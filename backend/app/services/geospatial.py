import hashlib
import math
import unicodedata
from typing import Iterable


def normalize_geo_text(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.lower().strip().split())


URBAN_BOUNDS = {
    # Peñalolén: recorta el sector cordillerano/parques naturales al oriente.
    "penalolen": (-70.565, -33.520, -70.485, -33.445),
    "la granja": (-70.660, -33.570, -70.605, -33.521),
    "maipu": (-70.845, -33.575, -70.690, -33.455),
    "pudahuel": (-70.835, -33.505, -70.680, -33.385),
    "san bernardo": (-70.775, -33.665, -70.630, -33.535),
    "la cisterna": (-70.690, -33.545, -70.640, -33.505),
}


SECTOR_CENTROIDS = {
    "penalolen": {
        "penalolen alto": (-33.4625, -70.5025),
        "penalolen nuevo": (-33.4840, -70.5165),
        "lo hermida": (-33.4975, -70.5220),
        "la faena": (-33.4815, -70.5160),
        "san luis": (-33.4685, -70.5205),
        "las parcelas": (-33.4885, -70.5030),
        "oriente": (-33.4740, -70.5010),
    },
    "maipu": {
        "centro": (-33.5118, -70.7583),
        "maipu centro": (-33.5118, -70.7583),
        "el abrazo": (-33.5330, -70.7750),
        "ciudad satelite": (-33.5530, -70.7870),
        "los heroes": (-33.5050, -70.7425),
        "villa los heroes": (-33.5050, -70.7425),
        "rinconada": (-33.4935, -70.7890),
        "sol poniente": (-33.5225, -70.8070),
        "pajaritos": (-33.4890, -70.7550),
        "templo votivo": (-33.5140, -70.7645),
        "lo espejo": (-33.5455, -70.7365),
    },
    "pudahuel": {
        "norte": (-33.4140, -70.7480),
        "sur": (-33.4700, -70.7540),
        "pudahuel sur": (-33.4700, -70.7540),
        "pudahuel norte": (-33.4140, -70.7480),
        "estrella sur": (-33.4610, -70.7360),
        "pablo vi": (-33.4470, -70.7290),
        "barrancas": (-33.4410, -70.7580),
        "lo prado": (-33.4480, -70.7190),
    },
    "la granja": {
        "franja 1": (-33.5250, -70.6400),
        "franja 2": (-33.5350, -70.6250),
        "franja 3": (-33.5450, -70.6350),
        "franja 4": (-33.5550, -70.6200),
        "franja 5": (-33.5620, -70.6400),
        "franja 6": (-33.5680, -70.6280),
        "la granja": (-33.5450, -70.6320),
    },
    "san bernardo": {
        "centro": (-33.5922, -70.6996),
        "san bernardo": (-33.5922, -70.6996),
        "nos": (-33.6150, -70.7080),
        "lo herrera": (-33.6330, -70.6860),
    },
    "la cisterna": {
        "la cisterna": (-33.5272, -70.6636),
        "centro": (-33.5272, -70.6636),
    },
}

COMUNA_CENTROIDS = {
    "la cisterna": (-33.5272, -70.6636),
    "la granja": (-33.5356, -70.6325),
    "maipu": (-33.5117, -70.7581),
    "penalolen": (-33.4828, -70.5089),
    "pudahuel": (-33.4439, -70.7642),
    "san bernardo": (-33.5922, -70.6996),
    "valparaiso": (-33.0472, -71.6127),
}


def comuna_key(nombre: str | None) -> str:
    normalized = normalize_geo_text(nombre)
    if "penalolen" in normalized:
        return "penalolen"
    if "maipu" in normalized:
        return "maipu"
    return normalized


def is_within_urban_bounds(nombre_comuna: str | None, lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    bounds = URBAN_BOUNDS.get(comuna_key(nombre_comuna))
    if not bounds:
        return True
    min_lon, min_lat, max_lon, max_lat = bounds
    return min_lat <= float(lat) <= max_lat and min_lon <= float(lon) <= max_lon


def sector_centroid(nombre_comuna: str | None, values: Iterable[str | None]):
    sectors = SECTOR_CENTROIDS.get(comuna_key(nombre_comuna), {})
    if not sectors:
        return None

    text = " ".join(normalize_geo_text(value) for value in values if value)
    if not text:
        return None

    for sector, coords in sectors.items():
        if sector in text:
            return coords[0], coords[1], sector.title()
    return None


def fallback_comuna_centroid(nombre_comuna: str | None, lat: float | None = None, lon: float | None = None):
    if lat is not None and lon is not None:
        return float(lat), float(lon)
    return COMUNA_CENTROIDS.get(comuna_key(nombre_comuna))


def aggregate_weight(count: int, base_weight: float = 1.0) -> float:
    return min(5.0, max(base_weight, math.log1p(max(count, 1)) / 1.6))


def deterministic_offset(label: str, radius: float = 0.0012) -> tuple[float, float]:
    digest = hashlib.sha1(label.encode("utf-8")).hexdigest()
    angle = (int(digest[:8], 16) % 360) * math.pi / 180
    distance = radius * (0.35 + (int(digest[8:12], 16) % 65) / 100)
    return math.sin(angle) * distance, math.cos(angle) * distance
