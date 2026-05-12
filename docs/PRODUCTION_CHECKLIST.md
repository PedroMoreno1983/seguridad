# Production Checklist

## Configuracion obligatoria

- Definir `DATABASE_URL` con PostgreSQL administrado.
- Definir `JWT_SECRET_KEY` largo, unico y fuera del repositorio.
- Definir `CORS_ORIGINS` con los dominios reales del frontend.
- Definir `VITE_API_URL` con la URL publica del backend terminada en `/api/v1`.
- Definir `VITE_ENABLE_OFFLINE_DATA=false`.
- Definir `VITE_MAPBOX_TOKEN` si el modulo de mapas estara habilitado.
- Definir `GEMINI_API_KEY` solo si se vendera reporte ejecutivo con IA.
- Ejecutar migraciones: `cd backend && alembic -c alembic.ini upgrade head`.

## Datos

- Cargar catalogo territorial desde `database/seed/01_comunas_rm.sql`.
- Importar centroides y bbox oficiales:

```bash
cd backend
python data_ingestion/import_comuna_geometry.py --all-loaded --dry-run --json
python data_ingestion/import_comuna_geometry.py --all-loaded --json
```

- Cargar incidentes municipales u oficiales con importadores del backend.
- Materializar precision geoespacial:

```bash
cd backend
python data_ingestion/materialize_incident_geocodes.py --all-loaded --dry-run --json
python data_ingestion/materialize_incident_geocodes.py --all-loaded --json
```

- Cargar desercion escolar oficial con `backend/data_ingestion/education_parser.py`.
- Confirmar que cada comuna comercial tenga `comuna_id`, `codigo_ine`, centroide y bbox.
- Validar que predicciones solo corran con incidentes `exacta` o `sector` suficientes.

## Seguridad y acceso

- Mantener `SAFECITY_CREATE_SEED_USERS=false`.
- Crear cuentas nominativas por municipio u organizacion.
- No publicar credenciales compartidas en correos ni documentacion.
- Revisar expiracion de JWT y rotacion de secretos antes del despliegue.
- Verificar que los reportes IA no generen contenido si falta proveedor configurado.

## Pruebas previas a venta

- `python -m compileall app data_ingestion`
- `alembic -c alembic.ini upgrade head`
- `npm run build`
- `GET /health`
- `GET /api/v1/comunas`
- `GET /api/v1/comunas?incluir_bbox=true`
- `GET /api/v1/delitos/georef-quality?comuna_id=<id>`
- `GET /api/v1/delitos/heatmap?comuna_id=<id>`
- `GET /api/v1/prevencion/resumen?comuna_id=<id>`
- `POST /api/v1/predicciones/generar` con una comuna que tenga datos reales.
- `POST /api/v1/predicciones/generar` con una comuna insuficiente debe devolver 422 y motivo claro.
- Flujo completo: crear cuenta municipal, seleccionar comuna, entrar a Territorio, abrir Prevencion.

## Estado Comercial Actual

- Listas para venta territorial: Peñalolen y Pudahuel.
- Requieren datos antes de venta predictiva: Valparaiso, La Cisterna, La Granja, Maipu y San Bernardo.
- Evidencia vigente: `docs/READINESS_COMUNAS_2026-05-12.md`.
