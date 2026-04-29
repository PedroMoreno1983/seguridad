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
from excel_parser import get_or_create_comuna, parse_valparaiso_cctv, parse_generic_excel
from comunas_config import (
    COMUNAS_DIR,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    SUPPORTED_EXCEL_EXTENSIONS,
    iter_comuna_dirs,
    iter_supported_files,
    normalize_text,
)


def _selected_comunas(comuna_filter: str | None):
    wanted = normalize_text(comuna_filter) if comuna_filter else None
    for comuna_name, data_path in iter_comuna_dirs():
        if wanted and normalize_text(comuna_name) != wanted:
            continue
        yield comuna_name, data_path


def run_ingestion(comuna_filter: str | None = None, include_excel: bool = True, include_docs: bool = True):
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError as exc:
        print("ERROR: no se pudo conectar a la base de datos.")
        print("Revisa que PostgreSQL esté corriendo o define DATABASE_URL en backend/.env.")
        print(f"Detalle: {exc.orig}")
        return 1

    db = SessionLocal()
    try:
        total_inserted = 0
        print(f"Directorio base de comunas: {COMUNAS_DIR}")

        for comuna_name, data_path in _selected_comunas(comuna_filter):
            print(f"\n[{comuna_name}] Iniciando ingesta en {data_path}")

            if not data_path or not Path(data_path).exists():
                print(f"[{comuna_name}] Directorio no encontrado. Omitiendo comuna.")
                continue

            # Asegurar Comuna en DB.
            comuna = get_or_create_comuna(db, comuna_name)

            if include_excel:
                # Buscar todos los Excel solo dentro del directorio de esta comuna.
                excel_files = iter_supported_files(Path(data_path), SUPPORTED_EXCEL_EXTENSIONS)
                print(f"[{comuna_name}] Encontrados {len(excel_files)} archivos Excel.")

                for file_path in excel_files:
                    if comuna_name == "Valparaíso" and "BBDD_CCTV" in file_path.name:
                        inserted = parse_valparaiso_cctv(str(file_path), db, comuna.id)
                    else:
                        inserted = parse_generic_excel(str(file_path), db, comuna.id)

                    print(f"  -> Insertados {inserted} delitos desde {file_path.name}")
                    total_inserted += inserted

            if include_docs:
                from unstructured_parser import parse_unstructured_document

                # Buscar documentos no estructurados solo dentro del directorio de esta comuna.
                docs = iter_supported_files(Path(data_path), SUPPORTED_DOCUMENT_EXTENSIONS)
                if docs:
                    print(f"[{comuna_name}] Encontrados {len(docs)} documentos no estructurados (PDF/Word).")
                    for doc_path in docs:
                        inserted = parse_unstructured_document(str(doc_path), db, comuna.id, comuna_name)
                        print(
                            f"  -> Extraídos e inyectados {inserted} puntos calientes "
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
    parser.add_argument("--comuna", help="Procesa solo una comuna, por ejemplo: Maipú")
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
