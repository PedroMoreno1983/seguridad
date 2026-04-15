import os
import json
import logging
import random
from datetime import datetime

logger = logging.getLogger(__name__)

# Intentar importar google.generativeai
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("google-generativeai no está instalado. Usando mock.")

def get_gemini_api_key():
    return os.getenv("GEMINI_API_KEY", "")

def _init_gemini():
    api_key = get_gemini_api_key()
    if not api_key:
        return False
    if GEMINI_AVAILABLE:
        genai.configure(api_key=api_key)
        return True
    return False

def _generar_mock_reporte(comuna_nombre: str, modelo: str, periodo: str) -> str:
    """Retorna un reporte fijo si no hay API key o no hay internet."""
    disminucion = random.randint(5, 15)
    return f"""# Reporte Ejecutivo de Seguridad: {comuna_nombre}
**Modelo Analítico:** {modelo}
**Período Evaluado:** {periodo}

## Resumen Ejecutivo
Durante el último período, nuestro modelo predictivo **{modelo}** ha identificado una potencial **disminución del {disminucion}%** en la tasa de delitos violentos en los cuadrantes comerciales de {comuna_nombre}, siempre y cuando se mantengan las intervenciones preventivas actuales. 

## Análisis de Contexto
El análisis espacio-temporal ("Risk Terrain Modeling") revela que las zonas aledañas a paraderos de transporte público entre las 18:00 y las 21:00 horas concentran el 40% del riesgo de hurtos. 

**Factores claves identificados:**
1. Iluminación pública deficiente en la calle principal.
2. Aglomeración de personas en horarios de término de jornada laboral.

## Recomendaciones Tácticas para la Autoridad
- **Despliegue Inmediato:** Aumentar el patrullaje de seguridad municipal intermitente entre 18:00 y 21:30 hrs en ejes troncales.
- **Participación Vecinal:** Fomentar el uso de la aplicación Participación Ciudadana para generar alertas tempranas sobre focos de riesgo ambiental (luminarias, mobiliario urbano).
- **Proyecciones:** De aplicar estas medidas tácticas, el modelo proyecta que en 30 días, la zona abandonará el estado de 'Riesgo Alto'.

*Nota: Este es un reporte simulado porque no se encontró una clave de API válida para Gemini.*
"""

def generar_reporte_ejecutivo(comuna_nombre: str, modelo: str, predicciones: list, contexto: dict) -> str:
    """
    Genera un informe narrativo usando Gemini o retorna mock.
    """
    if not _init_gemini():
        logger.warning("Generando mock de reporte ejecutivo (faltan credenciales o dependencias).")
        periodo = datetime.now().strftime("%B %Y")
        return _generar_mock_reporte(comuna_nombre, modelo, periodo)
        
    try:
        # Prompt de ingeniería de contexto
        prompt = f"""
        Actúa como un Analista de Inteligencia Criminal experto trabajando para SafeCity, una plataforma chilena de prevención del delito.
        Debes redactar un 'Reporte Ejecutivo de Seguridad' autoexplicativo y narrativo (storytelling) para las autoridades de la comuna de {comuna_nombre}.
        
        CONTEXTO DE LA COMUNA:
        Modelo predictivo utilizado: {modelo}
        Total riesgo de predicciones dadas: {len(predicciones)} hotspots de alto riesgo.
        
        INFORMACIÓN ADICIONAL (Contexto):
        {json.dumps(contexto, indent=2, ensure_ascii=False)}
        
        ESTRUCTURA OBLIGATORIA DEL REPORTE (formato Markdown):
        - Empezar con el título (H1) y contexto.
        - Un "Resumen Ejecutivo".
        - Un "Análisis de Contexto Espacio-Temporal" donde expliques de forma humana y clara (para personas que no saben estadística espacial) por qué ocurren los delitos o qué indican los hotspots.
        - "Recomendaciones Tácticas" que sean accionables (patrullaje, luminarias, comunicación con vecinos).
        
        ESPECIFICACIONES:
        - Tono formal, ejecutivo, proactivo gubernamental chileno.
        - Largo: Unas 300 palabras.
        - No reveles que eres una IA.
        """
        
        # Generar usando modelo
        model_gemini = genai.GenerativeModel('gemini-1.5-pro') # O el que esté configurado
        response = model_gemini.generate_content(prompt)
        
        if response and response.text:
            return response.text
        else:
            return _generar_mock_reporte(comuna_nombre, modelo, "Actual")
            
    except Exception as e:
        logger.error(f"Error generando reporte con Gemini: {str(e)}")
        periodo = datetime.now().strftime("%B %Y")
        return _generar_mock_reporte(comuna_nombre, modelo, periodo)
