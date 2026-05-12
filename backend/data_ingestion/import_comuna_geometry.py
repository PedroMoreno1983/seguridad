"""
Importa centroides y bbox comunales desde la DPA oficial MOP/SUBDERE.

Uso:
  python data_ingestion/import_comuna_geometry.py --all-loaded --dry-run --json
  python data_ingestion/import_comuna_geometry.py --codigo-ine 13122
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Iterable

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models.comuna import Comuna


DPA_LAYER_URL = (
    "https://rest-sit.mop.gob.cl/arcgis/rest/services/"
    "INTEROP/SERVICIO_DPA/MapServer/1/query"
)
REFERENCE_URL = (
    "https://www.subdere.gob.cl/sala-de-prensa/"
    "subdere-publica-nueva-versi%C3%B3n-de-los-l%C3%ADmites-de-la-divisi%C3%B3n-pol%C3%ADtico-administrativa"
)


def _ring_area_centroid(ring: list[list[float]]) -> tuple[float, float, float]:
    area2 = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = float(ring[i][0]), float(ring[i][1])
        x2, y2 = float(ring[i + 1][0]), float(ring[i + 1][1])
        cross = x1 * y2 - x2 * y1
        area2 += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if area2 == 0:
        return 0.0, 0.0, 0.0
    area = area2 / 2.0
    return area, cx / (3.0 * area2), cy / (3.0 * area2)


def _geometry_summary(rings: Iterable[list[list[float]]]) -> tuple[float, float, list[float]]:
    points: list[tuple[float, float]] = []
    weighted_area = 0.0
    weighted_x = 0.0
    weighted_y = 0.0

    for ring in rings:
        if len(ring) < 4:
            continue
        ring_points = [(float(point[0]), float(point[1])) for point in ring]
        points.extend(ring_points)
        area, cx, cy = _ring_area_centroid(ring)
        weighted_area += area
        weighted_x += cx * area
        weighted_y += cy * area

    if not points:
        raise ValueError("La geometria oficial no trae vertices")

    min_lon = min(point[0] for point in points)
    min_lat = min(point[1] for point in points)
    max_lon = max(point[0] for point in points)
    max_lat = max(point[1] for point in points)

    if abs(weighted_area) > 1e-12:
        centroid_lon = weighted_x / weighted_area
        centroid_lat = weighted_y / weighted_area
    else:
        centroid_lon = sum(point[0] for point in points) / len(points)
        centroid_lat = sum(point[1] for point in points) / len(points)

    return (
        round(centroid_lat, 6),
        round(centroid_lon, 6),
        [round(min_lon, 6), round(min_lat, 6), round(max_lon, 6), round(max_lat, 6)],
    )


def fetch_official_geometry(codigo_ine: str) -> dict:
    params = {
        "where": f"CUT_COM='{codigo_ine}'",
        "outFields": "CUT_COM,COMUNA,PROVINCIA,REGION",
        "returnGeometry": "true",
        "f": "json",
        "outSR": "4326",
    }
    url = f"{DPA_LAYER_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.load(response)

    features = payload.get("features") or []
    if not features:
        raise ValueError(f"No se encontro geometria oficial para CUT_COM={codigo_ine}")

    feature = features[0]
    geometry = feature.get("geometry") or {}
    centroid_lat, centroid_lon, bbox = _geometry_summary(geometry.get("rings") or [])
    return {
        "codigo_ine": codigo_ine,
        "nombre_oficial": feature.get("attributes", {}).get("COMUNA"),
        "centroid_lat": centroid_lat,
        "centroid_lon": centroid_lon,
        "bbox": bbox,
        "source": {
            "name": "MOP/SUBDERE DPA comunal",
            "service_url": DPA_LAYER_URL,
            "reference_url": REFERENCE_URL,
            "cut_com": codigo_ine,
            "fetched_at": datetime.now(UTC).isoformat(),
        },
    }


def _selected_comunas(db, args) -> list[Comuna]:
    query = db.query(Comuna)
    if args.all_loaded:
        return query.order_by(Comuna.codigo_ine).all()
    if args.codigo_ine:
        comuna = query.filter(Comuna.codigo_ine == args.codigo_ine).first()
        return [comuna] if comuna else []
    raise ValueError("Debe usar --all-loaded o --codigo-ine")


def import_geometry(args) -> list[dict]:
    db = SessionLocal()
    results: list[dict] = []
    try:
        comunas = _selected_comunas(db, args)
        for comuna in comunas:
            official = fetch_official_geometry(comuna.codigo_ine)
            before = {
                "centroid_lat": comuna.centroid_lat,
                "centroid_lon": comuna.centroid_lon,
                "bbox": comuna.bbox,
            }
            changed = (
                before["centroid_lat"] != official["centroid_lat"]
                or before["centroid_lon"] != official["centroid_lon"]
                or before["bbox"] != official["bbox"]
            )
            if not args.dry_run:
                extra_data = dict(comuna.extra_data or {})
                extra_data["geometry_source"] = official["source"]
                comuna.centroid_lat = official["centroid_lat"]
                comuna.centroid_lon = official["centroid_lon"]
                comuna.bbox = official["bbox"]
                comuna.extra_data = extra_data
            results.append(
                {
                    "codigo_ine": comuna.codigo_ine,
                    "nombre": comuna.nombre,
                    "nombre_oficial": official["nombre_oficial"],
                    "before": before,
                    "after": {
                        "centroid_lat": official["centroid_lat"],
                        "centroid_lon": official["centroid_lon"],
                        "bbox": official["bbox"],
                    },
                    "changed": changed,
                    "dry_run": args.dry_run,
                }
            )
        if not args.dry_run:
            db.commit()
        return results
    except Exception:
        if not args.dry_run:
            db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa geometrias oficiales de comunas cargadas.")
    parser.add_argument("--all-loaded", action="store_true")
    parser.add_argument("--codigo-ine")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    results = import_geometry(args)
    if args.json:
        print(json.dumps({"resultados": results}, ensure_ascii=False, indent=2))
        return

    for item in results:
        action = "simularia" if item["dry_run"] else "actualizo"
        print(f"{item['codigo_ine']} {item['nombre']}: {action} centroide/bbox oficial")


if __name__ == "__main__":
    main()
