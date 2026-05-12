"""
Carga de indicadores educativos comunales.

Uso:
  python data_ingestion/education_parser.py ruta/educacion_comunal.csv
  python data_ingestion/education_parser.py ruta/educacion_comunal.xlsx --dry-run
"""

import argparse
import os
import sys
from datetime import date
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import Base, SessionLocal, engine
from app.models.comuna import Comuna
from app.models.prevencion import EducacionComunal
from comunas_config import get_comuna_metadata, normalize_text


COLUMN_ALIASES = {
    "codigo_ine": ("codigo_ine", "cod_comuna", "codigo comuna", "codine", "ine", "comuna_codigo"),
    "comuna": ("comuna", "nombre_comuna", "nom_comuna", "nombre comuna"),
    "anio": ("anio", "año", "year", "periodo", "periodo_anual"),
    "matricula_total": ("matricula_total", "matricula", "matricula comunal", "total matricula"),
    "estudiantes_desvinculados": ("estudiantes_desvinculados", "desvinculados", "abandono", "retiro", "estudiantes retirados"),
    "tasa_desvinculacion": ("tasa_desvinculacion", "tasa desvinculacion", "porcentaje desvinculacion", "% desvinculacion"),
    "estudiantes_revinculados": ("estudiantes_revinculados", "revinculados", "reingresados"),
    "tasa_revinculacion": ("tasa_revinculacion", "tasa revinculacion", "% revinculacion"),
    "inasistencia_grave_pct": ("inasistencia_grave_pct", "inasistencia grave", "% inasistencia grave", "inasistencia_grave"),
    "retiro_basica_pct": ("retiro_basica_pct", "retiro basica", "% retiro basica"),
    "retiro_media_pct": ("retiro_media_pct", "retiro media", "% retiro media"),
    "fuente": ("fuente", "origen"),
    "metodologia": ("metodologia", "nota", "observacion", "metodo"),
    "fecha_actualizacion": ("fecha_actualizacion", "fecha actualizacion", "fecha carga"),
}


def _find_column(df: pd.DataFrame, canonical: str):
    aliases = tuple(normalize_text(value) for value in COLUMN_ALIASES[canonical])
    for column in df.columns:
        normalized = normalize_text(column).replace("_", " ")
        if normalized in aliases:
            return column
    for column in df.columns:
        normalized = normalize_text(column).replace("_", " ")
        if any(alias in normalized for alias in aliases):
            return column
    return None


def _value(row, columns, canonical: str, default=None):
    column = columns.get(canonical)
    if not column:
        return default
    value = row.get(column, default)
    if pd.isna(value):
        return default
    return value


def _as_int(value):
    if value in (None, ""):
        return None
    text = str(value).replace(",", ".").strip()
    if text in {"", "-", "--", "s/i", "nan"}:
        return None
    return int(float(text))


def _as_float(value):
    if value in (None, ""):
        return None
    text = str(value).replace("%", "").replace(",", ".").strip()
    if not text or text in {"-", "--", "s/i", "nan"}:
        return None
    return round(float(text), 2)


def _as_raw_float(value):
    if value in (None, ""):
        return None
    text = str(value).replace("%", "").replace(",", ".").strip()
    if not text or text in {"-", "--", "s/i", "nan"}:
        return None
    return float(text)


def _as_date(value):
    if value in (None, ""):
        return date.today()
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return date.today()
    return parsed.date()


def _read_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        if _is_mineduc_desvinculacion(path):
            return _read_mineduc_desvinculacion(path)
        return pd.read_excel(path)
    return pd.read_csv(path, encoding="utf-8-sig")


def _is_mineduc_desvinculacion(path: Path) -> bool:
    try:
        return "Tasas a nivel de Comuna" in pd.ExcelFile(path).sheet_names
    except Exception:
        return False


def _read_mineduc_desvinculacion(path: Path) -> pd.DataFrame:
    raw = pd.read_excel(path, sheet_name="Tasas a nivel de Comuna", header=None)
    rows = []

    # La hoja oficial tiene 15 bloques anuales; cada ano usa 6 columnas:
    # 3 para Global y 3 para Sistema regular. Usamos Global para la lectura comunal.
    for row_idx in range(4, len(raw)):
        comuna = raw.iat[row_idx, 0]
        if pd.isna(comuna):
            continue
        comuna_text = str(comuna).strip()
        if not comuna_text or comuna_text.startswith("/"):
            continue

        for col in range(1, raw.shape[1], 6):
            year_value = raw.iat[1, col] if col < raw.shape[1] else None
            if pd.isna(year_value):
                continue
            anio = _as_int(year_value)
            desvinculados = raw.iat[row_idx, col]
            matricula_teorica = raw.iat[row_idx, col + 1] if col + 1 < raw.shape[1] else None
            tasa = raw.iat[row_idx, col + 2] if col + 2 < raw.shape[1] else None
            if pd.isna(desvinculados) and pd.isna(matricula_teorica) and pd.isna(tasa):
                continue

            tasa_float = _as_raw_float(tasa)
            if tasa_float is not None and tasa_float <= 1:
                tasa_float = round(tasa_float * 100, 2)
            elif tasa_float is not None:
                tasa_float = round(tasa_float, 2)

            rows.append({
                "comuna": comuna_text.title(),
                "anio": anio,
                "matricula_total": _as_int(matricula_teorica),
                "estudiantes_desvinculados": _as_int(desvinculados),
                "tasa_desvinculacion": tasa_float,
                "fuente": "Mineduc/CEM - Tasas de incidencia de desvinculacion 2010-2024",
                "metodologia": "Hoja 'Tasas a nivel de Comuna', bloque Global. Tasa convertida a porcentaje.",
                "fecha_actualizacion": date.today().isoformat(),
            })

    return pd.DataFrame(rows)


def _resolve_comuna(db, codigo_ine: str | None, nombre: str | None):
    comuna = None
    if codigo_ine:
        codigo = str(codigo_ine).split(".")[0].zfill(5)
        comuna = db.query(Comuna).filter(Comuna.codigo_ine == codigo).first()
        if comuna:
            return comuna

    if nombre:
        nombre_norm = normalize_text(nombre)
        comuna = db.query(Comuna).filter(Comuna.nombre_normalizado == nombre_norm).first()
        if comuna:
            return comuna
        for candidate in db.query(Comuna).all():
            if normalize_text(candidate.nombre) == nombre_norm:
                return candidate

        metadata = get_comuna_metadata(nombre)
        if metadata:
            comuna = Comuna(
                codigo_ine=metadata["codigo_ine"],
                nombre=str(nombre).strip(),
                nombre_normalizado=nombre_norm,
                region=metadata.get("region", "Region Metropolitana de Santiago"),
                codigo_region=metadata.get("codigo_region", "13"),
                provincia=metadata.get("provincia", "Santiago"),
            )
            db.add(comuna)
            db.commit()
            db.refresh(comuna)
            return comuna

    return None


def import_educacion_comunal(path: str, dry_run: bool = False) -> dict:
    file_path = Path(path).resolve()
    if not file_path.exists():
        raise FileNotFoundError(file_path)

    df = _read_table(file_path)
    columns = {key: _find_column(df, key) for key in COLUMN_ALIASES}
    required_missing = [key for key in ("anio",) if not columns.get(key)]
    if not columns.get("codigo_ine") and not columns.get("comuna"):
        required_missing.append("codigo_ine o comuna")
    if required_missing:
        raise ValueError(f"Faltan columnas requeridas: {', '.join(required_missing)}")

    Base.metadata.create_all(bind=engine)

    stats = {"archivo": str(file_path), "filas": len(df), "insertados": 0, "actualizados": 0, "omitidos": 0}
    db = SessionLocal()
    try:
        for _, row in df.iterrows():
            comuna = _resolve_comuna(
                db,
                _value(row, columns, "codigo_ine"),
                _value(row, columns, "comuna"),
            )
            anio = _as_int(_value(row, columns, "anio"))
            if not comuna or not anio:
                stats["omitidos"] += 1
                continue

            registro = db.query(EducacionComunal).filter(
                EducacionComunal.comuna_id == comuna.id,
                EducacionComunal.anio == anio,
            ).first()
            is_new = registro is None
            if is_new:
                registro = EducacionComunal(comuna_id=comuna.id, anio=anio)

            registro.matricula_total = _as_int(_value(row, columns, "matricula_total"))
            registro.estudiantes_desvinculados = _as_int(_value(row, columns, "estudiantes_desvinculados"))
            registro.tasa_desvinculacion = _as_float(_value(row, columns, "tasa_desvinculacion"))
            registro.estudiantes_revinculados = _as_int(_value(row, columns, "estudiantes_revinculados"))
            registro.tasa_revinculacion = _as_float(_value(row, columns, "tasa_revinculacion"))
            registro.inasistencia_grave_pct = _as_float(_value(row, columns, "inasistencia_grave_pct"))
            registro.retiro_basica_pct = _as_float(_value(row, columns, "retiro_basica_pct"))
            registro.retiro_media_pct = _as_float(_value(row, columns, "retiro_media_pct"))
            registro.fuente = str(_value(row, columns, "fuente", "Mineduc / Centro de Estudios"))[:120]
            registro.metodologia = _value(row, columns, "metodologia", "Carga comunal agregada desde archivo externo.")
            registro.fecha_actualizacion = _as_date(_value(row, columns, "fecha_actualizacion"))
            registro.extra_data = {"archivo_origen": file_path.name}

            if not dry_run:
                db.add(registro)
                db.flush()
            stats["insertados" if is_new else "actualizados"] += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Importar indicadores educativos por comuna.")
    parser.add_argument("archivo", help="CSV/XLSX con datos comunales agregados")
    parser.add_argument("--dry-run", action="store_true", help="Valida sin escribir en la base")
    args = parser.parse_args()

    stats = import_educacion_comunal(args.archivo, dry_run=args.dry_run)
    print(stats)


if __name__ == "__main__":
    main()
