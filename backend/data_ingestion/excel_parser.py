import os
import sys
import zlib
import hashlib
import re
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models.delito import Delito
from app.models.comuna import Comuna
from comunas_config import get_comuna_metadata, normalize_text

IGNORED_SHEET_KEYWORDS = (
    "plan operativo",
    "plan de compras",
    "proyectos de inversion",
    "contratos vigentes",
    "solicitud publicidad",
)


def _excel_source(file_path: str, sheet_name: str) -> str:
    digest = hashlib.sha1(str(Path(file_path).resolve()).lower().encode("utf-8")).hexdigest()[:10]
    sheet = normalize_text(sheet_name).replace(" ", "_")[:28]
    return f"Excel:{digest}:{sheet}"[:50]


def _stable_fallback_ine(nombre_norm: str) -> str:
    return str(90000 + (zlib.crc32(nombre_norm.encode("utf-8")) % 10000))


def get_or_create_comuna(db: Session, nombre_comuna: str):
    nombre_norm = normalize_text(nombre_comuna)
    metadata = get_comuna_metadata(nombre_comuna)
    codigo_ine = metadata.get("codigo_ine", _stable_fallback_ine(nombre_norm))

    comuna = db.query(Comuna).filter(Comuna.nombre_normalizado == nombre_norm).first()
    if not comuna:
        comuna = db.query(Comuna).filter(Comuna.codigo_ine == codigo_ine).first()

    if not comuna:
        for candidate in db.query(Comuna).all():
            if normalize_text(candidate.nombre_normalizado) == nombre_norm or normalize_text(candidate.nombre) == nombre_norm:
                comuna = candidate
                break

    if comuna:
        changed = False
        if comuna.nombre_normalizado != nombre_norm:
            comuna.nombre_normalizado = nombre_norm
            changed = True
        if comuna.nombre != nombre_comuna:
            comuna.nombre = nombre_comuna
            changed = True
        for field in ("region", "codigo_region", "provincia"):
            value = metadata.get(field)
            if value and getattr(comuna, field) != value:
                setattr(comuna, field, value)
                changed = True
        if metadata.get("codigo_ine") and comuna.codigo_ine != codigo_ine:
            existing = db.query(Comuna).filter(
                Comuna.codigo_ine == codigo_ine,
                Comuna.id != comuna.id,
            ).first()
            if not existing:
                comuna.codigo_ine = codigo_ine
                changed = True
        if changed:
            db.commit()
            db.refresh(comuna)
        return comuna

    print(f"Instanciando nueva comuna: {nombre_comuna}")
    comuna = Comuna(
        codigo_ine=codigo_ine,
        nombre=nombre_comuna,
        nombre_normalizado=nombre_norm,
        region=metadata.get("region", "Region Metropolitana de Santiago"),
        codigo_region=metadata.get("codigo_region", "13"),
        provincia=metadata.get("provincia", "Santiago"),
    )
    db.add(comuna)
    db.commit()
    db.refresh(comuna)
    return comuna


def _find_column(df: pd.DataFrame, *needles: str):
    normalized_needles = tuple(normalize_text(needle) for needle in needles)
    for column in df.columns:
        normalized_column = normalize_text(column)
        if any(needle in normalized_column for needle in normalized_needles):
            return column
    return None


def _column_score(df: pd.DataFrame) -> int:
    score = 0
    if _find_column(df, "fecha", "marca temporal", "timestamp", "tsi_fecha", "ano"):
        score += 1
    if _find_column(
        df,
        "delito",
        "motivo",
        "infraccion",
        "procedimiento",
        "acontecimiento",
        "categoria",
        "macrocategoria",
    ):
        score += 1
    if _find_column(df, "lugar", "direccion", "direccion", "sector", "ubicacion", "ubicacion", "macrosector", "territorio"):
        score += 1
    if _find_column(df, "descripcion", "descripcion", "detalle", "incidente", "observacion", "observacion"):
        score += 1
    return score


def _read_relevant_excel_sheets(file_path: str):
    try:
        workbook = pd.ExcelFile(file_path)
    except Exception:
        return []

    relevant_sheets = []
    for sheet_name in workbook.sheet_names:
        normalized_sheet_name = normalize_text(sheet_name)
        if any(keyword in normalized_sheet_name for keyword in IGNORED_SHEET_KEYWORDS):
            continue

        best_score = 0
        best_header = 0
        for header in range(0, 8):
            try:
                preview = workbook.parse(sheet_name=sheet_name, header=header, nrows=5)
            except Exception:
                continue
            score = _column_score(preview)
            if score > best_score:
                best_score = score
                best_header = header

        if best_score < 2:
            continue

        try:
            df = workbook.parse(sheet_name=sheet_name, header=best_header)
        except Exception:
            continue
        if not df.empty:
            relevant_sheets.append((sheet_name, df))

    return relevant_sheets


def _row_value(row, column, default=None):
    if not column:
        return default
    value = row.get(column, default)
    return default if pd.isna(value) else value


def _to_float(value):
    if pd.isna(value):
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_coordinate_pair(value):
    if value is None or pd.isna(value):
        return None, None

    numbers = re.findall(r"-?\d+(?:[\.,]\d+)?", str(value))
    if len(numbers) < 2:
        return None, None

    first = _to_float(numbers[0])
    second = _to_float(numbers[1])
    if first is None or second is None:
        return None, None

    if -56 <= first <= -17 and -76 <= second <= -66:
        return first, second
    if -76 <= first <= -66 and -56 <= second <= -17:
        return second, first
    return None, None


def _normalize_chile_lat_lon(latitud, longitud):
    if latitud is None or longitud is None:
        return None, None
    if -56 <= latitud <= -17 and -76 <= longitud <= -66:
        return latitud, longitud
    if -76 <= latitud <= -66 and -56 <= longitud <= -17:
        return longitud, latitud
    return None, None


def _is_sector_column(column) -> bool:
    normalized = normalize_text(column)
    return any(token in normalized for token in ("sector", "territorio", "macrosector", "barrio"))


def _parse_datetime(row, date_col, hour_col=None):
    date_value = _row_value(row, date_col)
    if date_value is None:
        return datetime.now()

    normalized_date_col = normalize_text(date_col)
    if normalized_date_col in {"ano"} or normalized_date_col.endswith(" ano"):
        try:
            return datetime(int(float(date_value)), 1, 1)
        except (TypeError, ValueError):
            return datetime.now()

    date_part = pd.to_datetime(date_value, dayfirst=True, errors="coerce")
    if pd.isna(date_part):
        return datetime.now()

    hour = getattr(date_part, "hour", 0)
    minute = getattr(date_part, "minute", 0)
    second = getattr(date_part, "second", 0)
    microsecond = getattr(date_part, "microsecond", 0)

    hour_value = _row_value(row, hour_col)
    if hour_value is not None:
        if isinstance(hour_value, datetime):
            hour, minute, second, microsecond = (
                hour_value.hour,
                hour_value.minute,
                hour_value.second,
                hour_value.microsecond,
            )
        else:
            match = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?", str(hour_value))
            if match:
                hour = min(int(match.group(1)), 23)
                minute = min(int(match.group(2)), 59)
                second = min(int(match.group(3) or 0), 59)
                micro = (match.group(4) or "")[:6].ljust(6, "0")
                microsecond = int(micro or 0)

    return datetime(
        date_part.year,
        date_part.month,
        date_part.day,
        hour,
        minute,
        second,
        microsecond,
    )


def _parse_valparaiso_datetime(row, fecha_col, hora_col):
    fecha_val = _row_value(row, fecha_col)
    if fecha_val is None:
        return None
    return _parse_datetime(row, fecha_col, hora_col)


def _legacy_parse_datetime(row, date_col, hour_col=None):
    date_value = _row_value(row, date_col)
    if date_value is None:
        return datetime.now()

    hour_value = _row_value(row, hour_col)
    try:
        if hour_value is not None:
            return pd.to_datetime(f"{str(date_value).split(' ')[0]} {hour_value}", dayfirst=True)
        return pd.to_datetime(date_value, dayfirst=True)
    except Exception:
        return datetime.now()



def _clean_text(value, default=""):
    if value is None or pd.isna(value):
        return default
    text = " ".join(str(value).replace("\n", " ").strip().split())
    if text.lower() in {"", "nan", "none", "na", "n/a", "s/i", "sin informacion"}:
        return default
    return text


def _first_text(row, *columns, default=""):
    for column in columns:
        value = _clean_text(_row_value(row, column))
        if value:
            return value
    return default


def _new_delito(
    *,
    comuna_id: int,
    tipo: str,
    fecha_hora,
    source: str,
    subtipo: str = "",
    direccion: str = "",
    barrio: str = "",
    descripcion: str = "",
    latitud=None,
    longitud=None,
    contexto: dict | None = None,
):
    latitud, longitud = _normalize_chile_lat_lon(latitud, longitud)
    has_coords = latitud is not None and longitud is not None
    dt = fecha_hora if isinstance(fecha_hora, datetime) else pd.to_datetime(fecha_hora, errors="coerce")
    if pd.isna(dt):
        dt = datetime.now()
    if not isinstance(dt, datetime):
        dt = dt.to_pydatetime()
    return Delito(
        comuna_id=comuna_id,
        tipo_delito=_clean_text(tipo, "Incidente Generico")[:100],
        subtipo=_clean_text(subtipo)[:100] or None,
        direccion=_clean_text(direccion)[:200] or None,
        barrio=_clean_text(barrio)[:100] or None,
        latitud=latitud,
        longitud=longitud,
        geocode_precision="exacta" if has_coords else "sin_senal",
        geocode_source="source_coordinates" if has_coords else "pending_materialization",
        geocode_confidence=0.95 if has_coords else 0.0,
        descripcion=_clean_text(descripcion)[:500] or None,
        fecha_hora=dt,
        fuente=source,
        contexto=contexto or {},
        dia_semana=dt.weekday(),
        hora_del_dia=dt.hour,
        es_fin_semana=dt.weekday() >= 5,
    )


def _commit_every(db: Session, count: int, chunk: int = 1000):
    if count and count % chunk == 0:
        db.commit()


def parse_pudahuel_patrullajes(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando Pudahuel patrullajes: {os.path.basename(file_path)}")
    sheets = ["Respuestas de formulario 1"]
    total = 0
    sources = [_excel_source(file_path, sheet) for sheet in sheets]
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente.in_(sources)).delete()
    for sheet in sheets:
        try:
            df = pd.read_excel(file_path, sheet_name=sheet)
        except Exception:
            continue
        source = _excel_source(file_path, sheet)
        date_col = _find_column(df, "marca temporal")
        patrol_col = _find_column(df, "tipo de patrullaje")
        proc_col = _find_column(df, "tipo de procedimiento")
        event_col = _find_column(df, "tipo de acontecimiento")
        delito_col = _find_column(df, "delito", "falta asociada")
        ticket_col = _find_column(df, "ticket")
        sector_col = _find_column(df, "sector")
        address_col = _find_column(df, "direccion", "direccion")
        detail_col = _find_column(df, "detalle", "observaciones")
        coords_col = _find_column(df, "coordenadas")
        uv_col = _find_column(df, "uv")
        territorio_col = _find_column(df, "territorio")
        for _, row in df.iterrows():
            dt = _parse_datetime(row, date_col)
            tipo = _first_text(row, delito_col, event_col, proc_col, patrol_col, default="Patrullaje municipal")
            sector = _first_text(row, sector_col)
            direccion = _first_text(row, address_col)
            latitud, longitud = _parse_coordinate_pair(_row_value(row, coords_col))
            contexto = {
                "archivo": os.path.basename(file_path),
                "hoja": sheet,
                "ticket": _first_text(row, ticket_col),
                "patrullaje": _first_text(row, patrol_col),
                "procedimiento": _first_text(row, proc_col),
                "acontecimiento": _first_text(row, event_col),
                "uv": _first_text(row, uv_col),
                "territorio": _first_text(row, territorio_col),
                "direccion_exacta": direccion,
            }
            db.add(_new_delito(
                comuna_id=comuna_id,
                tipo=tipo,
                subtipo=_first_text(row, event_col, proc_col),
                direccion=direccion,
                barrio=sector or _first_text(row, territorio_col),
                latitud=latitud,
                longitud=longitud,
                descripcion=_first_text(row, detail_col),
                fecha_hora=dt,
                source=source,
                contexto=contexto,
            ))
            total += 1
            _commit_every(db, total)
    db.commit()
    return total


def parse_pudahuel_atencion_telefonica(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando Pudahuel atencion telefonica: {os.path.basename(file_path)}")
    sheet = "Respuestas de formulario 1"
    source = _excel_source(file_path, sheet)
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente == source).delete()
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
    except Exception:
        return 0
    date_col = _find_column(df, "marca temporal")
    sector_col = _find_column(df, "sector")
    incident_col = _find_column(df, "identificacion", "incidente")
    ticket_col = _find_column(df, "ticket")
    obs_col = _find_column(df, "observaciones")
    deriv_col = _find_column(df, "deriva")
    count = 0
    for _, row in df.iterrows():
        dt = _parse_datetime(row, date_col)
        sector = _first_text(row, sector_col)
        tipo = _first_text(row, incident_col, default="Atencion telefonica 1514")
        db.add(_new_delito(
            comuna_id=comuna_id,
            tipo=tipo,
            subtipo="Atencion telefonica 1514",
            barrio=sector,
            descripcion=_first_text(row, obs_col),
            fecha_hora=dt,
            source=source,
            contexto={
                "archivo": os.path.basename(file_path),
                "hoja": sheet,
                "ticket": _first_text(row, ticket_col),
                "derivado": _first_text(row, deriv_col),
            },
        ))
        count += 1
        _commit_every(db, count)
    db.commit()
    return count


def parse_pudahuel_registro_prevencion(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando Pudahuel registro prevencion: {os.path.basename(file_path)}")
    sheet = "Hoja1"
    source = _excel_source(file_path, sheet)
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente == source).delete()
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
    except Exception:
        return 0
    date_col = _find_column(df, "marca temporal")
    territory_col = _find_column(df, "territorio")
    type_col = _find_column(df, "tipo de requerimiento")
    address_col = _find_column(df, "direccion del requerimiento", "direccion del requerimiento")
    derived_col = _find_column(df, "programa", "derivado")
    count = 0
    for _, row in df.iterrows():
        direccion = _first_text(row, address_col)
        db.add(_new_delito(
            comuna_id=comuna_id,
            tipo=_first_text(row, type_col, default="Requerimiento comunitario"),
            subtipo="Mas comunidad mas prevencion",
            direccion=direccion,
            barrio=_first_text(row, territory_col),
            descripcion=_first_text(row, derived_col),
            fecha_hora=_parse_datetime(row, date_col),
            source=source,
            contexto={"archivo": os.path.basename(file_path), "hoja": sheet, "direccion_exacta": direccion},
        ))
        count += 1
    db.commit()
    return count


def parse_valparaiso_citaciones(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando Valparaiso citaciones: {os.path.basename(file_path)}")
    workbook = pd.ExcelFile(file_path)
    sources = [_excel_source(file_path, sheet) for sheet in workbook.sheet_names]
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente.in_(sources)).delete()
    count = 0
    for sheet in workbook.sheet_names:
        df = workbook.parse(sheet_name=sheet)
        source = _excel_source(file_path, sheet)
        date_col = _find_column(df, "fecha infraccion", "fecha")
        type_col = _find_column(df, "infraccion")
        place_col = _find_column(df, "lugar")
        citation_col = _find_column(df, "citacion")
        for _, row in df.iterrows():
            direccion = _first_text(row, place_col)
            if not direccion:
                continue
            db.add(_new_delito(
                comuna_id=comuna_id,
                tipo=_first_text(row, type_col, default="Citacion municipal"),
                subtipo="Citacion",
                direccion=direccion,
                barrio=direccion,
                fecha_hora=_parse_datetime(row, date_col),
                source=source,
                contexto={"archivo": os.path.basename(file_path), "hoja": sheet, "citacion": _first_text(row, citation_col), "direccion_exacta": direccion},
            ))
            count += 1
            _commit_every(db, count)
    db.commit()
    return count


def parse_valparaiso_ingresos(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando Valparaiso ingresos: {os.path.basename(file_path)}")
    workbook = pd.ExcelFile(file_path)
    sources = [_excel_source(file_path, sheet) for sheet in workbook.sheet_names]
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente.in_(sources)).delete()
    count = 0
    for sheet in workbook.sheet_names:
        df = workbook.parse(sheet_name=sheet)
        source = _excel_source(file_path, sheet)
        date_col = _find_column(df, "tsi_fecha", "fecha")
        type_col = _find_column(df, "tsi_materia", "materia")
        sector_col = _find_column(df, "tsi_sector")
        detail_col = _find_column(df, "tsi_sector_detalle")
        address_col = _find_column(df, "tsi_sector_direccion", "tsi_sector_direccion")
        state_col = _find_column(df, "estado", "expr")
        number_col = _find_column(df, "tsi_numero")
        for _, row in df.iterrows():
            direccion = _first_text(row, address_col, detail_col)
            sector = _first_text(row, sector_col)
            db.add(_new_delito(
                comuna_id=comuna_id,
                tipo=_first_text(row, type_col, default="Ingreso municipal"),
                subtipo="Ingreso municipal",
                direccion=direccion,
                barrio=sector,
                descripcion=_first_text(row, state_col),
                fecha_hora=_parse_datetime(row, date_col),
                source=source,
                contexto={"archivo": os.path.basename(file_path), "hoja": sheet, "numero": _first_text(row, number_col), "direccion_exacta": direccion},
            ))
            count += 1
            _commit_every(db, count)
    db.commit()
    return count


def parse_lagranja_partes(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando La Granja partes: {os.path.basename(file_path)}")
    sheet = "LISTADO"
    source = _excel_source(file_path, sheet)
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente == source).delete()
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
    except Exception:
        return 0
    date_col = _find_column(df, "fechaparteinsp", "fechaturno")
    hour_col = _find_column(df, "horario_insp")
    type_col = _find_column(df, "nombreinfraccion", "descinfraccioninsp", "tipo_visita")
    desc_col = _find_column(df, "descinfraccioninsp", "lininfraccioninsp")
    address_col = _find_column(df, "direccioncomercio")
    activity_col = _find_column(df, "actividad")
    notif_col = _find_column(df, "notifinsp")
    count = 0
    for _, row in df.iterrows():
        direccion = _first_text(row, address_col)
        tipo = _first_text(row, type_col, default="Parte cursado")
        db.add(_new_delito(
            comuna_id=comuna_id,
            tipo=tipo,
            subtipo=_first_text(row, activity_col),
            direccion=direccion,
            barrio=direccion,
            descripcion=_first_text(row, desc_col),
            fecha_hora=_parse_datetime(row, date_col, hour_col),
            source=source,
            contexto={"archivo": os.path.basename(file_path), "hoja": sheet, "notificacion": _first_text(row, notif_col), "direccion_exacta": direccion},
        ))
        count += 1
        _commit_every(db, count)
    db.commit()
    return count


def parse_lagranja_procedimientos(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando La Granja procedimientos: {os.path.basename(file_path)}")
    sheet = next((name for name in pd.ExcelFile(file_path).sheet_names if "procedimientos" in normalize_text(name) and "2025" in normalize_text(name)), "Procedimientos Año 2025")
    source = _excel_source(file_path, sheet)
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente == source).delete()
    try:
        df = pd.read_excel(file_path, sheet_name=sheet, header=3)
    except Exception:
        return 0
    date_col = _find_column(df, "fecha")
    proc_col = _find_column(df, "indique su procedimiento", "procedimiento")
    patrol_col = _find_column(df, "tipo de patrullaje")
    contact_col = _find_column(df, "modalidad")
    count = 0
    for _, row in df.iterrows():
        if not _first_text(row, date_col):
            continue
        db.add(_new_delito(
            comuna_id=comuna_id,
            tipo=_first_text(row, proc_col, patrol_col, default="Procedimiento seguridad"),
            subtipo=_first_text(row, patrol_col),
            descripcion=_first_text(row, contact_col),
            fecha_hora=_parse_datetime(row, date_col),
            source=source,
            contexto={"archivo": os.path.basename(file_path), "hoja": sheet},
        ))
        count += 1
        _commit_every(db, count)
    db.commit()
    return count

def parse_valparaiso_cctv(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando Valparaiso CCTV: {os.path.basename(file_path)}")
    workbook = pd.ExcelFile(file_path)
    sheet = next(
        (name for name in workbook.sheet_names if "procedimientos" in normalize_text(name)),
        workbook.sheet_names[0],
    )
    try:
        df = workbook.parse(sheet_name=sheet)
    except Exception as e:
        print(f"Error leyendo excel: {e}")
        return 0

    source = _excel_source(file_path, sheet)
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente == source).delete()

    fecha_col = _find_column(df, "fecha")
    hora_col = _find_column(df, "hora")
    tipo_col = _find_column(
        df,
        "delitos e infracciones",
        "accion acc",
        "tipo de suceso",
        "tipo de accion",
        "procedimiento",
    )
    subtipo_col = _find_column(df, "tipo de suceso", "tipo de accion", "accion acc")
    sector_col = _find_column(df, "ut plan", "ut cerros", "unidad territorial", "ut")
    desc_col = _find_column(df, "descripcion del procedimiento", "descripicion del procedimiento", "resultado")
    camera_col = _find_column(df, "camara principal", "n camara")
    lat_col = _find_column(df, "latitud")
    lon_col = _find_column(df, "longitud")
    coords_col = _find_column(df, "coordenadas", "coordenada")

    count = 0
    for _, row in df.iterrows():
        try:
            dt = _parse_valparaiso_datetime(row, fecha_col, hora_col)
            if dt is None:
                continue

            latitud = _to_float(_row_value(row, lat_col))
            longitud = _to_float(_row_value(row, lon_col))
            if (latitud is None or longitud is None) and coords_col:
                latitud, longitud = _parse_coordinate_pair(_row_value(row, coords_col))
            else:
                latitud, longitud = _normalize_chile_lat_lon(latitud, longitud)

            sector = _first_text(row, sector_col)
            db.add(_new_delito(
                comuna_id=comuna_id,
                tipo=_first_text(row, tipo_col, subtipo_col, default="Procedimiento CCTV"),
                subtipo=_first_text(row, subtipo_col),
                barrio=sector,
                latitud=latitud,
                longitud=longitud,
                descripcion=_first_text(row, desc_col),
                fecha_hora=dt,
                source=source,
                contexto={
                    "archivo": os.path.basename(file_path),
                    "hoja": sheet,
                    "camara": _first_text(row, camera_col),
                    "sector": sector,
                },
            ))
            count += 1
            _commit_every(db, count)
        except Exception:
            continue

    db.commit()
    return count

def parse_generic_excel(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando archivo generico: {os.path.basename(file_path)}")
    sheets = _read_relevant_excel_sheets(file_path)
    if not sheets:
        return 0

    sources = [_excel_source(file_path, sheet_name) for sheet_name, _ in sheets]
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente.in_(sources)).delete()

    count = 0
    for sheet_name, df in sheets:
        source = _excel_source(file_path, sheet_name)
        date_col = _find_column(df, "fecha", "marca temporal", "timestamp", "tsi_fecha", "ano")
        hour_col = _find_column(df, "hora")
        type_col = _find_column(
            df,
            "delito",
            "motivo",
            "infraccion",
            "procedimiento",
            "acontecimiento",
            "categoria",
            "macrocategoria",
        )
        addr_col = _find_column(
            df,
            "lugar",
            "direccion",
            "direccion",
            "sector",
            "ubicacion",
            "ubicacion",
            "macrosector",
            "territorio",
        )
        desc_col = _find_column(df, "descripcion", "descripcion", "detalle", "incidente", "observacion", "observacion")
        lat_col = _find_column(df, "latitud", "latitude")
        lon_col = _find_column(df, "longitud", "longitude", "lng")
        coords_col = _find_column(df, "coordenadas", "coordenada", "coords")

        for _, row in df.iterrows():
            try:
                if all(pd.isna(value) for value in row.values):
                    continue

                dt = _parse_datetime(row, date_col, hour_col)
                tipo = str(_row_value(row, type_col, "Incidente Generico"))
                direccion = str(_row_value(row, addr_col, ""))
                desc = str(_row_value(row, desc_col, ""))
                latitud = _to_float(_row_value(row, lat_col))
                longitud = _to_float(_row_value(row, lon_col))
                if (latitud is None or longitud is None) and coords_col:
                    latitud, longitud = _parse_coordinate_pair(_row_value(row, coords_col))
                else:
                    latitud, longitud = _normalize_chile_lat_lon(latitud, longitud)

                delito_obj = Delito(
                    comuna_id=comuna_id,
                    tipo_delito=tipo[:90],
                    direccion=direccion[:190],
                    barrio=direccion[:100] if _is_sector_column(addr_col) else None,
                    latitud=latitud,
                    longitud=longitud,
                    descripcion=desc[:490],
                    fecha_hora=dt,
                    fuente=source,
                    contexto={"archivo": os.path.basename(file_path), "hoja": sheet_name},
                    dia_semana=dt.weekday() if isinstance(dt, datetime) else 0,
                    hora_del_dia=dt.hour if isinstance(dt, datetime) else 0,
                    es_fin_semana=(dt.weekday() >= 5) if isinstance(dt, datetime) else False,
                )
                db.add(delito_obj)
                count += 1
                if count % 1000 == 0:
                    db.commit()
            except Exception:
                continue

    db.commit()
    return count
