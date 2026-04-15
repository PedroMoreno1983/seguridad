from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.intervencion import Intervencion

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
