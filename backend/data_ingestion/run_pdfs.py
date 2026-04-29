import os
import sys
from pathlib import Path
from sqlalchemy.exc import OperationalError

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine, Base
from excel_parser import get_or_create_comuna
from unstructured_parser import parse_unstructured_document
from comunas_config import COMUNAS_DIR, SUPPORTED_DOCUMENT_EXTENSIONS, iter_comuna_dirs, iter_supported_files


def run_pdf_ingestion():
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

        for name, com_path in iter_comuna_dirs():
            if not com_path or not Path(com_path).exists():
                print(f"[{name}] Directorio no encontrado. Omitiendo comuna.")
                continue

            comuna = get_or_create_comuna(db, name)

            docs = iter_supported_files(Path(com_path), SUPPORTED_DOCUMENT_EXTENSIONS)
            if docs:
                print(f"[{name}] Encontrados {len(docs)} documentos no estructurados (PDF/Word).")
                for doc_path in docs:
                    inserted = parse_unstructured_document(str(doc_path), db, comuna.id, name)
                    print(f"  -> Extraídos e inyectados {inserted} puntos calientes desde {doc_path.name}")
                    total_inserted += inserted

        print(f"\nTOTAL ZONAS CALIENTES EXTRAÍDAS: {total_inserted}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(run_pdf_ingestion())
