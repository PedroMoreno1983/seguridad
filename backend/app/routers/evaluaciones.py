from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.intervencion import Intervencion

router = APIRouter()

class EvaluacionCreate(BaseModel):
    comuna_id: int
    tipo: str
    descripcion: str
    reduccion_estimada: float # Percentage 0 to 100
    desplazamiento: str = "Bajo"

router = APIRouter()

@router.get("/evaluaciones", response_model=List[dict])
async def listar_evaluaciones(
    comuna_id: int = Query(..., description="ID de la comuna"),
    db: Session = Depends(get_db)
):
    """Listar todas las intervenciones/estrategias aplicadas en una comuna."""
    try:
        intervenciones = db.query(Intervencion).filter(Intervencion.comuna_id == comuna_id).order_by(Intervencion.fecha_inicio.desc()).all()
        return [i.to_dict() for i in intervenciones]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evaluaciones", response_model=dict)
async def crear_evaluacion(
    evaluacion: EvaluacionCreate,
    db: Session = Depends(get_db)
):
    """Crear una nueva evaluación/intervención manualmente."""
    try:
        nueva_intervencion = Intervencion(
            comuna_id=evaluacion.comuna_id,
            tipo=evaluacion.tipo,
            descripcion=evaluacion.descripcion,
            fecha_inicio=datetime.utcnow(),
            impacto_estimado={
                "reduccion_delitos_ratio": evaluacion.reduccion_estimada / 100.0,
                "desplazamiento_crimen": evaluacion.desplazamiento
            }
        )
        db.add(nueva_intervencion)
        db.commit()
        db.refresh(nueva_intervencion)
        return nueva_intervencion.to_dict()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
