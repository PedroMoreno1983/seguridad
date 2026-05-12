# Readiness Comercial Por Comuna - 2026-05-12

## Resumen Ejecutivo

La reparacion geoespacial oficial quedo aplicada para las 7 comunas cargadas. Todas tienen centroide y bbox desde la capa DPA MOP/SUBDERE por `CUT_COM`, y los incidentes quedaron clasificados por precision geoespacial: `exacta`, `sector`, `comuna` o `sin_senal`.

Estado comercial actual:

| Comuna | CUT_COM | Estado | Incidentes | Exactos | Sectorizados | Comunales | Util prediccion | Predicciones |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Peñalolen | 13122 | Listo comercial | 122.257 | 0 | 98.061 | 24.196 | 80,2% | 5 |
| Pudahuel | 13124 | Listo comercial | 18.734 | 0 | 15.220 | 3.514 | 81,2% | 5 |
| Valparaiso | 05101 | Requiere datos | 37.448 | 2.529 | 0 | 34.919 | 6,8% | 0 |
| La Cisterna | 13109 | Requiere datos | 0 | 0 | 0 | 0 | 0,0% | 0 |
| La Granja | 13111 | Requiere datos | 9.791 | 0 | 2 | 9.789 | 0,0% | 0 |
| Maipu | 13119 | Requiere datos | 35.339 | 0 | 0 | 35.339 | 0,0% | 0 |
| San Bernardo | 13401 | Requiere datos | 7 | 0 | 1 | 6 | 14,3% | 0 |

## Criterio Comercial

- `Listo comercial`: minimo 500 incidentes, al menos 80% exacto/sectorial, serie educativa cargada y predicciones activas.
- `Requiere datos`: falta volumen, direccion/sector usable o predicciones activas.
- Los centroides comunales sirven para visualizacion contextual, pero no cuentan como base predictiva.

## Brechas Por Comuna

- **Peñalolen**: lista para demo comercial y venta. La cobertura es sectorial, no exacta; debe comunicarse como analisis por macrosector.
- **Pudahuel**: lista para demo comercial y venta. Quedo con predicciones activas generadas desde incidentes sectoriales.
- **Valparaiso**: requiere geocodificacion por direccion/interseccion para transformar direcciones frecuentes en puntos validados. No debe venderse como prediccion territorial fina todavia.
- **La Cisterna**: requiere carga de incidentes historicos.
- **La Granja**: la fuente cargada trae casi todos los registros sin direccion ni sector; requiere archivo enriquecido o diccionario oficial de sectores.
- **Maipu**: la fuente cargada no trae direccion/sector usable; requiere carga enriquecida antes de prediccion.
- **San Bernardo**: requiere incidentes historicos reales; lo cargado actualmente parece material programatico/preventivo, no serie operacional de incidentes.

## Evidencia Tecnica

Comandos ejecutados:

```bash
cd backend
alembic upgrade head
python data_ingestion/import_comuna_geometry.py --all-loaded --json
python data_ingestion/materialize_incident_geocodes.py --all-loaded --json
python data_ingestion/comuna_readiness.py --codigo-ine 13122 --json
python data_ingestion/comuna_readiness.py --codigo-ine 13124 --json
```

Validaciones:

- `import_comuna_geometry.py --all-loaded --dry-run --json`: 0 cambios pendientes.
- `materialize_incident_geocodes.py --all-loaded --dry-run --json`: 0 cambios pendientes.
- `POST /api/v1/predicciones/generar` en Pudahuel: 5 predicciones SEPP generadas.
- `POST /api/v1/predicciones/generar` en Maipu: 422 esperado por falta de incidentes exactos/sectoriales suficientes.
