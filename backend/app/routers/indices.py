"""
Router Índices de Seguridad
===========================
Endpoints para índices y rankings de seguridad.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.indice import IndiceSeguridad
from app.models.comuna import Comuna

router = APIRouter()


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/indices")
async def obtener_indices(
    comuna_id: int = Query(..., description="ID de la comuna"),
    fecha: Optional[str] = Query(None, description="Fecha específica (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Obtener índices de seguridad de una comuna.
    
    Si no se especifica fecha, retorna el más reciente.
    """
    query = db.query(IndiceSeguridad).filter(IndiceSeguridad.comuna_id == comuna_id)
    
    if fecha:
        try:
            from datetime import date as date_cls
            f = datetime.strptime(fecha, "%Y-%m-%d").date()
            query = query.filter(IndiceSeguridad.fecha == f)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    else:
        # Último disponible
        query = query.order_by(IndiceSeguridad.fecha.desc())
    
    indice = query.first()
    
    if not indice:
        raise HTTPException(status_code=404, detail="Índice no encontrado")
    
    return indice.to_dict()


@router.get("/indices/historico")
async def historico_indices(
    comuna_id: int = Query(..., description="ID de la comuna"),
    meses: int = Query(12, ge=1, le=60, description="Meses de historial"),
    db: Session = Depends(get_db)
):
    """
    Obtener serie histórica de índices de seguridad.
    """
    indices = db.query(IndiceSeguridad).filter(
        IndiceSeguridad.comuna_id == comuna_id
    ).order_by(IndiceSeguridad.fecha).all()
    
    return {
        "comuna_id": comuna_id,
        "total_registros": len(indices),
        "historial": [i.to_dict() for i in indices]
    }


@router.get("/indices/ranking")
async def ranking_comunas(
    region: Optional[str] = Query(None, description="Filtrar por región"),
    ordenar_por: str = Query("global", description="global, delictual, percepcion"),
    limite: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Ranking de comunas por nivel de seguridad.
    
    - **ordenar_por**: Criterio de ordenamiento
      - `global`: Índice global de seguridad (más alto = más seguro)
      - `delictual`: Tasa delictual (más bajo = más seguro)
      - `percepcion`: Índice de percepción ciudadana
    """
    # Subquery: índice más reciente por comuna
    from sqlalchemy import desc, asc
    
    subq = db.query(
        IndiceSeguridad.comuna_id,
        func.max(IndiceSeguridad.fecha).label("max_fecha")
    ).group_by(IndiceSeguridad.comuna_id).subquery()
    
    query = db.query(IndiceSeguridad, Comuna).join(
        Comuna, IndiceSeguridad.comuna_id == Comuna.id
    ).join(
        subq,
        (IndiceSeguridad.comuna_id == subq.c.comuna_id) &
        (IndiceSeguridad.fecha == subq.c.max_fecha)
    )
    
    if region:
        query = query.filter(Comuna.region.ilike(f"%{region}%"))
    
    # Ordenamiento
    if ordenar_por == "global":
        query = query.order_by(desc(IndiceSeguridad.indice_seguridad_global))
    elif ordenar_por == "delictual":
        query = query.order_by(asc(IndiceSeguridad.tasa_delictual))
    elif ordenar_por == "percepcion":
        query = query.order_by(desc(IndiceSeguridad.indice_percepcion))
    else:
        query = query.order_by(desc(IndiceSeguridad.indice_seguridad_global))
    
    resultados = query.limit(limite).all()
    
    ranking = []
    for i, (indice, comuna) in enumerate(resultados, 1):
        data = indice.to_dict()
        data["comuna"] = {
            "id": comuna.id,
            "nombre": comuna.nombre,
            "region": comuna.region,
            "codigo_ine": comuna.codigo_ine
        }
        data["posicion_ranking"] = i
        ranking.append(data)
    
    return {
        "ordenado_por": ordenar_por,
        "total": len(ranking),
        "ranking": ranking
    }


@router.get("/indices/comparativa")
async def comparativa_comunas(
    comunas: List[int] = Query(..., description="IDs de comunas a comparar (máx 5)"),
    db: Session = Depends(get_db)
):
    """
    Comparar índices entre múltiples comunas.
    """
    if len(comunas) > 5:
        raise HTTPException(status_code=400, detail="Máximo 5 comunas para comparar")
    
    # Obtener último índice de cada comuna
    resultados = []
    for comuna_id in comunas:
        comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
        if not comuna:
            continue
        
        indice = db.query(IndiceSeguridad).filter(
            IndiceSeguridad.comuna_id == comuna_id
        ).order_by(IndiceSeguridad.fecha.desc()).first()
        
        if indice:
            data = indice.to_dict()
            data["comuna"] = {
                "id": comuna.id,
                "nombre": comuna.nombre,
                "region": comuna.region
            }
            resultados.append(data)
    
    return {
        "comparativa": resultados,
        "metricas": {
            "mas_segura": max(resultados, key=lambda x: x["indices"]["global"])["comuna"]["nombre"] if resultados else None,
            "menor_tasa": min(resultados, key=lambda x: x["tasas"]["delictual"] or 999)["comuna"]["nombre"] if resultados else None,
        }
    }
