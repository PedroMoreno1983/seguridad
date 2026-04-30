# Fuentes de datos para mundo privado

Este documento convierte la linea privada de Atalaya en una matriz accionable. La premisa es simple: el valor no esta solo en delitos publicos, sino en cruzar perdidas internas, operacion de seguridad y contexto territorial.

## Principio de integracion

- Solo usar datos autorizados por el cliente o fuentes externas con licencia compatible.
- Separar precision: exacta, zona interna, sede, comuna.
- Anonimizar personas cuando no sean necesarias para el objetivo de seguridad.
- Cachear fuentes externas para no depender de portales en tiempo real.
- Validar coordenadas contra sedes, zonas o limites urbanos antes de pintar mapas.

## Priorizacion

| Prioridad | Fuente | Cliente ideal | Valor | Dificultad | Primer uso |
|---|---|---|---:|---|---|
| 1 | Bitacora de incidentes internos | retail, mall, logistica, colegios, condominios | 100 | baja | mapa de calor privado, ranking de zonas, reportes |
| 1 | POS, ventas y mermas | retail, supermercados, farmacias | 95 | media | perdidas, horarios criticos, sucursales vulnerables |
| 1 | Rondas y check-ins de guardias | retail, mall, logistica, condominios | 90 | media | cumplimiento, brechas de cobertura, respuesta |
| 2 | Control de acceso | oficinas, colegios, industrias, clinicas | 85 | media | accesos fuera de horario, puertas criticas |
| 2 | Alarmas y sensores | bodegas, tiendas, condominios | 75 | media | falsas alarmas, intrusion, tiempos de respuesta |
| 2 | Mantencion de activos criticos | malls, industrias, campus | 70 | baja | camaras caidas, luminarias, cercos, puntos ciegos |
| 2 | Entorno publico | cualquier sede fisica | 78 | media | risk terrain, contexto comunal, prediccion |
| 3 | CCTV / VMS | malls, retail, industria | 80 | alta | eventos, estado de camaras, evidencia |
| 3 | Logistica y rutas | transporte, ecommerce, retail | 85 | alta | riesgo por parada, ruta o franja |
| 3 | RRHH, turnos y ausentismo | operaciones con guardias o personal masivo | 65 | media | dotacion vs incidentes |
| 3 | Seguros y siniestros | retail, inmobiliaria, industria | 70 | media | costo de perdida, ROI de mitigacion |

## Fuentes externas iniciales

- CEAD / Ministerio de Seguridad Publica: estadisticas delictuales comunales y reportes de casos policiales.
- Datos Comunales Paz Ciudadana: series comunales historicas de DMCS y otros indicadores.
- datos.gob.cl: datasets publicos de seguridad, transporte, infraestructura, clima y geografia.
- ChileAtiende / Carabineros: acceso a reportes estadisticos institucionales.
- RedMeteo y otras APIs meteorologicas: clima, lluvia, temperatura y eventos ambientales.
- OpenStreetMap / Mapbox: puntos de interes, calles, paraderos y geocodificacion validada.

## Paquete comercial por vertical

### Retail

Fuentes prioritarias:

- POS, ventas, mermas, anulaciones.
- Bitacora de incidentes.
- Guardias y rondas.
- CCTV metadata.
- Entorno publico.

Resultados esperados:

- ranking de sucursales por riesgo;
- horarios criticos por tipo de perdida;
- accesos y zonas vulnerables;
- recomendacion de dotacion y patrullaje.

### Logistica

Fuentes prioritarias:

- rutas planificadas y GPS ejecutado;
- incidentes en ruta;
- valor de carga;
- horarios de detencion;
- entorno comunal.

Resultados esperados:

- riesgo por parada;
- zonas de detencion vulnerables;
- alertas por desvio o detencion prolongada;
- ranking de rutas criticas.

### Mall / centro comercial

Fuentes prioritarias:

- incidentes por zona;
- rondas de guardias;
- CCTV metadata;
- control de acceso;
- eventos y flujo.

Resultados esperados:

- mapa de zonas calientes;
- puntos ciegos;
- refuerzo por horario;
- reporte ejecutivo para administracion.

### Colegios, universidades y campus

Fuentes prioritarias:

- control de acceso;
- incidentes de convivencia y seguridad;
- rondas;
- mantencion;
- entorno y rutas de acceso.

Resultados esperados:

- accesos criticos;
- horarios de salida/entrada;
- zonas sin visibilidad;
- trazabilidad de respuesta.

### Condominios

Fuentes prioritarias:

- visitas y accesos;
- encomiendas;
- rondas;
- reclamos;
- alarmas y mantencion.

Resultados esperados:

- cumplimiento de guardias;
- horarios vulnerables;
- torres o zonas con reincidencia;
- evidencia operacional para administracion.

## Endpoints implementados

- `GET /api/v1/fuentes-privadas/catalogo`
- `GET /api/v1/fuentes-privadas/catalogo?vertical=retail&prioridad_max=2`
- `GET /api/v1/fuentes-privadas/resumen`
- `GET /api/v1/fuentes-privadas/playbook/retail`

## Siguiente paso recomendado

Para vender esto, pedir a un cliente piloto tres archivos:

1. 12 meses de incidentes internos.
2. 12 meses de mermas/perdidas o siniestros.
3. listado de sedes con zonas internas, accesos y puntos criticos.

Con eso se genera una demo privada real en menos tiempo que una integracion completa.
