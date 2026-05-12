"""
Router Prevencion
=================
Endpoints para riesgo social preventivo y alertas responsables.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.prevencion import AlertaResponsable, EducacionComunal

router = APIRouter()


class AlertaResponsableCreate(BaseModel):
    comuna_id: int
    origen: str = "SafeCity"
    categoria: str
    nivel_riesgo: str = Field("medio", pattern="^(bajo|medio|alto|critico)$")
    descripcion: str
    confianza: float = Field(0.0, ge=0, le=1)
    accion_sugerida: Optional[str] = None
    responsable: Optional[str] = None
    plazo_horas: int = Field(72, ge=1, le=720)
    criterios: dict = Field(default_factory=dict)


class AlertaResponsableUpdate(BaseModel):
    estado: Optional[str] = Field(None, pattern="^(pendiente|en_revision|derivada|descartada|cerrada)$")
    responsable: Optional[str] = None
    decision: Optional[str] = None
    accion_sugerida: Optional[str] = None
    criterios: Optional[dict] = None


class EducacionComunalUpsert(BaseModel):
    comuna_id: int
    anio: int = Field(..., ge=2000, le=2100)
    matricula_total: Optional[int] = None
    estudiantes_desvinculados: Optional[int] = None
    tasa_desvinculacion: Optional[float] = None
    estudiantes_revinculados: Optional[int] = None
    tasa_revinculacion: Optional[float] = None
    inasistencia_grave_pct: Optional[float] = None
    retiro_basica_pct: Optional[float] = None
    retiro_media_pct: Optional[float] = None
    fuente: str = "Mineduc / Centro de Estudios"
    metodologia: Optional[str] = None
    fecha_actualizacion: Optional[date] = None
    extra_data: dict = Field(default_factory=dict)


def _score_prevencion(educacion: dict, alertas_altas: int, tasa_delictual: Optional[float]) -> dict:
    score = 0.0
    score += (educacion.get("tasa_desvinculacion") or 0) * 14
    score += (educacion.get("inasistencia_grave_pct") or 0) * 1.15
    score += (educacion.get("retiro_media_pct") or 0) * 3
    score += alertas_altas * 7
    if tasa_delictual:
        score += min(18, tasa_delictual / 450)

    score = round(min(100, score), 1)
    if score >= 75:
        nivel = "critico"
    elif score >= 55:
        nivel = "alto"
    elif score >= 35:
        nivel = "medio"
    else:
        nivel = "bajo"

    return {"score": score, "nivel": nivel}


def _recomendaciones(score: dict, educacion: dict) -> list[dict]:
    recomendaciones = [
        {
            "tipo": "gobernanza",
            "titulo": "Revisar alerta con responsable humano",
            "detalle": "Toda senal predictiva debe quedar asociada a una decision, fundamento y plazo de revision.",
        },
        {
            "tipo": "prevencion",
            "titulo": "Coordinar mesa de seguridad y educacion",
            "detalle": "Cruzar asistencia, reportes ciudadanos y zonas de riesgo sin usar datos personales de estudiantes.",
        },
    ]
    if (educacion.get("inasistencia_grave_pct") or 0) >= 25:
        recomendaciones.append({
            "tipo": "territorial",
            "titulo": "Priorizar rutas y entornos escolares",
            "detalle": "Focalizar luminarias, patrullaje preventivo y mediacion comunitaria en horarios de entrada y salida.",
        })
    if score["nivel"] in {"alto", "critico"}:
        recomendaciones.append({
            "tipo": "auditoria",
            "titulo": "Activar bitacora de deber de gestion",
            "detalle": "Documentar por que se deriva, se observa o se descarta cada alerta relevante.",
        })
    return recomendaciones


@router.get("/prevencion/resumen")
async def resumen_prevencion(
    comuna_id: int = Query(..., description="ID de la comuna"),
    db: Session = Depends(get_db),
    _user=Depends(require_role("autoridad", "tecnico", "admin")),
):
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    educacion_row = db.query(EducacionComunal).filter(
        EducacionComunal.comuna_id == comuna_id
    ).order_by(EducacionComunal.anio.desc()).first()
    educacion = educacion_row.to_dict() if educacion_row else None

    alertas = db.query(AlertaResponsable).filter(
        AlertaResponsable.comuna_id == comuna_id
    ).order_by(AlertaResponsable.created_at.desc()).limit(20).all()
    alertas_data = [a.to_dict() for a in alertas]

    delitos_12m = db.query(Delito).filter(Delito.comuna_id == comuna_id).count()
    tasa_delictual = round((delitos_12m / comuna.poblacion * 100000), 1) if comuna.poblacion else None
    alertas_altas = sum(1 for a in alertas_data if a["nivel_riesgo"] in {"alto", "critico"})
    score = _score_prevencion(educacion, alertas_altas, tasa_delictual) if educacion else None

    return {
        "comuna": {
            "id": comuna.id,
            "nombre": comuna.nombre,
            "region": comuna.region,
            "poblacion": comuna.poblacion,
        },
        "educacion": educacion,
        "indice_prevencion_social": score,
        "alertas": alertas_data,
        "metricas": {
            "alertas_pendientes": sum(1 for a in alertas_data if a["estado"] == "pendiente"),
            "alertas_derivadas": sum(1 for a in alertas_data if a["estado"] == "derivada"),
            "tasa_delictual_100k": tasa_delictual,
            "total_incidentes_comunales": delitos_12m,
        },
        "recomendaciones": _recomendaciones(score, educacion) if educacion and score else [],
        "principios": [
            "La alerta no equivale a culpabilidad.",
            "Solo se muestran datos agregados por comuna o zona.",
            "Toda decision sensible requiere revision humana y registro auditable.",
        ],
    }


@router.get("/prevencion/educacion")
async def educacion_comunal(
    comuna_id: int = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(require_role("autoridad", "tecnico", "admin")),
):
    registros = db.query(EducacionComunal).filter(
        EducacionComunal.comuna_id == comuna_id
    ).order_by(EducacionComunal.anio.desc()).all()
    return [r.to_dict() for r in registros]


@router.post("/prevencion/educacion")
async def upsert_educacion_comunal(
    body: EducacionComunalUpsert,
    db: Session = Depends(get_db),
    _user=Depends(require_role("tecnico", "admin")),
):
    comuna = db.query(Comuna).filter(Comuna.id == body.comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    registro = db.query(EducacionComunal).filter(
        EducacionComunal.comuna_id == body.comuna_id,
        EducacionComunal.anio == body.anio,
    ).first()
    if not registro:
        registro = EducacionComunal(comuna_id=body.comuna_id, anio=body.anio)

    payload = body.model_dump(exclude={"comuna_id", "anio"}, exclude_unset=True)
    for key, value in payload.items():
        setattr(registro, key, value)
    if not registro.fecha_actualizacion:
        registro.fecha_actualizacion = date.today()

    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro.to_dict()


@router.get("/prevencion/alertas")
async def listar_alertas_responsables(
    comuna_id: int = Query(...),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_role("autoridad", "tecnico", "admin")),
):
    query = db.query(AlertaResponsable).filter(AlertaResponsable.comuna_id == comuna_id)
    if estado:
        query = query.filter(AlertaResponsable.estado == estado)
    alertas = query.order_by(AlertaResponsable.created_at.desc()).all()
    return [a.to_dict() for a in alertas]


@router.post("/prevencion/alertas")
async def crear_alerta_responsable(
    body: AlertaResponsableCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("autoridad", "tecnico", "admin")),
):
    comuna = db.query(Comuna).filter(Comuna.id == body.comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    alerta = AlertaResponsable(**body.model_dump())
    db.add(alerta)
    db.commit()
    db.refresh(alerta)
    return alerta.to_dict()


@router.patch("/prevencion/alertas/{alerta_id}")
async def actualizar_alerta_responsable(
    alerta_id: int,
    body: AlertaResponsableUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("autoridad", "tecnico", "admin")),
):
    alerta = db.query(AlertaResponsable).filter(AlertaResponsable.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(alerta, key, value)

    db.commit()
    db.refresh(alerta)
    return alerta.to_dict()
