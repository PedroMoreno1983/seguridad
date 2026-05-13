from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.models.comuna import Comuna
from app.models.delito import Delito
from app.services.geospatial import (
    fallback_comuna_centroid,
    normalize_lat_lon,
    sector_centroid,
)


VALID_PRECISIONS = {"exacta", "sector", "comuna", "sin_senal"}


@dataclass(frozen=True)
class GeocodeResult:
    latitud: float | None
    longitud: float | None
    precision: str
    source: str
    confidence: float
    sector: str | None = None
    invalid_coordinates: bool = False


def _context_value(delito: Delito, key: str) -> Any:
    contexto = delito.contexto if isinstance(delito.contexto, dict) else {}
    return contexto.get(key)


def classify_incident_geocode(
    comuna: Comuna,
    delito: Delito,
    *,
    allow_comuna_fallback: bool = True,
) -> GeocodeResult:
    stored_precision = getattr(delito, "geocode_precision", None)
    stored_source = getattr(delito, "geocode_source", None)
    if stored_source and stored_precision in {"exacta", "sector", "comuna"}:
        contexto = delito.contexto if isinstance(delito.contexto, dict) else {}
        sector = contexto.get("geocoding", {}).get("sector") or delito.barrio
        return GeocodeResult(
            latitud=delito.latitud,
            longitud=delito.longitud,
            precision=stored_precision,
            source=stored_source,
            confidence=float(delito.geocode_confidence or 0),
            sector=sector if stored_precision == "sector" else None,
        )

    centroid = sector_centroid(
        comuna.nombre,
        (
            delito.barrio,
            delito.direccion,
            delito.cuadrante,
            delito.descripcion,
            _context_value(delito, "hoja"),
        ),
    )
    has_exact_signal = bool(delito.direccion or _context_value(delito, "direccion_exacta"))
    if centroid and not has_exact_signal:
        lat, lon, sector = centroid
        return GeocodeResult(
            latitud=lat,
            longitud=lon,
            precision="sector",
            source="sector_centroid",
            confidence=0.65,
            sector=sector,
            invalid_coordinates=delito.latitud is not None and delito.longitud is not None,
        )

    normalized = normalize_lat_lon(comuna.nombre, delito.latitud, delito.longitud)
    if normalized:
        lat, lon = normalized
        return GeocodeResult(
            latitud=lat,
            longitud=lon,
            precision="exacta",
            source="source_coordinates",
            confidence=0.95,
        )

    invalid_coordinates = delito.latitud is not None and delito.longitud is not None
    if centroid:
        lat, lon, sector = centroid
        return GeocodeResult(
            latitud=lat,
            longitud=lon,
            precision="sector",
            source="sector_centroid",
            confidence=0.65,
            sector=sector,
            invalid_coordinates=invalid_coordinates,
        )

    center = fallback_comuna_centroid(comuna.nombre, comuna.centroid_lat, comuna.centroid_lon)
    if allow_comuna_fallback and center:
        lat, lon = center
        return GeocodeResult(
            latitud=lat,
            longitud=lon,
            precision="comuna",
            source="official_comuna_centroid",
            confidence=0.25,
            invalid_coordinates=invalid_coordinates,
        )

    return GeocodeResult(
        latitud=None,
        longitud=None,
        precision="sin_senal",
        source="not_geocoded",
        confidence=0.0,
        invalid_coordinates=invalid_coordinates,
    )


def geocode_context_update(result: GeocodeResult) -> dict[str, Any]:
    return {
        "geocoding": {
            "precision": result.precision,
            "source": result.source,
            "confidence": result.confidence,
            "sector": result.sector,
        }
    }


def confidence_decimal(value: float) -> Decimal:
    return Decimal(str(round(value, 2)))
