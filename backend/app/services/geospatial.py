import hashlib
import math
import re
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
    "valparaiso": (-71.690, -33.095, -71.540, -33.000),
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
        "pie andino": (-33.4720, -70.4930),
        "alto norte": (-33.4585, -70.5030),
        "alto sur": (-33.4750, -70.5040),
        "grecia": (-33.4578, -70.5140),
        "tobalaba": (-33.4820, -70.5220),
    },
    "maipu": {
        "centro": (-33.5118, -70.7583),
        "maipu centro": (-33.5118, -70.7583),
        "plaza maipu": (-33.5105, -70.7573),
        "el abrazo": (-33.5330, -70.7750),
        "ciudad satelite": (-33.5530, -70.7870),
        "los heroes": (-33.5050, -70.7425),
        "villa los heroes": (-33.5050, -70.7425),
        "rinconada": (-33.4935, -70.7890),
        "sol poniente": (-33.5225, -70.8070),
        "pajaritos": (-33.4890, -70.7550),
        "templo votivo": (-33.5140, -70.7645),
        "lo espejo": (-33.5455, -70.7365),
        "la farfana": (-33.4780, -70.7630),
        "longitudinal": (-33.4985, -70.7330),
        "esquina blanca": (-33.5235, -70.7380),
        "tres poniente": (-33.5090, -70.7740),
        "santa ana de chena": (-33.5400, -70.7980),
        "industrial": (-33.4920, -70.7250),
    },
    "pudahuel": {
        "norte": (-33.4140, -70.7480),
        "sur": (-33.4700, -70.7540),
        "pudahuel sur": (-33.4700, -70.7540),
        "pudahuel norte": (-33.4140, -70.7480),
        "pudahuel poniente": (-33.4435, -70.7930),
        "poniente": (-33.4435, -70.7930),
        "estrella sur": (-33.4610, -70.7360),
        "pablo vi": (-33.4470, -70.7290),
        "barrancas": (-33.4410, -70.7580),
        "lo prado": (-33.4480, -70.7190),
        "laguna sur": (-33.4515, -70.7335),
        "enea": (-33.4230, -70.7860),
        "lo boza": (-33.4250, -70.7620),
        "ciudad de los valles": (-33.4180, -70.8200),
        "noviciado": (-33.3920, -70.8100),
        "territorio 1": (-33.4700, -70.7540),
        "territorio 2": (-33.4610, -70.7360),
        "territorio 3": (-33.4435, -70.7930),
        "territorio 4": (-33.4410, -70.7580),
        "territorio 5": (-33.4140, -70.7480),
    },
    "la granja": {
        "franja 1": (-33.5250, -70.6400),
        "franja 2": (-33.5350, -70.6250),
        "franja 3": (-33.5450, -70.6350),
        "franja 4": (-33.5550, -70.6200),
        "franja 5": (-33.5620, -70.6400),
        "franja 6": (-33.5680, -70.6280),
        "la granja": (-33.5450, -70.6320),
        "san gregorio": (-33.5580, -70.6290),
        "lo ovalle": (-33.5250, -70.6400),
        "santo tomas": (-33.5480, -70.6150),
        "malaquias concha": (-33.5370, -70.6280),
        "yungay": (-33.5450, -70.6400),
        "santa rosa": (-33.5440, -70.6240),
    },
    "san bernardo": {
        "centro": (-33.5922, -70.6996),
        "san bernardo": (-33.5922, -70.6996),
        "nos": (-33.6150, -70.7080),
        "lo herrera": (-33.6330, -70.6860),
        "san francisco": (-33.5900, -70.6720),
        "maestranza": (-33.5990, -70.7070),
        "villa maestranza": (-33.5990, -70.7070),
        "tejas de chena": (-33.5790, -70.7200),
        "lo blanco": (-33.5630, -70.7000),
        "el manzano": (-33.6130, -70.6740),
        "padre hurtado": (-33.5840, -70.7070),
    },
    "la cisterna": {
        "la cisterna": (-33.5272, -70.6636),
        "centro": (-33.5272, -70.6636),
        "lo ovalle": (-33.5250, -70.6525),
        "el parron": (-33.5335, -70.6650),
        "gran avenida": (-33.5275, -70.6630),
        "goycolea": (-33.5240, -70.6665),
        "fernandez albano": (-33.5325, -70.6600),
        "la cultura": (-33.5230, -70.6590),
    },
}

SECTOR_ALIASES = {
    "penalolen": {
        "penalolen alto norte": "alto norte",
        "penalolen alto sur": "alto sur",
        "penalolen alto": "penalolen alto",
        "penalolen nuevo": "penalolen nuevo",
        "lo hermida": "lo hermida",
        "la faena": "la faena",
        "san luis": "san luis",
        "las parcelas": "las parcelas",
        "pie andino": "pie andino",
        "grecia": "grecia",
        "tobalaba": "tobalaba",
    },
    "maipu": {
        "ciudad satelite": "ciudad satelite",
        "villa los heroes": "villa los heroes",
        "los heroes": "los heroes",
        "el abrazo": "el abrazo",
        "rinconada": "rinconada",
        "sol poniente": "sol poniente",
        "la farfana": "la farfana",
        "pajaritos": "pajaritos",
        "templo votivo": "templo votivo",
        "longitudinal": "longitudinal",
        "esquina blanca": "esquina blanca",
        "tres poniente": "tres poniente",
        "santa ana de chena": "santa ana de chena",
        "industrial": "industrial",
        "maipu centro": "maipu centro",
        "plaza maipu": "plaza maipu",
        "centro": "centro",
    },
    "pudahuel": {
        "pudahuel norte": "pudahuel norte",
        "pudahuel sur": "pudahuel sur",
        "pudahuel poniente": "pudahuel poniente",
        "estrella sur": "estrella sur",
        "pablo vi": "pablo vi",
        "pablo 6": "pablo vi",
        "barrancas": "barrancas",
        "laguna sur": "laguna sur",
        "lo boza": "lo boza",
        "ciudad de los valles": "ciudad de los valles",
        "noviciado": "noviciado",
        "enea": "enea",
        "territorio 1": "territorio 1",
        "territorio 2": "territorio 2",
        "territorio 3": "territorio 3",
        "territorio 4": "territorio 4",
        "territorio 5": "territorio 5",
        "norte": "norte",
        "sur": "sur",
        "poniente": "poniente",
    },
    "la granja": {
        "san gregorio": "san gregorio",
        "lo ovalle": "lo ovalle",
        "santo tomas": "santo tomas",
        "malaquias concha": "malaquias concha",
        "yungay": "yungay",
        "santa rosa": "santa rosa",
        "franja 1": "franja 1",
        "franja 2": "franja 2",
        "franja 3": "franja 3",
        "franja 4": "franja 4",
        "franja 5": "franja 5",
        "franja 6": "franja 6",
    },
    "san bernardo": {
        "san francisco": "san francisco",
        "villa maestranza": "villa maestranza",
        "maestranza": "maestranza",
        "tejas de chena": "tejas de chena",
        "lo herrera": "lo herrera",
        "lo blanco": "lo blanco",
        "el manzano": "el manzano",
        "padre hurtado": "padre hurtado",
        "nos": "nos",
        "centro": "centro",
    },
    "la cisterna": {
        "lo ovalle": "lo ovalle",
        "el parron": "el parron",
        "gran avenida": "gran avenida",
        "goycolea": "goycolea",
        "fernandez albano": "fernandez albano",
        "la cultura": "la cultura",
        "centro": "centro",
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


def _contains_alias(text: str, alias: str) -> bool:
    if len(alias) <= 3:
        return re.search(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", text) is not None
    return alias in text


def is_within_urban_bounds(nombre_comuna: str | None, lat: float | None, lon: float | None) -> bool:
    if lat is None or lon is None:
        return False
    bounds = URBAN_BOUNDS.get(comuna_key(nombre_comuna))
    if not bounds:
        return True
    min_lon, min_lat, max_lon, max_lat = bounds
    return min_lat <= float(lat) <= max_lat and min_lon <= float(lon) <= max_lon


def normalize_lat_lon(nombre_comuna: str | None, lat: float | None, lon: float | None):
    if lat is None or lon is None:
        return None

    lat_float = float(lat)
    lon_float = float(lon)
    if is_within_urban_bounds(nombre_comuna, lat_float, lon_float):
        return lat_float, lon_float
    if is_within_urban_bounds(nombre_comuna, lon_float, lat_float):
        return lon_float, lat_float
    return None


def sector_centroid(nombre_comuna: str | None, values: Iterable[str | None]):
    key = comuna_key(nombre_comuna)
    sectors = SECTOR_CENTROIDS.get(key, {})
    if not sectors:
        return None

    text = " ".join(normalize_geo_text(value) for value in values if value)
    if not text:
        return None

    aliases = SECTOR_ALIASES.get(key, {})
    for alias, sector in sorted(aliases.items(), key=lambda item: len(item[0]), reverse=True):
        coords = sectors.get(sector)
        if coords and _contains_alias(text, alias):
            return coords[0], coords[1], sector.title()

    for sector, coords in sorted(sectors.items(), key=lambda item: len(item[0]), reverse=True):
        if _contains_alias(text, sector):
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
