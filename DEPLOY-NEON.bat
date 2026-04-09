@echo off
chcp 65001 >nul
cls

echo ==========================================
echo   🟠 SAFE CITY - DESPLIEGUE CON NEON
echo ==========================================
echo.
echo Este script te guiara para desplegar:
echo   1. Base de datos: Neon (PostgreSQL+PostGIS)
echo   2. Backend: Render (FastAPI)
echo   3. Frontend: Vercel (React)
echo.

REM Verificar ubicacion
if not exist "frontend" (
  echo ❌ Error: Debes ejecutar esto desde la carpeta SafeCity-Platform
  pause
  exit /b 1
)

echo 📋 PASO 1: Configurar Neon
echo ---------------------------
echo 1. Ve a https://neon.tech
echo 2. Crea proyecto llamado "safecity"
echo 3. En SQL Editor, ejecuta: CREATE EXTENSION postgis;
echo 4. Crea tablas (copia database/init/01_init.sql)
echo 5. Ve a "Connection Details" y copia la URL
echo.

set /p NEON_URL="🔗 Pega tu NEON DATABASE_URL (pooled connection): "

echo.
echo 📋 PASO 2: Configurar Backend (Render)
echo ----------------------------------------
echo Ve a https://dashboard.render.com y crea Web Service
echo Agrega estas variables de entorno:
echo.
echo DATABASE_URL=%NEON_URL%
echo JWT_SECRET_KEY=clave-secreta-minimo-32-caracteres-12345
echo CORS_ORIGINS=http://localhost:5173
echo.
set /p RENDER_URL="🔗 Cuando termines, pega la URL de Render (ej: https://safecity-api.onrender.com): "

echo.
echo ⚙️  Configurando frontend...
cd frontend

echo VITE_API_URL=%RENDER_URL%/api/v1 > .env.local
echo ✅ Frontend configurado con backend

echo.
echo 📦 Instalando dependencias...
call npm install

echo.
echo 🚀 Desplegando frontend en Vercel...
call npx vercel --prod

echo.
echo ==========================================
echo   ✅ DESPLIEGUE COMPLETADO
echo ==========================================
echo.
echo Tu aplicacion esta en:
echo   Frontend: https://tu-app.vercel.app
echo   Backend:  %RENDER_URL%
echo   API Docs: %RENDER_URL%/docs
echo.
echo No olvides actualizar CORS_ORIGINS en Render
echo con tu URL real de Vercel!
echo.
pause
