"""
Base Model Class
================
Clase abstracta base para todos los modelos de ML.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


class BaseModel(ABC):
    """Clase base para todos los modelos predictivos."""
    
    # Metadatos de la clase (deben ser sobreescritos)
    NOMBRE: str = "Base Model"
    DESCRIPCION: str = "Descripción del modelo"
    TIPO: str = "temporal"  # temporal, espacial, espaciotemporal, ensemble
    REQUIERE_ENTRENAMIENTO: bool = True
    TIEMPO_TIPICO: str = "~5 minutos"
    EFECTIVIDAD_ESTIMADA: str = "80%"
    
    VENTAJAS: List[str] = []
    DESVENTAJAS: List[str] = []
    
    PARAMETROS_DEFAULT: Dict[str, Any] = {}
    
    def __init__(self, params: Optional[Dict] = None):
        """
        Inicializar modelo.
        
        Args:
            params: Parámetros específicos del modelo
        """
        self.params = {**self.PARAMETROS_DEFAULT, **(params or {})}
        self.modelo = None
        self.esta_entrenado = False
        self.metadata_entrenamiento = {}
        
    @abstractmethod
    def preparar_datos(
        self, 
        df: pd.DataFrame,
        columna_fecha: str = 'fecha_hora',
        columna_target: str = 'cantidad',
        **kwargs
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Preparar datos para entrenamiento/predicción.
        
        Args:
            df: DataFrame con datos
            columna_fecha: Nombre de columna de fecha
            columna_target: Nombre de columna objetivo
            
        Returns:
            Tupla (X, y) con datos preparados
        """
        pass
    
    @abstractmethod
    def entrenar(
        self, 
        X: np.ndarray, 
        y: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        **kwargs
    ) -> Dict[str, float]:
        """
        Entrenar el modelo.
        
        Args:
            X: Features de entrenamiento
            y: Target de entrenamiento
            X_val: Features de validación (opcional)
            y_val: Target de validación (opcional)
            
        Returns:
            Métricas de entrenamiento
        """
        pass
    
    @abstractmethod
    def predecir(
        self, 
        X: np.ndarray,
        horizonte: int = 7,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generar predicciones.
        
        Args:
            X: Datos de entrada
            horizonte: Número de pasos a predecir
            
        Returns:
            Diccionario con predicciones y metadata
        """
        pass
    
    def evaluar(
        self, 
        y_true: np.ndarray, 
        y_pred: np.ndarray
    ) -> Dict[str, float]:
        """
        Calcular métricas de evaluación.
        
        Args:
            y_true: Valores reales
            y_pred: Valores predichos
            
        Returns:
            Diccionario con métricas
        """
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        
        mae = mean_absolute_error(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-8))) * 100
        
        return {
            'mae': float(mae),
            'mse': float(mse),
            'rmse': float(rmse),
            'r2': float(r2),
            'mape': float(mape),
        }
    
    def guardar(self, path: str) -> bool:
        """Guardar modelo entrenado."""
        try:
            import pickle
            with open(path, 'wb') as f:
                pickle.dump({
                    'modelo': self.modelo,
                    'params': self.params,
                    'metadata': self.metadata_entrenamiento,
                    'esta_entrenado': self.esta_entrenado
                }, f)
            return True
        except Exception as e:
            print(f"Error guardando modelo: {e}")
            return False
    
    def cargar(self, path: str) -> bool:
        """Cargar modelo guardado."""
        try:
            import pickle
            with open(path, 'rb') as f:
                data = pickle.load(f)
                self.modelo = data['modelo']
                self.params = data['params']
                self.metadata_entrenamiento = data['metadata']
                self.esta_entrenado = data['esta_entrenado']
            return True
        except Exception as e:
            print(f"Error cargando modelo: {e}")
            return False
    
    def get_info(self) -> Dict[str, Any]:
        """Obtener información del modelo."""
        return {
            'nombre': self.NOMBRE,
            'descripcion': self.DESCRIPCION,
            'tipo': self.TIPO,
            'esta_entrenado': self.esta_entrenado,
            'parametros': self.params,
            'metadata_entrenamiento': self.metadata_entrenamiento,
        }
