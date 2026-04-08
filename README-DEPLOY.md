# 🚀 Guía de Despliegue - GitHub + Vercel

Esta guía explica paso a paso cómo subir el proyecto a GitHub y desplegarlo en Vercel.

## 📋 Pre-requisitos

- Cuenta en GitHub (https://github.com)
- Cuenta en Vercel (https://vercel.com) - puedes usar "Sign up with GitHub"
- Git instalado en tu computadora (https://git-scm.com/download/win)
- Node.js 20+ instalado

---

## 1️⃣ SUBIR A GITHUB

### Paso 1: Inicializar repositorio Git

Abre PowerShell o CMD en la carpeta del proyecto:

```powershell
cd "C:\Users\pedro.moreno\Desktop\Seguridad\SafeCity-Platform"

# Inicializar git
git init

# Configurar tu identidad
git config user.email "tu-email@ejemplo.com"
git config user.name "Tu Nombre"
```

### Paso 2: Agregar archivos

```powershell
# Agregar todo (excepto lo que está en .gitignore)
git add .

# Verificar estado
git status

# Hacer commit inicial
git commit -m "🎉 Initial commit: SafeCity Analytics Platform

- Full-stack PWA for crime analytics
- 9 ML models implemented (LSTM, Prophet, ARIMA, etc.)
- FastAPI backend + React frontend
- PostgreSQL + PostGIS database
- Docker Compose setup"
```

### Paso 3: Conectar con GitHub

```powershell
# Agregar remote (reemplaza con tu URL)
git remote add origin https://github.com/PedroMoreno1983/seguridad.git

# Subir código
git branch -M main
git push -u origin main
```

> 💡 **Nota**: Si te pide credenciales, usa un Personal Access Token de GitHub:
> 1. Ve a GitHub → Settings → Developer settings → Personal access tokens
> 2. Genera un token con permisos "repo"
> 3. Úsalo como contraseña cuando git lo solicite

---

## 2️⃣ DESPLEGAR FRONTEND EN VERCEL

### Opción A: Despliegue automático (Recomendado)

1. Ve a https://vercel.com/new
2. Selecciona "Import Git Repository"
3. Autoriza Vercel a acceder a tu GitHub
4. Selecciona el repositorio `PedroMoreno1983/seguridad`
5. Configura:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Agrega variables de entorno:
   ```
   VITE_API_URL=https://tu-backend.onrender.com/api/v1
   ```
7. Click "Deploy"

### Opción B: CLI de Vercel

```powershell
# Instalar Vercel CLI
npm install -g vercel

# Ir a la carpeta frontend
cd frontend

# Login (abrirá navegador)
vercel login

# Desplegar
vercel --prod

# Seguir instrucciones interactivas
```

---

## 3️⃣ DESPLEGAR BACKEND (Opciones)

El backend necesita una base de datos PostgreSQL. Aquí hay varias opciones:

### Opción A: Render.com (Recomendado - Tiene free tier)

1. Ve a https://dashboard.render.com
2. Crear "PostgreSQL" database (free tier)
3. Crear "Web Service" con tu repositorio de GitHub
4. Configurar:
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**:
     ```
     DATABASE_URL=postgresql://user:pass@host:5432/dbname
     JWT_SECRET_KEY=tu-secreto-super-seguro
     CORS_ORIGINS=https://tu-app-en-vercel.vercel.app
     ```

### Opción B: Railway.app

```powershell
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Ir a backend
cd backend

# Inicializar proyecto
railway init

# Agregar PostgreSQL
railway add --database postgres

# Desplegar
railway up
```

### Opción C: Fly.io

```powershell
# Instalar Fly CLI
iwr https://fly.io/install.ps1 -useb | iex

# Login
fly auth login

# Ir a backend
cd backend

# Crear app
fly launch --name safecity-backend

# Configurar base de datos
fly postgres create --name safecity-db

# Conectar DB a app
fly postgres attach --app safecity-backend safecity-db

# Desplegar
fly deploy
```

---

## 4️⃣ CONFIGURAR VARIABLES DE ENTORNO EN VERCEL

Una vez desplegado el frontend, configura la URL del backend:

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   ```
   VITE_API_URL=https://tu-backend.onrender.com/api/v1
   ```
4. Redeploy (Vercel lo hará automáticamente)

---

## 5️⃣ VERIFICAR DESPLIEGUE

### Frontend (Vercel)
- URL típica: `https://seguridad.vercel.app`
- Debería mostrar el login/dashboard
- Verificar que carga sin errores 404

### Backend
- URL típica: `https://safecity-backend.onrender.com`
- Probar: `https://safecity-backend.onrender.com/health`
- Debería retornar: `{"status": "healthy"}`

### Base de datos
- Verificar conexión desde backend
- Logs en el dashboard del proveedor

---

## 🐛 Solución de Problemas Comunes

### Error: "Cannot find module"
```powershell
# Asegúrate de que node_modules está en .gitignore
# Y que package.json está en el repo
git add frontend/package.json
git commit -m "fix: add package.json"
git push
```

### Error: "Build failed"
```powershell
# Verificar build localmente primero
cd frontend
npm install
npm run build

# Si funciona localmente, limpiar caché en Vercel
# Vercel Dashboard → Project → Settings → Git → Clear Cache
```

### Error CORS
```python
# En backend/app/main.py, actualizar CORS origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tu-app-en-vercel.vercel.app",
        "http://localhost:5173"  # desarrollo
    ],
    ...
)
```

### Base de datos no conecta
- Verificar DATABASE_URL en variables de entorno
- Asegurar que PostgreSQL acepta conexiones externas
- Verificar firewall/reglas de red

---

## 📁 Estructura esperada en GitHub

```
PedroMoreno1983/seguridad/
├── .gitignore
├── README.md
├── docker-compose.yml
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vercel.json
└── database/
    └── init/
```

---

## 🔗 URLs importantes

- **GitHub Repo**: https://github.com/PedroMoreno1983/seguridad
- **Vercel Dashboard**: https://vercel.com/homadropi-9167s-projects
- **Documentación Vercel**: https://vercel.com/docs

---

## ✅ Checklist Final

- [ ] Código subido a GitHub
- [ ] Frontend desplegado en Vercel
- [ ] Backend desplegado (Render/Railway/Fly)
- [ ] Base de datos PostgreSQL configurada
- [ ] Variables de entorno configuradas
- [ ] CORS configurado para permitir Vercel
- [ ] PWA instalable (íconos, manifest)
- [ ] HTTPS habilitado (Vercel lo hace automático)

---

## 💡 Tips

1. **Usa GitHub Desktop** si prefieres interfaz gráfica: https://desktop.github.com
2. **Vercel Preview**: Cada Pull Request genera una URL de preview automáticamente
3. **Variables de entorno**: Nunca subas `.env` a GitHub (ya está en .gitignore)
4. **Base de datos**: Para producción, considera backups automáticos

¿Necesitas ayuda con algún paso específico?
