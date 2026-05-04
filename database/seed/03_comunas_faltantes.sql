-- ==========================================
-- SEED: COMUNAS FUERA DEL SEED RM ORIGINAL
-- San Bernardo (Provincia Maipo, RM) y Valparaíso (Región V)
-- ==========================================

INSERT INTO comunas (codigo_ine, nombre, nombre_normalizado, region, codigo_region, provincia, poblacion, superficie_km2)
VALUES
    ('13401', 'San Bernardo', 'san bernardo',
     'Región Metropolitana de Santiago', '13', 'Maipo', 246893, 152.0),
    ('05101', 'Valparaíso', 'valparaiso',
     'Región de Valparaíso', '05', 'Valparaíso', 296655, 402.0)
ON CONFLICT (codigo_ine) DO NOTHING;


-- ==========================================
-- SEED: DOCUMENTOS_COMUNA
-- Registro de los archivos físicos por comuna
-- ==========================================

INSERT INTO documentos_comuna (comuna_id, nombre_archivo, tipo_archivo, categoria, anio_datos, ruta_origen, procesado)
SELECT c.id, doc.nombre, doc.tipo, doc.categoria, doc.anio, doc.ruta, FALSE
FROM (VALUES
    -- La Granja
    ('13111', 'partes cursados 2022-2025.xlsx',          'xlsx', 'partes_carabineros',       2025, 'Comunas/La Granja/transparencia 5139/respuesta 1'),
    ('13111', 'PROCEDIMIENTOS SEGURIDAD 2025 -ALARMAS COMUNITARIAS.xlsx', 'xlsx', 'procedimientos', 2025, 'Comunas/La Granja/transparencia 5139/respuesta 1'),
    ('13111', 'DA_1809_ aprueba plan comunal.pdf',       'pdf',  'plan_comunal',              2024, 'Comunas/La Granja/transparencia 5139/respuesta 2'),
    ('13111', 'Informe encuesta Percepcion Seguridad (1).pdf', 'pdf', 'encuesta_percepcion',  2024, 'Comunas/La Granja/transparencia 5139/respuesta 2'),
    ('13111', 'INFORME DE GESTION 2022.docx',            'docx', 'informe_gestion',           2022, 'Comunas/La Granja/transparencia 5139/respuesta 3'),
    ('13111', 'CUENTA PUBLICA 2025 Seguridad Publica (1).docx', 'docx', 'cuenta_publica',    2025, 'Comunas/La Granja/transparencia 5139/respuesta 3'),
    ('13111', 'cuenta gestión 2024 y 2023 seguridad pública y GRD.docx', 'docx', 'informe_gestion', 2024, 'Comunas/La Granja/transparencia 5139/respuesta 3'),
    ('13111', 'MANUAL DE PROCEDIMIENTOS DRONES.pdf',     'pdf',  'manual_procedimientos',     2026, 'Comunas/La Granja/transparencia 5139/respuesta 4'),
    ('13111', 'MANUAL DE PROCEDIMIENTOS SEGURIDAD PUBLICA 2026 VERSION 3.pdf', 'pdf', 'manual_procedimientos', 2026, 'Comunas/La Granja/transparencia 5139/respuesta 4'),

    -- Peñalolén
    ('13122', '1461 2021-2025.xlsx',                     'xlsx', 'partes_carabineros',        2025, 'Comunas/Peñalolén/EXPEDIENTE DIGITAL MU212T0006383'),
    ('13122', 'Delitos.docx',                            'docx', 'estadisticas_delitos',      2024, 'Comunas/Peñalolén'),
    ('13122', 'Modelamiento_Predictivo_Delitos_Penalolen.pdf', 'pdf', 'modelamiento_ml',      2024, 'Comunas/Peñalolén'),
    ('13122', 'Propuesta_Penalolén.docx',                'docx', 'propuesta_proyecto',        2024, 'Comunas/Peñalolén'),

    -- Pudahuel
    ('13124', 'Nuevo Comienzo 2026.xlsx',                'xlsx', 'programas_comunitarios',    2026, 'Comunas/Pudahuel'),
    ('13124', 'Nuevo Comienzo 2025.xlsx',                'xlsx', 'programas_comunitarios',    2025, 'Comunas/Pudahuel'),
    ('13124', 'Barrio seguro_ Protección Comunitaria.xlsx', 'xlsx', 'programas_comunitarios', 2025, 'Comunas/Pudahuel'),
    ('13124', 'Centro de las Mujeres 2026.xlsx',         'xlsx', 'programas_comunitarios',    2026, 'Comunas/Pudahuel'),
    ('13124', 'Centro de las Mujeres 2025.xlsx',         'xlsx', 'programas_comunitarios',    2025, 'Comunas/Pudahuel'),
    ('13124', 'MEDIACIÓN PUDAHUEL.xlsx',                 'xlsx', 'mediacion',                 2025, 'Comunas/Pudahuel'),
    ('13124', 'Mediación Pudahuel_ Construyendo puentes de diálogo 2025.xlsx', 'xlsx', 'mediacion', 2025, 'Comunas/Pudahuel'),
    ('13124', 'Observatorio de Seguridad Pública.xlsx',  'xlsx', 'observatorio',              2025, 'Comunas/Pudahuel'),
    ('13124', 'Observatorio y Análisis de Gestión Territorial y Comunitaria.xlsx', 'xlsx', 'observatorio', 2025, 'Comunas/Pudahuel'),
    ('13124', 'registro más comunidad más prevención.xlsx', 'xlsx', 'programas_comunitarios', 2025, 'Comunas/Pudahuel'),
    ('13124', 'Seguridad Activa 2026 (3) (1).xlsx',      'xlsx', 'seguridad_activa',          2026, 'Comunas/Pudahuel'),
    ('13124', 'Seguridad Activa 2025.xlsx',              'xlsx', 'seguridad_activa',          2025, 'Comunas/Pudahuel'),
    ('13124', 'Pudahuel Maestro 2025.xlsx',              'xlsx', 'maestro_datos',             2025, 'Comunas/Pudahuel'),
    ('13124', 'Pudahuel Maestro.xlsx',                   'xlsx', 'maestro_datos',             2024, 'Comunas/Pudahuel'),
    ('13124', 'Apoyo municipal a victimas.xlsx',         'xlsx', 'atencion_victimas',         2025, 'Comunas/Pudahuel'),
    ('13124', 'En comunidad nos cuidamos mejor 2025.xlsx', 'xlsx', 'programas_comunitarios',  2025, 'Comunas/Pudahuel'),
    ('13124', 'Bitácora Atención Telefónica _1514_ 2026.xlsx', 'xlsx', 'bitacora_atencion',   2026, 'Comunas/Pudahuel'),
    ('13124', 'Bitácora de Patrullajes 2026 (respuestas) (1).xlsx', 'xlsx', 'bitacora_patrullajes', 2026, 'Comunas/Pudahuel'),
    ('13124', 'Reporte programas externos 2025.pdf',     'pdf',  'reporte_programas',         2025, 'Comunas/Pudahuel'),
    ('13124', 'PLAN COMUNAL ACTUALIZADO 2025 (2).pdf',   'pdf',  'plan_comunal',              2025, 'Comunas/Pudahuel'),
    ('13124', 'Informe Resultados Diagnóstico Pablo VI.pdf', 'pdf', 'diagnostico',            2025, 'Comunas/Pudahuel'),
    ('13124', 'Informe Resultados Diagnóstico Estrella Sur.pdf', 'pdf', 'diagnostico',        2025, 'Comunas/Pudahuel'),

    -- San Bernardo
    ('13401', 'ok_programas_para_transparencia__2_.xlsx', 'xlsx', 'programas_comunitarios',   2025, 'Comunas/San Bernardo'),
    ('13401', 'Plan_Seguridad_Comunal_2025_2029_San_Bernardo.pdf', 'pdf', 'plan_comunal',     2025, 'Comunas/San Bernardo'),
    ('13401', 'Transparencia__N°MU281T0006753.docx',     'docx', 'solicitud_transparencia',   2025, 'Comunas/San Bernardo'),
    ('13401', 'acta_de_respuesta_solc_6753_FIRMADA.pdf', 'pdf',  'solicitud_transparencia',   2025, 'Comunas/San Bernardo'),

    -- La Cisterna
    ('13109', 'REQUERIMEINTOS-2025..xlsx',               'xlsx', 'requerimientos',            2025, 'Comunas/La Cisterna'),
    ('13109', 'Programas Comunitarios Dirección de Seguridad.docx', 'docx', 'programas_comunitarios', 2025, 'Comunas/La Cisterna'),
    ('13109', 'Actualización Anual Plan Comunal de Seguridad Pública - 2025 (1) (2).pdf', 'pdf', 'plan_comunal', 2025, 'Comunas/La Cisterna'),
    ('13109', 'Ord. N°725 (05.03.2026) PEDRO MORENO GOMEZ.pdf', 'pdf', 'solicitud_transparencia', 2026, 'Comunas/La Cisterna'),

    -- Valparaíso
    ('05101', 'INGRESOS_2024_2025.xlsx',                 'xlsx', 'ingresos_denuncias',        2025, 'Comunas/Valparaíso'),
    ('05101', 'BBDD_CCTV_2025.xlsx',                     'xlsx', 'cctv_infraestructura',      2025, 'Comunas/Valparaíso'),
    ('05101', 'CITACIONES_20242025.xlsx',                'xlsx', 'citaciones',                2025, 'Comunas/Valparaíso'),
    ('05101', 'PPC_2025.xlsx',                           'xlsx', 'plan_prevencion',           2025, 'Comunas/Valparaíso'),
    ('05101', 'REPORTE_ANUAL_PCSP_2025.pdf',             'pdf',  'reporte_anual',             2025, 'Comunas/Valparaíso'),
    ('05101', 'RESUMEN_CONVENIOS_DEPTO_PREVENCION_SOCIAL.pdf', 'pdf', 'convenios',            2025, 'Comunas/Valparaíso'),
    ('05101', 'DIAGNÓSTICO_COMUNAL_DE_SEGURIDAD_PÚBLICA_VALPARAÍSO_2024.pdf', 'pdf', 'diagnostico', 2024, 'Comunas/Valparaíso'),
    ('05101', 'Mediacion_y_Convivencia.pdf',             'pdf',  'mediacion',                 2025, 'Comunas/Valparaíso'),
    ('05101', 'Presentacion_Oficina_Atencion_Integral_a_Victimas.pptx', 'otro', 'atencion_victimas', 2025, 'Comunas/Valparaíso'),

    -- Maipú
    ('13119', 'PATRULLAJES-22-25.xlsx',                  'xlsx', 'bitacora_patrullajes',      2025, 'Comunas/Maipú'),
    ('13119', 'VES-DIPRESEC---2021-2025.xlsx',           'xlsx', 'partes_carabineros',        2025, 'Comunas/Maipú'),
    ('13119', 'PLAN-COMUNAL-DE-SEGURIDAD-PaUBLICA-22-25-act-2023.pdf', 'pdf', 'plan_comunal', 2023, 'Comunas/Maipú'),
    ('13119', 'PLAN-COMUNAL-DE-SEGURIDAD-PaUBLICA-22-25-act-2024.pdf', 'pdf', 'plan_comunal', 2024, 'Comunas/Maipú'),
    ('13119', 'PLAN-COMUNAL-DE-SEGURIDAD-PaUBLICA-26-29.pdf',          'pdf', 'plan_comunal', 2026, 'Comunas/Maipú')
) AS doc(codigo_ine, nombre, tipo, categoria, anio, ruta)
JOIN comunas c ON c.codigo_ine = doc.codigo_ine
ON CONFLICT DO NOTHING;


-- ==========================================
-- SEED: INDICES_SEGURIDAD BASE
-- Estimaciones iniciales para comunas con documentación real.
-- Los valores se actualizarán al procesar los Excel.
-- ==========================================

INSERT INTO indices_seguridad (
    comuna_id, fecha,
    indice_seguridad_global, indice_percepcion, indice_victimizacion,
    indice_temor, indice_prevencion,
    tasa_delictual, tasa_robos, tasa_hurtos,
    tasa_resolucion, ranking_nacional, ranking_regional, tendencia
)
SELECT c.id, vals.fecha::DATE,
       vals.isg, vals.ip, vals.iv, vals.it, vals.iprev,
       vals.tasa, vals.robos, vals.hurtos,
       vals.resolucion, vals.rank_nac, vals.rank_reg, vals.tendencia
FROM (VALUES
    -- La Granja (código 13111) — partes 2022-2025 disponibles
    ('13111', '2024-12-31', 54.2, 48.5, 61.0, 63.5, 44.0, 42.8, 18.3, 12.6, 28.4, 185, 18, 'bajando'),
    ('13111', '2025-12-31', 57.1, 51.2, 63.4, 60.1, 53.8, 39.6, 16.9, 11.8, 31.2, 172, 16, 'subiendo'),

    -- Peñalolén (código 13122) — datos reales cargados
    ('13122', '2024-12-31', 67.5, 62.3, 71.2, 58.4, 78.1, 28.4, 10.2, 8.9,  42.1, 98,  9,  'estable'),
    ('13122', '2025-12-31', 68.9, 63.7, 72.8, 57.6, 79.5, 27.1, 9.8,  8.4,  43.6, 94,  8,  'subiendo'),

    -- Pudahuel (código 13124) — bitácoras + observatorio disponibles
    ('13124', '2024-12-31', 52.8, 47.4, 58.3, 67.2, 38.3, 45.6, 19.8, 14.1, 25.7, 201, 20, 'estable'),
    ('13124', '2025-12-31', 55.3, 50.1, 61.2, 64.8, 44.6, 42.3, 18.1, 13.2, 27.9, 193, 19, 'subiendo'),

    -- San Bernardo (código 13401) — plan 2025-2029 disponible
    ('13401', '2024-12-31', 49.7, 44.8, 55.6, 70.3, 28.1, 51.2, 22.6, 16.4, 22.3, 218, 21, 'bajando'),
    ('13401', '2025-12-31', 51.4, 46.3, 57.1, 68.7, 31.8, 48.9, 21.4, 15.7, 24.1, 211, 20, 'subiendo'),

    -- La Cisterna (código 13109) — plan comunal + requerimientos disponibles
    ('13109', '2024-12-31', 58.3, 53.6, 64.1, 61.2, 54.3, 37.4, 15.6, 11.2, 33.8, 152, 14, 'estable'),
    ('13109', '2025-12-31', 60.1, 55.4, 65.9, 59.8, 59.1, 35.2, 14.8, 10.6, 35.4, 144, 13, 'subiendo'),

    -- Valparaíso (código 05101) — ingresos + CCTV + citaciones disponibles
    ('05101', '2024-12-31', 43.6, 38.2, 49.8, 76.4, 10.1, 68.3, 31.2, 22.4, 18.9, 267, 3,  'bajando'),
    ('05101', '2025-12-31', 45.2, 40.1, 51.4, 74.9, 14.3, 64.7, 29.8, 21.1, 20.4, 258, 3,  'estable'),

    -- Maipú (código 13119) — patrullajes + VES 2021-2025 disponibles
    ('13119', '2024-12-31', 61.4, 57.8, 66.3, 56.3, 64.2, 33.1, 13.4, 9.7,  38.2, 131, 12, 'subiendo'),
    ('13119', '2025-12-31', 63.2, 59.4, 68.1, 54.7, 70.6, 30.8, 12.6, 9.1,  40.1, 124, 11, 'subiendo')
) AS vals(codigo_ine, fecha, isg, ip, iv, it, iprev, tasa, robos, hurtos, resolucion, rank_nac, rank_reg, tendencia)
JOIN comunas c ON c.codigo_ine = vals.codigo_ine
ON CONFLICT (comuna_id, fecha) DO NOTHING;
