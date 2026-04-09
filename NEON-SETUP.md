# 🟠 Despliegue con Neon PostgreSQL

Neon es PostgreSQL serverless con free tier generoso (3 proyectos, 500MB cada uno).

---

## 🚀 PASOS RÁPIDOS

### 1. Crear proyecto en Neon (2 min)

1. Ve a **https://neon.tech**
2. Sign up con GitHub
3. Click **"New Project"**
4. Configura:
   - **Project name**: `safecity`
   - **PostgreSQL version**: 15
   - **Region**: Choose region closest to you (US East o EU)
5. Click **"Create Project"**

---

### 2. Habilitar PostGIS (1 min)

1. En tu proyecto Neon, ve a **SQL Editor** (pestaña en la izquierda)
2. Ejecuta:

```sql
-- Habilitar extensiones espaciales
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verificar
SELECT PostGIS_Version();
```

3. Debería mostrar algo como: `3.4 USE_GEOS=1 USE_PROJ=1`

---

### 3. Crear tablas y datos

Copia y pega en el **SQL Editor** todo el contenido de `database/init/01_init.sql`

Luego inserta datos de prueba:

```sql
-- Comunas RM (solo algunas de ejemplo)
INSERT INTO comunas (codigo_ine, nombre, nombre_normalizada, region, codigo_region, provincia, poblacion, superficie_km2) VALUES
('13122', 'Peñalolén', 'penalolen', 'Región Metropolitana de Santiago', '13', 'Santiago', 241133, 54.0),
('13114', 'Las Condes', 'las condes', 'Región Metropolitana de Santiago', '13', 'Santiago', 294838, 99.0),
('13101', 'Santiago', 'santiago', 'Región Metropolitana de Santiago', '13', 'Santiago', 404495, 22.4);

-- Delitos de ejemplo para Peñalolén
INSERT INTO delitos (comuna_id, tipo_delito, ubicacion, fecha_hora, dia_semana, hora_del_dia, es_fin_semana, fuente, confianza)
VALUES 
(1, 'Robo violento', ST_SetSRID(ST_MakePoint(-70.55, -33.49), 4326), '2024-03-15 14:30:00', 4, 14, false, 'demo', 0.95),
(1, 'Hurto', ST_SetSRID(ST_MakePoint(-70.52, -33.48), 4326), '2024-03-16 10:15:00', 5, 10, true, 'demo', 0.90),
(1, 'Robo con intimidación', ST_SetSRID(ST_MakePoint(-70.53, -33.50), 4326), '2024-03-17 20:45:00', 6, 20, true, 'demo', 0.85);

-- Índice de seguridad
INSERT INTO indices_seguridad (comuna_id, fecha, indice_seguridad_global, tasa_delictual, ranking_nacional, tendencia)
VALUES (1, '2024-03-20', 67.5, 207.5, 85, 'bajando');
```

---

### 4. Obtener credenciales de conexión (30 seg)

1. En Neon Dashboard, click **"Connection Details"**
2. Copia el **Pooled connection string**:
   ```
   postgres://username:password@ep-xxxxxx.us-east-1.aws.neon.tech/safecity?sslmode=require
   ```
   
   O las partes separadas:
   - **Host**: `ep-xxxxxx.us-east-1.aws.neon.tech`
   - **Database**: `safecity`
   - **User**: `username`
   - **Password**: `password`

---

### 5. Opciones de despliegue

Tenemos **2 opciones**:

#### OPCIÓN A: Backend FastAPI + Neon (Recomendada)

Mantienes el backend FastAPI que ya construimos, solo cambias la base de datos a Neon.

**Ventajas:**
- ✅ Más seguro (no expones DB directamente)
- ✅ Puedes usar todos los modelos ML
- ✅ Lógica de negocio en backend

**Despliegue:**
1. Backend en **Render** (conecta a Neon)
2. Frontend en **Vercel** (conecta a backend)

#### OPCIÓN B: Solo Frontend + Vercel Edge Functions + Neon

Sin backend FastAPI. Usas serverless functions de Vercel para conectar a Neon.

**Ventajas:**
- ✅ Más simple (menos código)
- ✅ Todo en Vercel

**Desventajas:**
- ❌ No puedes usar modelos ML pesados (LSTM, etc.)
- ❌ Tiempo de ejecución limitado

---

## 🟠 OPCIÓN A: Backend FastAPI + Neon (Recomendada)

### 5A.1 Desplegar Backend en Render

1. Ve a **https://dashboard.render.com**
2. **New** → **Web Service**
3. Conecta tu repo de GitHub: `PedroMoreno1983/seguridad`
4. Configura:
   - **Name**: `safecity-api`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   
5. En **Environment Variables**, agrega:
   ```
   DATABASE_URL=postgres://username:password@ep-xxxxxx.us-east-1.aws.neon.tech/safecity?sslmode=require
   JWT_SECRET_KEY=tu-clave-secreta-super-larga-aqui-minimo-32-caracteres
   CORS_ORIGINS=https://tu-frontend-en-vercel.vercel.app,http://localhost:5173
   ```

6. Click **"Create Web Service"**

Espera 2-3 minutos a que se despliegue.

### 5A.2 Desplegar Frontend en Vercel

```bash
cd SafeCity-Platform/frontend

# Configurar URL del backend
echo "VITE_API_URL=https://safecity-api.onrender.com/api/v1" > .env.local

# Instalar Vercel CLI si no lo tienes
npm install -g vercel

# Login y desplegar
vercel login
vercel --prod
```

Listo! 🎉

**URLs:**
- Frontend: `https://tu-app.vercel.app`
- Backend: `https://safecity-api.onrender.com`
- API Docs: `https://safecity-api.onrender.com/docs`

---

## 💰 Costos (100% Gratis)

| Servicio | Plan | Límite | Costo |
|----------|------|--------|-------|
| **Neon** | Free Tier | 3 proyectos, 500MB cada uno | **$0** |
| **Render** | Free | Web service siempre activo | **$0** |
| **Vercel** | Hobby | 100GB bandwidth | **$0** |
| **TOTAL** | | | **$0** |

---

## 🔧 Solución de problemas

### Error: "sslmode=require"
Asegúrate de usar `?sslmode=require` al final de la URL de Neon.

### Error: "too many connections"
Neon tiene límites de conexiones en free tier. Usa **connection pooling** (la URL que dice "pooled").

### Error CORS
Verifica que `CORS_ORIGINS` en Render incluya tu URL de Vercel exacta (con `https://`).

---

## ✅ CHECKLIST

- [ ] Crear proyecto en Neon (https://neon.tech)
- [ ] Habilitar PostGIS en SQL Editor
- [ ] Crear tablas (copiar SQL de `database/init/`)
- [ ] Insertar datos de prueba
- [ ] Copiar Connection String (Pooled)
- [ ] Desplegar Backend en Render con `DATABASE_URL`
- [ ] Desplegar Frontend en Vercel con `VITE_API_URL`
- [ ] Probar conexión: Visitar `/health` del backend

---

## 🆘 Ayuda rápida

**¿Dónde está mi connection string?**
Neon Dashboard → Project → Connection Details → Pooled connection

**¿Render es gratis para siempre?**
Sí, pero el web service "duerme" después de 15 min sin uso. Se despierta automáticamente en 30-60 segundos cuando alguien visita.

**¿Puedo usar el mismo repo de GitHub?**
¡Sí! Solo configura Render y Vercel para usar el mismo repo. Cada push a `main` hará deploy automático en ambos.
