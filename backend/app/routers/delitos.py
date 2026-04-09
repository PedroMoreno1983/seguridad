"""
Router Delitos
==============
Endpoints para consulta y análisis de datos delictuales.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models.delito import Delito
from app.models.comuna import Comuna

router = APIRouter()


# ==========================================
# SCHEMAS
# ==========================================

class DelitoResponse(BaseModel):
    id: int
    tipo_delito: str
    subtipo: Optional[str]
    latitud: Optional[float]
    longitud: Optional[float]
    barrio: Optional[str]
    fecha_hora: Optional[str]
    fuente: str
    
    class Config:
        from_attributes = True


class EstadisticasResponse(BaseModel):
    comuna_id: int
    periodo: str
    total_delitos: int
    por_tipo: dict
    por_mes: List[dict]
    tendencia: str


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/delitos", response_model=List[DelitoResponse])
async def listar_delitos(
    comuna_id: Optional[int] = Query(None, description="Filtrar por comuna"),
    tipo: Optional[str] = Query(None, description="Tipo de delito"),
    fecha_desde: Optional[str] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Listar delitos con filtros.
    """
    query = db.query(Delito)
    
    if comuna_id:
        query = query.filter(Delito.comuna_id == comuna_id)
    
    if tipo:
        query = query.filter(Delito.tipo_delito.ilike(f"%{tipo}%"))
    
    if fecha_desde:
        try:
            desde = datetime.strptime(fecha_desde, "%Y-%m-%d")
            query = query.filter(Delito.fecha_hora >= desde)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato fecha_desde inválido (YYYY-MM-DD)")
    
    if fecha_hasta:
        try:
            hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d")
            query = query.filter(Delito.fecha_hora <= hasta)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato fecha_hasta inválido (YYYY-MM-DD)")
    
    query = query.order_by(Delito.fecha_hora.desc())
    delitos = query.offset(offset).limit(limit).all()
    
    return [d.to_dict() for d in delitos]


@router.get("/delitos/estadisticas")
async def estadisticas_delitos(
    comuna_id: int = Query(..., description="ID de la comuna"),
    periodo: str = Query("12m", description="Período: 1m, 3m, 6m, 12m, 24m"),
    db: Session = Depends(get_db)
):
    """
    Obtener estadísticas agregadas de delitos para una comuna.
    
    - **periodo**: 1m (1 mes), 3m, 6m, 12m (1 año), 24m (2 años)
    """
    # Validar comuna existe
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")
    
    # Calcular fecha de inicio
    meses = {"1m": 1, "3m": 3, "6m": 6, "12m": 12, "24m": 24}.get(periodo, 12)
    fecha_inicio = datetime.now() - timedelta(days=30 * meses)
    
    # Query base
    query = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    )
    
    total = query.count()
    
    # Por tipo de delito
    tipos = db.query(
        Delito.tipo_delito,
        func.count(Delito.id).label("cantidad")
    ).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    ).group_by(Delito.tipo_delito).order_by(func.count(Delito.id).desc()).all()
    
    # Por mes
    por_mes = db.query(
        extract('year', Delito.fecha_hora).label('anio'),
        extract('month', Delito.fecha_hora).label('mes'),
        func.count(Delito.id).label("cantidad")
    ).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    ).group_by('anio', 'mes').order_by('anio', 'mes').all()
    
    # Calcular tendencia (últimos 3 meses vs 3 meses anteriores)
    ahora = datetime.now()
    ultimos_3m = ahora - timedelta(days=90)
    anteriores_3m = ahora - timedelta(days=180)
    
    reciente = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= ultimos_3m
    ).count()
    
    previo = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= anteriores_3m,
        Delito.fecha_hora < ultimos_3m
    ).count()
    
    if previo == 0:
        tendencia = "estable"
    else:
        cambio = (reciente - previo) / previo
        if cambio < -0.1:
            tendencia = "bajando"
        elif cambio > 0.1:
            tendencia = "subiendo"
        else:
            tendencia = "estable"
    
    return {
        "comuna_id": comuna_id,
        "nombre_comuna": comuna.nombre,
        "periodo": periodo,
        "total_delitos": total,
        "por_tipo": {t.tipo_delito: t.cantidad for t in tipos},
        "por_mes": [
            {"anio": int(p.anio), "mes": int(p.mes), "cantidad": p.cantidad}
            for p in por_mes
        ],
        "tendencia": tendencia,
        "cambio_reciente": reciente - previo if previo > 0 else 0
    }


@router.get("/delitos/heatmap")
async def datos_heatmap(
    comuna_id: int = Query(..., description="ID de la comuna"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    dias: int = Query(365, ge=7, le=730, description="Días hacia atrás"),
    db: Session = Depends(get_db)
):
    """
    Obtener datos formateados para mapa de calor (heatmap).
    
    Retorna coordenadas ponderadas para visualización en Deck.gl o Mapbox.
    """
    fecha_inicio = datetime.now() - timedelta(days=dias)
    
    query = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio,
        Delito.latitud.isnot(None),
        Delito.longitud.isnot(None)
    )
    
    if tipo:
        query = query.filter(Delito.tipo_delito == tipo)
    
    delitos = query.all()
    
    # Formato para Deck.gl HeatmapLayer
    puntos = []
    for d in delitos:
        if d.latitud and d.longitud:
            puntos.append({
                "lat": d.latitud,
                "lon": d.longitud,
                "intensity": 1,
                "tipo": d.tipo_delito,
                "fecha": d.fecha_hora.isoformat() if d.fecha_hora else None
            })
    
    return {
        "comuna_id": comuna_id,
        "total_puntos": len(puntos),
        "dias": dias,
        "tipo": tipo or "todos",
        "puntos": puntos
    }


@router.get("/delitos/tipos")
async def tipos_delito(
    comuna_id: Optional[int] = Query(None, description="Filtrar por comuna")
):
    """
    Listar tipos de delito disponibles.
    """
    # Por ahora retornar lista estandarizada
    # En producción, esto vendría de la base de datos
    tipos = [
        "Robo violento",
        "Robo con intimidación",
        "Robo de vehículo",
        "Hurto",
        "Hurto de vehículo",
        "Lesiones",
        "Homicidio",
        "Violencia intrafamiliar",
        "Amenazas",
        "Daños",
        "Otros"
    ]
    
    return {"tipos": tipos}
