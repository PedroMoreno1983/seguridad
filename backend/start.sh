#!/bin/sh
set -e

echo "Iniciando SafeCity API..."

# Crear tablas si hay DB disponible (no abortar si falla)
python -c "
try:
    from app.database import engine, Base
    import app.models.comuna
    import app.models.delito
    import app.models.feature
    import app.models.prediccion
    import app.models.indice
    import app.models.user
    Base.metadata.create_all(bind=engine)
    print('Tablas creadas/verificadas')
except Exception as e:
    print(f'Sin base de datos por ahora: {e}')
" || true

echo "Ejecutando seed de datos (Penalolen)..."
python seed.py || echo "Seed Penalolen fallo (puede que ya existan datos)"

echo "Ejecutando seed de datos (La Granja)..."
python seed_lagranja.py || echo "Seed La Granja fallo (puede que ya existan datos)"

echo "Levantando servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
