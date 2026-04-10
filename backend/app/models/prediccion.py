"""
Modelo Prediccion
=================
Resultados de modelos predictivos (SEPP, RTM, ML).
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Numeric, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Prediccion(Base):
    __tablename__ = "predicciones"

    id = Column(BigInteger, primary_key=True, index=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)

    # Identificación del modelo
    modelo = Column(String(50), nullable=False)  # SEPP, RTM, XGBoost, Ensemble
    version_modelo = Column(String(20))

    # Zona de predicción almacenada como bbox JSON [minx, miny, maxx, maxy]
    zona_bbox = Column(JSON)
    # Centro de la predicción
    centro_lat = Column(Float)
    centro_lon = Column(Float)

    # Clasificación de riesgo
    nivel_riesgo = Column(String(20))  # muy_bajo, bajo, medio, alto, critico
    probabilidad = Column(Numeric(5, 4))  # 0.0000 a 1.0000

    # Ventana temporal de predicción
    fecha_prediccion = Column(DateTime(timezone=True), default=datetime.utcnow)
    fecha_inicio = Column(DateTime(timezone=True), nullable=False)
    fecha_fin = Column(DateTime(timezone=True), nullable=False)
    horizonte_horas = Column(Integer)  # 24, 48, 72, 168

    # Métricas de calidad
    precision_historica = Column(Numeric(5, 4))
    intervalo_confianza = Column(JSON)  # {"lower": 0.15, "upper": 0.45}
    mae = Column(Numeric(8, 4))

    # Features utilizados
    features_utilizados = Column(JSON)

    # Para modelos SEPP
    params_sepp = Column(JSON)

    # Relaciones
    comuna = relationship("Comuna", back_populates="predicciones")

    def __repr__(self):
        return f"<Prediccion(id={self.id}, modelo='{self.modelo}', riesgo='{self.nivel_riesgo}')>"

    def to_dict(self):
        """Serializar a diccionario."""
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "modelo": self.modelo,
            "version_modelo": self.version_modelo,
            "nivel_riesgo": self.nivel_riesgo,
            "probabilidad": float(self.probabilidad) if self.probabilidad else None,
            "centro": {"lat": self.centro_lat, "lon": self.centro_lon},
            "bbox": self.zona_bbox,
            "fecha_inicio": self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            "fecha_fin": self.fecha_fin.isoformat() if self.fecha_fin else None,
            "horizonte_horas": self.horizonte_horas,
            "precision_historica": float(self.precision_historica) if self.precision_historica else None,
            "intervalo_confianza": self.intervalo_confianza,
        }


# Back-reference
from app.models.comuna import Comuna
Comuna.predicciones = relationship("Prediccion", back_populates="comuna")
