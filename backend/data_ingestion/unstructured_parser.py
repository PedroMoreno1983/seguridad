import os
import sys
import re
from datetime import datetime
from sqlalchemy.orm import Session
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import PyPDF2
from docx import Document

# Dependencias locales del backend
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models.delito import Delito
from app.services.ai_reports import get_gemini_api_key, GEMINI_AVAILABLE
import google.generativeai as genai

# Inicializar Geocoder open source
geolocator = Nominatim(user_agent="safecity_analytics_extractor")

def geocode_address(address_text: str, comuna_name: str):
    try:
        # Añadir sufijos para mejorar la precisión en Chile
        full_query = f"{address_text}, {comuna_name}, Chile"
        location = geolocator.geocode(full_query, timeout=10)
        if location:
            return location.latitude, location.longitude
    except (GeocoderTimedOut, GeocoderServiceError):
        pass
    return None, None

def extract_text_from_pdf(file_path: str):
    text_content = ""
    try:
        with open(file_path, "rb") as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text_content += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error leyendo PDF {file_path}: {e}")
    return text_content

def extract_text_from_docx(file_path: str):
    text_content = ""
    try:
        doc = Document(file_path)
        for para in doc.paragraphs:
            text_content += para.text + "\n"
    except Exception as e:
        print(f"Error leyendo Docx {file_path}: {e}")
    return text_content

def parse_unstructured_document(file_path: str, db: Session, comuna_id: int, nombre_comuna: str):
    msg = f"[{nombre_comuna}] Procesando documento IA: {os.path.basename(file_path)}"
    print(msg.encode('ascii', 'ignore').decode('ascii'))
    
    ext = file_path.lower()
    if ext.endswith('.pdf'):
        text = extract_text_from_pdf(file_path)
    elif ext.endswith('.docx'):
        text = extract_text_from_docx(file_path)
    else:
        return 0
        
    if not text.strip():
        return 0

    extracted_locations = set()
    api_key = os.getenv("GEMINI_API_KEY")
    
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash-latest')
            prompt = f"Analiza el siguiente segmento de texto de un informe de seguridad comunal. Extrae únicamente un listado en viñetas de intersecciones, calles o direcciones exactas donde se reportan delitos, incivilidades o factores de riesgo. Si no hay direcciones exactas no inventes nada. Responde con el formato '- Calle 1 esquina Calle 2'.\nTexto: {text[:8000]}"
            resp = model.generate_content(prompt)
            for line in resp.text.split('\n'):
                line = line.replace('-','').strip()
                if line:
                    extracted_locations.add((line, "Punto Riesgo / IA Extracción de Documento"))
        except Exception as e:
            msg_e = f"Gemini error: {e}"
            print(msg_e.encode('ascii', 'ignore').decode('ascii'))
    else:
        # Fallback Heurística Regex si no hay API.
        patterns = [
            r"(?i)(?:avenida|av\.|calle|pasaje)\s+([A-Za-z0-9\s]+?)\s+(?:con|y|esquina)\s+(?:avenida|av\.|calle|pasaje)?\s*([A-Za-z0-9\s]+)"
        ]
        for ptrn in patterns:
            for match in re.findall(ptrn, text):
                if len(match) == 2:
                    extracted_locations.add((f"{match[0].strip()} esquina {match[1].strip()}", "Extraído por Heurística Pura"))

    count = 0
    dt_now = datetime.now()
    
    for loc, desc in extracted_locations:
        # Extraer Lat / Long real!
        lat, lon = geocode_address(loc, nombre_comuna)
        if lat and lon:
            delito_obj = Delito(
                comuna_id=comuna_id,
                tipo_delito="Incobrable / Riesgo en Informe",
                direccion=loc[:190],
                descripcion=f"Extraído vía NLP desde doc oficial: {desc}"[:490],
                latitud=lat,
                longitud=lon,
                fecha_hora=dt_now,
                fuente="PDF_AI_Extraction",
                dia_semana=dt_now.weekday(),
                hora_del_dia=dt_now.hour,
                es_fin_semana=dt_now.weekday() >= 5
            )
            db.add(delito_obj)
            count += 1
            
    try:
        db.commit()
    except Exception as e:
        print(f"Error guardando extracciones geolocalizadas: {e}")
        db.rollback()
        
    return count
