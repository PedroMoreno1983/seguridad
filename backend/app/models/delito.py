"""
Modelo Delito
=============
Registro individual de incidentes delictuales.
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Numeric, SmallInteger, Boolean, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Delito(Base):
    __tablename__ = "delitos"
    
    id = Column(BigInteger, primary_key=True, index=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)
    
    # Clasificación del delito
    tipo_delito = Column(String(100), nullable=False, index=True)
    subtipo = Column(String(100))
    descripcion = Column(String(500))
    
    # Geolocalización precisa (almacenada como lat/lon simples)
    latitud = Column(Float)
    longitud = Column(Float)
    cuadrante = Column(String(50), index=True)
    barrio = Column(String(100))
    direccion = Column(String(200))
    
    # Temporal
    fecha_hora = Column(DateTime(timezone=True), nullable=False, index=True)
    fecha_denuncia = Column(DateTime(timezone=True))
    dia_semana = Column(SmallInteger)  # 0=Lunes, 6=Domingo
    hora_del_dia = Column(SmallInteger)  # 0-23
    es_fin_semana = Column(Boolean)
    
    # Contexto para Risk Terrain Modeling
    contexto = Column(JSON, default=dict)
    # Ejemplo: {"luminaria_mts": 15, "tipo_vivienda": "departamento", 
    #           "cajero_cercano": true, "paradero_mts": 50}
    
    # Fuente y calidad
    fuente = Column(String(50), default="desconocida")  # carabineros, pdi, 1461, denuncia
    confianza = Column(Numeric(3, 2), default=1.0)  # 0.0 a 1.0
    validado = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    comuna = relationship("Comuna", back_populates="delitos")
    
    def __repr__(self):
        return f"<Delito(id={self.id}, tipo='{self.tipo_delito}', comuna_id={self.comuna_id})>"
    
    def to_dict(self):
        """Serializar a diccionario."""
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "tipo_delito": self.tipo_delito,
            "subtipo": self.subtipo,
            "descripcion": self.descripcion,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "cuadrante": self.cuadrante,
            "barrio": self.barrio,
            "direccion": self.direccion,
            "fecha_hora": self.fecha_hora.isoformat() if self.fecha_hora else None,
            "dia_semana": self.dia_semana,
            "hora_del_dia": self.hora_del_dia,
            "fuente": self.fuente,
            "confianza": float(self.confianza) if self.confianza else 1.0,
        }


# Back-reference en Comuna
from app.models.comuna import Comuna
Comuna.delitos = relationship("Delito", back_populates="comuna")
