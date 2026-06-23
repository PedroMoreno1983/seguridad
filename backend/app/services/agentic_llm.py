import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class AgentLLMUnavailable(RuntimeError):
    """Raised when the conversational provider cannot be used safely."""


def _safe_json_loads(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("LLM response was not a JSON object")
    return parsed


def _list_of_strings(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, str) and item.strip():
            cleaned.append(item.strip())
        if len(cleaned) >= limit:
            break
    return cleaned


def _agent_evidence(plan: dict[str, Any]) -> dict[str, Any]:
    metricas = plan.get("metricas") or {}
    overlays = plan.get("map_overlays") or {}
    return {
        "comuna": plan.get("comuna"),
        "estado_operacional": plan.get("estado_operacional"),
        "score_operacional": plan.get("score_operacional"),
        "metricas": {
            "calidad_georreferencial": metricas.get("calidad_georreferencial"),
            "tendencia_temporal": metricas.get("tendencia_temporal"),
            "top_tipos": metricas.get("top_tipos"),
            "hotspots_detectados": metricas.get("hotspots_detectados"),
            "predicciones_activas": metricas.get("predicciones_activas"),
            "alertas_abiertas": metricas.get("alertas_abiertas"),
            "readiness_comercial": metricas.get("readiness_comercial"),
            "fuentes_comunales": metricas.get("fuentes_comunales"),
        },
        "hallazgos": plan.get("hallazgos") or [],
        "zonas": (overlays.get("zonas") or [])[:6],
        "puntos": (overlays.get("puntos") or [])[:6],
        "acciones": [
            {
                "title": action.get("title"),
                "tool_name": action.get("tool_name"),
                "risk_level": action.get("risk_level"),
                "requires_approval": action.get("requires_approval"),
                "description": action.get("description"),
                "preview": action.get("preview"),
            }
            for action in (plan.get("actions") or [])[:8]
        ],
        "memoria": plan.get("agent_memory"),
        "razonamiento": plan.get("reasoning_trace"),
    }


def _build_prompt(question: str, plan: dict[str, Any]) -> str:
    evidence = _agent_evidence(plan)
    return f"""
Actua como Agente SafeCity, un agente operativo para seguridad municipal y GaaS territorial.
Responde en espanol claro, directo y accionable para una autoridad o equipo tecnico.

PREGUNTA DEL OPERADOR:
{question}

EVIDENCIA DISPONIBLE DEL SISTEMA:
{json.dumps(evidence, indent=2, ensure_ascii=False, default=str)}

REGLAS ESTRICTAS:
- Usa solo la evidencia entregada. Si falta informacion, dilo y formula la siguiente accion auditable.
- Puedes responder preguntas amplias, pero siempre aterrizadas al contexto SafeCity, la comuna, datos, mapa, predicciones, fuentes, alertas o acciones.
- No inventes delitos, personas, culpabilidades, horarios, porcentajes, obras, causas ni resultados no presentes.
- Distingue hechos observados, inferencias operativas y recomendaciones.
- Las acciones sensibles como prediccion, alerta, intervencion o ingesta quedan sujetas a aprobacion humana.
- No des instrucciones de vigilancia invasiva, discriminatoria o basada en personas.
- Si la pregunta esta fuera del dominio, responde brevemente el limite y redirige a lo que el agente si puede resolver con datos.

Devuelve SOLO JSON valido con esta forma:
{{
  "answer": "respuesta principal en 1 a 3 parrafos cortos",
  "bullets": ["3 a 6 respaldos concretos de evidencia"],
  "limitations": ["0 a 4 limites o brechas"],
  "follow_up_questions": ["0 a 3 preguntas o siguientes consultas utiles"],
  "confidence": 0.0
}}
"""


def generate_agent_answer(question: str, plan: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise AgentLLMUnavailable("GEMINI_API_KEY no configurada")
    if genai is None or types is None:
        raise AgentLLMUnavailable("Dependencia google-genai no instalada")

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    prompt = _build_prompt(question, plan)

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.15,
                top_p=0.8,
                max_output_tokens=1400,
                response_mime_type="application/json",
            ),
        )
        text = (response.text or "").strip()
        if not text:
            raise AgentLLMUnavailable("Gemini no devolvio contenido")
        payload = _safe_json_loads(text)
        answer = str(payload.get("answer") or "").strip()
        if not answer:
            raise AgentLLMUnavailable("Gemini devolvio una respuesta vacia")
        confidence = payload.get("confidence", 0.7)
        try:
            confidence = max(0.0, min(1.0, float(confidence)))
        except (TypeError, ValueError):
            confidence = 0.7
        return {
            "answer": answer,
            "bullets": _list_of_strings(payload.get("bullets"), 6),
            "limitations": _list_of_strings(payload.get("limitations"), 4),
            "follow_up_questions": _list_of_strings(payload.get("follow_up_questions"), 3),
            "confidence": confidence,
            "model": model_name,
        }
    except AgentLLMUnavailable:
        raise
    except Exception as exc:
        logger.warning("Agent LLM answer failed: %s", exc)
        raise AgentLLMUnavailable("No fue posible generar respuesta LLM del agente") from exc
