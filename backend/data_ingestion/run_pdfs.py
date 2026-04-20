import os
import sys
import glob

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine, Base
from excel_parser import get_or_create_comuna
from unstructured_parser import parse_unstructured_document

Base.metadata.create_all(bind=engine)

def run_pdf_ingestion():
    db = SessionLocal()
    try:
        total_inserted = 0
        base_path = r"C:\Users\pedro.moreno\Desktop\Seguridad"
        comunas = ["La Cisterna", "San Bernardo", "Valparaíso", "Peñalolén", "La Granja", "Pudahuel"]
        
        for name in comunas:
            # Encontrar el directorio recorriendo recursivamente buscando PDFs o DOCX
            com_path = os.path.join(base_path, name)
            if not os.path.exists(com_path):
                continue
                
            comuna = get_or_create_comuna(db, name)
            
            docs = glob.glob(os.path.join(com_path, "**", "*.pdf"), recursive=True) + glob.glob(os.path.join(com_path, "**", "*.docx"), recursive=True)
            if docs:
                print(f"[{name}] Encontrados {len(docs)} documentos no estructurados (PDF/Word).")
                for doc_path in docs:
                    inserted = parse_unstructured_document(doc_path, db, comuna.id, name)
                    print(f"  -> Extraídos e inyectados {inserted} puntos calientes desde {os.path.basename(doc_path)}")
                    total_inserted += inserted
                    
        print(f"\nTOTAL ZONAS CALIENTES EXTRAÍDAS: {total_inserted}")
    finally:
        db.close()

if __name__ == "__main__":
    run_pdf_ingestion()
