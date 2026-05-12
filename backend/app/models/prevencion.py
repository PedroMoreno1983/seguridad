"""
Modelos de prevencion social y alertas responsables.
"""

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class EducacionComunal(Base):
    __tablename__ = "educacion_comunal"

    id = Column(Integer, primary_key=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)
    anio = Column(Integer, nullable=False, index=True)

    matricula_total = Column(Integer)
    estudiantes_desvinculados = Column(Integer)
    tasa_desvinculacion = Column(Numeric(5, 2))
    estudiantes_revinculados = Column(Integer)
    tasa_revinculacion = Column(Numeric(5, 2))
    inasistencia_grave_pct = Column(Numeric(5, 2))
    retiro_basica_pct = Column(Numeric(5, 2))
    retiro_media_pct = Column(Numeric(5, 2))

    fuente = Column(String(120), default="Mineduc / Centro de Estudios")
    metodologia = Column(Text)
    fecha_actualizacion = Column(Date)
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    comuna = relationship("Comuna", back_populates="educacion")

    __table_args__ = (
        UniqueConstraint("comuna_id", "anio", name="uq_educacion_comuna_anio"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "anio": self.anio,
            "matricula_total": self.matricula_total,
            "estudiantes_desvinculados": self.estudiantes_desvinculados,
            "tasa_desvinculacion": float(self.tasa_desvinculacion) if self.tasa_desvinculacion is not None else None,
            "estudiantes_revinculados": self.estudiantes_revinculados,
            "tasa_revinculacion": float(self.tasa_revinculacion) if self.tasa_revinculacion is not None else None,
            "inasistencia_grave_pct": float(self.inasistencia_grave_pct) if self.inasistencia_grave_pct is not None else None,
            "retiro_basica_pct": float(self.retiro_basica_pct) if self.retiro_basica_pct is not None else None,
            "retiro_media_pct": float(self.retiro_media_pct) if self.retiro_media_pct is not None else None,
            "fuente": self.fuente,
            "metodologia": self.metodologia,
            "fecha_actualizacion": self.fecha_actualizacion.isoformat() if self.fecha_actualizacion else None,
            "extra_data": self.extra_data or {},
        }


class AlertaResponsable(Base):
    __tablename__ = "alertas_responsables"

    id = Column(Integer, primary_key=True)
    comuna_id = Column(Integer, ForeignKey("comunas.id"), nullable=False, index=True)
    origen = Column(String(80), nullable=False, default="SafeCity")
    categoria = Column(String(80), nullable=False)
    nivel_riesgo = Column(String(20), nullable=False, default="medio")
    descripcion = Column(Text, nullable=False)
    confianza = Column(Numeric(4, 2), default=0.0)
    accion_sugerida = Column(Text)
    estado = Column(String(30), nullable=False, default="pendiente")
    responsable = Column(String(120))
    plazo_horas = Column(Integer, default=72)
    decision = Column(Text)
    criterios = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    comuna = relationship("Comuna", back_populates="alertas_responsables")

    def to_dict(self):
        return {
            "id": self.id,
            "comuna_id": self.comuna_id,
            "origen": self.origen,
            "categoria": self.categoria,
            "nivel_riesgo": self.nivel_riesgo,
            "descripcion": self.descripcion,
            "confianza": float(self.confianza) if self.confianza is not None else None,
            "accion_sugerida": self.accion_sugerida,
            "estado": self.estado,
            "responsable": self.responsable,
            "plazo_horas": self.plazo_horas,
            "decision": self.decision,
            "criterios": self.criterios or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


from app.models.comuna import Comuna

Comuna.educacion = relationship("EducacionComunal", back_populates="comuna")
Comuna.alertas_responsables = relationship("AlertaResponsable", back_populates="comuna")
