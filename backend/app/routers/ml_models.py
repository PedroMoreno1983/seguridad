"""
Router ML Models
================
Endpoints para entrenamiento y predicción de modelos de ML.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.ml.orchestrator import MLOrchestrator
from app.ml.registry import ModelRegistry

router = APIRouter()

# Instancia global del orquestador
orchestrator = MLOrchestrator()


# ==========================================
# SCHEMAS
# ==========================================

class EntrenarRequest(BaseModel):
    comuna_id: int
    modelo: str
    dias_historia: int = 365
    params: Optional[Dict[str, Any]] = None


class PredecirRequest(BaseModel):
    comuna_id: int
    modelo: str
    horizonte: int = 7


class CompararRequest(BaseModel):
    comuna_id: int
    modelos: List[str]
    dias_test: int = 30
    dias_historia: int = 365


class EnsembleRequest(BaseModel):
    comuna_id: int
    modelos: List[str]
    pesos: Optional[List[float]] = None
    horizonte: int = 7


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/ml/modelos")
async def listar_modelos():
    """
    Listar todos los modelos de ML disponibles con sus características.
    """
    return {
        "modelos": orchestrator.listar_modelos_disponibles(),
        "total": len(ModelRegistry.list_models()),
        "categorias": {
            "temporal": ["LSTM", "GRU", "Prophet", "ARIMA", "TFT"],
            "espacial": ["RTM"],
            "espaciotemporal": ["SEPP", "XGBoost", "ConvLSTM"],
        }
    }


@router.get("/ml/modelos/{modelo_id}")
async def info_modelo(modelo_id: str):
    """
    Obtener información detallada de un modelo específico.
    """
    info = orchestrator.get_modelo_info(modelo_id)
    
    if not info:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    
    return info


@router.post("/ml/entrenar")
async def entrenar_modelo(
    request: EntrenarRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Entrenar un modelo de ML para una comuna.
    
    Modelos disponibles:
    - **LSTM**: Red neuronal recurrente para patrones temporales
    - **GRU**: Alternativa ligera a LSTM
    - **Prophet**: Modelo de Facebook para estacionalidad
    - **ARIMA**: Modelo estadístico clásico
    - **XGBoost**: Gradient boosting
    - **SEPP**: Self-Exciting Point Process
    - **TFT**: Temporal Fusion Transformer (state-of-the-art)
    """
    try:
        resultado = orchestrator.entrenar(
            comuna_id=request.comuna_id,
            modelo=request.modelo,
            dias_historia=request.dias_historia,
            params=request.params,
            db_session=db
        )
        
        return {
            "success": True,
            "message": f"Modelo {request.modelo} entrenado exitosamente",
            **resultado
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error entrenando modelo: {str(e)}")


@router.post("/ml/predecir")
async def predecir(request: PredecirRequest):
    """
    Generar predicciones con un modelo entrenado.
    """
    try:
        resultado = orchestrator.predecir(
            comuna_id=request.comuna_id,
            modelo=request.modelo,
            horizonte=request.horizonte
        )
        
        return {
            "success": True,
            **resultado
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en predicción: {str(e)}")


@router.post("/ml/comparar")
async def comparar_modelos(
    request: CompararRequest,
    db: Session = Depends(get_db)
):
    """
    Comparar múltiples modelos en los mismos datos de test.
    
    Retorna ranking de modelos ordenados por performance.
    """
    try:
        resultado = orchestrator.comparar_modelos(
            comuna_id=request.comuna_id,
            modelos=request.modelos,
            dias_test=request.dias_test,
            dias_historia=request.dias_historia,
            db_session=db
        )
        
        return resultado
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en comparación: {str(e)}")


@router.post("/ml/ensemble")
async def ensemble(request: EnsembleRequest):
    """
    Combinar predicciones de múltiples modelos.
    
    Si no se especifican pesos, usa promedio simple.
    """
    try:
        resultado = orchestrator.ensemble(
            comuna_id=request.comuna_id,
            modelos=request.modelos,
            pesos=request.pesos,
            horizonte=request.horizonte
        )
        
        return {
            "success": True,
            **resultado
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en ensemble: {str(e)}")


@router.get("/ml/benchmark")
async def benchmark_comuna(
    comuna_id: int = Query(..., description="ID de la comuna"),
    dias: int = Query(30, description="Días de predicción"),
    db: Session = Depends(get_db)
):
    """
    Ejecutar benchmark completo con todos los modelos disponibles.
    
    Entrena y evalúa todos los modelos, retornando ranking completo.
    """
    modelos_disponibles = [
        "Prophet",      # Más rápido
        "ARIMA",
        "XGBoost",
        "LSTM",
        "GRU",
        # "TFT",        # Muy lento, descomentar si se necesita
        # "SEPP",       # Requiere datos con coordenadas
    ]
    
    return await comparar_modelos(
        CompararRequest(
            comuna_id=comuna_id,
            modelos=modelos_disponibles,
            dias_test=dias,
            dias_historia=365
        ),
        db
    )


@router.get("/ml/series-temporales/{comuna_id}")
async def obtener_serie_temporal(
    comuna_id: int,
    dias: int = Query(365, ge=30, le=730),
    agregacion: str = Query("D", description="D=diaria, W=semanal, M=mensual"),
    db: Session = Depends(get_db)
):
    """
    Obtener serie temporal de delitos para análisis.
    
    Útil para visualizar tendencias antes de aplicar modelos.
    """
    from sqlalchemy import text
    from datetime import datetime, timedelta
    
    fecha_min = datetime.now() - timedelta(days=dias)
    
    query = text("""
        SELECT 
            DATE_TRUNC(:agregacion, fecha_hora) as fecha,
            COUNT(*) as cantidad,
            tipo_delito
        FROM delitos
        WHERE comuna_id = :comuna_id
        AND fecha_hora >= :fecha_min
        GROUP BY DATE_TRUNC(:agregacion, fecha_hora), tipo_delito
        ORDER BY fecha
    """)
    
    result = db.execute(query, {
        'comuna_id': comuna_id,
        'fecha_min': fecha_min,
        'agregacion': agregacion
    })
    
    datos = {}
    for row in result:
        fecha = row.fecha.strftime('%Y-%m-%d')
        if fecha not in datos:
            datos[fecha] = {'fecha': fecha, 'total': 0, 'por_tipo': {}}
        
        datos[fecha]['total'] += row.cantidad
        datos[fecha]['por_tipo'][row.tipo_delito] = row.cantidad
    
    return {
        "comuna_id": comuna_id,
        "agregacion": agregacion,
        "dias": dias,
        "serie": list(datos.values())
    }
