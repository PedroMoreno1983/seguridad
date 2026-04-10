"""
Modelo Comuna
=============
Representa una comuna de Chile con sus datos geoespaciales.
"""

from sqlalchemy import Column, Integer, String, Numeric, JSON, Float
from app.database import Base


class Comuna(Base):
    __tablename__ = "comunas"

    id = Column(Integer, primary_key=True, index=True)
    codigo_ine = Column(String(5), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    nombre_normalizado = Column(String(100), nullable=False, index=True)
    region = Column(String(100), nullable=False)
    codigo_region = Column(String(2), nullable=False)
    provincia = Column(String(100), nullable=False)

    # Centroide (reemplaza Geometry MULTIPOLYGON)
    centroid_lat = Column(Float)
    centroid_lon = Column(Float)
    # Bounding box: [minx, miny, maxx, maxy]
    bbox = Column(JSON)

    # Datos demográficos
    poblacion = Column(Integer)
    superficie_km2 = Column(Numeric(10, 2))
    densidad_poblacional = Column(Numeric(10, 2))

    # Datos adicionales
    extra_data = Column(JSON, default=dict)

    def __repr__(self):
        return f"<Comuna(id={self.id}, nombre='{self.nombre}', region='{self.region}')>"

    def to_dict(self, include_geom=False):
        """Serializar a diccionario."""
        data = {
            "id": self.id,
            "codigo_ine": self.codigo_ine,
            "nombre": self.nombre,
            "region": self.region,
            "provincia": self.provincia,
            "poblacion": self.poblacion,
            "superficie_km2": float(self.superficie_km2) if self.superficie_km2 else None,
            "centroid_lat": self.centroid_lat,
            "centroid_lon": self.centroid_lon,
        }
        if include_geom:
            data["bbox"] = self.bbox
        return data
