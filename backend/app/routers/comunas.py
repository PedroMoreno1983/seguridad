"""
Router Comunas
==============
Endpoints para gestión y consulta de comunas.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.comuna import Comuna

router = APIRouter()


# ==========================================
# SCHEMAS
# ==========================================

class ComunaResponse(BaseModel):
    id: int
    codigo_ine: str
    nombre: str
    region: str
    provincia: str
    poblacion: Optional[int] = None
    superficie_km2: Optional[float] = None
    densidad_poblacional: Optional[float] = None
    centroid_lat: Optional[float] = None
    centroid_lon: Optional[float] = None

    class Config:
        from_attributes = True


class ComunaDetail(ComunaResponse):
    bbox: Optional[List[float]] = None


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/comunas", response_model=List[ComunaResponse])
async def listar_comunas(
    region: Optional[str] = Query(None, description="Filtrar por región"),
    buscar: Optional[str] = Query(None, description="Buscar por nombre"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Listar todas las comunas con filtros opcionales.
    
    - **region**: Filtrar por nombre de región
    - **buscar**: Búsqueda por nombre de comuna (contiene)
    - **limit**: Límite de resultados (default: 100, max: 500)
    - **offset**: Paginación
    """
    query = db.query(Comuna)
    
    if region:
        query = query.filter(Comuna.region.ilike(f"%{region}%"))
    
    if buscar:
        query = query.filter(Comuna.nombre.ilike(f"%{buscar}%"))
    
    comunas = query.offset(offset).limit(limit).all()
    
    return [c.to_dict() for c in comunas]


@router.get("/comunas/{comuna_id}", response_model=ComunaDetail)
async def obtener_comuna(
    comuna_id: int,
    incluir_bbox: bool = Query(False, description="Incluir bounding box"),
    db: Session = Depends(get_db)
):
    """
    Obtener detalle de una comuna específica.
    
    - **comuna_id**: ID numérico de la comuna
    - **incluir_bbox**: Si es true, incluye el bounding box geoespacial
    """
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")
    
    return comuna.to_dict(include_geom=incluir_bbox)


@router.get("/comunas/ine/{codigo_ine}", response_model=ComunaDetail)
async def obtener_comuna_por_ine(
    codigo_ine: str,
    incluir_bbox: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Obtener comuna por código INE (ej: 13114 para La Florida).
    
    - **codigo_ine**: Código INE de 5 dígitos
    """
    comuna = db.query(Comuna).filter(Comuna.codigo_ine == codigo_ine).first()
    
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")
    
    return comuna.to_dict(include_geom=incluir_bbox)


@router.get("/comunas/{comuna_id}/resumen")
async def resumen_comuna(
    comuna_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtener resumen completo de una comuna con estadísticas agregadas.
    """
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")
    
    # Conteos básicos
    total_delitos = len(comuna.delitos) if hasattr(comuna, 'delitos') else 0
    total_features = len(comuna.features) if hasattr(comuna, 'features') else 0
    
    # Tipos de delito más frecuentes
    tipos_delito = {}
    if hasattr(comuna, 'delitos'):
        for d in comuna.delitos:
            tipos_delito[d.tipo_delito] = tipos_delito.get(d.tipo_delito, 0) + 1
    
    top_delitos = sorted(tipos_delito.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "comuna": comuna.to_dict(),
        "estadisticas": {
            "total_delitos_registrados": total_delitos,
            "total_features_espaciales": total_features,
            "top_5_delitos": [{"tipo": t, "cantidad": c} for t, c in top_delitos],
        }
    }


@router.get("/regiones")
async def listar_regiones(db: Session = Depends(get_db)):
    """
    Listar todas las regiones disponibles con conteo de comunas.
    """
    from sqlalchemy import func
    
    resultados = db.query(
        Comuna.region,
        Comuna.codigo_region,
        func.count(Comuna.id).label("total_comunas")
    ).group_by(Comuna.region, Comuna.codigo_region).order_by(Comuna.codigo_region).all()
    
    return [
        {
            "nombre": r.region,
            "codigo": r.codigo_region,
            "total_comunas": r.total_comunas
        }
        for r in resultados
    ]
