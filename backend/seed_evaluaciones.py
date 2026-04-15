import os
import sys
import random
from datetime import datetime, timedelta

# Add path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.models.intervencion import Intervencion
from app.models.reporte_ciudadano import ReporteCiudadano
from app.models.comuna import Comuna

def seed_evaluaciones():
    # Crear tablas si no existen
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if we have comunas
        comunas = db.query(Comuna).all()
        if not comunas:
            print("No comunas found, please run seed.py first.")
            return

        comuna = comunas[0]
        
        # Eliminar previos
        db.query(Intervencion).delete()
        db.query(ReporteCiudadano).delete()

        print(f"Cargando reportes ciudadanos e intervenciones para {comuna.nombre}...")

        # 1. Crear intervenciones ficticias
        tipos_intervencion = [
            "Aumento patrullaje preventivo",
            "Instalación de luminarias LED",
            "Recuperación espacio público",
            "Pórticos lectores de patentes"
        ]

        ahora = datetime.utcnow()
        for i in range(5):
            lat_c = comuna.centroid_lat + random.uniform(-0.02, 0.02)
            lon_c = comuna.centroid_lon + random.uniform(-0.02, 0.02)
            fecha_inicio = ahora - timedelta(days=random.randint(60, 180))
            
            intervencion = Intervencion(
                comuna_id=comuna.id,
                tipo=random.choice(tipos_intervencion),
                descripcion=f"Estrategia aplicada en sector sur {i}",
                fecha_inicio=fecha_inicio,
                centro_lat=lat_c,
                centro_lon=lon_c,
                zona_bbox=[
                    lon_c - 0.005, lat_c - 0.005,
                    lon_c + 0.005, lat_c + 0.005
                ],
                impacto_estimado={
                    "reduccion_delitos_ratio": round(random.uniform(0.1, 0.4), 2),
                    "desplazamiento_crimen": "Bajo"
                }
            )
            db.add(intervencion)

        # 2. Crear reportes ciudadanos
        tipos_reporte = [
            "percepcion_inseguridad",
            "iluminacion_defectuosa",
            "vandalismo",
            "actividad_sospechosa"
        ]

        gravedades = ["bajo", "medio", "alto"]

        for i in range(30):
            lat = comuna.centroid_lat + random.uniform(-0.03, 0.03)
            lon = comuna.centroid_lon + random.uniform(-0.03, 0.03)
            fecha = ahora - timedelta(days=random.randint(1, 30))
            
            reporte = ReporteCiudadano(
                comuna_id=comuna.id,
                tipo_reporte=random.choice(tipos_reporte),
                descripcion=f"Reporte comunitario de vecino {i}",
                nivel_gravedad=random.choice(gravedades),
                latitud=lat,
                longitud=lon,
                fecha=fecha
            )
            db.add(reporte)

        db.commit()
        print("Módulos creados con éxito.")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_evaluaciones()
