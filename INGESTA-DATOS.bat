@echo off
chcp 65001 >nul
cls

echo ==========================================
echo   📊 SAFE CITY - INGESTAR DATOS MUNICIPALES
echo ==========================================
echo.
echo Este script cargara de golpe todos los archivos Excel
echo de La Cisterna, Pudahuel, Valparaiso, San Bernardo y mas.
echo.

set /p PROD_DB_URL="🔗 Pega la DATABASE_URL de tu base de datos de produccion (Neon/Railway): "

if "%PROD_DB_URL%"=="" (
  echo ❌ Error: La URL de la base de datos es obligatoria.
  pause
  exit /b 1
)

echo.
echo ⚙️ Configurando el entorno e iniciando ETL...
echo ------------------------------------------------

set DATABASE_URL=%PROD_DB_URL%
cd backend\data_ingestion

echo.
echo Ejecutando el Orquestador...
python orchestrator.py

echo.
echo ==========================================
echo   ✅ PROCESO FINALIZADO
echo ==========================================
pause
