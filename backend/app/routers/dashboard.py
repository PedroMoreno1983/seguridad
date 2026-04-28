"""
Router Dashboard
================
Endpoints para datos agregados del dashboard.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.indice import IndiceSeguridad
from app.services.taxonomy import coverage_level, normalize_count_rows

router = APIRouter()


@router.get("/dashboard/resumen")
async def dashboard_resumen(
    comuna_id: int = Query(..., description="ID de la comuna"),
    db: Session = Depends(get_db)
):
    """
    Obtener resumen completo para el dashboard de una comuna.
    
    Incluye:
    - Datos de la comuna
    - Índices de seguridad
    - Estadísticas de delitos
    - Tendencias
    - Comparativas
    """
    comuna = db.query(Comuna).filter(Comuna.id == comuna_id).first()
    if not comuna:
        return {"error": "Comuna no encontrada"}
    
    # Último índice
    indice = db.query(IndiceSeguridad).filter(
        IndiceSeguridad.comuna_id == comuna_id
    ).order_by(IndiceSeguridad.fecha.desc()).first()
    
    # Usar la fecha máxima de datos reales como referencia (no datetime.now())
    # Esto evita que con datos históricos (2021-2025) el dashboard muestre el período equivocado
    fecha_max_result = db.query(func.max(Delito.fecha_hora)).filter(
        Delito.comuna_id == comuna_id
    ).scalar()

    fecha_referencia = fecha_max_result if fecha_max_result else datetime.now()
    fecha_inicio = fecha_referencia - timedelta(days=365)

    total_delitos = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    ).count()

    # Por tipo, homologado a una taxonomia comun entre municipalidades.
    tipos_raw = db.query(
        Delito.tipo_delito,
        func.count(Delito.id).label("cantidad")
    ).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    ).group_by(Delito.tipo_delito).all()

    tipos_normalizados = normalize_count_rows(
        (row.tipo_delito, row.cantidad) for row in tipos_raw
    )

    # Por mes (últimos 12 meses basado en datos reales)
    meses = db.query(
        extract('year', Delito.fecha_hora).label('anio'),
        extract('month', Delito.fecha_hora).label('mes'),
        func.count(Delito.id).label("cantidad")
    ).filter(
        Delito.comuna_id == comuna_id,
        Delito.fecha_hora >= fecha_inicio
    ).group_by('anio', 'mes').order_by('anio', 'mes').all()

    # Tendencia: usar el mes más reciente con datos vs el anterior
    mes_actual = int(fecha_referencia.month)
    anio_actual = int(fecha_referencia.year)

    delitos_mes_actual = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        extract('year', Delito.fecha_hora) == anio_actual,
        extract('month', Delito.fecha_hora) == mes_actual
    ).count()

    # Mes anterior
    if mes_actual == 1:
        mes_ant = 12
        anio_ant = anio_actual - 1
    else:
        mes_ant = mes_actual - 1
        anio_ant = anio_actual

    delitos_mes_anterior = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        extract('year', Delito.fecha_hora) == anio_ant,
        extract('month', Delito.fecha_hora) == mes_ant
    ).count()

    total_registros = db.query(Delito).filter(Delito.comuna_id == comuna_id).count()
    registros_geocodificados = db.query(Delito).filter(
        Delito.comuna_id == comuna_id,
        Delito.latitud.isnot(None),
        Delito.longitud.isnot(None)
    ).count()
    fuentes = db.query(
        Delito.fuente,
        func.count(Delito.id).label("cantidad")
    ).filter(
        Delito.comuna_id == comuna_id
    ).group_by(Delito.fuente).order_by(func.count(Delito.id).desc()).all()
    tipos_distintos = db.query(func.count(func.distinct(Delito.tipo_delito))).filter(
        Delito.comuna_id == comuna_id
    ).scalar() or 0
    fecha_min_result = db.query(func.min(Delito.fecha_hora)).filter(
        Delito.comuna_id == comuna_id
    ).scalar()
    
    if delitos_mes_anterior > 0:
        cambio_mensual = ((delitos_mes_actual - delitos_mes_anterior) / delitos_mes_anterior) * 100
    else:
        cambio_mensual = 0
    
    return {
        "comuna": {
            "id": comuna.id,
            "nombre": comuna.nombre,
            "region": comuna.region,
            "poblacion": comuna.poblacion,
            "superficie_km2": float(comuna.superficie_km2) if comuna.superficie_km2 else None,
        },
        "indice_seguridad": indice.to_dict() if indice else None,
        "estadisticas_delitos": {
            "total_ultimos_12m": total_delitos,
            "tasa_100k": round((total_delitos / comuna.poblacion * 100000), 1) if comuna.poblacion else None,
            "top_5_tipos": tipos_normalizados[:5],
            "evolucion_mensual": [
                {"anio": int(m.anio), "mes": int(m.mes), "cantidad": m.cantidad}
                for m in meses
            ],
            "periodo": {
                "desde": fecha_inicio.strftime("%Y-%m") if fecha_inicio else None,
                "hasta": fecha_referencia.strftime("%Y-%m") if fecha_referencia else None,
            }
        },
        "tendencias": {
            "cambio_mensual_porcentaje": round(cambio_mensual, 1),
            "direccion": "subiendo" if cambio_mensual > 5 else "bajando" if cambio_mensual < -5 else "estable",
            "delitos_mes_actual": delitos_mes_actual,
            "delitos_mes_anterior": delitos_mes_anterior,
        },
        "kpi": {
            "indice_global": float(indice.indice_seguridad_global) if indice and indice.indice_seguridad_global else None,
            "ranking_nacional": indice.ranking_nacional if indice else None,
            "tendencia_anual": indice.tendencia if indice else None,
        },
        "calidad_datos": {
            "nivel_cobertura": coverage_level(total_registros, registros_geocodificados),
            "total_registros": total_registros,
            "registros_geocodificados": registros_geocodificados,
            "porcentaje_geocodificado": round((registros_geocodificados / total_registros * 100), 1) if total_registros else 0,
            "tipos_raw_distintos": int(tipos_distintos),
            "fuentes": [{"fuente": f.fuente or "desconocida", "cantidad": f.cantidad} for f in fuentes],
            "periodo_disponible": {
                "desde": fecha_min_result.strftime("%Y-%m-%d") if fecha_min_result else None,
                "hasta": fecha_max_result.strftime("%Y-%m-%d") if fecha_max_result else None,
            },
            "nota": "Categorias homologadas desde fuentes municipales heterogeneas.",
        }
    }


@router.get("/dashboard/nacional")
async def dashboard_nacional(db: Session = Depends(get_db)):
    """
    Resumen a nivel nacional.
    """
    # Total de comunas
    total_comunas = db.query(Comuna).count()
    
    # Promedios nacionales
    from sqlalchemy import desc
    
    # Últimos índices de todas las comunas
    subq = db.query(
        IndiceSeguridad.comuna_id,
        func.max(IndiceSeguridad.fecha).label("max_fecha")
    ).group_by(IndiceSeguridad.comuna_id).subquery()
    
    indices = db.query(IndiceSeguridad).join(
        subq,
        (IndiceSeguridad.comuna_id == subq.c.comuna_id) &
        (IndiceSeguridad.fecha == subq.c.max_fecha)
    ).all()
    
    if indices:
        avg_global = sum(i.indice_seguridad_global or 0 for i in indices) / len(indices)
        avg_tasa = sum(i.tasa_delictual or 0 for i in indices) / len(indices)
    else:
        avg_global = 0
        avg_tasa = 0
    
    # Comunas con mejor y peor índice
    mejor = max(indices, key=lambda x: x.indice_seguridad_global or 0) if indices else None
    peor = min(indices, key=lambda x: x.indice_seguridad_global or 100) if indices else None
    
    return {
        "total_comunas": total_comunas,
        "promedios_nacionales": {
            "indice_seguridad_global": round(float(avg_global), 2),
            "tasa_delictual_100k": round(float(avg_tasa), 2),
        },
        "mejor_comuna": {
            "nombre": mejor.comuna.nombre if mejor else None,
            "indice": mejor.indice_seguridad_global if mejor else None,
        },
        "comuna_mayor_riesgo": {
            "nombre": peor.comuna.nombre if peor else None,
            "indice": peor.indice_seguridad_global if peor else None,
        },
    }
