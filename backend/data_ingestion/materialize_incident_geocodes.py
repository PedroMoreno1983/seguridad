"""
Materializa calidad geoespacial de incidentes sin inventar precision exacta.

Uso:
  python data_ingestion/materialize_incident_geocodes.py --all-loaded --dry-run --json
  python data_ingestion/materialize_incident_geocodes.py --codigo-ine 13122
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import UTC, datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.services.geocoding import classify_incident_geocode, confidence_decimal


def _selected_comunas(db, args) -> list[Comuna]:
    query = db.query(Comuna)
    if args.all_loaded:
        return query.order_by(Comuna.codigo_ine).all()
    if args.codigo_ine:
        comuna = query.filter(Comuna.codigo_ine == args.codigo_ine).first()
        return [comuna] if comuna else []
    raise ValueError("Debe usar --all-loaded o --codigo-ine")


def _merge_context(contexto, result) -> dict:
    data = dict(contexto or {}) if isinstance(contexto, dict) else {}
    data["geocoding"] = {
        "precision": result.precision,
        "source": result.source,
        "confidence": result.confidence,
        "sector": result.sector,
        "materialized_at": datetime.now(UTC).isoformat(),
    }
    return data


def _changed(delito: Delito, result) -> bool:
    return (
        delito.latitud != result.latitud
        or delito.longitud != result.longitud
        or getattr(delito, "geocode_precision", None) != result.precision
        or getattr(delito, "geocode_source", None) != result.source
        or float(delito.geocode_confidence or 0) != result.confidence
    )


def materialize(args) -> list[dict]:
    db = SessionLocal()
    summaries: list[dict] = []
    try:
        for comuna in _selected_comunas(db, args):
            counts = Counter()
            changed = 0
            pending = 0
            invalid_coordinates = 0
            last_id = 0
            while True:
                page = (
                    db.query(Delito)
                    .filter(Delito.comuna_id == comuna.id, Delito.id > last_id)
                    .order_by(Delito.id)
                    .limit(args.batch_size)
                    .all()
                )
                if not page:
                    break

                for delito in page:
                    last_id = delito.id
                    result = classify_incident_geocode(
                        comuna,
                        delito,
                        allow_comuna_fallback=not args.skip_comuna_fallback,
                    )
                    counts[result.precision] += 1
                    invalid_coordinates += int(result.invalid_coordinates)

                    if _changed(delito, result):
                        changed += 1
                        if not args.dry_run:
                            delito.latitud = result.latitud
                            delito.longitud = result.longitud
                            delito.geocode_precision = result.precision
                            delito.geocode_source = result.source
                            delito.geocode_confidence = confidence_decimal(result.confidence)
                            delito.contexto = _merge_context(delito.contexto, result)
                            pending += 1

                if not args.dry_run and pending:
                    db.commit()
                    pending = 0

            if not args.dry_run:
                db.commit()

            total = sum(counts.values())
            useful = counts["exacta"] + counts["sector"]
            summaries.append(
                {
                    "codigo_ine": comuna.codigo_ine,
                    "nombre": comuna.nombre,
                    "total": total,
                    "cambios": changed,
                    "exacta": counts["exacta"],
                    "sector": counts["sector"],
                    "comuna": counts["comuna"],
                    "sin_senal": counts["sin_senal"],
                    "coordenadas_invalidas": invalid_coordinates,
                    "porcentaje_util_prediccion": round((useful / total) * 100, 1) if total else 0,
                    "dry_run": args.dry_run,
                }
            )
        return summaries
    except Exception:
        if not args.dry_run:
            db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Materializa geocodigos defendibles de incidentes.")
    parser.add_argument("--all-loaded", action="store_true")
    parser.add_argument("--codigo-ine")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--skip-comuna-fallback", action="store_true")
    parser.add_argument("--batch-size", type=int, default=5000)
    args = parser.parse_args()

    summaries = materialize(args)
    if args.json:
        print(json.dumps({"resultados": summaries}, ensure_ascii=False, indent=2))
        return

    for item in summaries:
        action = "simularia" if item["dry_run"] else "actualizo"
        print(
            f"{item['codigo_ine']} {item['nombre']}: {action} {item['cambios']} filas "
            f"(exacta={item['exacta']}, sector={item['sector']}, comuna={item['comuna']}, sin_senal={item['sin_senal']})"
        )


if __name__ == "__main__":
    main()
