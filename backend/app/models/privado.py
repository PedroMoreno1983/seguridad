"""
Modelos para operacion de seguridad privada.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base


class OrganizacionPrivada(Base):
    __tablename__ = "organizaciones_privadas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(160), nullable=False, index=True)
    vertical = Column(String(60), nullable=False, index=True)
    rut = Column(String(20), index=True)
    contacto_nombre = Column(String(120))
    contacto_email = Column(String(160))
    estado = Column(String(30), default="prospecto", index=True)
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sedes = relationship("SedePrivada", back_populates="organizacion")
    incidentes = relationship("IncidentePrivado", back_populates="organizacion")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "vertical": self.vertical,
            "rut": self.rut,
            "contacto_nombre": self.contacto_nombre,
            "contacto_email": self.contacto_email,
            "estado": self.estado,
            "metadata": self.extra_data or {},
        }


class SedePrivada(Base):
    __tablename__ = "sedes_privadas"

    id = Column(Integer, primary_key=True, index=True)
    organizacion_id = Column(Integer, ForeignKey("organizaciones_privadas.id"), nullable=False, index=True)
    nombre = Column(String(160), nullable=False, index=True)
    tipo = Column(String(60), nullable=False, index=True)
    direccion = Column(String(220))
    comuna = Column(String(100), index=True)
    region = Column(String(100))
    latitud = Column(Float)
    longitud = Column(Float)
    zonas = Column(JSON, default=list)
    activos_criticos = Column(JSON, default=list)
    activa = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    organizacion = relationship("OrganizacionPrivada", back_populates="sedes")
    incidentes = relationship("IncidentePrivado", back_populates="sede")

    def to_dict(self):
        return {
            "id": self.id,
            "organizacion_id": self.organizacion_id,
            "nombre": self.nombre,
            "tipo": self.tipo,
            "direccion": self.direccion,
            "comuna": self.comuna,
            "region": self.region,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "zonas": self.zonas or [],
            "activos_criticos": self.activos_criticos or [],
            "activa": self.activa,
        }


class IncidentePrivado(Base):
    __tablename__ = "incidentes_privados"

    id = Column(Integer, primary_key=True, index=True)
    organizacion_id = Column(Integer, ForeignKey("organizaciones_privadas.id"), nullable=False, index=True)
    sede_id = Column(Integer, ForeignKey("sedes_privadas.id"), nullable=False, index=True)
    tipo = Column(String(80), nullable=False, index=True)
    categoria = Column(String(80), index=True)
    severidad = Column(Integer, default=2, index=True)
    fecha_hora = Column(DateTime(timezone=True), nullable=False, index=True)
    zona = Column(String(120), index=True)
    descripcion = Column(String(600))
    fuente = Column(String(80), default="manual", index=True)
    monto_estimado = Column(Numeric(12, 2))
    latitud = Column(Float)
    longitud = Column(Float)
    evidencia_url = Column(String(300))
    contexto = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    organizacion = relationship("OrganizacionPrivada", back_populates="incidentes")
    sede = relationship("SedePrivada", back_populates="incidentes")

    def to_dict(self):
        return {
            "id": self.id,
            "organizacion_id": self.organizacion_id,
            "sede_id": self.sede_id,
            "tipo": self.tipo,
            "categoria": self.categoria,
            "severidad": self.severidad,
            "fecha_hora": self.fecha_hora.isoformat() if self.fecha_hora else None,
            "zona": self.zona,
            "descripcion": self.descripcion,
            "fuente": self.fuente,
            "monto_estimado": float(self.monto_estimado) if self.monto_estimado is not None else None,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "evidencia_url": self.evidencia_url,
            "contexto": self.contexto or {},
        }
