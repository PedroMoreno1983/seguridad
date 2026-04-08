-- ==========================================
-- SEED: DELITOS DEMO PARA PEÑALOLÉN
-- Datos simulados para desarrollo
-- ==========================================

-- Obtener ID de Peñalolén
DO $$
DECLARE
    v_comuna_id INTEGER;
    v_fecha_base DATE := '2024-01-01';
    i INTEGER;
    v_lat NUMERIC;
    v_lon NUMERIC;
    v_tipo VARCHAR(100);
    v_fecha TIMESTAMP;
BEGIN
    SELECT id INTO v_comuna_id FROM comunas WHERE codigo_ine = '13122';
    
    IF v_comuna_id IS NULL THEN
        RAISE NOTICE 'Comuna Peñalolén no encontrada';
        RETURN;
    END IF;
    
    -- Coordenadas aproximadas de Peñalolén (bbox aproximado)
    -- Lat: -33.45 a -33.52, Lon: -70.52 a -70.47
    
    -- Generar 500 delitos distribuidos en el tiempo
    FOR i IN 1..500 LOOP
        -- Fecha aleatoria entre enero 2024 y marzo 2026
        v_fecha := v_fecha_base + (random() * 800)::int;
        
        -- Coordenadas aleatorias dentro del bbox de Peñalolén
        v_lat := -33.52 + (random() * 0.07);
        v_lon := -70.52 + (random() * 0.05);
        
        -- Tipo de delito ponderado
        v_tipo := CASE 
            WHEN random() < 0.30 THEN 'Robo violento'
            WHEN random() < 0.55 THEN 'Hurto'
            WHEN random() < 0.70 THEN 'Robo con intimidación'
            WHEN random() < 0.80 THEN 'Lesiones'
            WHEN random() < 0.90 THEN 'Amenazas'
            ELSE 'Otros'
        END;
        
        INSERT INTO delitos (
            comuna_id, 
            tipo_delito, 
            ubicacion, 
            barrio,
            fecha_hora,
            dia_semana,
            hora_del_dia,
            es_fin_semana,
            fuente,
            confianza
        ) VALUES (
            v_comuna_id,
            v_tipo,
            ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326),
            'Barrio ' || (random() * 20)::int,
            v_fecha + (random() * 24 || ' hours')::interval,
            EXTRACT(DOW FROM v_fecha),
            (random() * 24)::int,
            EXTRACT(DOW FROM v_fecha) IN (5, 6),
            'demo',
            0.95
        );
    END LOOP;
    
    RAISE NOTICE 'Insertados 500 delitos demo para Peñalolén';
END $$;

-- Insertar índice de seguridad inicial para Peñalolén
INSERT INTO indices_seguridad (
    comuna_id, fecha, indice_seguridad_global, indice_percepcion,
    indice_victimizacion, indice_temor,
    tasa_delictual, tasa_robos, tasa_hurtos, tasa_resolucion,
    ranking_nacional, ranking_regional, tendencia, cambio_porcentual
)
SELECT 
    id as comuna_id,
    '2025-03-01'::date,
    67.5,  -- Índice global (0-100, más alto = más seguro)
    62.0,  -- Percepción ciudadana
    58.0,  -- Victimización
    55.0,  -- Temor
    207.5,  -- Tasa por 100mil habitantes (aprox)
    85.2,
    122.3,
    25.0,
    85,    -- Ranking nacional
    25,    -- Ranking regional
    'bajando',  -- Tendencia
    -12.5
FROM comunas WHERE codigo_ine = '13122'
ON CONFLICT (comuna_id, fecha) DO NOTHING;
