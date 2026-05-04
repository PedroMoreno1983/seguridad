import csv
import io
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import require_auth, require_role
from app.database import get_db
from app.models.privado import IncidentePrivado, OrganizacionPrivada, SedePrivada
from app.models.user import Usuario

router = APIRouter()


CSV_TEMPLATES = {
    "organizaciones": {
        "filename": "plantilla_organizaciones_privadas.csv",
        "headers": ["nombre", "vertical", "rut", "contacto_nombre", "contacto_email", "estado"],
        "rows": [
            ["Retail Demo", "retail", "76000000-0", "Gerencia Seguridad", "seguridad@empresa.cl", "piloto"],
        ],
    },
    "sedes": {
        "filename": "plantilla_sedes_privadas.csv",
        "headers": [
            "organizacion_id",
            "organizacion_nombre",
            "nombre",
            "tipo",
            "direccion",
            "comuna",
            "region",
            "latitud",
            "longitud",
            "zonas",
            "activos_criticos",
        ],
        "rows": [
            ["", "Retail Demo", "Sucursal Centro", "tienda", "Av. Principal 123", "Santiago", "Metropolitana", "-33.4489", "-70.6693", "sala ventas|bodega|cajas", "camaras|alarmas|luminarias"],
        ],
    },
    "incidentes": {
        "filename": "plantilla_incidentes_privados.csv",
        "headers": [
            "organizacion_id",
            "organizacion_nombre",
            "sede_id",
            "sede_nombre",
            "tipo",
            "categoria",
            "severidad",
            "fecha_hora",
            "zona",
            "descripcion",
            "fuente",
            "monto_estimado",
            "latitud",
            "longitud",
            "evidencia_url",
        ],
        "rows": [
            ["", "Retail Demo", "", "Sucursal Centro", "Hurto", "perdidas", "4", "2026-04-30 18:45", "sala ventas", "Hurto detectado por guardia", "bitacora", "129990", "-33.4489", "-70.6693", ""],
        ],
    },
}


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


def _clean(value) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _to_int(value, default: Optional[int] = None) -> Optional[int]:
    cleaned = _clean(value)
    if cleaned is None:
        return default
    try:
        return int(float(cleaned))
    except ValueError:
        return default


def _to_float(value) -> Optional[float]:
    cleaned = _clean(value)
    if cleaned is None:
        return None
    try:
        return float(cleaned.replace(",", "."))
    except ValueError:
        return None


def _split_pipe(value) -> List[str]:
    cleaned = _clean(value)
    if cleaned is None:
        return []
    return [item.strip() for item in cleaned.split("|") if item.strip()]


def _parse_dt(value) -> datetime:
    cleaned = _clean(value)
    if cleaned is None:
        return datetime.utcnow()

    normalized = cleaned.replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(cleaned)
    except ValueError as exc:
        raise ValueError("fecha_hora invalida") from exc


async def _read_csv_upload(file: UploadFile) -> List[dict]:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="El CSV debe estar codificado en UTF-8") from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="El CSV no contiene encabezados")
    return list(reader)


def _find_org(db: Session, organizacion_id=None, organizacion_nombre=None):
    org_id = _to_int(organizacion_id)
    if org_id:
        return db.query(OrganizacionPrivada).filter(OrganizacionPrivada.id == org_id).first()

    nombre = _clean(organizacion_nombre)
    if nombre:
        return db.query(OrganizacionPrivada).filter(func.lower(OrganizacionPrivada.nombre) == nombre.lower()).first()

    return None


def _find_sede(db: Session, sede_id=None, organizacion_id=None, sede_nombre=None):
    found_sede_id = _to_int(sede_id)
    if found_sede_id:
        query = db.query(SedePrivada).filter(SedePrivada.id == found_sede_id)
        org_id = _to_int(organizacion_id)
        if org_id:
            query = query.filter(SedePrivada.organizacion_id == org_id)
        return query.first()

    nombre = _clean(sede_nombre)
    org_id = _to_int(organizacion_id)
    if nombre and org_id:
        return db.query(SedePrivada).filter(
            SedePrivada.organizacion_id == org_id,
            func.lower(SedePrivada.nombre) == nombre.lower(),
        ).first()

    return None


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


@router.get("/privados/plantillas/{tipo}")
async def descargar_plantilla_privada(
    tipo: str,
    _: Usuario = Depends(require_auth),
):
    template = CSV_TEMPLATES.get(tipo)
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(template["headers"])
    writer.writerows(template["rows"])
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{template["filename"]}"'},
    )


@router.post("/privados/importar/organizaciones")
async def importar_organizaciones_privadas(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_role("autoridad", "tecnico")),
):
    rows = await _read_csv_upload(file)
    resultado = {"archivo": file.filename, "procesadas": len(rows), "insertadas": 0, "actualizadas": 0, "errores": []}

    for index, row in enumerate(rows, start=2):
        nombre = _clean(row.get("nombre"))
        vertical = (_clean(row.get("vertical")) or "").lower()
        if not nombre or not vertical:
            resultado["errores"].append({"fila": index, "error": "nombre y vertical son obligatorios"})
            continue

        rut = _clean(row.get("rut"))
        query = db.query(OrganizacionPrivada)
        organizacion = None
        if rut:
            organizacion = query.filter(OrganizacionPrivada.rut == rut).first()
        if not organizacion:
            organizacion = query.filter(func.lower(OrganizacionPrivada.nombre) == nombre.lower()).first()

        if organizacion:
            organizacion.vertical = vertical
            organizacion.rut = rut or organizacion.rut
            organizacion.contacto_nombre = _clean(row.get("contacto_nombre")) or organizacion.contacto_nombre
            organizacion.contacto_email = _clean(row.get("contacto_email")) or organizacion.contacto_email
            organizacion.estado = _clean(row.get("estado")) or organizacion.estado
            resultado["actualizadas"] += 1
            continue

        db.add(OrganizacionPrivada(
            nombre=nombre,
            vertical=vertical,
            rut=rut,
            contacto_nombre=_clean(row.get("contacto_nombre")),
            contacto_email=_clean(row.get("contacto_email")),
            estado=_clean(row.get("estado")) or "prospecto",
            extra_data={"origen": "csv"},
        ))
        resultado["insertadas"] += 1

    db.commit()
    return resultado


@router.post("/privados/importar/sedes")
async def importar_sedes_privadas(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_role("autoridad", "tecnico")),
):
    rows = await _read_csv_upload(file)
    resultado = {"archivo": file.filename, "procesadas": len(rows), "insertadas": 0, "actualizadas": 0, "errores": []}

    for index, row in enumerate(rows, start=2):
        organizacion = _find_org(db, row.get("organizacion_id"), row.get("organizacion_nombre"))
        nombre = _clean(row.get("nombre"))
        tipo = _clean(row.get("tipo")) or "sede"
        if not organizacion:
            resultado["errores"].append({"fila": index, "error": "organizacion no encontrada"})
            continue
        if not nombre:
            resultado["errores"].append({"fila": index, "error": "nombre de sede obligatorio"})
            continue

        sede = _find_sede(db, None, organizacion.id, nombre)
        if sede:
            sede.tipo = tipo
            sede.direccion = _clean(row.get("direccion")) or sede.direccion
            sede.comuna = _clean(row.get("comuna")) or sede.comuna
            sede.region = _clean(row.get("region")) or sede.region
            sede.latitud = _to_float(row.get("latitud")) if _clean(row.get("latitud")) else sede.latitud
            sede.longitud = _to_float(row.get("longitud")) if _clean(row.get("longitud")) else sede.longitud
            sede.zonas = _split_pipe(row.get("zonas")) or sede.zonas
            sede.activos_criticos = _split_pipe(row.get("activos_criticos")) or sede.activos_criticos
            resultado["actualizadas"] += 1
            continue

        db.add(SedePrivada(
            organizacion_id=organizacion.id,
            nombre=nombre,
            tipo=tipo,
            direccion=_clean(row.get("direccion")),
            comuna=_clean(row.get("comuna")),
            region=_clean(row.get("region")),
            latitud=_to_float(row.get("latitud")),
            longitud=_to_float(row.get("longitud")),
            zonas=_split_pipe(row.get("zonas")),
            activos_criticos=_split_pipe(row.get("activos_criticos")),
        ))
        resultado["insertadas"] += 1

    db.commit()
    return resultado


@router.post("/privados/importar/incidentes")
async def importar_incidentes_privados(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_role("autoridad", "tecnico")),
):
    rows = await _read_csv_upload(file)
    resultado = {"archivo": file.filename, "procesadas": len(rows), "insertadas": 0, "errores": []}

    for index, row in enumerate(rows, start=2):
        organizacion = _find_org(db, row.get("organizacion_id"), row.get("organizacion_nombre"))
        if not organizacion:
            resultado["errores"].append({"fila": index, "error": "organizacion no encontrada"})
            continue

        sede = _find_sede(db, row.get("sede_id"), organizacion.id, row.get("sede_nombre"))
        if not sede:
            resultado["errores"].append({"fila": index, "error": "sede no encontrada"})
            continue

        tipo = _clean(row.get("tipo"))
        if not tipo:
            resultado["errores"].append({"fila": index, "error": "tipo de incidente obligatorio"})
            continue

        try:
            fecha_hora = _parse_dt(row.get("fecha_hora"))
        except ValueError as exc:
            resultado["errores"].append({"fila": index, "error": str(exc)})
            continue

        db.add(IncidentePrivado(
            organizacion_id=organizacion.id,
            sede_id=sede.id,
            tipo=tipo,
            categoria=_clean(row.get("categoria")),
            severidad=max(1, min(5, _to_int(row.get("severidad"), 2) or 2)),
            fecha_hora=fecha_hora,
            zona=_clean(row.get("zona")),
            descripcion=_clean(row.get("descripcion")),
            fuente=_clean(row.get("fuente")) or "csv",
            monto_estimado=_to_float(row.get("monto_estimado")),
            latitud=_to_float(row.get("latitud")),
            longitud=_to_float(row.get("longitud")),
            evidencia_url=_clean(row.get("evidencia_url")),
            contexto={"origen": "csv"},
        ))
        resultado["insertadas"] += 1

    db.commit()
    return resultado


@router.get("/privados/organizaciones")
async def listar_organizaciones_privadas(
    vertical: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_auth),
):
    query = db.query(OrganizacionPrivada)
    if vertical:
        query = query.filter(OrganizacionPrivada.vertical == vertical)
    if estado:
        query = query.filter(OrganizacionPrivada.estado == estado)
    organizaciones = query.order_by(OrganizacionPrivada.nombre.asc()).all()
    return [organizacion.to_dict() for organizacion in organizaciones]


@router.post("/privados/organizaciones")
async def crear_organizacion_privada(
    payload: OrganizacionPrivadaCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_role("autoridad", "tecnico")),
):
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
    _: Usuario = Depends(require_auth),
):
    query = db.query(SedePrivada)
    if organizacion_id:
        query = query.filter(SedePrivada.organizacion_id == organizacion_id)
    sedes = query.order_by(SedePrivada.nombre.asc()).all()
    return [sede.to_dict() for sede in sedes]


@router.post("/privados/sedes")
async def crear_sede_privada(
    payload: SedePrivadaCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_role("autoridad", "tecnico")),
):
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
    _: Usuario = Depends(require_auth),
):
    query = db.query(IncidentePrivado)
    if organizacion_id:
        query = query.filter(IncidentePrivado.organizacion_id == organizacion_id)
    if sede_id:
        query = query.filter(IncidentePrivado.sede_id == sede_id)
    incidentes = query.order_by(IncidentePrivado.fecha_hora.desc()).limit(limit).all()
    return [incidente.to_dict() for incidente in incidentes]


@router.post("/privados/incidentes")
async def crear_incidente_privado(
    payload: IncidentePrivadoCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_role("autoridad", "tecnico")),
):
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
    _: Usuario = Depends(require_auth),
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
