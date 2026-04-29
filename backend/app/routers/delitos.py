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
from app.services.geospatial import (
    aggregate_weight,
    comuna_key,
    deterministic_offset,
    fallback_comuna_centroid,
    normalize_lat_lon,
    sector_centroid,
)
from app.services.taxonomy import canonical_types, incident_weight, normalize_count_rows, normalize_incident_type

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
    
    # Por tipo de delito, homologado a una taxonomia comun.
    tipos_raw = db.query(
        Delito.tipo_delito,
        func.count(Delito.id).label("cantidad")
    ).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    ).group_by(Delito.tipo_delito).order_by(func.count(Delito.id).desc()).all()
    tipos_normalizados = normalize_count_rows(
        (row.tipo_delito, row.cantidad) for row in tipos_raw
    )
    
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
        "por_tipo": {t["tipo"]: t["cantidad"] for t in tipos_normalizados},
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
    dias: int = Query(1400, ge=7, le=2000, description="Dias hacia atras"),
    db: Session = Depends(get_db)
):
    """
    Obtener datos formateados para mapa de calor.

    Si la fuente no trae coordenadas exactas, agrega por macrosector urbano
    conocido. Para Peñalolén se prioriza macrosector para no pintar el area
    cordillerana con puntos sinteticos.
    """
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        raise HTTPException(status_code=404, detail="Comuna no encontrada")

    fecha_max = db.query(func.max(Delito.fecha_hora)).filter(
        Delito.comuna_id == comuna_id
    ).scalar()

    if not fecha_max:
        return {
            "comuna_id": comuna_id,
            "total_puntos": 0,
            "dias": dias,
            "tipo": tipo or "todos",
            "puntos": [],
            "metadata": {
                "total_registros": 0,
                "registros_geocodificados": 0,
                "registros_sectorizados": 0,
                "modo": "sin_datos",
            },
        }

    fecha_inicio = fecha_max - timedelta(days=dias)

    query = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio,
    )

    total_registros = query.count()
    registros_geocodificados = query.filter(
        Delito.latitud.isnot(None),
        Delito.longitud.isnot(None),
    ).count()

    base_delitos = query.order_by(Delito.fecha_hora.desc()).limit(20000).all()
    geo_delitos = []
    if registros_geocodificados:
        geo_delitos = query.filter(
            Delito.latitud.isnot(None),
            Delito.longitud.isnot(None),
        ).order_by(Delito.fecha_hora.desc()).limit(5000).all()

    delitos = []
    seen_ids = set()
    for delito in [*geo_delitos, *base_delitos]:
        if delito.id in seen_ids:
            continue
        seen_ids.add(delito.id)
        delitos.append(delito)
    use_sector_first = comuna_key(comuna.nombre) == "penalolen"
    sector_buckets = {}
    comuna_buckets = {}
    puntos = []
    puntos_exactos = 0

    def add_comuna_bucket(delito, tipo_normalizado):
        current = comuna_buckets.setdefault(tipo_normalizado, {
            "tipo": tipo_normalizado,
            "tipo_raw": delito.tipo_delito,
            "count": 0,
            "fecha": delito.fecha_hora.strftime("%Y-%m-%d") if delito.fecha_hora else None,
            "weight": incident_weight(tipo_normalizado),
        })
        current["count"] += 1
        current["weight"] = max(current["weight"], incident_weight(tipo_normalizado))

    for d in delitos:
        tipo_normalizado = normalize_incident_type(d.tipo_delito)
        if tipo and tipo_normalizado != tipo:
            continue

        contexto = d.contexto if isinstance(d.contexto, dict) else {}
        centroid = sector_centroid(
            comuna.nombre,
            (
                d.barrio,
                d.direccion,
                d.cuadrante,
                d.descripcion,
                contexto.get("hoja"),
            ),
        )

        if centroid and (use_sector_first or not d.latitud or not d.longitud):
            lat, lon, sector = centroid
            bucket_key = (sector, tipo_normalizado)
            current = sector_buckets.setdefault(bucket_key, {
                "lat": lat,
                "lon": lon,
                "sector": sector,
                "tipo": tipo_normalizado,
                "tipo_raw": d.tipo_delito,
                "count": 0,
                "fecha": d.fecha_hora.strftime("%Y-%m-%d") if d.fecha_hora else None,
                "weight": incident_weight(tipo_normalizado),
            })
            current["count"] += 1
            current["weight"] = max(current["weight"], incident_weight(tipo_normalizado))
            continue

        if use_sector_first:
            add_comuna_bucket(d, tipo_normalizado)
            continue

        normalized_point = normalize_lat_lon(comuna.nombre, d.latitud, d.longitud)
        if normalized_point:
            latitud, longitud = normalized_point
            puntos.append({
                "lat": latitud,
                "lon": longitud,
                "intensity": incident_weight(tipo_normalizado),
                "tipo": tipo_normalizado,
                "tipo_raw": d.tipo_delito,
                "fecha": d.fecha_hora.strftime("%Y-%m-%d") if d.fecha_hora else None,
                "precision": "exacta",
            })
            puntos_exactos += 1
            if len(puntos) >= 5000:
                break
            continue

        add_comuna_bucket(d, tipo_normalizado)

    for (sector, tipo_normalizado), bucket in sector_buckets.items():
        offset_lat, offset_lon = deterministic_offset(f"{comuna_id}:{sector}:{tipo_normalizado}")
        puntos.append({
            "lat": float(bucket["lat"] + offset_lat),
            "lon": float(bucket["lon"] + offset_lon),
            "intensity": aggregate_weight(bucket["count"], bucket["weight"]),
            "tipo": bucket["tipo"],
            "tipo_raw": bucket["tipo_raw"],
            "fecha": bucket["fecha"],
            "sector": bucket["sector"],
            "count": bucket["count"],
            "precision": "sector",
        })
        if len(puntos) >= 5000:
            break

    if comuna_buckets and total_registros:
        center = fallback_comuna_centroid(comuna.nombre, comuna.centroid_lat, comuna.centroid_lon)
        if center:
            center_lat, center_lon = center
            for tipo_normalizado, bucket in comuna_buckets.items():
                offset_lat, offset_lon = deterministic_offset(f"{comuna_id}:comuna:{tipo_normalizado}", radius=0.003)
                puntos.append({
                    "lat": float(center_lat + offset_lat),
                    "lon": float(center_lon + offset_lon),
                    "intensity": aggregate_weight(bucket["count"], bucket["weight"]),
                    "tipo": bucket["tipo"],
                    "tipo_raw": bucket["tipo_raw"],
                    "fecha": bucket["fecha"],
                    "sector": comuna.nombre,
                    "count": bucket["count"],
                    "precision": "comuna",
                })
                if len(puntos) >= 5000:
                    break

    modo = "exacto"
    if (sector_buckets and puntos_exactos) or (sector_buckets and comuna_buckets) or (puntos_exactos and comuna_buckets):
        modo = "mixto"
    elif sector_buckets:
        modo = "sectorizado"
    elif comuna_buckets:
        modo = "comunal"
    elif not puntos and total_registros:
        modo = "sin_georreferenciacion"

    return {
        "comuna_id": comuna_id,
        "total_puntos": len(puntos),
        "dias": dias,
        "tipo": tipo or "todos",
        "periodo_desde": fecha_inicio.strftime("%Y-%m-%d"),
        "periodo_hasta": fecha_max.strftime("%Y-%m-%d"),
        "puntos": puntos,
        "metadata": {
            "total_registros": total_registros,
            "registros_geocodificados": registros_geocodificados,
            "registros_sectorizados": sum(bucket["count"] for bucket in sector_buckets.values()),
            "registros_comunales": sum(bucket["count"] for bucket in comuna_buckets.values()),
            "modo": modo,
            "nota": (
                "Puntos agregados por macrosector urbano; no representan direcciones exactas."
                if sector_buckets else
                "Puntos agregados a nivel comunal; no representan direcciones exactas."
                if comuna_buckets else None
            ),
        },
    }


@router.get("/delitos/heatmap-raw")
async def datos_heatmap_raw(
    comuna_id: int = Query(..., description="ID de la comuna"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    dias: int = Query(1400, ge=7, le=2000, description="Días hacia atrás"),
    db: Session = Depends(get_db)
):
    """
    Obtener datos formateados para mapa de calor (heatmap).
    Usa la fecha máxima de datos reales como referencia, no datetime.now().
    """
    # Usar fecha máxima de datos reales para no quedar sin resultados con datos históricos
    fecha_max = db.query(func.max(Delito.fecha_hora)).filter(
        Delito.comuna_id == comuna_id
    ).scalar()

    if not fecha_max:
        return {"comuna_id": comuna_id, "total_puntos": 0, "dias": dias, "tipo": tipo or "todos", "puntos": []}

    fecha_inicio = fecha_max - timedelta(days=dias)

    query = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio,
        Delito.latitud.isnot(None),
        Delito.longitud.isnot(None),
    )

    # Limitar a 5000 puntos para rendimiento del mapa
    delitos = query.order_by(Delito.fecha_hora.desc()).limit(8000).all()

    puntos = []
    for d in delitos:
        if d.latitud and d.longitud:
            tipo_normalizado = normalize_incident_type(d.tipo_delito)
            if tipo and tipo_normalizado != tipo:
                continue
            puntos.append({
                "lat": float(d.latitud),
                "lon": float(d.longitud),
                "intensity": incident_weight(tipo_normalizado),
                "tipo": tipo_normalizado,
                "tipo_raw": d.tipo_delito,
                "fecha": d.fecha_hora.strftime("%Y-%m-%d") if d.fecha_hora else None,
            })
            if len(puntos) >= 5000:
                break

    return {
        "comuna_id": comuna_id,
        "total_puntos": len(puntos),
        "dias": dias,
        "tipo": tipo or "todos",
        "periodo_desde": fecha_inicio.strftime("%Y-%m-%d"),
        "periodo_hasta": fecha_max.strftime("%Y-%m-%d"),
        "puntos": puntos,
    }


@router.get("/delitos/tipos")
async def tipos_delito(
    comuna_id: Optional[int] = Query(None, description="Filtrar por comuna")
):
    """
    Listar tipos de delito disponibles.
    """
    return {"tipos": canonical_types()}
