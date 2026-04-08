"""
Prophet Model
=============
Modelo de Facebook para predicción de series temporales.

Excelente para datos con estacionalidad fuerte y tendencias.
Maneja automáticamente días festivos y outliers.
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, Any, List
from datetime import datetime, timedelta

from ..base import BaseModel


class ProphetModel(BaseModel):
    """
    Modelo Prophet de Facebook para predicción de delitos.
    
    Ventajas principales:
    - Manejo automático de estacionalidad (diaria, semanal, anual)
    - Robustez ante datos faltantes y outliers
    - Fácil de interpretar (tendencia + estacionalidad)
    - No requiere preprocesamiento complejo
    """
    
    NOMBRE = "Prophet (Facebook)"
    DESCRIPCION = "Modelo aditivo para series temporales con estacionalidad automática"
    TIPO = "temporal"
    REQUIERE_ENTRENAMIENTO = True
    TIEMPO_TIPICO = "~1-2 minutos"
    EFECTIVIDAD_ESTIMADA = "78-85%"
    
    VENTAJAS = [
        "Manejo automático de estacionalidad",
        "Robusto a datos faltantes",
        "Interpretable (componentes separables)",
        "Rápido de entrenar",
        "Incluye días festivos de Chile"
    ]
    
    DESVENTAJAS = [
        "Asume aditividad (no captura interacciones complejas)",
        "Menos preciso que deep learning en patrones complejos",
        "Requiere suficiente historia para detectar estacionalidad"
    ]
    
    PARAMETROS_DEFAULT = {
        'yearly_seasonality': True,
        'weekly_seasonality': True,
        'daily_seasonality': False,
        'seasonality_mode': 'multiplicative',  # o 'additive'
        'changepoint_prior_scale': 0.05,
        'seasonality_prior_scale': 10.0,
        'holidays_prior_scale': 10.0,
        'interval_width': 0.8,  # 80% intervalo de confianza
    }
    
    def __init__(self, params: Optional[Dict] = None):
        super().__init__(params)
        self.modelo = None
        self.ultima_fecha = None
        self.frecuencia = 'D'  # Diaria por defecto
        
    def _get_chile_holidays(self, years: List[int]) -> pd.DataFrame:
        """Obtener días festivos de Chile."""
        holidays = []
        
        for year in years:
            # Fiestas nacionales fijas
            holidays.extend([
                (f'{year}-01-01', 'Año Nuevo'),
                (f'{year}-05-01', 'Día del Trabajo'),
                (f'{year}-05-21', 'Día de las Glorias Navales'),
                (f'{year}-06-29', 'San Pedro y San Pablo'),
                (f'{year}-07-16', 'Virgen del Carmen'),
                (f'{year}-08-15', 'Asunción de la Virgen'),
                (f'{year}-09-18', 'Independencia'),
                (f'{year}-09-19', 'Glorias del Ejército'),
                (f'{year}-10-12', 'Encuentro de Dos Mundos'),
                (f'{year}-10-31', 'Día de las Iglesias Evangélicas'),
                (f'{year}-11-01', 'Día de Todos los Santos'),
                (f'{year}-12-08', 'Inmaculada Concepción'),
                (f'{year}-12-25', 'Navidad'),
            ])
        
        df_holidays = pd.DataFrame(holidays, columns=['ds', 'holiday'])
        df_holidays['ds'] = pd.to_datetime(df_holidays['ds'])
        return df_holidays
    
    def preparar_datos(
        self,
        df: pd.DataFrame,
        columna_fecha: str = 'fecha_hora',
        columna_target: str = 'cantidad',
        frecuencia: str = 'D',
        **kwargs
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Preparar datos para Prophet.
        
        Prophet requiere columnas 'ds' (fecha) y 'y' (valor).
        """
        df = df.copy()
        df['ds'] = pd.to_datetime(df[columna_fecha])
        
        # Agregar por fecha si hay múltiples registros por día
        if frecuencia == 'D':
            df['ds'] = df['ds'].dt.date
            
        df_agrupado = df.groupby('ds').agg({
            columna_target: 'sum',
        }).reset_index()
        
        df_agrupado.columns = ['ds', 'y']
        df_agrupado['ds'] = pd.to_datetime(df_agrupado['ds'])
        
        # Rellenar fechas faltantes con 0
        date_range = pd.date_range(
            start=df_agrupado['ds'].min(),
            end=df_agrupado['ds'].max(),
            freq=frecuencia
        )
        df_completo = pd.DataFrame({'ds': date_range})
        df_completo = df_completo.merge(df_agrupado, on='ds', how='left')
        df_completo['y'] = df_completo['y'].fillna(0)
        
        self.frecuencia = frecuencia
        self.ultima_fecha = df_completo['ds'].max()
        
        return df_completo, df_agrupado
    
    def entrenar(
        self,
        df: pd.DataFrame,
        df_val: Optional[pd.DataFrame] = None,
        **kwargs
    ) -> Dict[str, float]:
        """Entrenar modelo Prophet."""
        try:
            from prophet import Prophet
        except ImportError:
            raise ImportError("Instalar: pip install prophet")
        
        # Obtener años para holidays
        years = df['ds'].dt.year.unique()
        holidays = self._get_chile_holidays(years.tolist())
        
        # Crear modelo
        self.modelo = Prophet(
            yearly_seasonality=self.params['yearly_seasonality'],
            weekly_seasonality=self.params['weekly_seasonality'],
            daily_seasonality=self.params['daily_seasonality'],
            seasonality_mode=self.params['seasonality_mode'],
            changepoint_prior_scale=self.params['changepoint_prior_scale'],
            seasonality_prior_scale=self.params['seasonality_prior_scale'],
            holidays_prior_scale=self.params['holidays_prior_scale'],
            interval_width=self.params['interval_width'],
            holidays=holidays,
        )
        
        # Agregar estacionalidad mensual personalizada
        self.modelo.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )
        
        print("Entrenando Prophet...")
        self.modelo.fit(df)
        
        # Cross-validation para métricas
        from prophet.diagnostics import cross_validation, performance_metrics
        
        try:
            df_cv = cross_validation(
                self.modelo,
                initial='365 days',
                period='30 days',
                horizon='30 days',
                parallel='processes'
            )
            df_p = performance_metrics(df_cv)
            
            metricas = {
                'mae': float(df_p['mae'].mean()),
                'mse': float(df_p['mse'].mean()),
                'rmse': float(df_p['rmse'].mean()),
                'mape': float(df_p['mape'].mean()) if 'mape' in df_p.columns else None,
                'coverage': float(df_p['coverage'].mean()) if 'coverage' in df_p.columns else None,
            }
        except Exception as e:
            print(f"Warning: Cross-validation falló: {e}")
            metricas = {'mae': None, 'rmse': None}
        
        self.esta_entrenado = True
        self.metadata_entrenamiento = {
            'puntos_entrenamiento': len(df),
            'fecha_inicio': str(df['ds'].min()),
            'fecha_fin': str(df['ds'].max()),
            'componentes': ['trend', 'weekly', 'yearly', 'holidays'],
        }
        
        return metricas
    
    def predecir(
        self,
        horizonte: int = 7,
        df_historico: Optional[pd.DataFrame] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generar predicciones con Prophet."""
        if not self.esta_entrenado:
            raise ValueError("Modelo no entrenado")
        
        # Crear dataframe futuro
        future = self.modelo.make_future_dataframe(
            periods=horizonte,
            freq=self.frecuencia
        )
        
        # Predecir
        forecast = self.modelo.predict(future)
        
        # Extraer solo predicciones futuras
        predicciones_futuras = forecast.tail(horizonte)
        
        # Componentes (tendencia, estacionalidad)
        componentes = {}
        if 'trend' in forecast.columns:
            componentes['tendencia'] = forecast.tail(horizonte)['trend'].tolist()
        if 'weekly' in forecast.columns:
            componentes['semanal'] = forecast.tail(horizonte)['weekly'].tolist()
        if 'yearly' in forecast.columns:
            componentes['anual'] = forecast.tail(horizonte)['yearly'].tolist()
        
        return {
            'fechas': predicciones_futuras['ds'].dt.strftime('%Y-%m-%d').tolist(),
            'predicciones': predicciones_futuras['yhat'].clip(lower=0).tolist(),
            'intervalo_confianza': {
                'lower': predicciones_futuras['yhat_lower'].clip(lower=0).tolist(),
                'upper': predicciones_futuras['yhat_upper'].tolist(),
            },
            'componentes': componentes,
            'metadata': {
                'modelo': 'Prophet',
                'intervalo_confianza': self.params['interval_width'],
            }
        }
