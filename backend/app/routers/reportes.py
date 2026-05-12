from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.prediccion import Prediccion
from app.services.ai_reports import ReporteIANoDisponible, generar_reporte_ejecutivo

router = APIRouter(
    prefix="/reportes",
    tags=["reportes"],
)

logger = logging.getLogger(__name__)


@router.get("/ejecutivo")
def get_reporte_ejecutivo(
    comuna_id: int = Query(..., description="ID de la comuna"),
    modelo: str = Query("SEPP", description="Modelo predictivo usado"),
    db: Session = Depends(get_db),
    _user=Depends(require_role("autoridad", "tecnico", "admin")),
):
    """Genera un reporte ejecutivo narrativo utilizando datos operacionales reales."""
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    ahora = datetime.utcnow()
    predicciones_activas = db.query(Prediccion).filter(
        Prediccion.comuna_id == comuna_id,
        Prediccion.fecha_fin >= ahora,
    ).order_by(Prediccion.probabilidad.desc()).limit(20).all()

    total_incidentes = db.query(func.count(Delito.id)).filter(
        Delito.comuna_id == comuna_id,
    ).scalar() or 0
    fuentes = db.query(
        Delito.fuente,
        func.count(Delito.id).label("cantidad"),
    ).filter(
        Delito.comuna_id == comuna_id,
    ).group_by(Delito.fuente).all()

    contexto = {
        "poblacion_estimada": comuna.poblacion,
        "superficie_km2": comuna.superficie_km2,
        "total_incidentes_cargados": total_incidentes,
        "fuentes_operacionales": [
            {"fuente": fuente, "cantidad": cantidad}
            for fuente, cantidad in fuentes
        ],
    }

    try:
        texto_reporte = generar_reporte_ejecutivo(
            comuna_nombre=comuna.nombre,
            modelo=modelo,
            predicciones=[p.to_dict() for p in predicciones_activas],
            contexto=contexto,
        )
    except ReporteIANoDisponible as exc:
        logger.warning("Reporte ejecutivo no disponible: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "comuna_id": comuna.id,
        "comuna_nombre": comuna.nombre,
        "modelo_usado": modelo,
        "reporte_markdown": texto_reporte,
    }
