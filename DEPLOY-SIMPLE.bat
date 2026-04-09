@echo off
chcp 65001 >nul
cls

echo ==========================================
echo   🚀 SAFE CITY - DESPLIEGUE SIMPLE
echo ==========================================
echo.

REM Verificar si está en la carpeta correcta
if not exist "frontend" (
  echo ❌ Error: Debes ejecutar esto desde la carpeta SafeCity-Platform
  pause
  exit /b 1
)

echo 📋 PASOS A SEGUIR:
echo.
echo 1️⃣  Crear proyecto en Supabase:
echo    → https://supabase.com
echo    → New Project → Nombre: safecity
echo.
echo 2️⃣  Habilitar PostGIS en SQL Editor:
echo    CREATE EXTENSION IF NOT EXISTS postgis;
echo.
echo 3️⃣  Copiar credenciales:
echo    → Settings → API
echo    → Project URL y anon key
echo.

set /p SUPABASE_URL="🔗 Ingresa tu SUPABASE URL: "
set /p SUPABASE_KEY="🔑 Ingresa tu SUPABASE ANON KEY: "

echo.
echo ⚙️  Configurando frontend...

cd frontend

REM Crear archivo .env
echo VITE_SUPABASE_URL=%SUPABASE_URL% > .env.local
echo VITE_SUPABASE_ANON_KEY=%SUPABASE_KEY% >> .env.local

echo ✅ Variables de entorno configuradas

echo.
echo 📦 Instalando dependencias...
call npm install

echo.
echo 🚀 Desplegando en Vercel...
call npx vercel --prod

echo.
echo ==========================================
echo   ✅ DESPLIEGUE COMPLETADO
echo ==========================================
echo.
pause
