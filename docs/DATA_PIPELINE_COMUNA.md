# Pipeline Comercial Por Comuna

## Objetivo

Dejar una comuna lista para venta exige trazabilidad de fuentes, cobertura minima y una revision objetiva antes de presentar predicciones o reportes.

## Flujo

1. Cargar catalogo territorial.

```bash
psql "$DATABASE_URL" -f database/seed/01_comunas_rm.sql
```

2. Importar geometria comunal oficial por CUT_COM.

```bash
cd backend
python data_ingestion/import_comuna_geometry.py --all-loaded --dry-run --json
python data_ingestion/import_comuna_geometry.py --all-loaded --json
```

Fuente operativa: capa DPA comunal MOP/SUBDERE.

3. Cargar incidentes municipales u oficiales.

```bash
cd backend
python data_ingestion/orchestrator.py --data-dir data/clientes/<comuna>
```

4. Materializar precision geoespacial defendible.

```bash
cd backend
python data_ingestion/materialize_incident_geocodes.py --all-loaded --dry-run --json
python data_ingestion/materialize_incident_geocodes.py --all-loaded --json
```

El materializador conserva coordenadas reales, usa centroides sectoriales cuando hay senal territorial y marca centroides comunales como `comuna`. La precision `comuna` no habilita predicciones.

5. Cargar desercion escolar oficial CEM/Mineduc.

```bash
cd backend
python data_ingestion/education_parser.py data/fuentes/mineduc/desvinculacion_2010_2024.xlsx
```

6. Auditar readiness comercial.

```bash
cd backend
python data_ingestion/comuna_readiness.py --codigo-ine 13122 --json
```

7. Generar predicciones solo si la auditoria muestra incidentes suficientes y geocodificacion exacta/sectorial adecuada.

```bash
curl -X POST "$API_URL/predicciones/generar" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comuna_id":4,"modelo":"SEPP","horizonte_horas":72}'
```

## Criterios De Salida

- Incidentes historicos: minimo 500 registros para uso operacional.
- Geocodificacion util: 80% o superior en `exacta + sector`.
- Educacion: al menos 5 anos cargados para lectura territorial.
- Predicciones: activas y generadas desde incidentes reales.
- Reportes IA: solo habilitados con `GEMINI_API_KEY` configurada.

## Entregable Cliente

El comando `comuna_readiness.py --json` debe guardarse como evidencia de carga y adjuntarse al onboarding comercial de cada municipio.
