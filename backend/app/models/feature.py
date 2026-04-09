"""
Modelo FeatureEspacial
======================
Features geográficas para Risk Terrain Modeling.
"""

from sqlalchemy import Column, Integer, String, Numeric, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base


class FeatureEspacial(Base):
    __tablename__ = "features_espaciales"
    
    id = Column(Integer, primary_key=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)
    
    # Clasificación
    tipo_feature = Column(String(50), nullable=False, index=True)
    # tipos: paradero, cajero, bar, restaurante, colegio, hospital, 
    #        luminaria, camara, baldio, estacion_metro, etc.
    
    subtipo = Column(String(100))
    nombre = Column(String(200))
    
    # Ubicación (almacenada como lat/lon simples)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    direccion = Column(String(200))
    
    # Pesos para RTM (Risk Terrain Modeling)
    peso_rtm = Column(Numeric(5, 2), default=1.0)
    radio_influencia_mts = Column(Integer, default=500)
    
    # Importancia calculada (SHAP values)
    importancia_shap = Column(Numeric(5, 4))
    
    # Metadata específica del tipo
    metadata = Column(JSON)
    # Ejemplo para paradero: {"lineas": ["210", "211"], "tipo": "metro"}
    # Ejemplo para cajero: {"banco": "BancoEstado", "24h": true}
    
    # Relaciones
    comuna = relationship("Comuna", back_populates="features")
    
    def __repr__(self):
        return f"<FeatureEspacial(id={self.id}, tipo='{self.tipo_feature}', comuna_id={self.comuna_id})>"
    
    def to_dict(self):
        """Serializar a diccionario."""
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "tipo": self.tipo_feature,
            "subtipo": self.subtipo,
            "nombre": self.nombre,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "direccion": self.direccion,
            "peso_rtm": float(self.peso_rtm) if self.peso_rtm else 1.0,
            "radio_influencia_mts": self.radio_influencia_mts,
            "metadata": self.metadata,
        }


# Back-reference
from app.models.comuna import Comuna
Comuna.features = relationship("FeatureEspacial", back_populates="comuna")
