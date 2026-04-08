"""
Modelo IndiceSeguridad
=======================
Índices calculados de seguridad para cada comuna y período.
"""

from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class IndiceSeguridad(Base):
    __tablename__ = "indices_seguridad"
    
    id = Column(Integer, primary_key=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False)
    fecha = Column(Date, nullable=False)
    
    # Índices principales (0-100)
    indice_seguridad_global = Column(Numeric(5, 2))
    indice_percepcion = Column(Numeric(5, 2))  # Basado en ENUSC u otras encuestas
    indice_victimizacion = Column(Numeric(5, 2))
    indice_temor = Column(Numeric(5, 2))
    indice_prevencion = Column(Numeric(5, 2))
    
    # Métricas desagregadas
    tasa_delictual = Column(Numeric(8, 2))  # por 100,000 habitantes
    tasa_homicidios = Column(Numeric(8, 2))
    tasa_robos = Column(Numeric(8, 2))
    tasa_hurtos = Column(Numeric(8, 2))
    tasa_resolucion = Column(Numeric(5, 2))  # % casos resueltos
    
    # Comparativas
    ranking_nacional = Column(Integer)
    ranking_regional = Column(Integer)
    tendencia = Column(String(20))  # 'subiendo', 'estable', 'bajando'
    cambio_porcentual = Column(Numeric(5, 2))  # vs período anterior
    
    # Relaciones
    comuna = relationship("Comuna", back_populates="indices")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('comuna_id', 'fecha', name='uq_indice_comuna_fecha'),
    )
    
    def __repr__(self):
        return f"<IndiceSeguridad(comuna_id={self.comuna_id}, fecha={self.fecha}, global={self.indice_seguridad_global})>"
    
    def to_dict(self):
        """Serializar a diccionario."""
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "indices": {
                "global": float(self.indice_seguridad_global) if self.indice_seguridad_global else None,
                "percepcion": float(self.indice_percepcion) if self.indice_percepcion else None,
                "victimizacion": float(self.indice_victimizacion) if self.indice_victimizacion else None,
                "temor": float(self.indice_temor) if self.indice_temor else None,
                "prevencion": float(self.indice_prevencion) if self.indice_prevencion else None,
            },
            "tasas": {
                "delictual": float(self.tasa_delictual) if self.tasa_delictual else None,
                "homicidios": float(self.tasa_homicidios) if self.tasa_homicidios else None,
                "robos": float(self.tasa_robos) if self.tasa_robos else None,
                "hurtos": float(self.tasa_hurtos) if self.tasa_hurtos else None,
                "resolucion": float(self.tasa_resolucion) if self.tasa_resolucion else None,
            },
            "rankings": {
                "nacional": self.ranking_nacional,
                "regional": self.ranking_regional,
            },
            "tendencia": self.tendencia,
            "cambio_porcentual": float(self.cambio_porcentual) if self.cambio_porcentual else None,
        }


# Back-reference
from app.models.comuna import Comuna
Comuna.indices = relationship("IndiceSeguridad", back_populates="comuna")
