"""
Modelo Reporte Ciudadano
========================
Guarda alertas o percepciones cualitativas de la comunidad.
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ReporteCiudadano(Base):
    __tablename__ = "reportes_ciudadanos"

    id = Column(BigInteger, primary_key=True, index=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)

    # Puede ser 'percepcion_inseguridad', 'vandalismo', 'iluminacion_defectuosa'
    tipo_reporte = Column(String(50), nullable=False)
    descripcion = Column(String(500))
    
    # Bajo, Medio, Alto
    nivel_gravedad = Column(String(20))

    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)

    fecha = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relaciones
    comuna = relationship("Comuna", back_populates="reportes_ciudadanos")

    def __repr__(self):
        return f"<ReporteCiudadano(id={self.id}, tipo='{self.tipo_reporte}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "tipo_reporte": self.tipo_reporte,
            "descripcion": self.descripcion,
            "nivel_gravedad": self.nivel_gravedad,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "fecha": self.fecha.isoformat() if self.fecha else None
        }

# Back-reference
from app.models.comuna import Comuna
Comuna.reportes_ciudadanos = relationship("ReporteCiudadano", back_populates="comuna")
