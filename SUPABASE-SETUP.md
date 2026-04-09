# 🟢 Despliegue Simplificado con Supabase

## ¿Por qué Supabase?

✅ **PostgreSQL + PostGIS** incluido (para datos espaciales)  
✅ **Base de datos** gratis hasta 500MB  
✅ **Autenticación** integrada  
✅ **Edge Functions** (backend serverless)  
✅ **Almacenamiento** de archivos  
✅ **Dashboard** muy fácil de usar  

---

## 🚀 PASOS SIMPLIFICADOS

### 1. Crear proyecto en Supabase (2 minutos)

1. Ve a https://supabase.com
2. Click **"New Project"**
3. Selecciona tu organización
4. Configura:
   - **Name**: `safecity-db`
   - **Database Password**: (genera uno fuerte)
   - **Region**: (la más cercana a Chile es `South America`)
5. Click **"Create new project"**

Espera ~2 minutos a que se cree.

---

### 2. Habilitar PostGIS (1 minuto)

1. En tu proyecto Supabase, ve a **SQL Editor**
2. Click **"New query"**
3. Pega esto:

```sql
-- Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verificar instalación
SELECT PostGIS_Version();
```

4. Click **"Run"**

---

### 3. Crear tablas (2 minutos)

En el SQL Editor, ejecuta el archivo `database/init/01_init.sql`

O copia y pega el contenido completo del archivo.

Luego ejecuta los seeds:
```sql
-- Comunas
\i database/seed/01_comunas_rm.sql

-- Datos demo
\i database/seed/02_delitos_demo_penalolen.sql
```

---

### 4. Obtener credenciales (30 segundos)

Ve a **Settings** → **Database**:

Copia estos datos:

```
Host: db.xxxxxx.supabase.co
Database: postgres
Port: 5432
User: postgres
Password: (tu password)
```

Y también en **Settings** → **API**:

```
Project URL: https://xxxxxx.supabase.co
anon public: eyJhbGciOiJIUzI1NiIs... (este es el token)
```

---

### 5. Configurar Backend (2 opciones)

#### OPCIÓN A: Backend en Render (Recomendado)

El backend FastAPI va en Render, pero conecta a Supabase:

1. Ve a https://render.com
2. New **Web Service**
3. Conecta tu repo de GitHub
4. Configura:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Agrega **Environment Variable**:
   ```
   DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.xxxxxx.supabase.co:5432/postgres
   ```

#### OPCIÓN B: Solo Frontend conectado directo (MÁS SIMPLE)

Si quieres algo aún más simple, el frontend React puede conectarse directamente a Supabase usando su cliente JavaScript:

```bash
cd frontend
npm install @supabase/supabase-js
```

Y usar Supabase como backend completo (sin FastAPI).

---

### 6. Desplegar Frontend en Vercel

```bash
cd frontend

# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Desplegar
vercel --prod
```

Variables de entorno en Vercel:
```
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 📊 Resumen de la arquitectura simplificada

```
┌─────────────────┐         ┌──────────────────┐
│   Vercel        │ ──────▶ │   Supabase       │
│   (Frontend)    │         │   (PostgreSQL)   │
└─────────────────┘         └──────────────────┘
                                    │
                              ┌─────┴─────┐
                              │  Tablas:  │
                              │  comunas  │
                              │  delitos  │
                              │  indices  │
                              └───────────┘
```

**Sin backend intermedio** - El frontend habla directo con Supabase.

---

## 💾 Plan Gratis de Supabase

| Recurso | Límite |
|---------|--------|
| Base de datos | 500 MB |
| Auth users | Ilimitado |
| Edge Functions | 500K invocaciones/mes |
| Storage | 1 GB |
| Transferencia | 2 GB/mes |

**Para tu proyecto**: Es más que suficiente.

---

## ✅ CHECKLIST RÁPIDO

- [ ] Crear proyecto en Supabase (https://supabase.com)
- [ ] Habilitar PostGIS en SQL Editor
- [ ] Crear tablas (copiar `database/init/01_init.sql`)
- [ ] Insertar datos demo
- [ ] Copiar URL y ANON KEY
- [ ] Configurar en Vercel
- [ ] Desplegar frontend

**Tiempo total**: ~10 minutos

---

## 🔗 URLs Importantes

- **Supabase**: https://supabase.com
- **Vercel**: https://vercel.com
- **Tu proyecto**: https://app.supabase.com/project/xxxxxx
