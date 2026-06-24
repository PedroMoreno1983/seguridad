"""
Router Agentic Security
=======================
Control agÃ©ntico para convertir SafeCity en GaaS operativo:
diagnostica, propone acciones, exige confirmaciÃ³n y audita ejecuciones.
"""

from __future__ import annotations

import json
import os
import sys
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import SessionLocal, get_db
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.intervencion import Intervencion
from app.models.prediccion import Prediccion
from app.models.prevencion import AlertaResponsable
from app.models.user import Usuario
from app.services.agentic_llm import AgentLLMUnavailable, generate_agent_answer
from app.services.geospatial import is_within_urban_bounds

router = APIRouter()
_scheduler_task: asyncio.Task | None = None

GRID_SIZE = 0.003
MIN_USABLE_INCIDENTS = 50
AGENT_VERSION = "gaas-v2-autopilot"
SAFE_AUTOPILOT_TOOLS = {
    "audit_geocoding",
    "create_operational_briefing",
    "monitor_prevention_queue",
    "audit_comuna_sources",
}
SENSITIVE_TOOLS = {
    "generate_prediction",
    "create_responsible_alert",
    "create_patrol_intervention",
    "ingest_comuna_sources",
}


class AgentRunRequest(BaseModel):
    comuna_id: int
    objective: str = Field(
        "Priorizar riesgo territorial, explicar marcas del mapa y proponer accion preventiva responsable",
        min_length=8,
        max_length=500,
    )


class AgentQuestionRequest(BaseModel):
    comuna_id: int
    question: str = Field(..., min_length=5, max_length=600)


class AgentAutopilotRequest(BaseModel):
    comuna_id: int
    objective: str = Field(
        "Monitorear riesgo territorial, ejecutar tareas seguras y dejar acciones sensibles listas para aprobacion",
        min_length=8,
        max_length=500,
    )
    execute_safe_actions: bool = True
    autonomy_level: str = Field("autopilot", pattern="^(supervised|autopilot)$")


class AgentMonitorRequest(BaseModel):
    comuna_ids: list[int] | None = None
    execute_safe_actions: bool = True
    limit: int = Field(10, ge=1, le=50)


class AgentRejectActionRequest(BaseModel):
    reason: str = Field(..., min_length=4, max_length=500)


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _ensure_agent_tables(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS agent_runs (
            id BIGSERIAL PRIMARY KEY,
            comuna_id INTEGER NOT NULL REFERENCES comunas(id),
            user_id INTEGER REFERENCES usuarios(id),
            objective TEXT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'planned',
            summary JSONB NOT NULL DEFAULT '{}'::jsonb,
            autonomy_level VARCHAR(30) NOT NULL DEFAULT 'supervised',
            agent_version VARCHAR(30) NOT NULL DEFAULT 'gaas-v1',
            reasoning_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
            last_observation JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    db.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS autonomy_level VARCHAR(30) NOT NULL DEFAULT 'supervised'"))
    db.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_version VARCHAR(30) NOT NULL DEFAULT 'gaas-v1'"))
    db.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS reasoning_trace JSONB NOT NULL DEFAULT '[]'::jsonb"))
    db.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS last_observation JSONB NOT NULL DEFAULT '{}'::jsonb"))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS agent_actions (
            id BIGSERIAL PRIMARY KEY,
            run_id BIGINT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
            action_key VARCHAR(80) NOT NULL,
            tool_name VARCHAR(80) NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            risk_level VARCHAR(20) NOT NULL DEFAULT 'medio',
            requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            preview JSONB NOT NULL DEFAULT '{}'::jsonb,
            result JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            executed_at TIMESTAMP
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_agent_runs_comuna ON agent_runs(comuna_id, created_at DESC)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_agent_actions_run ON agent_actions(run_id)"))
    db.commit()


def _bbox_for_cell(lat: float, lon: float, delta: float = GRID_SIZE) -> list[float]:
    return [
        round(lon - delta, 6),
        round(lat - delta, 6),
        round(lon + delta, 6),
        round(lat + delta, 6),
    ]


def _quality_snapshot(db: Session, comuna_id: int, dias: int = 730) -> dict[str, Any]:
    fecha_max = db.query(func.max(Delito.fecha_hora)).filter(Delito.comuna_id == comuna_id).scalar()
    if not fecha_max:
        return {
            "dias": dias,
            "total": 0,
            "exacta": 0,
            "sector": 0,
            "comuna": 0,
            "sin_senal": 0,
            "usable": 0,
            "score": 0.0,
            "periodo_desde": None,
            "periodo_hasta": None,
        }

    fecha_inicio = fecha_max - timedelta(days=dias)
    base = db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fecha_hora >= fecha_inicio)
    total = base.count()
    counts = {
        "exacta": base.filter(Delito.geocode_precision == "exacta").count(),
        "sector": base.filter(Delito.geocode_precision == "sector").count(),
        "comuna": base.filter(Delito.geocode_precision == "comuna").count(),
        "sin_senal": base.filter(Delito.geocode_precision == "sin_senal").count(),
    }
    usable = counts["exacta"] + counts["sector"]
    score = 0.0
    if total:
        score = ((counts["exacta"] + counts["sector"] * 0.65 + counts["comuna"] * 0.25) / total) * 100

    return {
        "dias": dias,
        "total": total,
        **counts,
        "usable": usable,
        "score": round(score, 1),
        "periodo_desde": fecha_inicio.strftime("%Y-%m-%d"),
        "periodo_hasta": fecha_max.strftime("%Y-%m-%d"),
    }


def _hotspots(db: Session, comuna: Comuna, limit: int = 8) -> list[dict[str, Any]]:
    raw = db.query(
        (func.round(Delito.latitud / GRID_SIZE) * GRID_SIZE).label("lat_cell"),
        (func.round(Delito.longitud / GRID_SIZE) * GRID_SIZE).label("lon_cell"),
        func.count(Delito.id).label("cnt"),
        func.max(Delito.fecha_hora).label("last_seen"),
    ).filter(
        Delito.comuna_id == comuna.id,
        Delito.latitud.isnot(None),
        Delito.longitud.isnot(None),
        Delito.geocode_precision.in_(["exacta", "sector"]),
    ).group_by("lat_cell", "lon_cell").order_by(func.count(Delito.id).desc()).limit(limit * 3).all()

    points = []
    max_count = max([int(item.cnt) for item in raw], default=1)
    fecha_max = db.query(func.max(Delito.fecha_hora)).filter(Delito.comuna_id == comuna.id).scalar()
    recent_start = fecha_max - timedelta(days=90) if fecha_max else None
    previous_start = fecha_max - timedelta(days=180) if fecha_max else None

    for item in raw:
        lat = float(item.lat_cell)
        lon = float(item.lon_cell)
        if not is_within_urban_bounds(comuna.nombre, lat, lon):
            continue

        cell_filter = [
            Delito.comuna_id == comuna.id,
            Delito.latitud >= lat - GRID_SIZE,
            Delito.latitud <= lat + GRID_SIZE,
            Delito.longitud >= lon - GRID_SIZE,
            Delito.longitud <= lon + GRID_SIZE,
            Delito.geocode_precision.in_(["exacta", "sector"]),
        ]
        top_type = db.query(
            Delito.tipo_delito,
            func.count(Delito.id).label("cnt"),
        ).filter(*cell_filter).group_by(Delito.tipo_delito).order_by(func.count(Delito.id).desc()).first()
        recent_count = 0
        previous_count = 0
        if recent_start:
            recent_count = db.query(func.count(Delito.id)).filter(*cell_filter, Delito.fecha_hora >= recent_start).scalar() or 0
        if recent_start and previous_start:
            previous_count = db.query(func.count(Delito.id)).filter(
                *cell_filter,
                Delito.fecha_hora >= previous_start,
                Delito.fecha_hora < recent_start,
            ).scalar() or 0
        trend_ratio = (recent_count + 1) / (previous_count + 1)
        trend = "alza" if trend_ratio >= 1.25 else "baja" if trend_ratio <= 0.75 else "estable"
        dominance = float(top_type.cnt) / max(int(item.cnt), 1) if top_type else 0.0
        intensity = round(min(1.0, (int(item.cnt) / max_count) * 0.62 + min(0.28, trend_ratio / 8) + dominance * 0.10), 3)

        points.append({
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "count": int(item.cnt),
            "recent_count": int(recent_count),
            "previous_count": int(previous_count),
            "trend": trend,
            "trend_ratio": round(trend_ratio, 2),
            "dominant_type": top_type.tipo_delito if top_type else "Sin clasificar",
            "dominant_share": round(dominance, 2),
            "intensity": intensity,
            "last_seen": item.last_seen.isoformat() if item.last_seen else None,
            "bbox": _bbox_for_cell(lat, lon),
        })
        if len(points) >= limit:
            break
    return sorted(points, key=lambda item: (item["intensity"], item["count"]), reverse=True)


def _prediction_overlays(db: Session, comuna: Comuna) -> list[dict[str, Any]]:
    ahora = datetime.utcnow()
    rows = db.query(Prediccion).filter(
        Prediccion.comuna_id == comuna.id,
        Prediccion.fecha_fin >= ahora,
    ).order_by(Prediccion.probabilidad.desc()).limit(8).all()
    overlays = []
    for row in rows:
        if not row.zona_bbox:
            continue
        overlays.append({
            "id": f"pred-{row.id}",
            "source": "prediccion",
            "label": f"{row.modelo} {row.nivel_riesgo}",
            "nivel": row.nivel_riesgo,
            "confidence": float(row.probabilidad or 0),
            "bbox": row.zona_bbox,
            "reason": "Prediccion activa confirmada y almacenada.",
        })
    return overlays


def _risk_level(probability: float) -> str:
    if probability >= 0.85:
        return "critico"
    if probability >= 0.70:
        return "alto"
    if probability >= 0.50:
        return "medio"
    return "bajo"


def _top_crime_types(db: Session, comuna_id: int, dias: int = 180, limit: int = 5) -> list[dict[str, Any]]:
    fecha_max = db.query(func.max(Delito.fecha_hora)).filter(Delito.comuna_id == comuna_id).scalar()
    if not fecha_max:
        return []
    fecha_inicio = fecha_max - timedelta(days=dias)
    rows = db.query(
        Delito.tipo_delito,
        func.count(Delito.id).label("cnt"),
    ).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio,
    ).group_by(Delito.tipo_delito).order_by(func.count(Delito.id).desc()).limit(limit).all()
    return [{"tipo": row.tipo_delito, "cantidad": int(row.cnt)} for row in rows]


def _temporal_summary(db: Session, comuna_id: int) -> dict[str, Any]:
    fecha_max = db.query(func.max(Delito.fecha_hora)).filter(Delito.comuna_id == comuna_id).scalar()
    if not fecha_max:
        return {"last_30": 0, "previous_30": 0, "trend": "sin_datos", "change_pct": 0}
    last_start = fecha_max - timedelta(days=30)
    previous_start = fecha_max - timedelta(days=60)
    last_30 = db.query(func.count(Delito.id)).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= last_start,
    ).scalar() or 0
    previous_30 = db.query(func.count(Delito.id)).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= previous_start,
        Delito.fecha_hora < last_start,
    ).scalar() or 0
    change_pct = round(((last_30 - previous_30) / previous_30) * 100, 1) if previous_30 else (100 if last_30 else 0)
    trend = "alza" if change_pct >= 10 else "baja" if change_pct <= -10 else "estable"
    return {
        "last_30": int(last_30),
        "previous_30": int(previous_30),
        "trend": trend,
        "change_pct": change_pct,
    }


def _normalize_for_match(value: str) -> str:
    try:
        data_ingestion_dir = Path(__file__).resolve().parents[2] / "data_ingestion"
        if str(data_ingestion_dir) not in sys.path:
            sys.path.insert(0, str(data_ingestion_dir))
        from comunas_config import normalize_text
        return normalize_text(value)
    except Exception:
        return " ".join(str(value or "").lower().strip().split())


def _comuna_sources_inventory(comuna_name: str) -> dict[str, Any]:
    try:
        data_ingestion_dir = Path(__file__).resolve().parents[2] / "data_ingestion"
        if str(data_ingestion_dir) not in sys.path:
            sys.path.insert(0, str(data_ingestion_dir))
        from comunas_config import (
            SUPPORTED_DOCUMENT_EXTENSIONS,
            SUPPORTED_EXCEL_EXTENSIONS,
            iter_supported_files,
            resolve_comuna_dir,
        )
        comuna_dir = resolve_comuna_dir(comuna_name)
        if not comuna_dir:
            return {
                "available": False,
                "comuna_dir": None,
                "excel_files": [],
                "document_files": [],
                "total_files": 0,
                "latest_file": None,
            }
        excel_files = iter_supported_files(comuna_dir, SUPPORTED_EXCEL_EXTENSIONS)
        document_files = iter_supported_files(comuna_dir, SUPPORTED_DOCUMENT_EXTENSIONS)
        all_files = [*excel_files, *document_files]
        latest = max(all_files, key=lambda path: path.stat().st_mtime, default=None)
        return {
            "available": True,
            "comuna_dir": str(comuna_dir),
            "excel_files": [
                {
                    "name": path.name,
                    "relative_path": str(path.relative_to(comuna_dir)),
                    "size": path.stat().st_size,
                    "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                }
                for path in excel_files
            ],
            "document_files": [
                {
                    "name": path.name,
                    "relative_path": str(path.relative_to(comuna_dir)),
                    "size": path.stat().st_size,
                    "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                }
                for path in document_files
            ],
            "total_files": len(all_files),
            "latest_file": latest.name if latest else None,
        }
    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
            "excel_files": [],
            "document_files": [],
            "total_files": 0,
            "latest_file": None,
        }


def _source_names_for_inventory(inventory: dict[str, Any]) -> set[str]:
    names = set()
    for key in ("excel_files", "document_files"):
        for item in inventory.get(key, []):
            name = item.get("name")
            if name:
                names.add(str(name))
    return names


def _absorbed_source_count(db: Session, comuna_id: int, inventory: dict[str, Any]) -> int:
    names = _source_names_for_inventory(inventory)
    if not names:
        return 0
    rows = db.query(Delito.contexto).filter(
        Delito.comuna_id == comuna_id,
        Delito.contexto.isnot(None),
    ).all()
    absorbed = set()
    for (contexto,) in rows:
        if isinstance(contexto, dict):
            archivo = contexto.get("archivo")
            if archivo in names:
                absorbed.add(archivo)
    return len(absorbed)


def _commercial_readiness(db: Session, comuna: Comuna, inventory: dict[str, Any]) -> dict[str, Any]:
    total = db.query(Delito).filter(Delito.comuna_id == comuna.id).count()
    usable = db.query(Delito).filter(
        Delito.comuna_id == comuna.id,
        Delito.geocode_precision.in_(["exacta", "sector"]),
    ).count()
    absorbed = _absorbed_source_count(db, comuna.id, inventory)
    source_files = inventory.get("total_files", 0)
    gaps = []
    if source_files and absorbed < source_files:
        gaps.append(f"{source_files - absorbed} archivos comunales disponibles aun no aparecen absorbidos en incidentes.")
    if total < 500:
        gaps.append("Menos de 500 incidentes cargados para prediccion robusta.")
    if usable < MIN_USABLE_INCIDENTS:
        gaps.append("Menos de 50 registros exactos/sectoriales para mapas defendibles.")
    return {
        "estado": "listo_comercial" if not gaps else "requiere_accion",
        "incidentes_total": total,
        "incidentes_usables": usable,
        "archivos_disponibles": source_files,
        "archivos_absorbidos": absorbed,
        "brechas": gaps,
    }


def _agent_memory(db: Session, comuna_id: int, limit: int = 5) -> dict[str, Any]:
    try:
        rows = db.execute(text("""
            SELECT
                r.id,
                r.objective,
                r.status,
                r.autonomy_level,
                r.created_at,
                COUNT(a.id) AS total_actions,
                COUNT(a.id) FILTER (WHERE a.status = 'executed') AS executed_actions,
                COUNT(a.id) FILTER (WHERE a.status = 'pending' AND a.requires_approval = TRUE) AS pending_sensitive_actions,
                COUNT(a.id) FILTER (WHERE a.status = 'failed') AS failed_actions
            FROM agent_runs r
            LEFT JOIN agent_actions a ON a.run_id = r.id
            WHERE r.comuna_id = :comuna_id
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT :limit
        """), {"comuna_id": comuna_id, "limit": limit}).mappings().all()
    except Exception:
        rows = []

    runs = []
    for row in rows:
        data = dict(row)
        runs.append({
            "id": int(data["id"]),
            "objective": data["objective"],
            "status": data["status"],
            "autonomy_level": data.get("autonomy_level") or "supervised",
            "created_at": data["created_at"].isoformat() if data["created_at"] else None,
            "total_actions": int(data["total_actions"] or 0),
            "executed_actions": int(data["executed_actions"] or 0),
            "pending_sensitive_actions": int(data["pending_sensitive_actions"] or 0),
            "failed_actions": int(data["failed_actions"] or 0),
        })

    return {
        "recent_runs": runs,
        "last_run": runs[0] if runs else None,
        "learning": (
            "El agente conserva trazabilidad por comuna: observa calidad, zonas, acciones ejecutadas "
            "y bloqueos pendientes para no operar como pantalla aislada."
        ),
    }


def _build_plan(db: Session, comuna_id: int, objective: str) -> dict[str, Any]:
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    quality = _quality_snapshot(db, comuna_id)
    hotspots = _hotspots(db, comuna)
    active_predictions = db.query(Prediccion).filter(
        Prediccion.comuna_id == comuna_id,
        Prediccion.fecha_fin >= datetime.utcnow(),
    ).count()

    hotspot_overlays = []
    for idx, h in enumerate(hotspots[:5], start=1):
        confidence = round(min(0.95, max(0.35, h["intensity"])), 3)
        hotspot_overlays.append({
            "id": f"agent-hotspot-{idx}",
            "source": "agente",
            "label": f"Prioridad operativa {idx}",
            "nivel": _risk_level(confidence),
            "confidence": confidence,
            "bbox": h["bbox"],
            "center": {"lat": h["lat"], "lon": h["lon"]},
            "reason": f"{h['count']} incidentes; tendencia {h['trend']}; tipo dominante: {h['dominant_type']}.",
            "metrics": {
                "incidentes": h["count"],
                "ultimos_90_dias": h["recent_count"],
                "periodo_previo": h["previous_count"],
                "tendencia": h["trend"],
                "tipo_dominante": h["dominant_type"],
                "concentracion_tipo": h["dominant_share"],
                "intensidad": h["intensity"],
            },
        })

    prediction_overlays = _prediction_overlays(db, comuna)
    top_types = _top_crime_types(db, comuna_id)
    temporal = _temporal_summary(db, comuna_id)
    memory = _agent_memory(db, comuna_id)
    source_inventory = _comuna_sources_inventory(comuna.nombre)
    readiness = _commercial_readiness(db, comuna, source_inventory)
    pending_alerts = db.query(AlertaResponsable).filter(
        AlertaResponsable.comuna_id == comuna_id,
        AlertaResponsable.estado.in_(["pendiente", "en_revision"]),
    ).count()
    data_ready = quality["usable"] >= MIN_USABLE_INCIDENTS and len(hotspots) >= 3
    score = min(100, round((quality["score"] * 0.55) + min(45, quality["usable"] / 12), 1))
    estado = "operativo" if data_ready and score >= 60 else "requiere_datos" if quality["total"] else "sin_datos"

    findings = [
        f"{quality['usable']} registros exactos/sectoriales utilizables para analisis territorial.",
        f"Calidad georreferencial {quality['score']}% en ventana de {quality['dias']} dias.",
        f"{active_predictions} predicciones activas disponibles para el mapa.",
        f"Tendencia 30 dias: {temporal['trend']} ({temporal['change_pct']}% vs periodo previo).",
    ]
    if hotspots:
        findings.append(
            f"Hotspot principal: {hotspots[0]['count']} incidentes, tendencia {hotspots[0]['trend']} y tipo dominante {hotspots[0]['dominant_type']}."
        )
    if top_types:
        findings.append(f"Tipo mas frecuente reciente: {top_types[0]['tipo']} ({top_types[0]['cantidad']} registros).")
    findings.append(f"{pending_alerts} alertas preventivas abiertas o en revision para seguimiento operativo.")
    if source_inventory.get("available"):
        findings.append(
            f"Repositorio comunal detectado: {source_inventory['total_files']} archivos fuente; "
            f"{readiness['archivos_absorbidos']} ya absorbidos como evidencia operacional."
        )
    if not data_ready:
        findings.append("La comuna aun no cumple el minimo comercial para prediccion defensible.")

    objective_norm = _normalize_for_match(objective)
    force_source_ingestion = any(
        token in objective_norm
        for token in (
            "ingestar",
            "reingestar",
            "recargar",
            "reprocesar",
            "reemplazo",
            "fuentes comunales",
            "bases comunales",
        )
    )

    actions: list[dict[str, Any]] = []
    if data_ready:
        actions.append({
            "action_key": "generate_prediction",
            "tool_name": "generate_prediction",
            "title": "Generar prediccion territorial 72h",
            "description": "Crea hasta 5 zonas de riesgo desde hotspots georreferenciados y las deja visibles en el mapa.",
            "risk_level": "medio",
            "requires_approval": True,
            "preview": {
                "comuna_id": comuna_id,
                "modelo": "AgentHotspot",
                "horizonte_horas": 72,
                "zonas_estimadas": len(hotspot_overlays),
                "criterio": "score compuesto: volumen historico, tendencia reciente, tipo dominante y limites urbanos operativos",
                "overlays": hotspot_overlays,
                "top_tipos": top_types,
                "tendencia": temporal,
            },
        })

    if source_inventory.get("available") and (
        force_source_ingestion or readiness["archivos_disponibles"] > readiness["archivos_absorbidos"]
    ):
        actions.append({
            "action_key": "ingest_comuna_sources",
            "tool_name": "ingest_comuna_sources",
            "title": "Ingerir bases comunales disponibles",
            "description": "Carga archivos Excel/PDF de la carpeta comunal usando la tuberia existente y actualiza la base operacional.",
            "risk_level": "medio",
            "requires_approval": True,
            "preview": {
                "comuna_id": comuna_id,
                "comuna_nombre": comuna.nombre,
                "inventario": source_inventory,
                "readiness": readiness,
                "forzada_por_objetivo": force_source_ingestion,
            },
        })

    if hotspots:
        top = hotspot_overlays[0]
        actions.append({
            "action_key": "create_responsible_alert",
            "tool_name": "create_responsible_alert",
            "title": "Crear alerta preventiva responsable",
            "description": "Abre una alerta auditable para revision humana, sin identificar personas ni inferir culpabilidad.",
            "risk_level": top["nivel"],
            "requires_approval": True,
            "preview": {
                "comuna_id": comuna_id,
                "categoria": "focalizacion_territorial",
                "nivel_riesgo": top["nivel"],
                "confianza": top["confidence"],
                "zona": top,
                "accion_sugerida": "Revisar patrullaje preventivo, luminarias, comercio local y coordinacion vecinal en la zona priorizada.",
            },
        })
        actions.append({
            "action_key": "create_patrol_intervention",
            "tool_name": "create_patrol_intervention",
            "title": "Planificar patrullaje preventivo en zona prioritaria",
            "description": "Crea una intervencion operativa auditada con zona, fundamento y ventana de seguimiento.",
            "risk_level": top["nivel"],
            "requires_approval": True,
            "preview": {
                "comuna_id": comuna_id,
                "tipo": "Patrullaje preventivo agentico",
                "zona": top,
                "descripcion": "Patrullaje preventivo focalizado por evidencia territorial agregada.",
                "plazo_horas": 72,
                "impacto_estimado": {
                    "base": "hotspot, tendencia, tipo dominante y calidad geo",
                    "objetivo": "reducir concentracion territorial sin focalizar personas",
                },
            },
        })

    if quality["score"] < 70:
        actions.append({
            "action_key": "audit_geocoding",
            "tool_name": "audit_geocoding",
            "title": "Auditar calidad de marcacion territorial",
            "description": "Registra brechas de georreferenciacion y deja recomendaciones antes de vender prediccion fina.",
            "risk_level": "bajo",
            "requires_approval": False,
            "preview": {
                "comuna_id": comuna_id,
                "calidad": quality,
                "recomendaciones": [
                    "Subir direcciones/intersecciones para aumentar precision exacta.",
                    "Homologar sectores recurrentes y cuadrantes antes de generar nuevas marcas finas.",
                    "No usar centroides comunales para predicciones comerciales.",
                ],
            },
        })

    actions.append({
        "action_key": "monitor_prevention_queue",
        "tool_name": "monitor_prevention_queue",
        "title": "Monitorear cola preventiva",
        "description": "Revisa alertas abiertas, detecta deuda operativa y deja un resumen para seguimiento.",
        "risk_level": "bajo",
        "requires_approval": False,
        "preview": {
            "comuna_id": comuna_id,
            "alertas_abiertas": pending_alerts,
            "criterios": [
                "Escalar si existen alertas criticas sin decision.",
                "Cerrar loop solo cuando haya decision y fundamento.",
                "No crear actuaciones sensibles sin aprobacion humana.",
            ],
        },
    })

    actions.append({
        "action_key": "audit_comuna_sources",
        "tool_name": "audit_comuna_sources",
        "title": "Auditar bases comunales detectadas",
        "description": "Contrasta archivos disponibles versus evidencia ya absorbida y brechas comerciales.",
        "risk_level": "bajo",
        "requires_approval": False,
        "preview": {
            "comuna_id": comuna_id,
            "comuna_nombre": comuna.nombre,
            "inventario": source_inventory,
            "readiness": readiness,
        },
    })

    actions.append({
        "action_key": "create_operational_briefing",
        "tool_name": "create_operational_briefing",
        "title": "Emitir briefing operativo",
        "description": "Consolida el diagnostico del agente en una minuta corta para autoridad o equipo tecnico.",
        "risk_level": "bajo",
        "requires_approval": False,
        "preview": {
            "comuna_id": comuna_id,
            "objetivo": objective,
            "hallazgos": findings,
            "resguardo": "Toda decision sensible requiere revision humana y registro de fundamento.",
        },
    })

    auto_count = sum(1 for action in actions if not action["requires_approval"])
    reasoning_trace = [
        {
            "step": "observar",
            "detail": f"Lee {quality['total']} registros, {quality['usable']} usables y {len(hotspots)} hotspots filtrados por limites urbanos.",
        },
        {
            "step": "evaluar",
            "detail": f"Combina calidad geo {quality['score']}%, tendencia {temporal['trend']} y score operacional {score}%.",
        },
        {
            "step": "planificar",
            "detail": f"Propone {len(actions)} acciones: {auto_count} automaticas seguras y {len(actions) - auto_count} sensibles con aprobacion.",
        },
        {
            "step": "gobernar",
            "detail": "Mantiene trazabilidad por run, preview, resultado y estado para auditoria posterior.",
        },
    ]

    return {
        "comuna": {"id": comuna.id, "nombre": comuna.nombre, "region": comuna.region},
        "objective": objective,
        "estado_operacional": estado,
        "score_operacional": score,
        "metricas": {
            "calidad_georreferencial": quality,
            "hotspots_detectados": len(hotspots),
            "predicciones_activas": active_predictions,
            "top_tipos": top_types,
            "tendencia_temporal": temporal,
            "alertas_abiertas": pending_alerts,
            "readiness_comercial": readiness,
            "fuentes_comunales": source_inventory,
        },
        "hallazgos": findings,
        "actions": actions,
        "map_overlays": {
            "zonas": [*prediction_overlays, *hotspot_overlays],
            "puntos": hotspots,
        },
        "autonomy": {
            "level": "autopilot",
            "agent_version": AGENT_VERSION,
            "safe_tools": sorted(SAFE_AUTOPILOT_TOOLS),
            "sensitive_tools": sorted(SENSITIVE_TOOLS),
            "auto_executable_actions": auto_count,
            "approval_required_actions": len(actions) - auto_count,
        },
        "agent_memory": memory,
        "reasoning_trace": reasoning_trace,
    }


def _row_to_action(row: Any) -> dict[str, Any]:
    data = dict(row)
    for key in ("preview", "result"):
        if isinstance(data.get(key), str):
            data[key] = json.loads(data[key])
    return data


def _insert_agent_run(
    db: Session,
    comuna_id: int,
    objective: str,
    plan: dict[str, Any],
    user: Usuario,
    autonomy_level: str,
) -> int:
    summary = {key: value for key, value in plan.items() if key != "actions"}
    observation = {
        "estado_operacional": plan.get("estado_operacional"),
        "score_operacional": plan.get("score_operacional"),
        "metricas": plan.get("metricas", {}),
    }
    run_row = db.execute(text("""
        INSERT INTO agent_runs (
            comuna_id, user_id, objective, status, summary, autonomy_level,
            agent_version, reasoning_trace, last_observation
        )
        VALUES (
            :comuna_id, :user_id, :objective, 'planned', CAST(:summary AS JSONB),
            :autonomy_level, :agent_version, CAST(:reasoning_trace AS JSONB),
            CAST(:last_observation AS JSONB)
        )
        RETURNING id
    """), {
        "comuna_id": comuna_id,
        "user_id": user.id,
        "objective": objective,
        "summary": _json(summary),
        "autonomy_level": autonomy_level,
        "agent_version": AGENT_VERSION,
        "reasoning_trace": _json(plan.get("reasoning_trace", [])),
        "last_observation": _json(observation),
    }).mappings().first()
    run_id = int(run_row["id"])

    for action in plan["actions"]:
        db.execute(text("""
            INSERT INTO agent_actions (
                run_id, action_key, tool_name, title, description, risk_level,
                requires_approval, status, preview
            )
            VALUES (
                :run_id, :action_key, :tool_name, :title, :description, :risk_level,
                :requires_approval, 'pending', CAST(:preview AS JSONB)
            )
        """), {
            "run_id": run_id,
            "action_key": action["action_key"],
            "tool_name": action["tool_name"],
            "title": action["title"],
            "description": action["description"],
            "risk_level": action["risk_level"],
            "requires_approval": action["requires_approval"],
            "preview": _json(action["preview"]),
        })
    db.commit()
    return run_id


def _run_payload(db: Session, run_id: int) -> dict[str, Any]:
    run = db.execute(text("SELECT * FROM agent_runs WHERE id = :id"), {"id": run_id}).mappings().first()
    if not run:
        raise HTTPException(status_code=404, detail="Corrida agentica no encontrada")
    actions = db.execute(text(
        "SELECT * FROM agent_actions WHERE run_id = :run_id ORDER BY id ASC"
    ), {"run_id": run_id}).mappings().all()
    payload = dict(run)
    for key in ("summary", "reasoning_trace", "last_observation"):
        if isinstance(payload.get(key), str):
            payload[key] = json.loads(payload[key])
    payload["actions"] = [_row_to_action(a) for a in actions]
    return payload


def _generate_predictions(db: Session, comuna_id: int) -> dict[str, Any]:
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")
    hotspots = _hotspots(db, comuna, limit=5)
    usable = _quality_snapshot(db, comuna_id)["usable"]
    if usable < MIN_USABLE_INCIDENTS or len(hotspots) < 3:
        raise HTTPException(status_code=422, detail="Datos insuficientes para generar prediccion agentica defendible")

    ahora = datetime.utcnow()
    fecha_fin = ahora + timedelta(hours=72)
    db.query(Prediccion).filter(
        Prediccion.comuna_id == comuna_id,
        Prediccion.fecha_fin >= ahora,
        Prediccion.horizonte_horas == 72,
    ).update({"fecha_fin": ahora}, synchronize_session=False)

    created = []
    for h in hotspots:
        probability = round(min(0.95, max(0.35, h["intensity"])), 3)
        pred = Prediccion(
            comuna_id=comuna_id,
            modelo="AgentHotspot",
            version_modelo="gaas-v1",
            zona_bbox=h["bbox"],
            centro_lat=h["lat"],
            centro_lon=h["lon"],
            nivel_riesgo=_risk_level(probability),
            probabilidad=probability,
            fecha_inicio=ahora,
            fecha_fin=fecha_fin,
            horizonte_horas=72,
            precision_historica=0.65,
            features_utilizados={
                "generated_by": "agentic_security",
                "incidentes_historicos": h["count"],
                "incidentes_90d": h["recent_count"],
                "periodo_previo_90d": h["previous_count"],
                "tendencia": h["trend"],
                "tipo_dominante": h["dominant_type"],
                "concentracion_tipo": h["dominant_share"],
                "intensidad_agentica": h["intensity"],
                "criterio": "score compuesto: volumen historico, tendencia reciente, tipo dominante y limites urbanos",
            },
        )
        db.add(pred)
        created.append(pred)

    db.commit()
    for pred in created:
        db.refresh(pred)
    return {
        "total_predicciones": len(created),
        "predicciones": [p.to_dict() for p in created],
    }


def _execute_tool(db: Session, action: dict[str, Any], user: Usuario) -> dict[str, Any]:
    preview = action.get("preview") or {}
    tool_name = action["tool_name"]
    comuna_id = preview.get("comuna_id") or _run_payload(db, action["run_id"])["comuna_id"]

    if tool_name == "generate_prediction":
        return _generate_predictions(db, int(comuna_id))

    if tool_name == "create_responsible_alert":
        alerta = AlertaResponsable(
            comuna_id=int(comuna_id),
            origen="Agente GaaS",
            categoria=preview.get("categoria", "focalizacion_territorial"),
            nivel_riesgo=preview.get("nivel_riesgo", "medio"),
            descripcion=f"Alerta generada por agente y aprobada por {user.email}. {preview.get('zona', {}).get('reason', '')}",
            confianza=preview.get("confianza", 0.0),
            accion_sugerida=preview.get("accion_sugerida"),
            responsable=user.nombre,
            plazo_horas=72,
            criterios={"agent_preview": preview},
        )
        db.add(alerta)
        db.commit()
        db.refresh(alerta)
        return {"alerta": alerta.to_dict()}

    if tool_name == "create_patrol_intervention":
        zona = preview.get("zona") or {}
        center = zona.get("center") or {}
        intervencion = Intervencion(
            comuna_id=int(comuna_id),
            tipo=preview.get("tipo", "Patrullaje preventivo agentico"),
            descripcion=preview.get("descripcion", "Intervencion propuesta por agente SafeCity."),
            fecha_inicio=datetime.utcnow(),
            fecha_fin=datetime.utcnow() + timedelta(hours=int(preview.get("plazo_horas", 72))),
            zona_bbox=zona.get("bbox"),
            centro_lat=center.get("lat"),
            centro_lon=center.get("lon"),
            impacto_estimado={
                **(preview.get("impacto_estimado") or {}),
                "agent_preview": preview,
                "aprobado_por": user.email,
            },
        )
        db.add(intervencion)
        db.commit()
        db.refresh(intervencion)
        return {"intervencion": intervencion.to_dict()}

    if tool_name == "audit_geocoding":
        return {
            "auditoria": "registrada",
            "calidad": preview.get("calidad"),
            "proximo_paso": "Priorizar normalizacion de direcciones/sectores antes de prediccion fina.",
        }

    if tool_name == "audit_comuna_sources":
        comuna = db.query(Comuna).filter(Comuna.id == int(comuna_id)).first()
        inventory = _comuna_sources_inventory(comuna.nombre if comuna else preview.get("comuna_nombre", ""))
        readiness = _commercial_readiness(db, comuna, inventory) if comuna else preview.get("readiness")
        return {
            "auditoria": "fuentes_comunales",
            "inventario": inventory,
            "readiness": readiness,
            "decision_agentica": (
                "ingerir fuentes pendientes"
                if readiness and readiness.get("archivos_disponibles", 0) > readiness.get("archivos_absorbidos", 0)
                else "mantener monitoreo"
            ),
        }

    if tool_name == "ingest_comuna_sources":
        comuna_nombre = preview.get("comuna_nombre")
        if not comuna_nombre:
            comuna = db.query(Comuna).filter(Comuna.id == int(comuna_id)).first()
            comuna_nombre = comuna.nombre if comuna else None
        if not comuna_nombre:
            raise HTTPException(status_code=400, detail="No se pudo determinar la comuna para ingesta")
        data_ingestion_dir = Path(__file__).resolve().parents[2] / "data_ingestion"
        if str(data_ingestion_dir) not in sys.path:
            sys.path.insert(0, str(data_ingestion_dir))
        from orchestrator import run_ingestion
        before = db.query(Delito).filter(Delito.comuna_id == int(comuna_id)).count()
        result_code = run_ingestion(comuna_filter=str(comuna_nombre), include_excel=True, include_docs=True)
        db.expire_all()
        after = db.query(Delito).filter(Delito.comuna_id == int(comuna_id)).count()
        return {
            "ingesta": "completada" if result_code == 0 else "fallida",
            "codigo_resultado": result_code,
            "comuna": comuna_nombre,
            "incidentes_antes": before,
            "incidentes_despues": after,
            "incidentes_nuevos_netos": after - before,
            "inventario": _comuna_sources_inventory(str(comuna_nombre)),
        }

    if tool_name == "monitor_prevention_queue":
        abiertas = db.query(AlertaResponsable).filter(
            AlertaResponsable.comuna_id == int(comuna_id),
            AlertaResponsable.estado.in_(["pendiente", "en_revision"]),
        ).count()
        criticas = db.query(AlertaResponsable).filter(
            AlertaResponsable.comuna_id == int(comuna_id),
            AlertaResponsable.estado.in_(["pendiente", "en_revision"]),
            AlertaResponsable.nivel_riesgo.in_(["alto", "critico"]),
        ).count()
        return {
            "monitor": "actualizado",
            "alertas_abiertas": abiertas,
            "alertas_altas_o_criticas": criticas,
            "decision_agentica": (
                "mantener seguimiento" if criticas == 0
                else "requiere revision humana prioritaria"
            ),
        }

    if tool_name == "create_operational_briefing":
        return {
            "briefing": {
                "titulo": "Briefing operativo SafeCity GaaS",
                "hallazgos": preview.get("hallazgos", []),
                "resguardo": preview.get("resguardo"),
                "aprobado_por": user.email,
            }
        }

    raise HTTPException(status_code=400, detail=f"Herramienta no soportada: {tool_name}")


def _execute_safe_actions(db: Session, run_id: int, user: Usuario) -> dict[str, Any]:
    run = _run_payload(db, run_id)
    executed = []
    failed = []

    for action in run["actions"]:
        is_safe = (
            action.get("status") == "pending"
            and action.get("tool_name") in SAFE_AUTOPILOT_TOOLS
            and (not action.get("requires_approval") or action.get("risk_level") == "bajo")
        )
        if not is_safe:
            continue
        try:
            result = _execute_tool(db, action, user)
            db.execute(text("""
                UPDATE agent_actions
                SET status = 'executed', result = CAST(:result AS JSONB), executed_at = NOW()
                WHERE id = :action_id
            """), {"action_id": action["id"], "result": _json(result)})
            executed.append({"id": action["id"], "tool_name": action["tool_name"]})
        except Exception as exc:
            db.execute(text("""
                UPDATE agent_actions
                SET status = 'failed', result = CAST(:result AS JSONB), executed_at = NOW()
                WHERE id = :action_id
            """), {
                "action_id": action["id"],
                "result": _json({"error": str(exc), "autopilot": True}),
            })
            failed.append({"id": action["id"], "tool_name": action["tool_name"], "error": str(exc)})

    pending = db.execute(text("""
        SELECT COUNT(*) AS total
        FROM agent_actions
        WHERE run_id = :run_id AND status = 'pending'
    """), {"run_id": run_id}).mappings().first()
    status = "completed" if int(pending["total"] or 0) == 0 else "waiting_approval"
    db.execute(text("""
        UPDATE agent_runs
        SET status = :status, updated_at = NOW()
        WHERE id = :run_id
    """), {"run_id": run_id, "status": status})
    db.commit()

    return {
        "executed": executed,
        "failed": failed,
        "pending_actions": int(pending["total"] or 0),
        "run_status": status,
    }


def _system_agent_user() -> Any:
    return SimpleNamespace(
        id=None,
        email="agente@safecity.local",
        nombre="Agente SafeCity",
        rol="sistema",
    )


def _eligible_monitor_comunas(db: Session, comuna_ids: list[int] | None, limit: int) -> list[Comuna]:
    query = db.query(Comuna)
    if comuna_ids:
        query = query.filter(Comuna.id.in_(comuna_ids))
    return query.order_by(Comuna.nombre.asc()).limit(limit).all()


def _run_monitor_cycle(
    db: Session,
    user: Any,
    comuna_ids: list[int] | None = None,
    execute_safe_actions: bool = True,
    limit: int = 10,
) -> dict[str, Any]:
    _ensure_agent_tables(db)
    results = []
    for comuna in _eligible_monitor_comunas(db, comuna_ids, limit):
        objective = (
            "Monitoreo continuo: revisar fuentes comunales, brechas de datos, riesgo territorial "
            "y ejecutar tareas seguras de seguimiento."
        )
        plan = _build_plan(db, comuna.id, objective)
        run_id = _insert_agent_run(db, comuna.id, objective, plan, user, "autopilot")
        autopilot = {"executed": [], "failed": [], "pending_actions": len(plan["actions"]), "run_status": "planned"}
        if execute_safe_actions:
            autopilot = _execute_safe_actions(db, run_id, user)
        payload = _run_payload(db, run_id)
        results.append({
            "comuna_id": comuna.id,
            "comuna": comuna.nombre,
            "run_id": run_id,
            "status": payload["status"],
            "autopilot": autopilot,
            "approval_required": [
                {
                    "id": action.get("id"),
                    "title": action.get("title"),
                    "tool_name": action.get("tool_name"),
                    "risk_level": action.get("risk_level"),
                }
                for action in payload["actions"]
                if action.get("status") == "pending" and action.get("requires_approval")
            ],
        })
    return {
        "executed_at": datetime.utcnow().isoformat(),
        "total_comunas": len(results),
        "results": results,
    }


async def _scheduler_loop() -> None:
    interval = int(os.getenv("SAFECITY_AGENT_INTERVAL_SECONDS", "3600"))
    limit = int(os.getenv("SAFECITY_AGENT_MONITOR_LIMIT", "10"))
    await asyncio.sleep(5)
    while True:
        db = SessionLocal()
        try:
            _run_monitor_cycle(
                db,
                _system_agent_user(),
                comuna_ids=None,
                execute_safe_actions=True,
                limit=limit,
            )
        except Exception as exc:
            print(f"Agente SafeCity scheduler error: {exc}")
        finally:
            db.close()
        await asyncio.sleep(max(60, interval))


def start_agent_scheduler() -> None:
    global _scheduler_task
    if os.getenv("SAFECITY_AGENT_SCHEDULER", "").lower() not in {"1", "true", "yes"}:
        return
    if _scheduler_task and not _scheduler_task.done():
        return
    try:
        _scheduler_task = asyncio.create_task(_scheduler_loop())
    except RuntimeError:
        _scheduler_task = None


async def stop_agent_scheduler() -> None:
    global _scheduler_task
    if not _scheduler_task:
        return
    _scheduler_task.cancel()
    try:
        await _scheduler_task
    except asyncio.CancelledError:
        pass
    _scheduler_task = None


def _answer_question_legacy(db: Session, comuna_id: int, question: str) -> dict[str, Any]:
    plan = _build_plan(db, comuna_id, question)
    quality = plan["metricas"]["calidad_georreferencial"]
    temporal = plan["metricas"].get("tendencia_temporal") or {}
    top_types = plan["metricas"].get("top_tipos") or []
    zones = plan["map_overlays"]["zonas"]
    points = plan["map_overlays"]["puntos"]
    question_norm = question.lower()

    focus = points[0] if points else None
    bullets = [
        f"Estado operacional: {plan['estado_operacional']} con score {plan['score_operacional']}%.",
        f"Base territorial: {quality['usable']} registros utilizables de {quality['total']} totales; calidad geo {quality['score']}%.",
        f"Tendencia reciente: {temporal.get('trend', 'sin_datos')} ({temporal.get('change_pct', 0)}% vs 30 dias previos).",
    ]
    if top_types:
        bullets.append(f"Principal tipo reciente: {top_types[0]['tipo']} ({top_types[0]['cantidad']} registros en ventana analitica).")
    if focus:
        bullets.append(
            f"Zona prioritaria: {focus['count']} incidentes, {focus['recent_count']} en ultimos 90 dias, tendencia {focus['trend']} y tipo dominante {focus['dominant_type']}."
        )

    if "por que" in question_norm or "por qué" in question_norm or "explica" in question_norm:
        answer = (
            "La priorizacion se explica por un score compuesto: volumen historico, comportamiento reciente, "
            "dominancia del tipo delictual y filtro urbano. No se usa un centroide comunal como evidencia fina."
        )
    elif "mapa" in question_norm or "zona" in question_norm or "cuadrante" in question_norm:
        answer = (
            "El mapa debe mostrar calor historico, predicciones activas y zonas propuestas por el agente. "
            "La capa agentica marca prioridades operativas con bbox, confianza y razon trazable."
        )
    elif "hacer" in question_norm or "accion" in question_norm or "priori" in question_norm:
        answer = (
            "La accion recomendada es revisar la zona prioritaria con patrullaje preventivo, luminarias, comercio local "
            "y coordinacion vecinal. Si la autoridad aprueba, el agente puede generar prediccion 72h y alerta responsable."
        )
    else:
        answer = (
            "El diagnostico indica si la comuna esta lista para operacion predictiva y que zonas requieren revision. "
            "La respuesta se basa solo en incidentes georreferenciados, predicciones activas y calidad de datos."
        )

    recommended_actions = [
        action["title"]
        for action in plan["actions"]
        if action.get("requires_approval")
    ]

    return {
        "question": question,
        "answer": answer,
        "bullets": bullets,
        "evidence": {
            "quality": quality,
            "temporal": temporal,
            "top_types": top_types,
            "zones": zones[:5],
            "points": points[:5],
        },
        "map_focus": zones[0] if zones else None,
        "recommended_actions": recommended_actions,
        "guardrail": "Orientacion operacional: toda decision sensible requiere revision humana, proporcionalidad y registro del fundamento.",
    }


def _answer_question_fallback(plan: dict[str, Any], question: str) -> dict[str, Any]:
    quality = plan["metricas"]["calidad_georreferencial"]
    temporal = plan["metricas"].get("tendencia_temporal") or {}
    top_types = plan["metricas"].get("top_tipos") or []
    readiness = plan["metricas"].get("readiness_comercial") or {}
    sources = plan["metricas"].get("fuentes_comunales") or {}
    pending_alerts = plan["metricas"].get("alertas_abiertas", 0)
    zones = plan["map_overlays"]["zonas"]
    points = plan["map_overlays"]["puntos"]
    memory = plan.get("agent_memory") or {}
    question_norm = _normalize_for_match(question)
    focus = points[0] if points else None

    topic_keywords = {
        "calidad": ("calidad", "datos", "georreferencia", "geocod", "precision", "confiable", "defendible"),
        "mapa": ("mapa", "zona", "hotspot", "cuadrante", "sector", "territorio", "marca", "bbox"),
        "accion": ("hacer", "accion", "priori", "patrull", "alerta", "intervencion", "aprobar", "ejecutar"),
        "prediccion": ("predic", "riesgo", "72", "modelo", "probabilidad", "pronost"),
        "fuentes": ("fuente", "archivo", "base", "ingesta", "excel", "pdf", "documento"),
        "alertas": ("alerta", "cola", "seguimiento", "pendiente", "revision"),
        "tendencia": ("tendencia", "sube", "baja", "mes", "temporal", "cuando", "hora"),
        "comercial": ("comercial", "vender", "produccion", "listo", "brecha", "falta"),
        "memoria": ("memoria", "historial", "corrida", "run", "audit", "bitacora"),
    }
    topics = {
        topic
        for topic, keywords in topic_keywords.items()
        if any(keyword in question_norm for keyword in keywords)
    }
    if not topics:
        topics = {"calidad", "mapa", "accion", "comercial"}

    bullets = [
        f"Estado operacional: {plan['estado_operacional']} con score {plan['score_operacional']}%.",
        f"Base territorial: {quality['usable']} registros utilizables de {quality['total']} totales; calidad geo {quality['score']}%.",
        f"Tendencia reciente: {temporal.get('trend', 'sin_datos')} ({temporal.get('change_pct', 0)}% vs 30 dias previos).",
    ]
    if top_types:
        bullets.append(f"Principal tipo reciente: {top_types[0]['tipo']} ({top_types[0]['cantidad']} registros en ventana analitica).")
    if focus:
        bullets.append(
            f"Zona prioritaria: {focus['count']} incidentes, {focus['recent_count']} en ultimos 90 dias, tendencia {focus['trend']} y tipo dominante {focus['dominant_type']}."
        )
    if "fuentes" in topics or "comercial" in topics:
        bullets.append(
            f"Fuentes comunales: {readiness.get('archivos_absorbidos', 0)}/{readiness.get('archivos_disponibles', sources.get('total_files', 0))} archivos absorbidos."
        )
    if "alertas" in topics or "accion" in topics:
        bullets.append(f"Seguimiento preventivo: {pending_alerts} alertas abiertas o en revision.")
    if readiness.get("brechas") and ("comercial" in topics or "fuentes" in topics):
        bullets.extend([f"Brecha: {gap}" for gap in readiness.get("brechas", [])[:3]])

    answer_parts = []
    if "calidad" in topics:
        if quality["usable"] >= MIN_USABLE_INCIDENTS:
            answer_parts.append(
                f"La base es utilizable para analisis territorial: hay {quality['usable']} registros exactos/sectoriales y calidad geo {quality['score']}%."
            )
        else:
            answer_parts.append(
                f"No conviene prometer prediccion fina todavia: solo hay {quality['usable']} registros exactos/sectoriales y el minimo defendible es {MIN_USABLE_INCIDENTS}."
            )
    if "mapa" in topics:
        if focus:
            answer_parts.append(
                f"El mapa debe priorizar la zona de mayor concentracion observada: {focus['count']} incidentes, tendencia {focus['trend']} y tipo dominante {focus['dominant_type']}."
            )
        else:
            answer_parts.append("No hay hotspot territorial suficiente; el agente debe mostrar brecha de datos antes de marcar zonas operativas.")
    if "prediccion" in topics:
        active_predictions = plan["metricas"].get("predicciones_activas", 0)
        answer_parts.append(
            f"Hay {active_predictions} predicciones activas. Si la comuna cumple datos minimos, el agente deja nuevas predicciones 72h como accion sensible para aprobacion."
        )
    if "fuentes" in topics:
        if sources.get("available"):
            answer_parts.append(
                f"Detecte repositorio comunal con {sources.get('total_files', 0)} archivos; audito e ingiero solo con aprobacion cuando haya fuentes pendientes."
            )
        else:
            answer_parts.append("No encontre carpeta/fuentes comunales disponibles para esta comuna; la accion correcta es cargar o conectar fuentes antes de ampliar cobertura.")
    if "alertas" in topics:
        answer_parts.append(
            f"La cola preventiva tiene {pending_alerts} alertas abiertas o en revision; el agente puede monitorearlas automaticamente y escalar las criticas."
        )
    if "tendencia" in topics:
        answer_parts.append(
            f"La tendencia reciente esta {temporal.get('trend', 'sin_datos')} con cambio {temporal.get('change_pct', 0)}% contra los 30 dias previos."
        )
    if "comercial" in topics:
        estado = readiness.get("estado", "sin_estado")
        if estado == "listo_comercial" and plan["estado_operacional"] == "operativo":
            answer_parts.append("Comercialmente esta defendible: datos suficientes, zonas trazables y acciones sensibles bajo aprobacion humana.")
        else:
            answer_parts.append("Para cierre comercial faltan las brechas listadas por el agente; no debe venderse como prediccion fina donde la evidencia no alcanza.")
    if "memoria" in topics:
        last_run = memory.get("last_run")
        if last_run:
            answer_parts.append(
                f"La ultima corrida registrada fue #{last_run.get('id')} en estado {last_run.get('status')}, con {last_run.get('executed_actions')} acciones ejecutadas."
            )
        else:
            answer_parts.append("Todavia no hay corridas previas para esta comuna; la primera corrida creara memoria auditable.")

    if not answer_parts:
        answer_parts.append(
            "Puedo responder con la evidencia disponible: calidad georreferencial, hotspots, tendencia, predicciones, fuentes, alertas, acciones y memoria de corridas."
        )

    recommended_actions = [
        f"{action['title']} ({'requiere aprobacion' if action.get('requires_approval') else 'ejecutable por autopiloto seguro'})"
        for action in plan["actions"]
    ]

    return {
        "question": question,
        "answer": " ".join(answer_parts),
        "bullets": bullets,
        "evidence": {
            "quality": quality,
            "temporal": temporal,
            "top_types": top_types,
            "readiness": readiness,
            "sources": sources,
            "agent_memory": memory,
            "zones": zones[:5],
            "points": points[:5],
        },
        "map_focus": zones[0] if zones else None,
        "recommended_actions": recommended_actions,
        "guardrail": (
            "Respuesta autonoma basada en evidencia disponible. Si una materia no esta en datos, el agente la declara como brecha "
            "y propone la siguiente accion auditable; no inventa hechos, personas ni culpabilidades."
        ),
        "answer_source": "rule_engine",
        "llm_status": "not_used",
        "llm_model": None,
        "confidence": None,
        "limitations": [],
        "follow_up_questions": [],
    }


def _answer_question(db: Session, comuna_id: int, question: str) -> dict[str, Any]:
    plan = _build_plan(db, comuna_id, question)
    fallback = _answer_question_fallback(plan, question)

    try:
        llm_answer = generate_agent_answer(question, plan)
    except AgentLLMUnavailable as exc:
        fallback["llm_status"] = "unavailable"
        fallback["llm_error"] = str(exc)
        return fallback

    bullets = llm_answer.get("bullets") or fallback["bullets"]
    guardrail = (
        "Respuesta generada con IA sobre evidencia operacional cerrada. Si una materia no esta en datos, "
        "el agente debe declararla como brecha y proponer la siguiente accion auditable; no inventa hechos, "
        "personas ni culpabilidades."
    )

    return {
        **fallback,
        "answer": llm_answer["answer"],
        "bullets": bullets,
        "guardrail": guardrail,
        "answer_source": "gemini",
        "llm_status": "generated",
        "llm_model": llm_answer.get("model"),
        "confidence": llm_answer.get("confidence"),
        "limitations": llm_answer.get("limitations") or [],
        "follow_up_questions": llm_answer.get("follow_up_questions") or [],
    }


@router.get("/agentic/status")
async def agentic_status(
    comuna_id: int = Query(...),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    return _build_plan(db, comuna_id, "Diagnostico continuo del agente")


@router.get("/agentic/runs")
async def list_agent_runs(
    comuna_id: int = Query(...),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    rows = db.execute(text("""
        SELECT id FROM agent_runs
        WHERE comuna_id = :comuna_id
        ORDER BY created_at DESC
        LIMIT :limit
    """), {"comuna_id": comuna_id, "limit": limit}).mappings().all()
    return [_run_payload(db, int(row["id"])) for row in rows]


@router.post("/agentic/runs")
async def create_agent_run(
    body: AgentRunRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    plan = _build_plan(db, body.comuna_id, body.objective)
    run_id = _insert_agent_run(db, body.comuna_id, body.objective, plan, user, "supervised")
    return _run_payload(db, run_id)


@router.post("/agentic/autopilot")
async def run_agentic_autopilot(
    body: AgentAutopilotRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    plan = _build_plan(db, body.comuna_id, body.objective)
    run_id = _insert_agent_run(db, body.comuna_id, body.objective, plan, user, body.autonomy_level)
    autopilot = {"executed": [], "failed": [], "pending_actions": len(plan["actions"]), "run_status": "planned"}
    if body.execute_safe_actions:
        autopilot = _execute_safe_actions(db, run_id, user)
    payload = _run_payload(db, run_id)
    payload["autopilot"] = autopilot
    return payload


@router.post("/agentic/monitor")
async def run_agentic_monitor(
    body: AgentMonitorRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    return _run_monitor_cycle(
        db,
        user,
        comuna_ids=body.comuna_ids,
        execute_safe_actions=body.execute_safe_actions,
        limit=body.limit,
    )


@router.post("/agentic/ask")
async def ask_agentic_security(
    body: AgentQuestionRequest,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    return _answer_question(db, body.comuna_id, body.question)


@router.post("/agentic/runs/{run_id}/actions/{action_id}/approve")
async def approve_agent_action(
    run_id: int,
    action_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    action = db.execute(text("""
        SELECT * FROM agent_actions
        WHERE id = :action_id AND run_id = :run_id
    """), {"action_id": action_id, "run_id": run_id}).mappings().first()
    if not action:
        raise HTTPException(status_code=404, detail="Accion agentica no encontrada")
    action_payload = _row_to_action(action)
    if action_payload["status"] != "pending":
        raise HTTPException(status_code=409, detail="La accion ya fue procesada")

    result = _execute_tool(db, action_payload, user)
    db.execute(text("""
        UPDATE agent_actions
        SET status = 'executed', result = CAST(:result AS JSONB), executed_at = NOW()
        WHERE id = :action_id
    """), {"action_id": action_id, "result": _json(result)})
    db.execute(text("""
        UPDATE agent_runs
        SET status = CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM agent_actions
                WHERE run_id = :run_id AND id <> :action_id AND status = 'pending'
            ) THEN 'completed'
            ELSE 'waiting_approval'
        END,
        updated_at = NOW()
        WHERE id = :run_id
    """), {"run_id": run_id, "action_id": action_id})
    db.commit()
    return _run_payload(db, run_id)


@router.post("/agentic/runs/{run_id}/actions/{action_id}/reject")
async def reject_agent_action(
    run_id: int,
    action_id: int,
    body: AgentRejectActionRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("autoridad", "tecnico", "admin")),
):
    _ensure_agent_tables(db)
    action = db.execute(text("""
        SELECT * FROM agent_actions
        WHERE id = :action_id AND run_id = :run_id
    """), {"action_id": action_id, "run_id": run_id}).mappings().first()
    if not action:
        raise HTTPException(status_code=404, detail="Accion agentica no encontrada")
    action_payload = _row_to_action(action)
    if action_payload["status"] != "pending":
        raise HTTPException(status_code=409, detail="La accion ya fue procesada")

    result = {
        "rejected_by": user.email,
        "reason": body.reason,
        "rejected_at": datetime.utcnow().isoformat(),
    }
    db.execute(text("""
        UPDATE agent_actions
        SET status = 'rejected', result = CAST(:result AS JSONB), executed_at = NOW()
        WHERE id = :action_id
    """), {"action_id": action_id, "result": _json(result)})
    db.execute(text("""
        UPDATE agent_runs
        SET status = CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM agent_actions
                WHERE run_id = :run_id AND id <> :action_id AND status = 'pending'
            ) THEN 'completed'
            ELSE 'waiting_approval'
        END,
        updated_at = NOW()
        WHERE id = :run_id
    """), {"run_id": run_id, "action_id": action_id})
    db.commit()
    return _run_payload(db, run_id)
