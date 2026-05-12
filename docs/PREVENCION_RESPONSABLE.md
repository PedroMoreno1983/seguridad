# Prevencion Responsable

Este modulo convierte la discusion de IA predictiva en un flujo gobernable: SafeCity detecta senales territoriales, no culpables individuales. Cada alerta relevante debe quedar asociada a una revision humana, una decision y una accion proporcional.

## Datos educativos comunales

La tabla `educacion_comunal` recibe indicadores agregados por comuna y anio. No debe recibir datos personales de estudiantes.

Columnas recomendadas para CSV/XLSX:

```csv
codigo_ine,comuna,anio,matricula_total,estudiantes_desvinculados,tasa_desvinculacion,estudiantes_revinculados,tasa_revinculacion,inasistencia_grave_pct,retiro_basica_pct,retiro_media_pct,fuente,metodologia,fecha_actualizacion
13122,Penalolen,2024,42000,546,1.3,180,33.0,24.5,0.7,1.4,Mineduc/CEM,Datos agregados por comuna,2026-05-12
```

`codigo_ine` o `comuna` son suficientes para resolver el territorio, aunque usar ambos reduce errores. Las tasas deben ir en porcentaje, por ejemplo `1.3` para 1,3%.

## Carga por script

Desde `backend`:

```powershell
python data_ingestion/education_parser.py C:\ruta\educacion_comunal.csv --dry-run
python data_ingestion/education_parser.py C:\ruta\educacion_comunal.csv
```

El importador hace upsert por `(comuna_id, anio)`. Si el archivo trae nombres de columnas similares, intenta reconocerlos, por ejemplo `tasa desvinculacion`, `% desvinculacion`, `inasistencia grave` o `cod_comuna`.

Tambien entiende directamente el Excel oficial de CEM:

```powershell
python data_ingestion/education_parser.py C:\ruta\OFICIAL-Tasa-Incidencia-Desvinculacion-2010-2024.xlsx --dry-run
python data_ingestion/education_parser.py C:\ruta\OFICIAL-Tasa-Incidencia-Desvinculacion-2010-2024.xlsx
```

Para ese archivo se usa la hoja `Tasas a nivel de Comuna`, bloque `Global`. La tasa oficial viene como proporcion y se guarda como porcentaje.

Fuentes revisadas:

- Portal Datos Abiertos CEM: https://datosabiertos.mineduc.cl/
- Desvinculacion: https://datosabiertos.mineduc.cl/desvinculacion/
- Matricula longitudinal: https://datosabiertos.mineduc.cl/matricula-longitudinal/
- Asistencia anual por estudiante: https://datosabiertos.mineduc.cl/asistencia-anual-por-estudiante/
- Directorio de establecimientos: https://datosabiertos.mineduc.cl/directorio-de-establecimientos-educacionales/

## Carga por API

```http
POST /api/v1/prevencion/educacion
```

Payload minimo:

```json
{
  "comuna_id": 22,
  "anio": 2024,
  "matricula_total": 42000,
  "estudiantes_desvinculados": 546,
  "tasa_desvinculacion": 1.3,
  "inasistencia_grave_pct": 24.5,
  "fuente": "Mineduc / Centro de Estudios"
}
```

## Alertas responsables

Las alertas se guardan en `alertas_responsables`. Campos clave:

- `categoria`: tipo de senal, por ejemplo `riesgo_social_preventivo`.
- `nivel_riesgo`: `bajo`, `medio`, `alto` o `critico`.
- `confianza`: entre 0 y 1.
- `accion_sugerida`: recomendacion proporcional.
- `estado`: `pendiente`, `en_revision`, `derivada`, `descartada` o `cerrada`.
- `decision`: fundamento humano de la accion tomada.

La pantalla `/territorio/prevencion` permite registrar alertas y derivar o descartar alertas reales guardadas.

## Criterio juridico-operativo

- Una alerta no equivale a culpabilidad.
- La plataforma trabaja con datos agregados por comuna o zona.
- Las acciones sensibles requieren revision humana.
- La decision debe quedar trazable para evitar omisiones opacas.
- El objetivo es prevencion social y territorial, no vigilancia individual.
