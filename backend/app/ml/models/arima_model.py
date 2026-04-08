"""
ARIMA/SARIMA Model
==================
Autoregressive Integrated Moving Average.

Modelo estadístico clásico, muy interpretable y robusto.
SARIMA incluye componente estacional.
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, Any
from datetime import datetime

from ..base import BaseModel


class ARIMAModel(BaseModel):
    """
    Modelo ARIMA/SARIMA para predicción de delitos.
    
    Modelo estadístico clásico que captura:
    - AR: Autorregresión (dependencia de valores pasados)
    - I: Diferenciación (estacionariedad)
    - MA: Media móvil (ruido pasado)
    - S: Componente estacional (SARIMA)
    """
    
    NOMBRE = "ARIMA/SARIMA"
    DESCRIPCION = "Modelo estadístico clásico con componente estacional"
    TIPO = "temporal"
    REQUIERE_ENTRENAMIENTO = True
    TIEMPO_TIPICO = "~30-60 segundos"
    EFECTIVIDAD_ESTIMADA = "75-82%"
    
    VENTAJAS = [
        "Muy interpretable",
        "Base estadística sólida",
        "Rápido de entrenar",
        "Bueno para series cortas",
        "Intervalos de confianza válidos estadísticamente"
    ]
    
    DESVENTAJAS = [
        "Asume linealidad",
        "Requiere serie estacionaria",
        "No captura patrones complejos no lineales",
        "Difícil de tunear (p, d, q)"
    ]
    
    PARAMETROS_DEFAULT = {
        'p': 7,              # Orden AR (días anteriores)
        'd': 1,              # Orden de diferenciación
        'q': 7,              # Orden MA
        'P': 1,              # Orden AR estacional
        'D': 1,              # Diferenciación estacional
        'Q': 1,              # Orden MA estacional
        's': 7,              # Período estacional (semanal)
        'auto_arima': True,  # Buscar mejores parámetros automáticamente
        'seasonal': True,    # Usar SARIMA
        'information_criterion': 'aic',  # aic, bic, aicc
    }
    
    def __init__(self, params: Optional[Dict] = None):
        super().__init__(params)
        self.modelo = None
        self.resultados = None
        self.ultima_fecha = None
        self.frecuencia = 'D'
        
    def preparar_datos(
        self,
        df: pd.DataFrame,
        columna_fecha: str = 'fecha_hora',
        columna_target: str = 'cantidad',
        **kwargs
    ) -> Tuple[pd.Series, pd.DataFrame]:
        """Preparar serie temporal para ARIMA."""
        df = df.copy()
        df['fecha'] = pd.to_datetime(df[columna_fecha])
        
        # Agregar por día
        serie = df.groupby(df['fecha'].dt.date)[columna_target].sum()
        serie.index = pd.to_datetime(serie.index)
        
        # Asegurar frecuencia diaria
        serie = serie.asfreq('D', fill_value=0)
        
        self.ultima_fecha = serie.index[-1]
        
        return serie, df
    
    def entrenar(
        self,
        serie: pd.Series,
        **kwargs
    ) -> Dict[str, float]:
        """Entrenar modelo ARIMA/SARIMA."""
        try:
            from statsmodels.tsa.statespace.sarimax import SARIMAX
            import warnings
            warnings.filterwarnings('ignore')
        except ImportError:
            raise ImportError("Instalar: pip install statsmodels")
        
        print("Entrenando ARIMA...")
        
        if self.params['auto_arima']:
            # Buscar mejores parámetros con auto_arima
            try:
                from pmdarima import auto_arima
                
                print("Buscando mejores parámetros con auto_arima...")
                auto_model = auto_arima(
                    serie,
                    seasonal=self.params['seasonal'],
                    m=self.params['s'],
                    start_p=0, max_p=14,
                    start_q=0, max_q=14,
                    d=None,  # Determinar automáticamente
                    D=None,
                    trace=False,
                    error_action='ignore',
                    suppress_warnings=True,
                    stepwise=True,
                    information_criterion=self.params['information_criterion'],
                )
                
                order = auto_model.order
                seasonal_order = auto_model.seasonal_order
                
                print(f"Mejores parámetros: {order}, Seasonal: {seasonal_order}")
                
            except ImportError:
                print("pmdarima no disponible, usando parámetros por defecto")
                order = (self.params['p'], self.params['d'], self.params['q'])
                seasonal_order = (self.params['P'], self.params['D'], self.params['Q'], self.params['s'])
        else:
            order = (self.params['p'], self.params['d'], self.params['q'])
            seasonal_order = (self.params['P'], self.params['D'], self.params['Q'], self.params['s'])
        
        # Entrenar SARIMA
        self.modelo = SARIMAX(
            serie,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        
        self.resultados = self.modelo.fit(disp=False)
        
        print(self.resultados.summary().tables[0])
        
        # Métricas
        aic = self.resultados.aic
        bic = self.resultados.bic
        
        # Residual diagnostics
        residuos = self.resultados.resid
        mse_residuos = np.mean(residuos**2)
        
        self.esta_entrenado = True
        self.metadata_entrenamiento = {
            'order': order,
            'seasonal_order': seasonal_order if self.params['seasonal'] else None,
            'aic': float(aic),
            'bic': float(bic),
            'log_likelihood': float(self.resultados.llf),
        }
        
        return {
            'aic': float(aic),
            'bic': float(bic),
            'mse_residuos': float(mse_residuos),
        }
    
    def predecir(
        self,
        horizonte: int = 7,
        alpha: float = 0.05,  # 95% intervalo de confianza
        **kwargs
    ) -> Dict[str, Any]:
        """Generar predicciones con ARIMA."""
        if not self.esta_entrenado:
            raise ValueError("Modelo no entrenado")
        
        # Forecast
        forecast = self.resultados.get_forecast(steps=horizonte)
        predicciones = forecast.predicted_mean
        intervalo_confianza = forecast.conf_int()
        
        # Generar fechas futuras
        fechas_futuras = pd.date_range(
            start=self.ultima_fecha + pd.Timedelta(days=1),
            periods=horizonte,
            freq='D'
        )
        
        return {
            'fechas': fechas_futuras.strftime('%Y-%m-%d').tolist(),
            'predicciones': np.maximum(0, predicciones).tolist(),
            'intervalo_confianza': {
                'lower': np.maximum(0, intervalo_confianza.iloc[:, 0]).tolist(),
                'upper': intervalo_confianza.iloc[:, 1].tolist(),
            },
            'metadata': {
                'modelo': 'SARIMA' if self.params['seasonal'] else 'ARIMA',
                'order': self.metadata_entrenamiento.get('order'),
                'seasonal_order': self.metadata_entrenamiento.get('seasonal_order'),
            }
        }
