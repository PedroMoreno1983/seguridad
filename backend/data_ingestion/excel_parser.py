import os
import sys
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session

# Add backend directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models.delito import Delito
from app.models.comuna import Comuna

def get_or_create_comuna(db: Session, nombre_comuna: str):
    nombre_norm = nombre_comuna.lower().strip()
    comuna = db.query(Comuna).filter(Comuna.nombre_normalizado == nombre_norm).first()
    if not comuna:
        print(f"Instanciando nueva comuna: {nombre_comuna}")
        comuna = Comuna(
            codigo_ine=str(abs(hash(nombre_norm)) % 100000).zfill(5), # Pseudo-random INE
            nombre=nombre_comuna,
            nombre_normalizado=nombre_norm,
            region="Metropolitana" if nombre_comuna != "Valparaíso" else "Valparaíso",
            codigo_region="13" if nombre_comuna != "Valparaíso" else "05",
            provincia="Santiago" if nombre_comuna != "Valparaíso" else "Valparaíso"
        )
        db.add(comuna)
        db.commit()
        db.refresh(comuna)
    return comuna

def parse_valparaiso_cctv(file_path: str, db: Session, comuna_id: int):
    print(f"Procesando archivo Valparaíso: {os.path.basename(file_path)}")
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error leyendo excel: {e}")
        return 0
    
    count = 0
    for _, row in df.iterrows():
        try:
            # Extract datetime
            fecha_val = row.get('FECHA')
            hora_val = row.get('HORA')
            if pd.isna(fecha_val):
                continue
                
            fecha_str = str(fecha_val).split(' ')[0]
            hora_str = str(hora_val) if not pd.isna(hora_val) else "00:00:00"
            date_time_str = f"{fecha_str} {hora_str}"
            
            try:
                dt = pd.to_datetime(date_time_str)
            except:
                dt = datetime.now()
            
            delito_obj = Delito(
                comuna_id=comuna_id,
                tipo_delito=str(row.get('DELITOS E INFRACCIONES', 'Infracción')),
                subtipo=str(row.get('TIPO DE SUCESO (REACTIVAS)', '')),
                latitud=float(row.get('LATITUD', 0.0)) if not pd.isna(row.get('LATITUD')) else None,
                longitud=float(row.get('LONGITUD', 0.0)) if not pd.isna(row.get('LONGITUD')) else None,
                fecha_hora=dt,
                fuente='CCTV_Valparaíso',
                descripcion=str(row.get('DESCRIPICIÓN DEL PROCEDIMIENTO (RESULTADO)', ''))[:490],
                dia_semana=dt.weekday(),
                hora_del_dia=dt.hour,
                es_fin_semana=dt.weekday() >= 5
            )
            db.add(delito_obj)
            count += 1
        except Exception as e:
            continue
            
    db.commit()
    return count

def parse_generic_excel(file_path: str, db: Session, comuna_id: int):
    # Intentar buscar columnas parecidas a fecha, direccion, delito
    print(f"Procesando archivo genérico: {os.path.basename(file_path)}")
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
         return 0
         
    count = 0
    cols = [str(c).lower() for c in df.columns]
    
    # Heurísticas de mapeo
    date_col = next((c for c in df.columns if 'fecha' in str(c).lower() or 'marca temporal' in str(c).lower()), None)
    type_col = next((c for c in df.columns if 'delito' in str(c).lower() or 'motivo' in str(c).lower() or 'infraccion' in str(c).lower()), None)
    addr_col = next((c for c in df.columns if 'lugar' in str(c).lower() or 'direccion' in str(c).lower() or 'sector' in str(c).lower()), None)
    desc_col = next((c for c in df.columns if 'descrip' in str(c).lower() or 'detalle' in str(c).lower() or 'incidente' in str(c).lower()), None)

    for _, row in df.iterrows():
        try:
            if date_col and not pd.isna(row.get(date_col)):
                dt = pd.to_datetime(row.get(date_col))
            else:
                dt = datetime.now()
            
            tipo = str(row.get(type_col, 'Incidente Genérico')) if type_col and not pd.isna(row.get(type_col)) else 'Incidente Genérico'
            direccion = str(row.get(addr_col, '')) if addr_col and not pd.isna(row.get(addr_col)) else ''
            desc = str(row.get(desc_col, '')) if desc_col and not pd.isna(row.get(desc_col)) else ''

            delito_obj = Delito(
                comuna_id=comuna_id,
                tipo_delito=tipo[:90],
                direccion=direccion[:190],
                descripcion=desc[:490],
                fecha_hora=dt,
                fuente="Excel Import",
                dia_semana=dt.weekday() if isinstance(dt, datetime) else 0,
                hora_del_dia=dt.hour if isinstance(dt, datetime) else 0,
                es_fin_semana=(dt.weekday() >= 5) if isinstance(dt, datetime) else False
            )
            db.add(delito_obj)
            count += 1
            if count % 1000 == 0:
                 db.commit() # batch commit
        except Exception as e:
            continue
            
    db.commit()
    return count
