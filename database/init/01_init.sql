-- ==========================================
-- SAFE CITY PLATFORM - MIGRACIONES INICIALES
-- ==========================================

-- Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ==========================================
-- TABLA: COMUNAS
-- ==========================================
CREATE TABLE IF NOT EXISTS comunas (
    id SERIAL PRIMARY KEY,
    codigo_ine VARCHAR(5) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    nombre_normalizado VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    codigo_region VARCHAR(2) NOT NULL,
    provincia VARCHAR(100) NOT NULL,
    geom GEOMETRY(MULTIPOLYGON, 4326),
    poblacion INTEGER,
    superficie_km2 NUMERIC(10,2),
    densidad_poblacional NUMERIC(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices comunas
CREATE INDEX IF NOT EXISTS idx_comunas_geom ON comunas USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_comunas_nombre ON comunas(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_comunas_region ON comunas(region);

-- ==========================================
-- TABLA: DELITOS
-- ==========================================
CREATE TABLE IF NOT EXISTS delitos (
    id BIGSERIAL PRIMARY KEY,
    comuna_id INTEGER REFERENCES comunas(id) ON DELETE CASCADE,
    tipo_delito VARCHAR(100) NOT NULL,
    subtipo VARCHAR(100),
    descripcion VARCHAR(500),
    ubicacion GEOMETRY(POINT, 4326) NOT NULL,
    cuadrante VARCHAR(50),
    barrio VARCHAR(100),
    direccion VARCHAR(200),
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_denuncia TIMESTAMP WITH TIME ZONE,
    dia_semana SMALLINT,
    hora_del_dia SMALLINT,
    es_fin_semana BOOLEAN,
    contexto JSONB DEFAULT '{}',
    fuente VARCHAR(50) DEFAULT 'desconocida',
    confianza NUMERIC(3,2) DEFAULT 1.0,
    validado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices delitos
CREATE INDEX IF NOT EXISTS idx_delitos_comuna ON delitos(comuna_id);
CREATE INDEX IF NOT EXISTS idx_delitos_ubicacion ON delitos USING GIST(ubicacion);
CREATE INDEX IF NOT EXISTS idx_delitos_tipo ON delitos(tipo_delito);
CREATE INDEX IF NOT EXISTS idx_delitos_fecha ON delitos(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_delitos_cuadrante ON delitos(cuadrante);

-- ==========================================
-- TABLA: PREDICCIONES
-- ==========================================
CREATE TABLE IF NOT EXISTS predicciones (
    id BIGSERIAL PRIMARY KEY,
    comuna_id INTEGER REFERENCES comunas(id) ON DELETE CASCADE,
    modelo VARCHAR(50) NOT NULL,
    version_modelo VARCHAR(20),
    zona_geom GEOMETRY(POLYGON, 4326),
    punto_centro GEOMETRY(POINT, 4326),
    nivel_riesgo VARCHAR(20),
    probabilidad NUMERIC(5,4),
    fecha_prediccion TIMESTAMP DEFAULT NOW(),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    horizonte_horas INTEGER,
    precision_historica NUMERIC(5,4),
    intervalo_confianza JSONB,
    mae NUMERIC(8,4),
    features_utilizados JSONB DEFAULT '{}',
    params_sepp JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices predicciones
CREATE INDEX IF NOT EXISTS idx_predicciones_comuna ON predicciones(comuna_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_zona ON predicciones USING GIST(zona_geom);
CREATE INDEX IF NOT EXISTS idx_predicciones_modelo ON predicciones(modelo);
CREATE INDEX IF NOT EXISTS idx_predicciones_riesgo ON predicciones(nivel_riesgo);

-- ==========================================
-- TABLA: INDICES_SEGURIDAD
-- ==========================================
CREATE TABLE IF NOT EXISTS indices_seguridad (
    id SERIAL PRIMARY KEY,
    comuna_id INTEGER REFERENCES comunas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    indice_seguridad_global NUMERIC(5,2),
    indice_percepcion NUMERIC(5,2),
    indice_victimizacion NUMERIC(5,2),
    indice_temor NUMERIC(5,2),
    indice_prevencion NUMERIC(5,2),
    tasa_delictual NUMERIC(8,2),
    tasa_homicidios NUMERIC(8,2),
    tasa_robos NUMERIC(8,2),
    tasa_hurtos NUMERIC(8,2),
    tasa_resolucion NUMERIC(5,2),
    ranking_nacional INTEGER,
    ranking_regional INTEGER,
    tendencia VARCHAR(20),
    cambio_porcentual NUMERIC(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(comuna_id, fecha)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_indices_comuna ON indices_seguridad(comuna_id);
CREATE INDEX IF NOT EXISTS idx_indices_fecha ON indices_seguridad(fecha);
CREATE INDEX IF NOT EXISTS idx_indices_ranking ON indices_seguridad(ranking_nacional);

-- ==========================================
-- TABLA: FEATURES_ESPACIALES (RTM)
-- ==========================================
CREATE TABLE IF NOT EXISTS features_espaciales (
    id SERIAL PRIMARY KEY,
    comuna_id INTEGER REFERENCES comunas(id) ON DELETE CASCADE,
    tipo_feature VARCHAR(50) NOT NULL,
    subtipo VARCHAR(100),
    nombre VARCHAR(200),
    ubicacion GEOMETRY(POINT, 4326) NOT NULL,
    direccion VARCHAR(200),
    peso_rtm NUMERIC(5,2) DEFAULT 1.0,
    radio_influencia_mts INTEGER DEFAULT 500,
    importancia_shap NUMERIC(5,4),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_features_comuna ON features_espaciales(comuna_id);
CREATE INDEX IF NOT EXISTS idx_features_tipo ON features_espaciales(tipo_feature);
CREATE INDEX IF NOT EXISTS idx_features_ubicacion ON features_espaciales USING GIST(ubicacion);

-- ==========================================
-- TABLA: AUDITORIA (Ley 21.719)
-- ==========================================
CREATE TABLE IF NOT EXISTS auditoria_consultas (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER,
    rol VARCHAR(20),
    accion VARCHAR(50) NOT NULL,
    comuna_id INTEGER,
    datos_accedidos JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_consultas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp ON auditoria_consultas(timestamp);

-- ==========================================
-- VISTAS ÚTILES
-- ==========================================

-- Vista de comunas con conteos
CREATE OR REPLACE VIEW vista_comunas_resumen AS
SELECT 
    c.id,
    c.codigo_ine,
    c.nombre,
    c.region,
    c.poblacion,
    COUNT(DISTINCT d.id) as total_delitos,
    COUNT(DISTINCT p.id) as total_predicciones_activas,
    MAX(i.indice_seguridad_global) as ultimo_indice
FROM comunas c
LEFT JOIN delitos d ON c.id = d.comuna_id
LEFT JOIN predicciones p ON c.id = p.comuna_id AND p.fecha_fin >= NOW()
LEFT JOIN indices_seguridad i ON c.id = i.comuna_id
GROUP BY c.id, c.codigo_ine, c.nombre, c.region, c.poblacion;

-- ==========================================
-- FUNCIONES AUXILIARES
-- ==========================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_comunas_updated_at ON comunas;
CREATE TRIGGER update_comunas_updated_at BEFORE UPDATE ON comunas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delitos_updated_at ON delitos;
CREATE TRIGGER update_delitos_updated_at BEFORE UPDATE ON delitos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
