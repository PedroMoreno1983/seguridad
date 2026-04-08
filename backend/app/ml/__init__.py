"""
SafeCity ML Module
==================
Módulo de Machine Learning para predicción delictual.

Modelos disponibles:
- SEPP: Self-Exciting Point Process
- RTM: Risk Terrain Modeling
- LSTM: Long Short-Term Memory
- GRU: Gated Recurrent Unit
- ConvLSTM: CNN + LSTM espaciotemporal
- Prophet: Modelo de Facebook
- ARIMA: Autoregressive Integrated Moving Average
- XGBoost: Gradient boosting
- TemporalFusionTransformer: State-of-the-art multivariado

Uso:
    from app.ml import MLOrchestrator
    
    orchestrator = MLOrchestrator()
    resultados = orchestrator.entrenar_y_predecir(
        comuna_id=22,
        modelo='LSTM',
        dias_historia=365,
        dias_prediccion=7
    )
"""

from .orchestrator import MLOrchestrator
from .registry import ModelRegistry

__all__ = ['MLOrchestrator', 'ModelRegistry']
