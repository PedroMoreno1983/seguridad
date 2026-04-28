"""
Incident taxonomy helpers.

Municipal datasets arrive with different labels and levels of detail. This
module maps those raw labels into a shared operational vocabulary so dashboard,
map and prediction filters remain comparable across comunas.
"""

from __future__ import annotations

import unicodedata
from collections import defaultdict
from typing import Iterable


INCIDENT_CATALOG = [
    {
        "id": "robo_hurto",
        "label": "Robo/Hurto",
        "severity": 2.2,
        "keywords": ["robo", "hurto", "sustracc", "intimidacion", "portonazo"],
    },
    {
        "id": "violencia_lesiones",
        "label": "Violencia/Lesiones",
        "severity": 2.5,
        "keywords": ["lesion", "amenaza", "agresi", "pelea", "violencia"],
    },
    {
        "id": "vif",
        "label": "Violencia Intrafamiliar",
        "severity": 2.6,
        "keywords": ["vif", "intrafamiliar", "medidas cautelares"],
    },
    {
        "id": "transito_vialidad",
        "label": "Transito/Vialidad",
        "severity": 1.4,
        "keywords": ["transito", "accidente", "vehicular", "colision", "licencia"],
    },
    {
        "id": "incivilidades",
        "label": "Incivilidades",
        "severity": 1.0,
        "keywords": ["incivilidad", "ruido", "desorden", "fiesta", "bulla", "ordenanza"],
    },
    {
        "id": "fiscalizacion",
        "label": "Fiscalizacion",
        "severity": 0.8,
        "keywords": ["fiscaliz", "inspeccion", "municipal", "parte", "infraccion"],
    },
    {
        "id": "emergencias",
        "label": "Emergencias",
        "severity": 1.5,
        "keywords": ["emergencia", "salud", "medica", "incendio", "auxilio", "herido"],
    },
    {
        "id": "drogas_alcohol",
        "label": "Drogas/Alcohol",
        "severity": 1.7,
        "keywords": ["droga", "alcohol", "consumo", "narco"],
    },
    {
        "id": "vehiculos",
        "label": "Vehiculos",
        "severity": 1.3,
        "keywords": ["vehiculo abandonado", "abandonado", "vehiculo"],
    },
    {
        "id": "apoyo_social",
        "label": "Apoyo social",
        "severity": 0.7,
        "keywords": ["situacion calle", "persona en situacion calle", "retiro psc"],
    },
    {
        "id": "otros",
        "label": "Otros",
        "severity": 1.0,
        "keywords": [],
    },
]

_BY_LABEL = {item["label"]: item for item in INCIDENT_CATALOG}


def _plain(value: str | None) -> str:
    value = str(value or "").strip().lower()
    value = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in value if not unicodedata.combining(ch))


def normalize_incident_type(raw: str | None) -> str:
    text = _plain(raw)
    if not text:
        return "Otros"

    for item in INCIDENT_CATALOG:
        if item["id"] == "otros":
            continue
        if any(keyword in text for keyword in item["keywords"]):
            return item["label"]

    return "Otros"


def incident_weight(raw_or_canonical: str | None) -> float:
    canonical = raw_or_canonical if raw_or_canonical in _BY_LABEL else normalize_incident_type(raw_or_canonical)
    return float(_BY_LABEL.get(canonical, _BY_LABEL["Otros"])["severity"])


def canonical_types() -> list[str]:
    return [item["label"] for item in INCIDENT_CATALOG]


def normalize_count_rows(rows: Iterable[tuple[str, int]]) -> list[dict]:
    totals: dict[str, int] = defaultdict(int)
    for raw_type, amount in rows:
        totals[normalize_incident_type(raw_type)] += int(amount or 0)
    return [
        {"tipo": tipo, "cantidad": cantidad}
        for tipo, cantidad in sorted(totals.items(), key=lambda item: item[1], reverse=True)
    ]


def coverage_level(total_records: int, geocoded_records: int) -> str:
    if total_records <= 0:
        return "sin_eventos"
    ratio = geocoded_records / total_records
    if ratio >= 0.8:
        return "alta"
    if ratio >= 0.4:
        return "media"
    return "baja"
