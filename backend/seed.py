"""
Seed SafeCity Platform - Datos REALES 1461 Penalolen 2021-2025
"""
import os, sys, random
from datetime import datetime, date
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database import Base
import app.models.comuna, app.models.delito, app.models.feature
import app.models.prediccion, app.models.indice
import app.models.user
from app.models.comuna import Comuna
from app.models.delito import Delito
from app.models.indice import IndiceSeguridad

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://safecity:safecity_secret@localhost:5432/safecity_db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)
with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE usuarios "
        "ADD COLUMN IF NOT EXISTS producto_preferido VARCHAR(20) NOT NULL DEFAULT 'territorio'"
    ))
Session = sessionmaker(bind=engine)
db = Session()

# ==========================================
# 1. COMUNAS RM
# ==========================================
COMUNAS_RM = [
    ("13101","Santiago","santiago","Santiago",404495,22.4,-33.4569,-70.6483),
    ("13102","Cerrillos","cerrillos","Santiago",80457,21.0,-33.4956,-70.7150),
    ("13103","Cerro Navia","cerro navia","Santiago",132622,11.0,-33.4253,-70.7367),
    ("13104","Conchali","conchali","Santiago",133256,11.0,-33.3820,-70.6667),
    ("13105","El Bosque","el bosque","Santiago",162505,14.1,-33.5678,-70.6722),
    ("13106","Estacion Central","estacion central","Santiago",147041,14.2,-33.4567,-70.6928),
    ("13107","Huechuraba","huechuraba","Santiago",98671,44.8,-33.3672,-70.6433),
    ("13108","Independencia","independencia","Santiago",100239,7.0,-33.4178,-70.6564),
    ("13109","La Cisterna","la cisterna","Santiago",90219,10.0,-33.5272,-70.6636),
    ("13110","La Florida","la florida","Santiago",366916,71.0,-33.5231,-70.5886),
    ("13111","La Granja","la granja","Santiago",121673,10.0,-33.5356,-70.6325),
    ("13112","La Pintana","la pintana","Santiago",190085,30.0,-33.5819,-70.6239),
    ("13113","La Reina","la reina","Santiago",96762,23.0,-33.4544,-70.5481),
    ("13114","Las Condes","las condes","Santiago",294838,99.0,-33.4172,-70.5317),
    ("13115","Lo Barnechea","lo barnechea","Santiago",105833,1024.0,-33.3586,-70.5175),
    ("13116","Lo Espejo","lo espejo","Santiago",98561,7.0,-33.5322,-70.6919),
    ("13117","Lo Prado","lo prado","Santiago",104403,7.0,-33.4481,-70.7192),
    ("13118","Macul","macul","Santiago",116371,12.0,-33.4931,-70.5975),
    ("13119","Maipu","maipu","Santiago",522795,135.0,-33.5117,-70.7581),
    ("13120","Nunoa","nunoa","Santiago",208845,16.0,-33.4572,-70.5981),
    ("13121","Pedro Aguirre Cerda","pedro aguirre cerda","Santiago",101058,10.0,-33.4978,-70.6625),
    ("13122","Penalolen","penalolen","Santiago",241133,54.0,-33.4828,-70.5089),
    ("13123","Providencia","providencia","Santiago",120874,14.0,-33.4322,-70.6122),
    ("13124","Pudahuel","pudahuel","Santiago",230293,197.0,-33.4439,-70.7642),
    ("13125","Quilicura","quilicura","Santiago",210410,58.0,-33.3575,-70.7283),
    ("13126","Quinta Normal","quinta normal","Santiago",104058,13.0,-33.4378,-70.7039),
    ("13127","Recoleta","recoleta","Santiago",148220,16.0,-33.3972,-70.6383),
    ("13128","Renca","renca","Santiago",147151,24.0,-33.3967,-70.7100),
    ("13129","San Joaquin","san joaquin","Santiago",97779,10.0,-33.4922,-70.6394),
    ("13130","San Miguel","san miguel","Santiago",107453,10.0,-33.4983,-70.6508),
    ("13131","San Ramon","san ramon","Santiago",82100,6.0,-33.5364,-70.6461),
    ("13132","Vitacura","vitacura","Santiago",85284,28.0,-33.3906,-70.5767),
]

print("Cargando comunas RM...")
for cod, nombre, nombre_norm, prov, pob, sup, lat, lon in COMUNAS_RM:
    if not db.query(Comuna).filter(Comuna.codigo_ine == cod).first():
        db.add(Comuna(
            codigo_ine=cod, nombre=nombre, nombre_normalizado=nombre_norm,
            region="Region Metropolitana de Santiago", codigo_region="13",
            provincia=prov, poblacion=pob, superficie_km2=sup,
            densidad_poblacional=round(pob/sup, 2) if sup > 0 else None,
            centroid_lat=lat, centroid_lon=lon,
            bbox=[lon-0.05, lat-0.05, lon+0.05, lat+0.05],
        ))
db.commit()
print("OK: {} comunas".format(len(COMUNAS_RM)))

# ==========================================
# 2. DATOS REALES 1461 PENALOLEN
# ==========================================
penalolen = db.query(Comuna).filter(Comuna.codigo_ine == "13122").first()

existing_real = db.query(Delito).filter(
    Delito.comuna_id == penalolen.id, Delito.fuente == "1461"
).count()

if existing_real > 0:
    print("Ya hay {} delitos reales cargados. OK.".format(existing_real))
else:
    # Borrar demos si existen
    demo_count = db.query(Delito).filter(Delito.comuna_id == penalolen.id).count()
    if demo_count > 0:
        print("Borrando {} delitos demo...".format(demo_count))
        db.query(Delito).filter(Delito.comuna_id == penalolen.id).delete()
        db.commit()

    try:
        import pandas as pd

        EXCEL_PATH = "/app/data/1461_2021-2025.xlsx"
        if not os.path.exists(EXCEL_PATH):
            print("ARCHIVO NO ENCONTRADO: " + EXCEL_PATH)
            raise FileNotFoundError(EXCEL_PATH)

        # Bbox por sector dentro de Penalolen
        SECTORES = {
            "penalolen alto": (-33.455, -70.495, -33.470, -70.480),
            "lo hermida":     (-33.490, -70.515, -33.505, -70.500),
            "la faena":       (-33.475, -70.510, -33.490, -70.495),
            "san luis":       (-33.465, -70.505, -33.480, -70.490),
            "las parcelas":   (-33.480, -70.495, -33.495, -70.480),
            "villa macul":    (-33.495, -70.520, -33.510, -70.505),
            "el valle":       (-33.460, -70.490, -33.475, -70.475),
            "default":        (-33.520, -70.520, -33.450, -70.470),
        }

        def get_coords(sector):
            key = sector.lower().strip() if isinstance(sector, str) else ""
            box = next((v for k, v in SECTORES.items() if k in key), SECTORES["default"])
            return round(random.uniform(box[0], box[2]), 6), round(random.uniform(box[1], box[3]), 6)

        def mapear_tipo(motivo):
            if not isinstance(motivo, str):
                return "Otros"
            m = motivo.lower()
            if any(x in m for x in ["robo", "hurto", "sustracc"]):
                return "Robo/Hurto"
            if any(x in m for x in ["amenaza", "pelea", "agresi", "vif", "violencia", "lesion"]):
                return "Violencia/Lesiones"
            if any(x in m for x in ["droga", "alcohol", "consumo", "narco"]):
                return "Consumo/Drogas"
            if any(x in m for x in ["sospecha", "individuo", "merodea"]):
                return "Personas sospechosas"
            if any(x in m for x in ["ruido", "fiesta", "escandalo", "bulla"]):
                return "Ruidos/Desorden"
            if any(x in m for x in ["accidente", "colision", "atropell"]):
                return "Accidente vial"
            if any(x in m for x in ["incendio", "fuego"]):
                return "Incendio"
            if any(x in m for x in ["emergencia", "herido", "auxilio"]):
                return "Emergencia"
            return "Otros"

        def parse_fecha(fecha_val, hora_val=""):
            try:
                if isinstance(fecha_val, str):
                    for fmt in ["%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"]:
                        try:
                            d = datetime.strptime(fecha_val.strip(), fmt)
                            break
                        except ValueError:
                            pass
                    else:
                        return None
                elif hasattr(fecha_val, "year"):
                    d = datetime(fecha_val.year, fecha_val.month, fecha_val.day)
                else:
                    return None
                if isinstance(hora_val, str) and ":" in hora_val:
                    parts = hora_val.split(":")
                    d = d.replace(hour=int(parts[0]) % 24, minute=int(parts[1]) % 60)
                return d
            except Exception:
                return None

        SHEET_MAP = {
            "2021": ("Fecha", "Hora", "Motivo", "Macrosector"),
            "2022": ("Fecha", "Hora", "Motivo", "Macrosector"),
            "2023": ("fecha", "hora", "TIPO", "Sector_1"),
            "2024": ("Marca temporal", "Hora", "Motivo", "Macro sector"),
            "2025": ("Fecha", "Hora", "Motivo", "Macro sector"),
        }

        xl = pd.ExcelFile(EXCEL_PATH)
        registros = []

        for sheet, (col_fecha, col_hora, col_motivo, col_sector) in SHEET_MAP.items():
            df = xl.parse(sheet)
            df.columns = df.columns.str.strip()
            for _, row in df.iterrows():
                fecha = parse_fecha(row.get(col_fecha), row.get(col_hora, ""))
                if not fecha:
                    continue
                motivo = row.get(col_motivo, "Otros")
                sector = row.get(col_sector, "")
                lat, lon = get_coords(sector)
                registros.append((
                    fecha, str(motivo)[:200], mapear_tipo(motivo),
                    str(sector)[:100] if isinstance(sector, str) else "",
                    lat, lon
                ))

        print("Cargando {} registros reales del 1461...".format(len(registros)))

        BATCH = 500
        for i in range(0, len(registros), BATCH):
            batch = registros[i:i+BATCH]
            for fecha, desc, tipo, barrio, lat, lon in batch:
                db.add(Delito(
                    comuna_id=penalolen.id,
                    tipo_delito=tipo,
                    descripcion=desc,
                    latitud=lat,
                    longitud=lon,
                    barrio=barrio,
                    fecha_hora=fecha,
                    dia_semana=fecha.weekday(),
                    hora_del_dia=fecha.hour,
                    es_fin_semana=fecha.weekday() >= 5,
                    fuente="1461",
                    confianza=0.95,
                ))
            db.commit()
            if (i // BATCH) % 40 == 0:
                print("  ... {}/{}".format(i + len(batch), len(registros)))

        print("OK: {} delitos reales del 1461".format(len(registros)))

    except Exception as e:
        print("ERROR cargando delitos: {}".format(e))
        db.rollback()

# ==========================================
# 3. INDICES SEGURIDAD - RM COMUNAS
# ==========================================
# Datos estimados basados en estadísticas CEAD/INE para hacer el Ranking funcional
INDICES_RM = [
    # (codigo_ine, indice_global, percepcion, victimizacion, temor, tasa_del, tasa_rob, tasa_hur, resolucion, rank_nac, rank_reg, tendencia, cambio)
    ("13101", 52.0, 48.0, 44.0, 50.0, 312.1, 128.4, 183.7, 22.0, 142, 18, "estable", 1.2),    # Santiago
    ("13102", 71.0, 68.0, 65.0, 58.0, 145.2, 58.1,  87.1,  30.0, 45,  8,  "bajando", -8.5),   # Cerrillos
    ("13103", 58.0, 54.0, 50.0, 55.0, 251.3, 102.5, 148.8, 20.0, 110, 15, "estable", -2.1),   # Cerro Navia
    ("13104", 63.0, 60.0, 56.0, 52.0, 198.7, 79.5,  119.2, 24.0, 78,  12, "bajando", -5.3),   # Conchali
    ("13105", 60.0, 57.0, 53.0, 54.0, 225.4, 90.2,  135.2, 21.0, 98,  14, "estable", -0.8),   # El Bosque
    ("13106", 55.0, 51.0, 47.0, 53.0, 278.9, 111.6, 167.3, 19.0, 128, 17, "subiendo", 3.4),   # Estacion Central
    ("13107", 74.0, 71.0, 68.0, 60.0, 125.6, 50.2,  75.4,  32.0, 35,  5,  "bajando", -10.2),  # Huechuraba
    ("13108", 57.0, 53.0, 49.0, 55.0, 265.8, 106.3, 159.5, 20.0, 118, 16, "estable", 1.5),    # Independencia
    ("13109", 65.0, 62.0, 58.0, 53.0, 182.3, 72.9,  109.4, 26.0, 65,  10, "bajando", -6.7),   # La Cisterna
    ("13110", 69.0, 66.0, 62.0, 57.0, 154.8, 61.9,  92.9,  28.0, 52,  9,  "bajando", -7.8),   # La Florida
    ("13111", 61.0, 58.0, 54.0, 53.0, 215.6, 86.2,  129.4, 22.0, 92,  13, "estable", -1.9),   # La Granja
    ("13112", 56.0, 52.0, 48.0, 56.0, 270.4, 108.2, 162.2, 18.0, 125, 17, "subiendo", 2.8),   # La Pintana
    ("13113", 78.0, 75.0, 72.0, 62.0, 98.5,  39.4,  59.1,  38.0, 18,  2,  "bajando", -12.0),  # La Reina
    ("13114", 85.0, 82.0, 80.0, 68.0, 68.2,  27.3,  40.9,  45.0, 5,   1,  "bajando", -15.3),  # Las Condes
    ("13115", 80.0, 77.0, 74.0, 64.0, 88.4,  35.4,  53.0,  40.0, 12,  2,  "bajando", -11.5),  # Lo Barnechea
    ("13116", 59.0, 55.0, 51.0, 56.0, 238.7, 95.5,  143.2, 20.0, 105, 14, "estable", 0.5),    # Lo Espejo
    ("13117", 64.0, 61.0, 57.0, 52.0, 190.5, 76.2,  114.3, 25.0, 70,  11, "bajando", -4.8),   # Lo Prado
    ("13118", 67.0, 64.0, 60.0, 55.0, 168.9, 67.6,  101.3, 27.0, 60,  10, "bajando", -6.2),   # Macul
    ("13119", 66.0, 63.0, 59.0, 54.0, 174.3, 69.7,  104.6, 26.0, 63,  10, "bajando", -5.9),   # Maipu
    ("13120", 72.0, 69.0, 66.0, 59.0, 138.7, 55.5,  83.2,  31.0, 40,  7,  "bajando", -9.1),   # Nunoa
    ("13121", 60.0, 57.0, 53.0, 54.0, 222.1, 88.8,  133.3, 21.0, 95,  13, "estable", -1.2),   # Pedro Aguirre Cerda
    ("13122", 67.5, 62.0, 58.0, 55.0, 207.5, 85.2,  122.3, 25.0, 85,  25, "bajando", -12.5),  # Penalolen
    ("13123", 76.0, 73.0, 70.0, 61.0, 112.4, 45.0,  67.4,  36.0, 22,  3,  "bajando", -13.2),  # Providencia
    ("13124", 62.0, 59.0, 55.0, 53.0, 208.6, 83.4,  125.2, 23.0, 88,  13, "estable", -2.5),   # Pudahuel
    ("13125", 68.0, 65.0, 61.0, 56.0, 162.5, 65.0,  97.5,  27.0, 57,  9,  "bajando", -7.1),   # Quilicura
    ("13126", 63.0, 60.0, 56.0, 52.0, 196.2, 78.5,  117.7, 24.0, 76,  12, "bajando", -4.5),   # Quinta Normal
    ("13127", 58.0, 54.0, 50.0, 55.0, 258.3, 103.3, 155.0, 19.0, 114, 16, "estable", 1.8),    # Recoleta
    ("13128", 61.0, 58.0, 54.0, 53.0, 213.8, 85.5,  128.3, 22.0, 90,  13, "estable", -1.5),   # Renca
    ("13129", 64.0, 61.0, 57.0, 52.0, 188.4, 75.4,  113.0, 25.0, 68,  11, "bajando", -5.2),   # San Joaquin
    ("13130", 66.0, 63.0, 59.0, 54.0, 175.6, 70.2,  105.4, 26.0, 62,  10, "bajando", -6.1),   # San Miguel
    ("13131", 57.0, 53.0, 49.0, 56.0, 262.1, 104.8, 157.3, 19.0, 120, 16, "estable", 2.1),    # San Ramon
    ("13132", 88.0, 85.0, 83.0, 70.0, 55.3,  22.1,  33.2,  50.0, 2,   1,  "bajando", -18.5),  # Vitacura
]

print("Cargando índices de seguridad RM...")
indices_ok = 0
for (cod, ig, ip, iv, it, td, tr, th, res, rn, rr, tend, cambio) in INDICES_RM:
    comuna_obj = db.query(Comuna).filter(Comuna.codigo_ine == cod).first()
    if not comuna_obj:
        continue
    existing = db.query(IndiceSeguridad).filter(IndiceSeguridad.comuna_id == comuna_obj.id).first()
    if not existing:
        db.add(IndiceSeguridad(
            comuna_id=comuna_obj.id, fecha=date(2025, 3, 1),
            indice_seguridad_global=ig, indice_percepcion=ip,
            indice_victimizacion=iv, indice_temor=it,
            tasa_delictual=td, tasa_robos=tr, tasa_hurtos=th,
            tasa_resolucion=res, ranking_nacional=rn, ranking_regional=rr,
            tendencia=tend, cambio_porcentual=cambio,
        ))
        indices_ok += 1
db.commit()
print("OK: {} índices de seguridad".format(indices_ok))

# ==========================================
# 4. USUARIOS SEED
# ==========================================
from app.models.user import Usuario
from app.auth import hash_password

USERS_SEED = [
    ("Admin Técnico",    "admin@safecity.cl",    "admin123",     "tecnico",   22, "territorio"),
    ("Jefe Seguridad",   "autoridad@safecity.cl","autoridad123", "autoridad", 22, "territorio"),
    ("Ciudadano Demo",   "ciudadano@safecity.cl","ciudadano123", "ciudadano", 22, "territorio"),
    ("Pedro Moreno",     "pedro@safecity.cl",    "pedro123",     "tecnico",   22, "activos"),
]

print("Cargando usuarios seed...")
users_ok = 0
for user_seed in USERS_SEED:
    nombre, email, passwd, rol, cid = user_seed[:5]
    producto = user_seed[5] if len(user_seed) > 5 else "territorio"
    existing = db.query(Usuario).filter(Usuario.email == email).first()
    if not existing:
        db.add(Usuario(
            nombre=nombre, email=email,
            password_hash=hash_password(passwd),
            rol=rol, comuna_id=cid,
            producto_preferido=producto,
        ))
        users_ok += 1
    elif existing.producto_preferido != producto:
        existing.producto_preferido = producto
db.commit()
print(f"OK: {users_ok} usuarios creados")

db.close()
print("Seed completado.")
