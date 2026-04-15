from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.reporte_ciudadano import ReporteCiudadano

router = APIRouter()

class ReporteRequest(BaseModel):
    comuna_id: int
    tipo_reporte: str
    descripcion: str
    nivel_gravedad: str
    latitud: float
    longitud: float

@router.get("/participacion", response_model=List[dict])
async def listar_reportes(
    comuna_id: int = Query(..., description="ID de la comuna"),
    db: Session = Depends(get_db)
):
    """Listar reportes ciudadanos."""
    try:
        reportes = db.query(ReporteCiudadano).filter(ReporteCiudadano.comuna_id == comuna_id).order_by(ReporteCiudadano.fecha.desc()).limit(100).all()
        return [r.to_dict() for r in reportes]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/participacion", response_model=dict)
async def crear_reporte(
    reporte: ReporteRequest,
    db: Session = Depends(get_db)
):
    """Crear un nuevo reporte ciudadano cualitativo."""
    try:
        nuevo = ReporteCiudadano(
            comuna_id=reporte.comuna_id,
            tipo_reporte=reporte.tipo_reporte,
            descripcion=reporte.descripcion,
            nivel_gravedad=reporte.nivel_gravedad,
            latitud=reporte.latitud,
            longitud=reporte.longitud,
            fecha=datetime.utcnow()
        )
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return nuevo.to_dict()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
