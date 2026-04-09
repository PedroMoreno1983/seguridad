# 🚀 Quick Start - 3 Opciones de Despliegue

## Opción 1: NEON + Render + Vercel ⭐ (Recomendada)
**Arquitectura:** PostgreSQL (Neon) → Backend (Render) → Frontend (Vercel)

✅ **Ventajas:**
- Full stack completo (9 modelos ML disponibles)
- Backend robusto con FastAPI
- Base de datos PostgreSQL + PostGIS
- Todo gratis

⏱️ **Tiempo:** 10 minutos

**Pasos:**
1. Neon: https://neon.tech → Crear proyecto → Habilitar PostGIS
2. Render: https://render.com → New Web Service → Conectar repo
3. Vercel: `vercel --prod`

📄 **Guía:** `NEON-SETUP.md`

---

## Opción 2: Supabase + Vercel (Más simple)
**Arquitectura:** Supabase (DB+API) → Frontend (Vercel)

✅ **Ventajas:**
- Sin backend propio (usa API de Supabase)
- Menos código
- Realtime subscriptions

❌ **Desventajas:**
- Ya tienes 2 proyectos (límite alcanzado)
- Modelos ML limitados

⏱️ **Tiempo:** 5 minutos

📄 **Guía:** `SUPABASE-SETUP.md` (pero necesitas borrar un proyecto primero)

---

## Opción 3: Solo Local (Para desarrollo)
**Arquitectura:** Docker Compose todo local

✅ **Ventajas:**
- Todo en tu computadora
- Sin dependencias externas
- Rápido para desarrollar

❌ **Desventajas:**
- No está online (solo localhost)
- Necesitas Docker

⏱️ **Tiempo:** 2 minutos

**Comando:**
```bash
docker-compose up
```

---

## 🎯 Mi recomendación

Usa **OPCIÓN 1 (NEON)** porque:
1. Neon te permite **3 proyectos** (vs 2 de Supabase)
2. Tienes **backend completo** con todos los modelos ML
3. Es **gratis para siempre** (con límites razonables)
4. **Render** es muy confiable y fácil de usar

---

## 📊 Comparativa rápida

| Aspecto | Neon+Render | Supabase | Local Docker |
|---------|-------------|----------|--------------|
| **Proyectos gratis** | 3 (Neon) | 2 (límite) | ∞ |
| **Backend ML** | ✅ Completo | ⚠️ Limitado | ✅ Completo |
| **PostGIS** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Setup** | 10 min | 5 min | 2 min |
| **Siempre online** | ✅ Sí | ✅ Sí | ❌ No |

---

## 🆘 Problemas comunes

### "No puedo crear más proyectos"
→ Usa **Neon** en lugar de Supabase (3 vs 2 proyectos)

### "El backend se duerme"
→ Es normal en Render Free. Tarda 30-60 seg en despertar.

### "Error de CORS"
→ Actualiza `CORS_ORIGINS` en Render con tu URL de Vercel exacta.

### "No tengo Vercel CLI"
```bash
npm install -g vercel
```

---

## 🎉 Empecemos

¿Cuál opción prefieres?

**A)** Quiero la completa → Sigue `NEON-SETUP.md` o ejecuta `DEPLOY-NEON.bat`

**B)** Quiero la más simple → Borra un proyecto de Supabase y sigue `SUPABASE-SETUP.md`

**C)** Solo para probar local → Ejecuta `docker-compose up`
