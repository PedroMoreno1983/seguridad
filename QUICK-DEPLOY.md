# 🚀 Despliegue Ultra-Rápido (5 minutos)

## Arquitectura simplificada

```
Frontend (Vercel) ←──→ Supabase (PostgreSQL)
        ↓                    ↓
   React + Vercel      Base de datos
   Supabase Client     + PostGIS
```

**Sin backend FastAPI** - El frontend conecta directo a la base de datos vía Supabase.

---

## PASO 1: Supabase (2 min)

1. **Ir a https://supabase.com**
2. Click **"New Project"**
3. Nombre: `safecity`
4. Password: (copia y guarda este password)
5. Espera 2 minutos a que se cree

### Habilitar PostGIS

Ve a **SQL Editor** → **New query**, pega esto:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

Click **Run**.

### Crear tablas

Copia el contenido de `database/init/01_init.sql` y ejecútalo en el SQL Editor.

Luego ejecuta los seeds:
```sql
-- Datos de comunas
INSERT INTO comunas (codigo_ine, nombre, nombre_normalizado, region, codigo_region, provincia, poblacion, superficie_km2) VALUES
('13122', 'Peñalolén', 'penalolen', 'Región Metropolitana', '13', 'Santiago', 241133, 54.0),
('13114', 'Las Condes', 'las condes', 'Región Metropolitana', '13', 'Santiago', 294838, 99.0);

-- Delito demo
INSERT INTO delitos (comuna_id, tipo_delito, ubicacion, fecha_hora, fuente, confianza)
VALUES 
(1, 'Robo violento', ST_SetSRID(ST_MakePoint(-70.55, -33.49), 4326), NOW(), 'demo', 0.95);
```

### Copiar credenciales

Ve a **Settings** → **API**:
- `Project URL`: `https://xxxxxx.supabase.co`
- `anon public`: `eyJhbG...` (este es el token)

---

## PASO 2: Vercel (2 min)

### Instalar Vercel CLI
```bash
npm install -g vercel
```

### Ir al frontend
```bash
cd SafeCity-Platform/frontend
```

### Crear archivo .env.local
```bash
echo "VITE_SUPABASE_URL=https://TU-URL.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=TU-TOKEN" >> .env.local
```

### Desplegar
```bash
vercel login
vercel --prod
```

Listo! 🎉

---

## Configurar en Dashboard de Vercel

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. **Settings** → **Environment Variables**
4. Agrega:
   - `VITE_SUPABASE_URL` = `https://xxxxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbG...`

---

## ✅ Listo!

Tu app estará en: `https://tu-proyecto.vercel.app`

Y tienes:
- ✅ PostgreSQL + PostGIS en Supabase (gratis)
- ✅ Frontend en Vercel (gratis)
- ✅ SSL/HTTPS automático
- ✅ Base de datos accesible desde el frontend

---

## 💰 Costos

| Servicio | Costo |
|----------|-------|
| Supabase (500MB DB) | **$0** |
| Vercel (Frontend) | **$0** |
| **Total** | **$0** |

El plan gratis es suficiente para tu MVP.
