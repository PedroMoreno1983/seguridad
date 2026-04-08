# ==========================================
# SAFE CITY DEPLOY SCRIPT
# Script para desplegar en GitHub + Vercel
# ==========================================

param(
    [switch]$Init,
    [switch]$Push,
    [switch]$Deploy,
    [switch]$Full
)

$ErrorActionPreference = "Stop"

# Colores
$Green = "`e[32m"
$Blue = "`e[34m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Step($message) {
    Write-Host "`n$Blue>>> $message$Reset`n" -ForegroundColor Blue
}

function Write-Success($message) {
    Write-Host "$Green✓ $message$Reset" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "$Yellow⚠ $message$Reset" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "$Red✗ $message$Reset" -ForegroundColor Red
}

# ==========================================
# INICIALIZAR REPOSITORIO
# ==========================================
if ($Init -or $Full) {
    Write-Step "Inicializando repositorio Git..."
    
    if (Test-Path ".git") {
        Write-Warning "El repositorio ya está inicializado"
    } else {
        git init
        Write-Success "Repositorio Git inicializado"
    }
    
    # Configurar git si no está configurado
    $gitEmail = git config user.email
    $gitName = git config user.name
    
    if (-not $gitEmail) {
        $email = Read-Host "Ingresa tu email de GitHub"
        git config user.email $email
    }
    if (-not $gitName) {
        $name = Read-Host "Ingresa tu nombre"
        git config user.name $name
    }
    
    # Agregar remote
    $remote = git remote get-url origin 2>$null
    if (-not $remote) {
        git remote add origin https://github.com/PedroMoreno1983/seguridad.git
        Write-Success "Remote agregado: https://github.com/PedroMoreno1983/seguridad.git"
    }
}

# ==========================================
# SUBIR A GITHUB
# ==========================================
if ($Push -or $Full) {
    Write-Step "Subiendo código a GitHub..."
    
    # Verificar cambios
    $status = git status --porcelain
    if ($status) {
        git add .
        
        $commitMsg = Read-Host "Mensaje del commit (presiona Enter para mensaje por defecto)"
        if (-not $commitMsg) {
            $commitMsg = "update: SafeCity Analytics Platform"
        }
        
        git commit -m $commitMsg
        Write-Success "Commit creado"
        
        # Push
        $branch = git branch --show-current
        git push -u origin $branch
        Write-Success "Código subido a GitHub"
    } else {
        Write-Warning "No hay cambios para subir"
    }
}

# ==========================================
# DESPLEGAR EN VERCEL
# ==========================================
if ($Deploy -or $Full) {
    Write-Step "Desplegando en Vercel..."
    
    # Verificar si Vercel CLI está instalado
    $vercel = Get-Command vercel -ErrorAction SilentlyContinue
    if (-not $vercel) {
        Write-Warning "Vercel CLI no está instalado"
        $install = Read-Host "¿Instalar Vercel CLI? (s/n)"
        if ($install -eq "s") {
            npm install -g vercel
            Write-Success "Vercel CLI instalado"
        } else {
            Write-Error "No se puede continuar sin Vercel CLI"
            exit 1
        }
    }
    
    # Ir a carpeta frontend y desplegar
    Push-Location frontend
    
    Write-Host "Desplegando frontend..."
    vercel --prod
    
    Pop-Location
    Write-Success "Frontend desplegado en Vercel"
}

# ==========================================
# DESPLIEGUE COMPLETO
# ==========================================
if ($Full) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  DESPLIEGUE COMPLETADO" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nPróximos pasos:" -ForegroundColor Yellow
    Write-Host "1. Verifica el repositorio en: https://github.com/PedroMoreno1983/seguridad"
    Write-Host "2. Configura variables de entorno en Vercel Dashboard"
    Write-Host "3. Despliega el backend en Render/Railway"
    Write-Host "`nPara actualizar en el futuro, ejecuta: .\deploy.ps1 -Push"
}

# ==========================================
# AYUDA
# ==========================================
if (-not ($Init -or $Push -or $Deploy -or $Full)) {
    Write-Host @"
SafeCity Deploy Script

Uso:
  .\deploy.ps1 -Init    # Inicializar repositorio Git
  .\deploy.ps1 -Push    # Subir cambios a GitHub
  .\deploy.ps1 -Deploy  # Desplegar en Vercel
  .\deploy.ps1 -Full    # Todo el proceso completo

Ejemplo:
  .\deploy.ps1 -Full    # Primera vez
  .\deploy.ps1 -Push    # Actualizar código
"@
}
