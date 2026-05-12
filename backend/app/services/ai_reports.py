import json
import logging
import os

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class ReporteIANoDisponible(RuntimeError):
    """El proveedor IA no esta configurado o no pudo generar contenido."""


def _build_prompt(comuna_nombre: str, modelo: str, predicciones: list, contexto: dict) -> str:
    return f"""
Actua como analista senior de inteligencia criminal para Atalaya, una plataforma chilena de prevencion del delito.
Redacta un Reporte Ejecutivo de Seguridad para autoridades de la comuna de {comuna_nombre}.

CONTEXTO TERRITORIAL Y OPERACIONAL:
Modelo utilizado: {modelo}
Predicciones activas disponibles: {len(predicciones)}
Predicciones:
{json.dumps(predicciones, indent=2, ensure_ascii=False)}

Indicadores y contexto:
{json.dumps(contexto, indent=2, ensure_ascii=False)}

REQUISITOS ESTRICTOS:
- Usa solo los datos entregados. Si un dato no esta disponible, dilo explicitamente.
- No inventes eventos, porcentajes, obras, causas, horarios ni concentraciones.
- Distingue entre hechos observados, patrones historicos, inferencias y recomendaciones.
- Incluye resguardo de derechos: la prediccion no equivale a culpabilidad individual.
- Recomienda acciones institucionales proporcionales y auditables.
- Tono formal, ejecutivo y accionable para gestion municipal chilena.
- Extension aproximada: 300 palabras.
- No reveles que eres una IA.
"""


def generar_reporte_ejecutivo(
    comuna_nombre: str,
    modelo: str,
    predicciones: list,
    contexto: dict,
) -> str:
    """Genera un informe narrativo con Gemini usando solo contexto operacional real."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ReporteIANoDisponible("GEMINI_API_KEY no configurada")
    if genai is None or types is None:
        raise ReporteIANoDisponible("Dependencia google-genai no instalada")

    prompt = _build_prompt(comuna_nombre, modelo, predicciones, contexto)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.8,
                max_output_tokens=1200,
            ),
        )
        text = (response.text or "").strip()
        if not text:
            raise ReporteIANoDisponible("Gemini no devolvio contenido")
        return text
    except ReporteIANoDisponible:
        raise
    except Exception as exc:
        logger.error("Error generando reporte ejecutivo con Gemini: %s", exc)
        raise ReporteIANoDisponible("No fue posible generar el reporte ejecutivo") from exc
