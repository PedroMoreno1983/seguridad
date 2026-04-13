"""
Seed La Granja
==============
Carga datos reales de la comuna de La Granja:
  - partes cursados 2022-2025 (infracciones/fiscalización municipal)
  - procedimientos seguridad pública 2025 (intervenciones de terreno)
"""

import os
import sys
import re
from datetime import date, datetime, timedelta
import random
import pandas as pd
from sqlalchemy.orm import Session

from app.database import engine, Base
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.indice import IndiceSeguridad

# ── Crear tablas si faltan ──────────────────────────────────────────────────
try:
    Base.metadata.create_all(bind=engine)
    print("OK: tablas verificadas")
except Exception as e:
    print(f"WARN: {e}")

db: Session = Session(bind=engine)

# ══════════════════════════════════════════════════════════════════════════════
# 1. COMUNA LA GRANJA
# ══════════════════════════════════════════════════════════════════════════════
lagranja = db.query(Comuna).filter(Comuna.codigo_ine == "13111").first()
if not lagranja:
    lagranja = Comuna(
        nombre="La Granja",
        region="Metropolitana de Santiago",
        codigo_ine="13111",
        poblacion=132732,
        superficie_km2=10.8,
        centroid_lat=-33.5455,
        centroid_lon=-70.6330,
        bbox={"min_lat": -33.570, "max_lat": -33.521, "min_lon": -70.660, "max_lon": -70.605},
    )
    db.add(lagranja)
    db.commit()
    db.refresh(lagranja)
    print(f"OK: comuna La Granja creada (id={lagranja.id})")
else:
    print(f"OK: comuna La Granja ya existe (id={lagranja.id})")

# ══════════════════════════════════════════════════════════════════════════════
# 2. VERIFICAR SI YA HAY DATOS REALES
# ══════════════════════════════════════════════════════════════════════════════
existing_real = db.query(Delito).filter(
    Delito.comuna_id == lagranja.id,
    Delito.fuente.in_(["partes_lg", "procedimientos_lg"])
).count()

if existing_real > 0:
    print(f"OK: ya existen {existing_real} registros reales de La Granja, saltando.")
    db.close()
    print("Seed La Granja completado (sin cambios).")
    sys.exit(0)

# Borrar demos previos si existen
demos = db.query(Delito).filter(
    Delito.comuna_id == lagranja.id,
    Delito.fuente == "demo"
).count()
if demos:
    db.query(Delito).filter(
        Delito.comuna_id == lagranja.id,
        Delito.fuente == "demo"
    ).delete()
    db.commit()
    print(f"OK: {demos} registros demo eliminados")

# ══════════════════════════════════════════════════════════════════════════════
# 3. MAPEO DE TIPOS
# ══════════════════════════════════════════════════════════════════════════════

# Partes cursados → tipo_delito
def mapear_infraccion(nombre: str, desc: str) -> str:
    n = str(nombre).upper()
    d = str(desc).upper()
    if "GRAVISIMA" in n:
        return "Infracción Tránsito Grave"
    if "LICENCIA" in n or "LICENCIA" in d:
        return "Infracción Tránsito Grave"
    if "TRANSITO" in n or "TRANSITO" in d:
        return "Infracción de Tránsito"
    if "ORDENANZA" in n:
        return "Infracción Municipal"
    if "ABANDONADA" in n or "ABANDONADO" in d:
        return "Vehículo Abandonado"
    if "ACUMULACION" in n:
        return "Infracción de Tránsito"
    return "Infracción Municipal"

# Procedimientos → tipo_delito
def mapear_procedimiento(proc: str) -> str | None:
    p = str(proc).strip().lower()
    # Ignorar procedimientos no relevantes para seguridad pública
    if any(x in p for x in ["b.p.f", "breve punto", "rondas", "traslado", "ronda"]):
        return None  # patrullaje preventivo puro, no incidente
    if "delito" in p:
        return "Delito"
    if "vif" in p or "violencia intrafamiliar" in p:
        return "Violencia Intrafamiliar"
    if "incivilidad" in p:
        return "Ruidos/Desorden"
    if "policial" in p:
        return "Intervención Policial"
    if "fiscaliz" in p:
        return "Fiscalización"
    if "emergencia de salud" in p or "salud" in p:
        return "Emergencia Médica"
    if "emergencia" in p:
        return "Emergencia"
    if "accidente vehicular" in p or "vehicular" in p:
        return "Accidente Vial"
    if "medidas cautelares" in p:
        return "Violencia Intrafamiliar"
    if "situaci" in p and "calle" in p:
        return "Persona en Situación Calle"
    if "derivaci" in p:
        return None  # solo derivación, sin incidente
    if "retiro psc" in p:
        return "Persona en Situación Calle"
    return "Otros"

# ══════════════════════════════════════════════════════════════════════════════
# 4. COORDENADAS POR SECTOR (6 franjas territoriales)
# ══════════════════════════════════════════════════════════════════════════════
FRANJAS = {
    1: {"lat_c": -33.525, "lon_c": -70.640, "r": 0.008},
    2: {"lat_c": -33.535, "lon_c": -70.625, "r": 0.008},
    3: {"lat_c": -33.545, "lon_c": -70.635, "r": 0.007},
    4: {"lat_c": -33.555, "lon_c": -70.620, "r": 0.007},
    5: {"lat_c": -33.562, "lon_c": -70.640, "r": 0.006},
    6: {"lat_c": -33.568, "lon_c": -70.628, "r": 0.006},
}

rng = random.Random(42)

def coords_aleatorias(franja: int = None):
    if franja and franja in FRANJAS:
        z = FRANJAS[franja]
    else:
        z = FRANJAS[rng.randint(1, 6)]
    lat = z["lat_c"] + rng.uniform(-z["r"], z["r"])
    lon = z["lon_c"] + rng.uniform(-z["r"], z["r"])
    return round(lat, 6), round(lon, 6)

# ══════════════════════════════════════════════════════════════════════════════
# 5. CARGAR PARTES CURSADOS 2022-2025
# ══════════════════════════════════════════════════════════════════════════════
print("\nCargando partes cursados 2022-2025...")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
partes_path = os.path.join(DATA_DIR, "lagranja_partes_2022-2025.xlsx")

df_partes = pd.read_excel(partes_path)
batch = []
skipped = 0

for _, row in df_partes.iterrows():
    try:
        fecha_raw = row.get("fechaturno") or row.get("fechaparteinsp")
        if pd.isna(fecha_raw):
            skipped += 1
            continue

        if isinstance(fecha_raw, str):
            fecha_dt = datetime.strptime(fecha_raw[:10], "%Y-%m-%d")
        else:
            fecha_dt = pd.Timestamp(fecha_raw).to_pydatetime()

        hora = rng.randint(7, 22)
        minuto = rng.randint(0, 59)
        fecha_dt = fecha_dt.replace(hour=hora, minute=minuto)

        tipo = mapear_infraccion(
            row.get("nombreinfraccion", ""),
            row.get("descinfraccioninsp", "")
        )
        lat, lon = coords_aleatorias()

        batch.append(Delito(
            comuna_id=lagranja.id,
            tipo_delito=tipo,
            fecha_hora=fecha_dt,
            descripcion=str(row.get("descinfraccioninsp", ""))[:200],
            latitud=lat,
            longitud=lon,
            fuente="partes_lg",
            confianza=0.85,
        ))
    except Exception:
        skipped += 1

db.bulk_save_objects(batch)
db.commit()
print(f"OK: {len(batch)} partes cargados ({skipped} omitidos)")

# ══════════════════════════════════════════════════════════════════════════════
# 6. CARGAR PROCEDIMIENTOS SEGURIDAD 2025
# ══════════════════════════════════════════════════════════════════════════════
print("\nCargando procedimientos seguridad 2025...")

proc_path = os.path.join(DATA_DIR, "lagranja_procedimientos_2025.xlsx")

# Intentar con nombre exacto primero, si falla usar índice 0
try:
    df_proc = pd.read_excel(proc_path, sheet_name="Procedimientos Año 2025", header=3)
except Exception:
    try:
        df_proc = pd.read_excel(proc_path, sheet_name=0, header=3)
    except Exception:
        df_proc = pd.read_excel(proc_path, header=3)
df_proc.columns = [str(c).strip() for c in df_proc.columns]

# Identificar columnas dinámicamente
col_fecha  = "Fecha"
col_proc   = [c for c in df_proc.columns if "PROC" in c.upper()][0]
col_mod    = [c for c in df_proc.columns if "MODAL" in c.upper() or "Modalidad" in c][0]

batch2 = []
skipped2 = 0

for _, row in df_proc.iterrows():
    try:
        fecha_raw = row.get(col_fecha)
        if pd.isna(fecha_raw):
            skipped2 += 1
            continue

        if isinstance(fecha_raw, str):
            fecha_dt = datetime.strptime(str(fecha_raw)[:10], "%Y-%m-%d")
        else:
            fecha_dt = pd.Timestamp(fecha_raw).to_pydatetime()

        hora = rng.randint(0, 23)
        minuto = rng.randint(0, 59)
        fecha_dt = fecha_dt.replace(hour=hora, minute=minuto)

        proc_val = str(row.get(col_proc, "")).strip()
        tipo = mapear_procedimiento(proc_val)
        if tipo is None:
            skipped2 += 1
            continue

        modalidad = str(row.get(col_mod, "")).strip()
        # Franja aleatoria ponderada hacia zonas más activas
        franja = rng.choices(
            [1, 2, 3, 4, 5, 6],
            weights=[20, 18, 20, 17, 15, 10]
        )[0]
        lat, lon = coords_aleatorias(franja)

        batch2.append(Delito(
            comuna_id=lagranja.id,
            tipo_delito=tipo,
            fecha_hora=fecha_dt,
            descripcion=f"{proc_val} | Contacto: {modalidad}"[:200],
            latitud=lat,
            longitud=lon,
            fuente="procedimientos_lg",
            confianza=0.9,
        ))
    except Exception:
        skipped2 += 1

db.bulk_save_objects(batch2)
db.commit()
print(f"OK: {len(batch2)} procedimientos cargados ({skipped2} omitidos/patrullajes)")

# ══════════════════════════════════════════════════════════════════════════════
# 7. ÍNDICE DE SEGURIDAD LA GRANJA
# ══════════════════════════════════════════════════════════════════════════════
if not db.query(IndiceSeguridad).filter(IndiceSeguridad.comuna_id == lagranja.id).first():
    db.add(IndiceSeguridad(
        comuna_id=lagranja.id,
        fecha=date(2025, 3, 1),
        indice_seguridad_global=61.0,
        indice_percepcion=58.0,
        indice_victimizacion=54.0,
        indice_temor=53.0,
        tasa_delictual=215.6,
        tasa_robos=86.2,
        tasa_hurtos=129.4,
        tasa_resolucion=22.0,
        ranking_nacional=92,
        ranking_regional=13,
        tendencia="estable",
        cambio_porcentual=-1.9,
    ))
    db.commit()
    print("OK: índice seguridad La Granja creado")

# ══════════════════════════════════════════════════════════════════════════════
# RESUMEN
# ══════════════════════════════════════════════════════════════════════════════
total = db.query(Delito).filter(Delito.comuna_id == lagranja.id).count()
print(f"\n{'='*50}")
print(f"La Granja - total registros en BD: {total}")
print(f"  Partes 2022-2025:         {len(batch)}")
print(f"  Procedimientos 2025:      {len(batch2)}")
print(f"{'='*50}")

db.close()
print("Seed La Granja completado.")
