from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import logging

from app.database import get_db
from app.models.comuna import Comuna
from app.services.ai_reports import generar_reporte_ejecutivo

# Import models to ensure tables exist in some contexts although Comuna is already loaded
from typing import Optional

router = APIRouter(
    prefix="/reportes",
    tags=["reportes"]
)

logger = logging.getLogger(__name__)

@router.get("/ejecutivo")
def get_reporte_ejecutivo(
    comuna_id: int = Query(..., description="ID de la comuna"),
    modelo: str = Query("SEPP", description="Modelo predictivo usado"),
    db: Session = Depends(get_db)
):
    """
    Genera un reporte ejecutivo narrativo utilizando IA para una comuna.
    """
    # 1. Verificar si la comuna existe
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    # 2. Recopilar contexto (idealmente de métricas recientes de Predicciones/Evaluaciones)
    contexto = {
        "poblacion_estimada": comuna.poblacion if hasattr(comuna, 'poblacion') else "Desconocida",
        "superficie_km2": comuna.superficie_km2 if hasattr(comuna, 'superficie_km2') else "Desconocida",
        "eventos_recientes": "Implementación de luminarias LED en cuadrante norte (ficticio)",
        "tendencia": "Estable con leves alzas en fin de semana"
    }
    
    # Fake list of predictions since we don't calculate them on the fly for the report yet
    fake_predicciones = [1, 2, 3] # representa 3 hotspots
    
    # 3. Llamar al servicio IA
    texto_reporte = generar_reporte_ejecutivo(
        comuna_nombre=comuna.nombre,
        modelo=modelo,
        predicciones=fake_predicciones,
        contexto=contexto
    )
    
    return {
        "comuna_id": comuna.id,
        "comuna_nombre": comuna.nombre,
        "modelo_usado": modelo,
        "reporte_markdown": texto_reporte
    }
