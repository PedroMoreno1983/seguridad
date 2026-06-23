"""
SafeCity Platform - API Principal
=================================
FastAPI application para la plataforma de analítica criminal.

Endpoints:
- /health: Verificación de estado
- /api/v1/comunas: Gestión de comunas
- /api/v1/delitos: Datos de delincuencia
- /api/v1/predicciones: Modelos predictivos
- /api/v1/indices: Índices de seguridad
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.routers import comunas, delitos, predicciones, indices, dashboard, ml_models, auth, evaluaciones, participacion, reportes, fuentes_privadas, privados, prevencion, agentic_security
from app.database import engine, Base


def ensure_runtime_migrations():
    """Apply small additive migrations needed by deployed databases."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS centroid_lat DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS centroid_lon DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS bbox JSONB"))
        conn.execute(text("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'"))
        conn.execute(text("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS geocode_precision VARCHAR(20) DEFAULT 'sin_senal'"))
        conn.execute(text("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS geocode_source VARCHAR(80)"))
        conn.execute(text("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS geocode_confidence NUMERIC(4,2)"))
        conn.execute(text("ALTER TABLE delitos ALTER COLUMN geocode_precision SET DEFAULT 'sin_senal'"))
        conn.execute(text("UPDATE delitos SET geocode_precision = 'sin_senal' WHERE geocode_precision IS NULL"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_delitos_geocode_precision ON delitos(geocode_precision)"))
        conn.execute(text("ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS zona_bbox JSONB"))
        conn.execute(text("ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS centro_lat DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS centro_lon DOUBLE PRECISION"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS intervenciones (
                id BIGSERIAL PRIMARY KEY,
                comuna_id INTEGER NOT NULL REFERENCES comunas(id),
                tipo VARCHAR(100) NOT NULL,
                descripcion VARCHAR(500),
                fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
                fecha_fin TIMESTAMP WITH TIME ZONE,
                zona_bbox JSONB,
                centro_lat DOUBLE PRECISION,
                centro_lon DOUBLE PRECISION,
                impacto_estimado JSONB
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_intervenciones_comuna ON intervenciones(comuna_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_intervenciones_fecha ON intervenciones(fecha_inicio)"))
        conn.execute(text(
            "ALTER TABLE usuarios "
            "ADD COLUMN IF NOT EXISTS producto_preferido VARCHAR(20) NOT NULL DEFAULT 'territorio'"
        ))
        conn.execute(text(
            "ALTER TABLE usuarios "
            "ADD COLUMN IF NOT EXISTS tipo_usuario VARCHAR(20) NOT NULL DEFAULT 'territorial'"
        ))
        conn.execute(text(
            "ALTER TABLE usuarios "
            "ADD COLUMN IF NOT EXISTS organizacion_id INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE usuarios "
            "ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#3b82f6'"
        ))
        conn.execute(text(
            "UPDATE usuarios SET producto_preferido = 'activos' "
            "WHERE email = 'pedro@safecity.cl' AND producto_preferido = 'territorio'"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_runs (
                id BIGSERIAL PRIMARY KEY,
                comuna_id INTEGER NOT NULL REFERENCES comunas(id),
                user_id INTEGER REFERENCES usuarios(id),
                objective TEXT NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'planned',
                summary JSONB NOT NULL DEFAULT '{}'::jsonb,
                autonomy_level VARCHAR(30) NOT NULL DEFAULT 'supervised',
                agent_version VARCHAR(30) NOT NULL DEFAULT 'gaas-v1',
                reasoning_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
                last_observation JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS autonomy_level VARCHAR(30) NOT NULL DEFAULT 'supervised'"))
        conn.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_version VARCHAR(30) NOT NULL DEFAULT 'gaas-v1'"))
        conn.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS reasoning_trace JSONB NOT NULL DEFAULT '[]'::jsonb"))
        conn.execute(text("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS last_observation JSONB NOT NULL DEFAULT '{}'::jsonb"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_actions (
                id BIGSERIAL PRIMARY KEY,
                run_id BIGINT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
                action_key VARCHAR(80) NOT NULL,
                tool_name VARCHAR(80) NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                risk_level VARCHAR(20) NOT NULL DEFAULT 'medio',
                requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                preview JSONB NOT NULL DEFAULT '{}'::jsonb,
                result JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                executed_at TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_agent_runs_comuna ON agent_runs(comuna_id, created_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_agent_actions_run ON agent_actions(run_id)"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestión del ciclo de vida de la aplicación."""
    # Startup: Crear tablas si no existen (no abortar si DB no está lista)
    try:
        Base.metadata.create_all(bind=engine)
        ensure_runtime_migrations()
        agentic_security.start_agent_scheduler()
    except Exception as e:
        print(f"⚠️  DB no disponible en startup: {e}")
    yield
    # Shutdown: Cleanup
    await agentic_security.stop_agent_scheduler()


# Crear aplicación FastAPI
app = FastAPI(
    title="SafeCity Analytics API",
    description="Plataforma de analítica criminal y predicción delictual para Chile",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuración CORS — lista de orígenes separada por comas en env var
_default_cors_origins = ",".join([
    "http://localhost:5173",
    "http://localhost:3000",
    "https://safecity-analytics.vercel.app",
    "https://safecity-analytics-homadropi-9167s-projects.vercel.app",
    "https://safecity-analytics-git-main-homadropi-9167s-projects.vercel.app",
])
_cors_raw = os.getenv("CORS_ORIGINS", _default_cors_origins)
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
_cors_origin_regex = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"https://safecity-analytics-[a-z0-9]+-homadropi-9167s-projects\.vercel\.app",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# ==========================================
# ENDPOINTS BASE
# ==========================================

@app.get("/", tags=["Root"])
async def root():
    """Endpoint raíz - información básica de la API."""
    return {
        "name": "SafeCity Analytics API",
        "version": "1.0.0",
        "description": "Plataforma de analítica criminal y predicción delictual",
        "docs": "/docs",
        "endpoints": {
            "comunas": "/api/v1/comunas",
            "delitos": "/api/v1/delitos",
            "predicciones": "/api/v1/predicciones",
            "indices": "/api/v1/indices",
            "dashboard": "/api/v1/dashboard"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Verificación de estado del servicio."""
    return {
        "status": "healthy",
        "service": "safecity-api",
        "version": "1.0.0"
    }


# ==========================================
# REGISTRO DE ROUTERS
# ==========================================

app.include_router(auth.router, prefix="/api/v1", tags=["Autenticación"])
app.include_router(comunas.router, prefix="/api/v1", tags=["Comunas"])
app.include_router(delitos.router, prefix="/api/v1", tags=["Delitos"])
app.include_router(predicciones.router, prefix="/api/v1", tags=["Predicciones"])
app.include_router(indices.router, prefix="/api/v1", tags=["Índices de Seguridad"])
app.include_router(dashboard.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(ml_models.router, prefix="/api/v1", tags=["Machine Learning"])
app.include_router(evaluaciones.router, prefix="/api/v1", tags=["Evaluaciones"])
app.include_router(participacion.router, prefix="/api/v1", tags=["Participacion"])
app.include_router(reportes.router, prefix="/api/v1", tags=["Reportes IA"])
app.include_router(fuentes_privadas.router, prefix="/api/v1", tags=["Fuentes Privadas"])
app.include_router(privados.router, prefix="/api/v1", tags=["Operacion Privada"])
app.include_router(prevencion.router, prefix="/api/v1", tags=["Prevencion Responsable"])
app.include_router(agentic_security.router, prefix="/api/v1", tags=["Agente GaaS"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
