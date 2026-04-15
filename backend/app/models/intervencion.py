"""
Modelo Intervención
===================
Guardará el registro de las medidas de mitigación o campañas policiales en una zona para evaluar su impacto.
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Intervencion(Base):
    __tablename__ = "intervenciones"

    id = Column(BigInteger, primary_key=True, index=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)

    tipo = Column(String(100), nullable=False)  # ej: "Aumento de patrullaje", "Nuevas luminarias"
    descripcion = Column(String(500))

    fecha_inicio = Column(DateTime(timezone=True), nullable=False)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)

    # Zona de intervención almacenada como bbox JSON [minx, miny, maxx, maxy] o coordenadas
    zona_bbox = Column(JSON)
    centro_lat = Column(Float)
    centro_lon = Column(Float)

    # Métricas de la evaluación post-intervencion (pre/post density ratio, etc)
    impacto_estimado = Column(JSON) 

    # Relaciones
    comuna = relationship("Comuna", back_populates="intervenciones")

    def __repr__(self):
        return f"<Intervencion(id={self.id}, tipo='{self.tipo}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "tipo": self.tipo,
            "descripcion": self.descripcion,
            "fecha_inicio": self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            "fecha_fin": self.fecha_fin.isoformat() if self.fecha_fin else None,
            "centro": {"lat": self.centro_lat, "lon": self.centro_lon},
            "zona_bbox": self.zona_bbox,
            "impacto_estimado": self.impacto_estimado
        }


# Back-reference
from app.models.comuna import Comuna
Comuna.intervenciones = relationship("Intervencion", back_populates="comuna")
