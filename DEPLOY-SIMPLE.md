# 🚀 Despliegue SIMPLE - GitHub + Vercel

## Paso 1: Configurar Secrets en GitHub

Ve a tu repo en GitHub:
```
https://github.com/PedroMoreno1983/seguridad/settings/secrets/actions
```

Agrega estos secrets (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Valor |
|--------|-------|
| `VERCEL_TOKEN` | Tu token de Vercel (ver abajo cómo obtenerlo) |
| `VERCEL_ORG_ID` | ID de tu equipo en Vercel |
| `VERCEL_PROJECT_ID` | ID del proyecto en Vercel |
| `VITE_API_URL` | `https://safecity-api-n4hb.onrender.com/api/v1` |

### Cómo obtener los valores:

**VERCEL_TOKEN:**
1. Ve a https://vercel.com/account/tokens
2. Create Token → Name: "GitHub Actions" → Scope: Full Account
3. Copia el token

**VERCEL_ORG_ID y VERCEL_PROJECT_ID:**
1. En tu proyecto Vercel, ve a Settings → General
2. Están en "Project ID" y bajo "Team" está el Org ID

O ejecuta localmente:
```bash
cd frontend
npx vercel link
```
Y copia los valores del archivo `.vercel/project.json`

---

## Paso 2: Hacer push

```bash
git add .
git commit -m "Add GitHub Actions deploy"
git push origin main
```

---

## ✅ Listo!

Cada vez que hagas push a `main`, se desplegará automáticamente en Vercel.

Ver el progreso en: https://github.com/PedroMoreno1983/seguridad/actions
