from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.privado import IncidentePrivado, OrganizacionPrivada, SedePrivada


router = APIRouter()


class OrganizacionPrivadaCreate(BaseModel):
    nombre: str
    vertical: str
    rut: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_email: Optional[str] = None
    estado: str = "prospecto"
    metadata: dict = Field(default_factory=dict)


class SedePrivadaCreate(BaseModel):
    organizacion_id: int
    nombre: str
    tipo: str
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    zonas: List[str] = Field(default_factory=list)
    activos_criticos: List[str] = Field(default_factory=list)


class IncidentePrivadoCreate(BaseModel):
    organizacion_id: int
    sede_id: int
    tipo: str
    categoria: Optional[str] = None
    severidad: int = Field(2, ge=1, le=5)
    fecha_hora: Optional[datetime] = None
    zona: Optional[str] = None
    descripcion: Optional[str] = None
    fuente: str = "manual"
    monto_estimado: Optional[float] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    evidencia_url: Optional[str] = None
    contexto: dict = Field(default_factory=dict)


def _assert_org(db: Session, organizacion_id: int):
    organizacion = db.query(OrganizacionPrivada).filter(OrganizacionPrivada.id == organizacion_id).first()
    if not organizacion:
        raise HTTPException(status_code=404, detail="Organizacion privada no encontrada")
    return organizacion


def _assert_sede(db: Session, sede_id: int, organizacion_id: Optional[int] = None):
    query = db.query(SedePrivada).filter(SedePrivada.id == sede_id)
    if organizacion_id:
        query = query.filter(SedePrivada.organizacion_id == organizacion_id)
    sede = query.first()
    if not sede:
        raise HTTPException(status_code=404, detail="Sede privada no encontrada")
    return sede


@router.get("/privados/organizaciones")
async def listar_organizaciones_privadas(
    vertical: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(OrganizacionPrivada)
    if vertical:
        query = query.filter(OrganizacionPrivada.vertical == vertical)
    if estado:
        query = query.filter(OrganizacionPrivada.estado == estado)
    organizaciones = query.order_by(OrganizacionPrivada.nombre.asc()).all()
    return [organizacion.to_dict() for organizacion in organizaciones]


@router.post("/privados/organizaciones")
async def crear_organizacion_privada(payload: OrganizacionPrivadaCreate, db: Session = Depends(get_db)):
    organizacion = OrganizacionPrivada(
        nombre=payload.nombre,
        vertical=payload.vertical.lower().strip(),
        rut=payload.rut,
        contacto_nombre=payload.contacto_nombre,
        contacto_email=payload.contacto_email,
        estado=payload.estado,
        extra_data=payload.metadata,
    )
    db.add(organizacion)
    db.commit()
    db.refresh(organizacion)
    return organizacion.to_dict()


@router.get("/privados/sedes")
async def listar_sedes_privadas(
    organizacion_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(SedePrivada)
    if organizacion_id:
        query = query.filter(SedePrivada.organizacion_id == organizacion_id)
    sedes = query.order_by(SedePrivada.nombre.asc()).all()
    return [sede.to_dict() for sede in sedes]


@router.post("/privados/sedes")
async def crear_sede_privada(payload: SedePrivadaCreate, db: Session = Depends(get_db)):
    _assert_org(db, payload.organizacion_id)
    sede = SedePrivada(
        organizacion_id=payload.organizacion_id,
        nombre=payload.nombre,
        tipo=payload.tipo,
        direccion=payload.direccion,
        comuna=payload.comuna,
        region=payload.region,
        latitud=payload.latitud,
        longitud=payload.longitud,
        zonas=payload.zonas,
        activos_criticos=payload.activos_criticos,
    )
    db.add(sede)
    db.commit()
    db.refresh(sede)
    return sede.to_dict()


@router.get("/privados/incidentes")
async def listar_incidentes_privados(
    organizacion_id: Optional[int] = Query(None),
    sede_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = db.query(IncidentePrivado)
    if organizacion_id:
        query = query.filter(IncidentePrivado.organizacion_id == organizacion_id)
    if sede_id:
        query = query.filter(IncidentePrivado.sede_id == sede_id)
    incidentes = query.order_by(IncidentePrivado.fecha_hora.desc()).limit(limit).all()
    return [incidente.to_dict() for incidente in incidentes]


@router.post("/privados/incidentes")
async def crear_incidente_privado(payload: IncidentePrivadoCreate, db: Session = Depends(get_db)):
    _assert_org(db, payload.organizacion_id)
    _assert_sede(db, payload.sede_id, payload.organizacion_id)
    incidente = IncidentePrivado(
        organizacion_id=payload.organizacion_id,
        sede_id=payload.sede_id,
        tipo=payload.tipo,
        categoria=payload.categoria,
        severidad=payload.severidad,
        fecha_hora=payload.fecha_hora or datetime.utcnow(),
        zona=payload.zona,
        descripcion=payload.descripcion,
        fuente=payload.fuente,
        monto_estimado=payload.monto_estimado,
        latitud=payload.latitud,
        longitud=payload.longitud,
        evidencia_url=payload.evidencia_url,
        contexto=payload.contexto,
    )
    db.add(incidente)
    db.commit()
    db.refresh(incidente)
    return incidente.to_dict()


@router.get("/privados/resumen-operativo")
async def resumen_operativo_privado(
    organizacion_id: Optional[int] = Query(None),
    dias: int = Query(365, ge=7, le=2000),
    db: Session = Depends(get_db),
):
    fecha_inicio = datetime.utcnow() - timedelta(days=dias)
    incidentes_query = db.query(IncidentePrivado).filter(IncidentePrivado.fecha_hora >= fecha_inicio)
    sedes_query = db.query(SedePrivada)

    if organizacion_id:
        _assert_org(db, organizacion_id)
        incidentes_query = incidentes_query.filter(IncidentePrivado.organizacion_id == organizacion_id)
        sedes_query = sedes_query.filter(SedePrivada.organizacion_id == organizacion_id)

    total_incidentes = incidentes_query.count()
    total_sedes = sedes_query.count()
    total_perdidas = incidentes_query.with_entities(func.coalesce(func.sum(IncidentePrivado.monto_estimado), 0)).scalar() or 0
    incidentes_geocodificados = incidentes_query.filter(
        IncidentePrivado.latitud.isnot(None),
        IncidentePrivado.longitud.isnot(None),
    ).count()

    por_tipo = incidentes_query.with_entities(
        IncidentePrivado.tipo,
        func.count(IncidentePrivado.id).label("cantidad"),
    ).group_by(IncidentePrivado.tipo).order_by(func.count(IncidentePrivado.id).desc()).limit(8).all()

    por_sede = incidentes_query.join(SedePrivada, SedePrivada.id == IncidentePrivado.sede_id).with_entities(
        SedePrivada.id,
        SedePrivada.nombre,
        func.count(IncidentePrivado.id).label("incidentes"),
        func.coalesce(func.sum(IncidentePrivado.monto_estimado), 0).label("perdidas"),
    ).group_by(SedePrivada.id, SedePrivada.nombre).order_by(func.count(IncidentePrivado.id).desc()).limit(10).all()

    por_fuente = incidentes_query.with_entities(
        IncidentePrivado.fuente,
        func.count(IncidentePrivado.id).label("cantidad"),
    ).group_by(IncidentePrivado.fuente).order_by(func.count(IncidentePrivado.id).desc()).all()

    return {
        "estado": "con_datos" if total_incidentes else "sin_datos",
        "dias": dias,
        "organizacion_id": organizacion_id,
        "resumen": {
            "sedes": total_sedes,
            "incidentes": total_incidentes,
            "perdidas_estimadas": float(total_perdidas),
            "incidentes_geocodificados": incidentes_geocodificados,
            "porcentaje_geocodificado": round((incidentes_geocodificados / total_incidentes) * 100, 1) if total_incidentes else 0,
        },
        "por_tipo": [{"tipo": row.tipo, "cantidad": row.cantidad} for row in por_tipo],
        "por_sede": [
            {
                "sede_id": row.id,
                "sede": row.nombre,
                "incidentes": row.incidentes,
                "perdidas_estimadas": float(row.perdidas or 0),
            }
            for row in por_sede
        ],
        "por_fuente": [{"fuente": row.fuente or "desconocida", "cantidad": row.cantidad} for row in por_fuente],
        "siguiente_accion": (
            "Cargar incidentes privados o conectar bitacoras, POS y rondas para activar el resumen."
            if not total_incidentes else
            "Priorizar sedes con mayor recurrencia y cruzar fuentes de mayor valor predictivo."
        ),
    }
