# 🛡️ SafeCity Analytics Platform

Plataforma PWA (Progressive Web App) de **analítica criminal y predicción delictual** para comunas de Chile. Combina modelos espaciotemporales (SEPP/RTM) con visualizaciones storytelling autoexplicativas.

![SafeCity Dashboard](docs/dashboard-preview.png)

## ✨ Características

- 📱 **PWA**: Funciona como app nativa en móviles (iOS/Android) y web en desktop
- 🗺️ **Mapas interactivos**: Visualización geoespacial con Deck.gl y Mapbox
- 🤖 **Predicciones ML**: Modelos SEPP, Risk Terrain Modeling y XGBoost
- 📊 **Dashboard storytelling**: Visualizaciones narrativas autoexplicadas
- 🔐 **Multi-rol**: Ciudadano, Autoridad y Técnico con diferentes permisos
- 🌐 **Nacional**: Escalable a todas las comunas de Chile
- 📴 **Offline-first**: Funciona sin conexión con datos sincronizados

## 🚀 Inicio Rápido

### Requisitos

- Docker & Docker Compose
- Node.js 20+ (solo para desarrollo local sin Docker)
- Python 3.11+ (solo para desarrollo local sin Docker)
- Mapbox Access Token (opcional, para mapas)

### Instalación

1. **Clonar y entrar al directorio**:
```bash
cd SafeCity-Platform
```

2. **Configurar variables de entorno**:
```bash
# Crear archivo .env con tu token de Mapbox
echo "MAPBOX_TOKEN=pk.tu_token_aqui" > .env
```

3. **Iniciar con Docker Compose**:
```bash
docker-compose up --build
```

4. **Acceder a la aplicación**:
- 🌐 Frontend: http://localhost:5173
- 🔧 API Docs: http://localhost:8000/docs
- 🗄️ Backend API: http://localhost:8000

### Comandos útiles

```bash
# Ver logs
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Detener
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + PWA)                              │
│  ├── Mapbox GL / Deck.gl (Mapas)                            │
│  ├── Recharts (Gráficos)                                    │
│  └── Zustand (Estado)                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI + Python)                                 │
│  ├── SQLAlchemy + GeoAlchemy2 (ORM)                         │
│  ├── SEPP / RTM / XGBoost (ML)                              │
│  └── Celery (Tareas async)                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE (PostgreSQL + PostGIS)                            │
│  ├── PostGIS (Datos espaciales)                             │
│  └── TimescaleDB (Series temporales)                        │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Estructura del Proyecto

```
SafeCity-Platform/
├── docker-compose.yml          # Orquestación de servicios
├── backend/                    # API FastAPI
│   ├── app/
│   │   ├── main.py            # Entry point
│   │   ├── models/            # SQLAlchemy models
│   │   ├── routers/           # API endpoints
│   │   └── ml/                # Modelos ML (SEPP, RTM)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React + Vite + PWA
│   ├── src/
│   │   ├── pages/             # Dashboard, Mapa, Predicciones
│   │   ├── components/        # UI components
│   │   ├── hooks/             # React Query hooks
│   │   └── store/             # Zustand store
│   ├── Dockerfile.dev
│   └── vite.config.ts
├── database/                   # Migraciones y seed
│   ├── init/                  # SQL inicial
│   └── seed/                  # Datos de demo
└── docs/                      # Documentación
```

## 📊 Modelos Predictivos

| Modelo | Descripción | Efectividad | Tiempo |
|--------|-------------|-------------|--------|
| **SEPP** | Self-Exciting Point Process | 89% | ~5 min |
| **RTM** | Risk Terrain Modeling | 75% | ~2 min |
| **XGBoost** | Gradient boosting espacial | 85% | ~3 min |
| **Ensemble** | Combinación de modelos | 92% | ~10 min |

## 🔐 Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **Ciudadano** | Mapa público, índices, alertas |
| **Autoridad** | + Predicciones 72h, reportes ejecutivos |
| **Técnico** | + Datos crudos, reentrenar modelos, API |

## 🛠️ Desarrollo Local (sin Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configurar DB en docker-compose o local
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 📝 API Endpoints

### Comunas
- `GET /api/v1/comunas` - Listar comunas
- `GET /api/v1/comunas/{id}` - Obtener comuna
- `GET /api/v1/regiones` - Listar regiones

### Delitos
- `GET /api/v1/delitos` - Listar delitos (con filtros)
- `GET /api/v1/delitos/heatmap` - Datos para mapa de calor
- `GET /api/v1/delitos/estadisticas` - Estadísticas agregadas

### Predicciones
- `GET /api/v1/predicciones` - Listar predicciones
- `POST /api/v1/predicciones/generar` - Generar nuevas predicciones
- `GET /api/v1/predicciones/zonas-riesgo` - Zonas de riesgo para mapa

### Dashboard
- `GET /api/v1/dashboard/resumen` - Resumen completo
- `GET /api/v1/dashboard/nacional` - Vista nacional

## 🧪 Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

## 📦 Despliegue en Producción

1. **Variables de entorno requeridas**:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
JWT_SECRET_KEY=tu_secreto_seguro
MAPBOX_TOKEN=pk.tu_token
```

2. **Build de producción**:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE) para más detalles.

---

Desarrollado con ❤️ para la seguridad ciudadana de Chile.
