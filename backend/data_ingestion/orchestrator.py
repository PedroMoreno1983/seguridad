import os
import sys
import argparse
from pathlib import Path
from sqlalchemy.exc import OperationalError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine, Base
from app.models.delito import Delito
from excel_parser import (
    get_or_create_comuna,
    parse_generic_excel,
    parse_lagranja_partes,
    parse_lagranja_procedimientos,
    parse_pudahuel_atencion_telefonica,
    parse_pudahuel_patrullajes,
    parse_pudahuel_registro_prevencion,
    parse_valparaiso_cctv,
    parse_valparaiso_citaciones,
    parse_valparaiso_ingresos,
)
from comunas_config import (
    COMUNAS_DIR,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    SUPPORTED_EXCEL_EXTENSIONS,
    iter_comuna_dirs,
    iter_supported_files,
    normalize_text,
)


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "y", "si", "s"}


def _selected_comunas(comuna_filter: str | None):
    wanted = normalize_text(comuna_filter) if comuna_filter else None
    for comuna_name, data_path in iter_comuna_dirs():
        if wanted and normalize_text(comuna_name) != wanted:
            continue
        yield comuna_name, data_path


def _parse_excel_file(file_path: Path, db, comuna_id: int, comuna_name: str) -> int:
    comuna_norm = normalize_text(comuna_name)
    file_norm = normalize_text(file_path.name)

    if comuna_norm == "pudahuel":
        if "bitacora de patrullajes" in file_norm:
            return parse_pudahuel_patrullajes(str(file_path), db, comuna_id)
        if "atencion telefonica" in file_norm:
            return parse_pudahuel_atencion_telefonica(str(file_path), db, comuna_id)
        if "registro mas comunidad" in file_norm:
            return parse_pudahuel_registro_prevencion(str(file_path), db, comuna_id)

    if comuna_norm == "valparaiso":
        if "bbdd_cctv" in file_norm or "cctv" in file_norm:
            return parse_valparaiso_cctv(str(file_path), db, comuna_id)
        if "citaciones" in file_norm:
            return parse_valparaiso_citaciones(str(file_path), db, comuna_id)
        if "ingresos" in file_norm:
            return parse_valparaiso_ingresos(str(file_path), db, comuna_id)

    if comuna_norm == "la granja":
        if "partes cursados" in file_norm:
            return parse_lagranja_partes(str(file_path), db, comuna_id)
        if "procedimientos seguridad" in file_norm:
            return parse_lagranja_procedimientos(str(file_path), db, comuna_id)

    return parse_generic_excel(str(file_path), db, comuna_id)


def run_ingestion(comuna_filter: str | None = None, include_excel: bool = True, include_docs: bool = True):
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError as exc:
        print("ERROR: no se pudo conectar a la base de datos.")
        print("Revisa que PostgreSQL este corriendo o define DATABASE_URL en backend/.env.")
        print(f"Detalle: {exc.orig}")
        return 1

    db = SessionLocal()
    try:
        total_inserted = 0
        replace_comuna_data = _truthy_env("SAFECITY_REPLACE_COMUNA_DATA")
        if replace_comuna_data and not comuna_filter:
            print("ERROR: SAFECITY_REPLACE_COMUNA_DATA requiere --comuna para evitar borrados masivos.")
            return 1

        print(f"Directorio base de comunas: {COMUNAS_DIR}")

        for comuna_name, data_path in _selected_comunas(comuna_filter):
            print(f"\n[{comuna_name}] Iniciando ingesta en {data_path}")

            if not data_path or not Path(data_path).exists():
                print(f"[{comuna_name}] Directorio no encontrado. Omitiendo comuna.")
                continue

            comuna = get_or_create_comuna(db, comuna_name)

            if include_excel and replace_comuna_data:
                deleted = db.query(Delito).filter(Delito.comuna_id == comuna.id).delete(synchronize_session=False)
                db.commit()
                print(f"[{comuna_name}] Reemplazo activado: eliminados {deleted} delitos previos.")

            if include_excel:
                excel_files = iter_supported_files(Path(data_path), SUPPORTED_EXCEL_EXTENSIONS)
                print(f"[{comuna_name}] Encontrados {len(excel_files)} archivos Excel.")

                for file_path in excel_files:
                    inserted = _parse_excel_file(file_path, db, comuna.id, comuna_name)
                    print(f"  -> Insertados {inserted} delitos desde {file_path.name}")
                    total_inserted += inserted

            if include_docs:
                from unstructured_parser import parse_unstructured_document

                docs = iter_supported_files(Path(data_path), SUPPORTED_DOCUMENT_EXTENSIONS)
                if docs:
                    print(f"[{comuna_name}] Encontrados {len(docs)} documentos no estructurados (PDF/Word).")
                    for doc_path in docs:
                        inserted = parse_unstructured_document(str(doc_path), db, comuna.id, comuna_name)
                        print(
                            f"  -> Extraidos e inyectados {inserted} puntos calientes "
                            f"geolocalizados desde {doc_path.name}"
                        )
                        total_inserted += inserted

        print("\n=================================")
        print("PROCESO DE INGESTA TERMINADO")
        print(f"TOTAL DELITOS INGRESADOS: {total_inserted}")
        print("=================================")
    except Exception as e:
        print(f"Error fatal: {e}")
        db.rollback()
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingesta normalizada de archivos comunales.")
    parser.add_argument("--comuna", help="Procesa solo una comuna, por ejemplo: Maipu")
    parser.add_argument("--excel-only", action="store_true", help="Procesa solo archivos Excel.")
    parser.add_argument("--docs-only", action="store_true", help="Procesa solo PDF/Word.")
    args = parser.parse_args()

    if args.excel_only and args.docs_only:
        parser.error("--excel-only y --docs-only no pueden usarse al mismo tiempo.")

    raise SystemExit(run_ingestion(
        comuna_filter=args.comuna,
        include_excel=not args.docs_only,
        include_docs=not args.excel_only,
    ))
