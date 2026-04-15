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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import comunas, delitos, predicciones, indices, dashboard, ml_models, auth, evaluaciones, participacion
from app.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestión del ciclo de vida de la aplicación."""
    # Startup: Crear tablas si no existen (no abortar si DB no está lista)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"⚠️  DB no disponible en startup: {e}")
    yield
    # Shutdown: Cleanup


# Crear aplicación FastAPI
app = FastAPI(
    title="SafeCity Analytics API",
    description="Plataforma de analítica criminal y predicción delictual para Chile",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
