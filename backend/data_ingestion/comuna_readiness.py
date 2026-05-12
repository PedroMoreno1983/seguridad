"""
Auditoria comercial de datos por comuna.

Uso:
  python data_ingestion/comuna_readiness.py --codigo-ine 13122
  python data_ingestion/comuna_readiness.py --comuna-id 4 --json
"""

import argparse
import json
import os
import sys
from datetime import UTC, datetime

from sqlalchemy import func

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.prediccion import Prediccion
from app.models.prevencion import EducacionComunal


def _pct(numerator: int, denominator: int) -> float:
    return round((numerator / denominator) * 100, 1) if denominator else 0.0


def build_readiness_report(comuna_id: int | None = None, codigo_ine: str | None = None) -> dict:
    db = SessionLocal()
    try:
        query = db.query(Comuna)
        if comuna_id is not None:
            query = query.filter(Comuna.id == comuna_id)
        elif codigo_ine:
            query = query.filter(Comuna.codigo_ine == codigo_ine)
        else:
            raise ValueError("Debe indicar comuna_id o codigo_ine")

        comuna = query.first()
        if not comuna:
            raise ValueError("Comuna no encontrada")

        delitos_query = db.query(Delito).filter(Delito.comuna_id == comuna.id)
        total_incidentes = delitos_query.count()
        exactos = delitos_query.filter(Delito.geocode_precision == "exacta").count()
        sectorizados = delitos_query.filter(Delito.geocode_precision == "sector").count()
        comunales = delitos_query.filter(Delito.geocode_precision == "comuna").count()
        sin_senal = delitos_query.filter(Delito.geocode_precision == "sin_senal").count()
        geocodificados = exactos + sectorizados
        fuentes = delitos_query.with_entities(
            Delito.fuente,
            func.count(Delito.id).label("cantidad"),
        ).group_by(Delito.fuente).order_by(func.count(Delito.id).desc()).all()

        fechas = delitos_query.with_entities(
            func.min(Delito.fecha_hora),
            func.max(Delito.fecha_hora),
        ).first()

        educacion = db.query(EducacionComunal).filter(
            EducacionComunal.comuna_id == comuna.id,
        ).order_by(EducacionComunal.anio.asc()).all()

        predicciones_activas = db.query(Prediccion).filter(
            Prediccion.comuna_id == comuna.id,
            Prediccion.fecha_fin >= datetime.now(UTC),
        ).count()

        brechas = []
        if total_incidentes < 500:
            brechas.append("Cargar al menos 500 incidentes historicos para prediccion operacional robusta.")
        if _pct(geocodificados, total_incidentes) < 80:
            brechas.append("Mejorar geocodificacion de incidentes sobre 80%.")
        if len(educacion) < 5:
            brechas.append("Cargar serie educativa comunal de al menos 5 anos.")
        if predicciones_activas == 0 and total_incidentes >= 500 and geocodificados > 0:
            brechas.append("Generar predicciones activas para habilitar mapas de riesgo y reportes ejecutivos.")

        estado = "listo_comercial" if not brechas else "requiere_datos"

        return {
            "estado": estado,
            "comuna": {
                "id": comuna.id,
                "codigo_ine": comuna.codigo_ine,
                "nombre": comuna.nombre,
                "region": comuna.region,
            },
            "incidentes": {
                "total": total_incidentes,
                "geocodificados": geocodificados,
                "exactos": exactos,
                "sectorizados": sectorizados,
                "comunales": comunales,
                "sin_senal": sin_senal,
                "porcentaje_geocodificado": _pct(geocodificados, total_incidentes),
                "periodo": {
                    "desde": fechas[0].isoformat() if fechas and fechas[0] else None,
                    "hasta": fechas[1].isoformat() if fechas and fechas[1] else None,
                },
                "fuentes": [{"fuente": fuente, "cantidad": cantidad} for fuente, cantidad in fuentes],
            },
            "educacion": {
                "anios": [row.anio for row in educacion],
                "ultimo_anio": educacion[-1].anio if educacion else None,
                "ultima_tasa_desvinculacion": (
                    float(educacion[-1].tasa_desvinculacion)
                    if educacion and educacion[-1].tasa_desvinculacion is not None
                    else None
                ),
                "fuentes": sorted({row.fuente for row in educacion if row.fuente}),
            },
            "predicciones": {
                "activas": predicciones_activas,
            },
            "brechas": brechas,
        }
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Auditar readiness comercial de una comuna.")
    parser.add_argument("--comuna-id", type=int)
    parser.add_argument("--codigo-ine")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    report = build_readiness_report(comuna_id=args.comuna_id, codigo_ine=args.codigo_ine)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    print(f"Comuna: {report['comuna']['nombre']} ({report['comuna']['codigo_ine']})")
    print(f"Estado: {report['estado']}")
    print(f"Incidentes: {report['incidentes']['total']} ({report['incidentes']['porcentaje_geocodificado']}% geocodificados)")
    print(f"Educacion: {len(report['educacion']['anios'])} anos cargados")
    print(f"Predicciones activas: {report['predicciones']['activas']}")
    if report["brechas"]:
        print("Brechas:")
        for item in report["brechas"]:
            print(f"- {item}")


if __name__ == "__main__":
    main()
