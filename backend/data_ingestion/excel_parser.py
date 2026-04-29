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
        if changed:
            db.commit()
            db.refresh(comuna)
        return comuna

    print(f"Instanciando nueva comuna: {nombre_comuna}")
    comuna = Comuna(
        codigo_ine=codigo_ine,
        nombre=nombre_comuna,
        nombre_normalizado=nombre_norm,
        region=metadata.get("region", "Región Metropolitana de Santiago"),
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
    if _find_column(df, "fecha", "marca temporal", "timestamp", "tsi_fecha", "año", "ano"):
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
    if _find_column(df, "lugar", "direccion", "dirección", "sector", "ubicacion", "ubicación", "macrosector", "territorio"):
        score += 1
    if _find_column(df, "descripcion", "descripción", "detalle", "incidente", "observacion", "observación"):
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


def _parse_datetime(row, date_col, hour_col=None):
    date_value = _row_value(row, date_col)
    if date_value is None:
        return datetime.now()

    normalized_date_col = normalize_text(date_col)
    if normalized_date_col in {"año", "ano"} or normalized_date_col.endswith(" ano"):
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


def parse_valparaiso_cctv(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando archivo Valparaíso: {os.path.basename(file_path)}")
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error leyendo excel: {e}")
        return 0

    fecha_col = _find_column(df, "fecha")
    hora_col = _find_column(df, "hora")
    tipo_col = _find_column(df, "delitos e infracciones", "infracciones", "delitos")
    subtipo_col = _find_column(df, "tipo de suceso", "suceso")
    lat_col = _find_column(df, "latitud")
    lon_col = _find_column(df, "longitud")
    desc_col = _find_column(df, "descripcion del procedimiento", "descripicion del procedimiento", "resultado")
    source = _excel_source(file_path, "CCTV")
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente == source).delete()

    count = 0
    for _, row in df.iterrows():
        try:
            dt = _parse_valparaiso_datetime(row, fecha_col, hora_col)
            if dt is None:
                continue

            delito_obj = Delito(
                comuna_id=comuna_id,
                tipo_delito=str(_row_value(row, tipo_col, "Infracción"))[:90],
                subtipo=str(_row_value(row, subtipo_col, ""))[:90],
                latitud=_to_float(_row_value(row, lat_col)),
                longitud=_to_float(_row_value(row, lon_col)),
                fecha_hora=dt,
                fuente=source,
                descripcion=str(_row_value(row, desc_col, ""))[:490],
                contexto={"archivo": os.path.basename(file_path), "hoja": "CCTV"},
                dia_semana=dt.weekday(),
                hora_del_dia=dt.hour,
                es_fin_semana=dt.weekday() >= 5,
            )
            db.add(delito_obj)
            count += 1
        except Exception:
            continue

    db.commit()
    return count


def parse_generic_excel(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando archivo genérico: {os.path.basename(file_path)}")
    sheets = _read_relevant_excel_sheets(file_path)
    if not sheets:
        return 0

    sources = [_excel_source(file_path, sheet_name) for sheet_name, _ in sheets]
    db.query(Delito).filter(Delito.comuna_id == comuna_id, Delito.fuente.in_(sources)).delete()

    count = 0
    for sheet_name, df in sheets:
        source = _excel_source(file_path, sheet_name)
        date_col = _find_column(df, "fecha", "marca temporal", "timestamp", "tsi_fecha", "año", "ano")
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
            "dirección",
            "sector",
            "ubicacion",
            "ubicación",
            "macrosector",
            "territorio",
        )
        desc_col = _find_column(df, "descripcion", "descripción", "detalle", "incidente", "observacion", "observación")

        for _, row in df.iterrows():
            try:
                if all(pd.isna(value) for value in row.values):
                    continue

                dt = _parse_datetime(row, date_col, hour_col)
                tipo = str(_row_value(row, type_col, "Incidente Genérico"))
                direccion = str(_row_value(row, addr_col, ""))
                desc = str(_row_value(row, desc_col, ""))

                delito_obj = Delito(
                    comuna_id=comuna_id,
                    tipo_delito=tipo[:90],
                    direccion=direccion[:190],
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
