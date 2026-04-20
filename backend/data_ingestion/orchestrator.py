import os
import sys
import glob

# Add backend directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine, Base
from app.models.delito import Delito
from app.models.comuna import Comuna
from excel_parser import get_or_create_comuna, parse_valparaiso_cctv, parse_generic_excel
from unstructured_parser import parse_unstructured_document

# Create all tables
Base.metadata.create_all(bind=engine)

BASE_DATA_PATH = r"C:\Users\pedro.moreno\Desktop\Seguridad"

COMUNA_MAPPINGS = {
    "Pudahuel": os.path.join(BASE_DATA_PATH, "Pudahuel"),
    "Valparaíso": os.path.join(BASE_DATA_PATH, "Valparaíso"),
    "Peñalolén": os.path.join(BASE_DATA_PATH, "Peñalolén", "Peñalolén"), # unzipped
    "La Granja": os.path.join(BASE_DATA_PATH, "La Granja", "La Granja"), # unzipped
    "La Cisterna": os.path.join(BASE_DATA_PATH, "La Cisterna"),
    "San Bernardo": os.path.join(BASE_DATA_PATH, "San Bernardo")
}

def run_ingestion():
    db = SessionLocal()
    try:
        total_inserted = 0
        for comuna_name, data_path in COMUNA_MAPPINGS.items():
            print(f"\n[{comuna_name}] Iniciando ingesta en {data_path}")
            
            if not os.path.exists(data_path):
                print(f"[{comuna_name}] ¡Directorio {data_path} no encontrado! Intentando directorio superior.")
                data_path = os.path.dirname(data_path)
                if not os.path.exists(data_path):
                     print(f"[{comuna_name}] Falló. Omitiendo comuna.")
                     continue
            
            # Asegurar Comuna en DB
            comuna = get_or_create_comuna(db, comuna_name)
            
            # Buscar todos los excel
            excel_files = glob.glob(os.path.join(data_path, "**", "*.xlsx"), recursive=True)
            print(f"[{comuna_name}] Encontrados {len(excel_files)} archivos Excel.")
            
            for file_path in excel_files:
                if comuna_name == "Valparaíso" and "BBDD_CCTV" in os.path.basename(file_path):
                    inserted = parse_valparaiso_cctv(file_path, db, comuna.id)
                else:
                    inserted = parse_generic_excel(file_path, db, comuna.id)
                
                print(f"  -> Insertados {inserted} delitos desde {os.path.basename(file_path)}")
                total_inserted += inserted
                
            # Buscar documentos no estructurados
            docs = glob.glob(os.path.join(data_path, "**", "*.pdf"), recursive=True) + glob.glob(os.path.join(data_path, "**", "*.docx"), recursive=True)
            if docs:
                print(f"[{comuna_name}] Encontrados {len(docs)} documentos no estructurados (PDF/Word).")
                for doc_path in docs:
                    inserted = parse_unstructured_document(doc_path, db, comuna.id, comuna_name)
                    print(f"  -> Extraídos e inyectados {inserted} puntos calientes geolocalizados desde {os.path.basename(doc_path)}")
                    total_inserted += inserted
        print(f"\n=================================")
        print(f"PROCESO DE INGESTA TERMINADO")
        print(f"TOTAL DELITOS INGRESADOS: {total_inserted}")
        print(f"=================================")
    except Exception as e:
        print(f"Error fatal: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_ingestion()
