"""
ML Orchestrator
===============
Orquestador centralizado para todos los modelos de ML.

Maneja:
- Entrenamiento de modelos
- Generación de predicciones
- Comparación entre modelos
- Ensemble de múltiples modelos
- Persistencia de modelos entrenados
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import json
import os
from pathlib import Path

from .registry import ModelRegistry
from .base import BaseModel


class MLOrchestrator:
    """
    Orquestador de modelos de ML para predicción delictual.
    
    Uso:
        orchestrator = MLOrchestrator()
        
        # Entrenar un modelo
        resultado = orchestrator.entrenar(
            comuna_id=22,
            modelo='LSTM',
            dias_historia=365
        )
        
        # Generar predicción
        pred = orchestrator.predecir(
            comuna_id=22,
            modelo='LSTM',
            horizonte=7
        )
        
        # Comparar modelos
        comparacion = orchestrator.comparar_modelos(
            comuna_id=22,
            modelos=['LSTM', 'Prophet', 'ARIMA'],
            dias_test=30
        )
    """
    
    def __init__(self, models_dir: str = "./ml_models"):
        """
        Inicializar orquestador.
        
        Args:
            models_dir: Directorio para guardar modelos entrenados
        """
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        
        self.modelos_entrenados: Dict[str, BaseModel] = {}
        self.cache_datos: Dict[int, pd.DataFrame] = {}
        
    def _cargar_datos_comuna(
        self,
        comuna_id: int,
        dias_historia: int = 365,
        db_session = None
    ) -> pd.DataFrame:
        """Cargar datos históricos de una comuna."""
        # Verificar cache
        if comuna_id in self.cache_datos:
            df = self.cache_datos[comuna_id]
            # Filtrar por fecha
            fecha_min = datetime.now() - timedelta(days=dias_historia)
            return df[df['fecha_hora'] >= fecha_min]
        
        # Si no hay cache, cargar de DB
        if db_session is None:
            raise ValueError("Se requiere sesión de DB o datos precargados")
        
        from sqlalchemy import text
        
        query = text("""
            SELECT d.id, d.tipo_delito, d.fecha_hora, 
                   ST_X(d.ubicacion::geometry) as longitud,
                   ST_Y(d.ubicacion::geometry) as latitud,
                   d.barrio, d.cuadrante
            FROM delitos d
            WHERE d.comuna_id = :comuna_id
            AND d.fecha_hora >= :fecha_min
            ORDER BY d.fecha_hora
        """)
        
        fecha_min = datetime.now() - timedelta(days=dias_historia)
        result = db_session.execute(query, {
            'comuna_id': comuna_id,
            'fecha_min': fecha_min
        })
        
        df = pd.DataFrame(result.fetchall(), columns=result.keys())
        df['fecha_hora'] = pd.to_datetime(df['fecha_hora'])
        
        # Guardar en cache
        self.cache_datos[comuna_id] = df
        
        return df
    
    def entrenar(
        self,
        comuna_id: int,
        modelo: str,
        dias_historia: int = 365,
        params: Optional[Dict] = None,
        db_session = None,
        guardar: bool = True
    ) -> Dict[str, Any]:
        """
        Entrenar un modelo para una comuna.
        
        Args:
            comuna_id: ID de la comuna
            modelo: Nombre del modelo (LSTM, Prophet, etc.)
            dias_historia: Días de historia a usar
            params: Parámetros específicos del modelo
            db_session: Sesión de base de datos
            guardar: Si guardar el modelo entrenado
            
        Returns:
            Resultado del entrenamiento con métricas
        """
        print(f"\n{'='*60}")
        print(f"Entrenando modelo {modelo} para comuna {comuna_id}")
        print(f"{'='*60}\n")
        
        # Obtener clase del modelo
        model_class = ModelRegistry.get(modelo)
        if not model_class:
            raise ValueError(f"Modelo '{modelo}' no encontrado. "
                           f"Disponibles: {list(ModelRegistry.list_models().keys())}")
        
        # Instanciar modelo
        model_instance = model_class(params)
        
        # Cargar datos
        df = self._cargar_datos_comuna(comuna_id, dias_historia, db_session)
        
        if len(df) < 30:
            raise ValueError(f"Datos insuficientes: {len(df)} registros (mínimo 30)")
        
        print(f"Datos cargados: {len(df)} registros")
        
        # Preparar datos según tipo de modelo
        if hasattr(model_instance, 'preparar_datos'):
            if modelo in ['Prophet', 'ARIMA']:
                # Modelos que usan series temporales
                X, y = model_instance.preparar_datos(df)
                metricas = model_instance.entrenar(X, y=y if modelo == 'ARIMA' else None)
            elif modelo in ['LSTM', 'GRU', 'TFT']:
                X, y = model_instance.preparar_datos(df)
                metricas = model_instance.entrenar(X, y)
            elif modelo == 'XGBoost':
                X, y, _ = model_instance.preparar_datos(df)
                metricas = model_instance.entrenar(X, y)
            elif modelo == 'SEPP':
                eventos = model_instance.preparar_datos(df)
                metricas = model_instance.entrenar(eventos)
            elif modelo == 'RTM':
                # RTM necesita features espaciales adicionales
                raise NotImplementedError("RTM requiere implementación adicional de features")
            else:
                X, y = model_instance.preparar_datos(df)
                metricas = model_instance.entrenar(X, y)
        else:
            raise ValueError(f"Modelo {modelo} no tiene método preparar_datos")
        
        # Guardar modelo
        model_key = f"{modelo}_{comuna_id}"
        self.modelos_entrenados[model_key] = model_instance
        
        if guardar:
            path = self.models_dir / f"{model_key}.pkl"
            model_instance.guardar(str(path))
            print(f"Modelo guardado en: {path}")
        
        return {
            'modelo': modelo,
            'comuna_id': comuna_id,
            'datos_usados': len(df),
            'metricas': metricas,
            'esta_entrenado': model_instance.esta_entrenado,
            'metadata': model_instance.metadata_entrenamiento,
        }
    
    def predecir(
        self,
        comuna_id: int,
        modelo: str,
        horizonte: int = 7,
        usar_cache: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generar predicciones con un modelo.
        
        Args:
            comuna_id: ID de la comuna
            modelo: Nombre del modelo
            horizonte: Días a predecir
            usar_cache: Usar modelo en cache si existe
            
        Returns:
            Predicciones con metadata
        """
        model_key = f"{modelo}_{comuna_id}"
        
        # Buscar modelo
        if usar_cache and model_key in self.modelos_entrenados:
            model_instance = self.modelos_entrenados[model_key]
        else:
            # Cargar de disco
            path = self.models_dir / f"{model_key}.pkl"
            if not path.exists():
                raise ValueError(f"Modelo {model_key} no encontrado. Entrene primero.")
            
            model_class = ModelRegistry.get(modelo)
            model_instance = model_class()
            model_instance.cargar(str(path))
            self.modelos_entrenados[model_key] = model_instance
        
        if not model_instance.esta_entrenado:
            raise ValueError(f"Modelo {modelo} no está entrenado")
        
        # Generar predicción
        print(f"Generando predicción con {modelo} (horizonte={horizonte}d)...")
        
        resultado = model_instance.predecir(horizonte=horizonte, **kwargs)
        
        resultado['modelo'] = modelo
        resultado['comuna_id'] = comuna_id
        resultado['fecha_prediccion'] = datetime.now().isoformat()
        resultado['horizonte_dias'] = horizonte
        
        return resultado
    
    def comparar_modelos(
        self,
        comuna_id: int,
        modelos: List[str],
        dias_test: int = 30,
        dias_historia: int = 365,
        db_session = None
    ) -> Dict[str, Any]:
        """
        Comparar múltiples modelos en datos de test.
        
        Returns:
            Comparación con métricas de todos los modelos
        """
        print(f"\n{'='*60}")
        print(f"Comparando {len(modelos)} modelos para comuna {comuna_id}")
        print(f"{'='*60}\n")
        
        resultados = []
        
        for modelo in modelos:
            try:
                # Entrenar
                train_result = self.entrenar(
                    comuna_id=comuna_id,
                    modelo=modelo,
                    dias_historia=dias_historia - dias_test,
                    db_session=db_session,
                    guardar=False
                )
                
                # Predecir
                pred_result = self.predecir(
                    comuna_id=comuna_id,
                    modelo=modelo,
                    horizonte=dias_test,
                    usar_cache=True
                )
                
                resultados.append({
                    'modelo': modelo,
                    'entrenamiento': train_result,
                    'prediccion': pred_result,
                    'ranking': 0,  # Se calculará después
                })
                
            except Exception as e:
                print(f"❌ Error con {modelo}: {e}")
                resultados.append({
                    'modelo': modelo,
                    'error': str(e),
                })
        
        # Ordenar por métrica (ej: menor MAE)
        resultados_validos = [
            r for r in resultados 
            if 'entrenamiento' in r and 'metricas' in r['entrenamiento']
            and r['entrenamiento']['metricas'].get('mae') is not None
        ]
        
        if resultados_validos:
            resultados_validos.sort(
                key=lambda x: x['entrenamiento']['metricas'].get('mae', float('inf'))
            )
            
            for i, r in enumerate(resultados_validos):
                r['ranking'] = i + 1
        
        return {
            'comuna_id': comuna_id,
            'modelos_comparados': len(modelos),
            'resultados': resultados,
            'mejor_modelo': resultados_validos[0]['modelo'] if resultados_validos else None,
        }
    
    def ensemble(
        self,
        comuna_id: int,
        modelos: List[str],
        pesos: Optional[List[float]] = None,
        horizonte: int = 7,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Combinar predicciones de múltiples modelos.
        
        Args:
            modelos: Lista de modelos a combinar
            pesos: Pesos para cada modelo (None = igual peso)
            horizonte: Días a predecir
            
        Returns:
            Predicción ensemble
        """
        predicciones = []
        
        for modelo in modelos:
            try:
                pred = self.predecir(
                    comuna_id=comuna_id,
                    modelo=modelo,
                    horizonte=horizonte,
                    **kwargs
                )
                predicciones.append(pred)
            except Exception as e:
                print(f"Warning: No se pudo obtener predicción de {modelo}: {e}")
        
        if not predicciones:
            raise ValueError("No se pudieron obtener predicciones de ningún modelo")
        
        # Calcular pesos
        if pesos is None:
            pesos = [1.0 / len(predicciones)] * len(predicciones)
        
        # Combinar predicciones (promedio ponderado)
        pred_arrays = [np.array(p['predicciones']) for p in predicciones]
        pred_matrix = np.array(pred_arrays)
        
        ensemble_pred = np.average(pred_matrix, axis=0, weights=pesos)
        
        # Calcular incertidumbre (std entre modelos)
        uncertainty = np.std(pred_matrix, axis=0)
        
        return {
            'predicciones': ensemble_pred.tolist(),
            'incertidumbre': uncertainty.tolist(),
            'intervalo_confianza': {
                'lower': np.maximum(0, ensemble_pred - 1.96 * uncertainty).tolist(),
                'upper': (ensemble_pred + 1.96 * uncertainty).tolist(),
            },
            'modelos_usados': [p['modelo'] for p in predicciones],
            'pesos': pesos,
            'predicciones_individuales': predicciones,
            'horizonte': horizonte,
        }
    
    def listar_modelos_disponibles(self) -> Dict[str, dict]:
        """Listar todos los modelos disponibles."""
        return ModelRegistry.list_models()
    
    def get_modelo_info(self, modelo: str) -> Optional[dict]:
        """Obtener información de un modelo específico."""
        return ModelRegistry.get_model_info(modelo)
