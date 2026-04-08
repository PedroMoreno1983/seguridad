"""
Model Registry
==============
Registro centralizado de modelos ML disponibles.
"""

from typing import Dict, Type, Optional
from .base import BaseModel


class ModelRegistry:
    """Registro de modelos de ML para predicción delictual."""
    
    _models: Dict[str, Type[BaseModel]] = {}
    
    @classmethod
    def register(cls, name: str, model_class: Type[BaseModel]):
        """Registrar un nuevo modelo."""
        cls._models[name] = model_class
        print(f"✅ Modelo '{name}' registrado")
    
    @classmethod
    def get(cls, name: str) -> Optional[Type[BaseModel]]:
        """Obtener clase de modelo por nombre."""
        return cls._models.get(name)
    
    @classmethod
    def list_models(cls) -> Dict[str, dict]:
        """Listar todos los modelos disponibles con metadata."""
        return {
            name: {
                'nombre': model_class.NOMBRE,
                'descripcion': model_class.DESCRIPCION,
                'tipo': model_class.TIPO,
                'requiere_entrenamiento': model_class.REQUIERE_ENTRENAMIENTO,
                'tiempo_tipico': model_class.TIEMPO_TIPICO,
                'efectividad_estimada': model_class.EFECTIVIDAD_ESTIMADA,
                'ventajas': model_class.VENTAJAS,
                'desventajas': model_class.DESVENTAJAS,
            }
            for name, model_class in cls._models.items()
        }
    
    @classmethod
    def get_model_info(cls, name: str) -> Optional[dict]:
        """Obtener información detallada de un modelo."""
        model_class = cls.get(name)
        if not model_class:
            return None
        
        return {
            'id': name,
            'nombre': model_class.NOMBRE,
            'descripcion': model_class.DESCRIPCION,
            'tipo': model_class.TIPO,
            'requiere_entrenamiento': model_class.REQUIERE_ENTRENAMIENTO,
            'tiempo_tipico': model_class.TIEMPO_TIPICO,
            'efectividad_estimada': model_class.EFECTIVIDAD_ESTIMADA,
            'ventajas': model_class.VENTAJAS,
            'desventajas': model_class.DESVENTAJAS,
            'parametros_default': model_class.PARAMETROS_DEFAULT,
        }


# Auto-registro de modelos
def register_all_models():
    """Registrar todos los modelos disponibles."""
    
    # Modelos espaciotemporales
    try:
        from .models.sepp_model import SEPPModel
        ModelRegistry.register('SEPP', SEPPModel)
    except ImportError as e:
        print(f"⚠️  SEPP no disponible: {e}")
    
    try:
        from .models.rtm_model import RTMModel
        ModelRegistry.register('RTM', RTMModel)
    except ImportError as e:
        print(f"⚠️  RTM no disponible: {e}")
    
    # Modelos de series temporales (Deep Learning)
    try:
        from .models.lstm_model import LSTMModel
        ModelRegistry.register('LSTM', LSTMModel)
    except ImportError as e:
        print(f"⚠️  LSTM no disponible: {e}")
    
    try:
        from .models.gru_model import GRUModel
        ModelRegistry.register('GRU', GRUModel)
    except ImportError as e:
        print(f"⚠️  GRU no disponible: {e}")
    
    try:
        from .models.convlstm_model import ConvLSTMModel
        ModelRegistry.register('ConvLSTM', ConvLSTMModel)
    except ImportError as e:
        print(f"⚠️  ConvLSTM no disponible: {e}")
    
    # Modelos estadísticos
    try:
        from .models.prophet_model import ProphetModel
        ModelRegistry.register('Prophet', ProphetModel)
    except ImportError as e:
        print(f"⚠️  Prophet no disponible: {e}")
    
    try:
        from .models.arima_model import ARIMAModel
        ModelRegistry.register('ARIMA', ARIMAModel)
    except ImportError as e:
        print(f"⚠️  ARIMA no disponible: {e}")
    
    # Gradient Boosting
    try:
        from .models.xgboost_model import XGBoostModel
        ModelRegistry.register('XGBoost', XGBoostModel)
    except ImportError as e:
        print(f"⚠️  XGBoost no disponible: {e}")
    
    try:
        from .models.tft_model import TemporalFusionTransformerModel
        ModelRegistry.register('TFT', TemporalFusionTransformerModel)
    except ImportError as e:
        print(f"⚠️  TFT no disponible: {e}")
    
    print(f"\n📊 Total modelos registrados: {len(ModelRegistry._models)}")


# Registrar al importar
register_all_models()
