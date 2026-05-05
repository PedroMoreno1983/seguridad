"""
Modelo Usuario
==============
Usuarios del sistema con roles y permisos.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False, default="ciudadano")  # ciudadano | autoridad | tecnico | admin
    tipo_usuario = Column(String(20), nullable=False, default="territorial")  # territorial | organizacion
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=True)
    organizacion_id = Column(Integer, ForeignKey("organizaciones_privadas.id"), nullable=True)
    activo = Column(Boolean, default=True)
    avatar_color = Column(String(7), default="#3b82f6")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Usuario(id={self.id}, email='{self.email}', rol='{self.rol}')>"

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "email": self.email,
            "rol": self.rol,
            "tipo_usuario": self.tipo_usuario,
            "comuna_id": self.comuna_id,
            "organizacion_id": self.organizacion_id,
            "activo": self.activo,
            "avatar_color": self.avatar_color,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
