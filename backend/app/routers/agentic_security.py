"""
Router Agentic Security
=======================
Control agÃ©ntico para convertir SafeCity en GaaS operativo:
diagnostica, propone acciones, exige confirmaciÃ³n y audita ejecuciones.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.prediccion import Prediccion
from app.models.prevencion import AlertaResponsable
from app.models.user import Usuario
from app.services.geospatial import is_within_urban_bounds

router = APIRouter()

GRID_SIZE = 0.003
MIN_USABLE_INCIDENTS = 50


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
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
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
    if not data_ready:
        findings.append("La comuna aun no cumple el minimo comercial para prediccion defensible.")

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

    if quality["score"] < 70:
        actions.append({
            "action_key": "audit_geocoding",
            "tool_name": "audit_geocoding",
            "title": "Auditar calidad de marcacion territorial",
            "description": "Registra brechas de georreferenciacion y deja recomendaciones antes de vender prediccion fina.",
            "risk_level": "bajo",
            "requires_approval": True,
            "preview": {
                "calidad": quality,
                "recomendaciones": [
                    "Subir direcciones/intersecciones para aumentar precision exacta.",
                    "Homologar sectores recurrentes y cuadrantes antes de generar nuevas marcas finas.",
                    "No usar centroides comunales para predicciones comerciales.",
                ],
            },
        })

    actions.append({
        "action_key": "create_operational_briefing",
        "tool_name": "create_operational_briefing",
        "title": "Emitir briefing operativo",
        "description": "Consolida el diagnostico del agente en una minuta corta para autoridad o equipo tecnico.",
        "risk_level": "bajo",
        "requires_approval": True,
        "preview": {
            "objetivo": objective,
            "hallazgos": findings,
            "resguardo": "Toda decision sensible requiere revision humana y registro de fundamento.",
        },
    })

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
        },
        "hallazgos": findings,
        "actions": actions,
        "map_overlays": {
            "zonas": [*prediction_overlays, *hotspot_overlays],
            "puntos": hotspots,
        },
    }


def _row_to_action(row: Any) -> dict[str, Any]:
    data = dict(row)
    for key in ("preview", "result"):
        if isinstance(data.get(key), str):
            data[key] = json.loads(data[key])
    return data


def _run_payload(db: Session, run_id: int) -> dict[str, Any]:
    run = db.execute(text("SELECT * FROM agent_runs WHERE id = :id"), {"id": run_id}).mappings().first()
    if not run:
        raise HTTPException(status_code=404, detail="Corrida agentica no encontrada")
    actions = db.execute(text(
        "SELECT * FROM agent_actions WHERE run_id = :run_id ORDER BY id ASC"
    ), {"run_id": run_id}).mappings().all()
    payload = dict(run)
    if isinstance(payload.get("summary"), str):
        payload["summary"] = json.loads(payload["summary"])
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

    if tool_name == "audit_geocoding":
        return {
            "auditoria": "registrada",
            "calidad": preview.get("calidad"),
            "proximo_paso": "Priorizar normalizacion de direcciones/sectores antes de prediccion fina.",
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


def _answer_question(db: Session, comuna_id: int, question: str) -> dict[str, Any]:
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
    run_row = db.execute(text("""
        INSERT INTO agent_runs (comuna_id, user_id, objective, status, summary)
        VALUES (:comuna_id, :user_id, :objective, 'planned', CAST(:summary AS JSONB))
        RETURNING id
    """), {
        "comuna_id": body.comuna_id,
        "user_id": user.id,
        "objective": body.objective,
        "summary": _json({key: value for key, value in plan.items() if key != "actions"}),
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
    return _run_payload(db, run_id)


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
            ELSE 'in_progress'
        END,
        updated_at = NOW()
        WHERE id = :run_id
    """), {"run_id": run_id, "action_id": action_id})
    db.commit()
    return _run_payload(db, run_id)
