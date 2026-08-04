# Visor Garbigunes - piloto

Base común del entregable final. Es una aplicación estática modular, desplegable en Vercel sin dependencias de compilación.

## Estructura

- `index.html`, `styles.css`: shell y sistema visual compartidos.
- `src/app.js`: navegación, filtros, modos y renderizado del visor.
- `src/data-client.js`: cliente de solo lectura para el estado de Supabase.
- `api/health.js`: comprobación segura de las vistas públicas desde Vercel.

## Variables de entorno en Vercel

Configurar en el proyecto del visor, nunca en el navegador:

```text
SUPABASE_URL=https://lixjsmvxnihwlysnixvj.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La función `api/health.js` usa solo esa clave publicable y consulta `analytics.v_public_salidas_monthly`. La `SUPABASE_SERVICE_ROLE_KEY` se reserva para el pipeline local de carga.

En Vercel, crear o vincular un proyecto con `apps/garbigunes-piloto` como **Root Directory** y definir esas dos variables para Production, Preview y Development. La ruta `/api/health` confirmará que la vista pública está disponible.

## Desarrollo local

```bash
cd apps/garbigunes-piloto
python3 -m http.server 4173
```

Abrir `http://localhost:4173`. Sin el entorno de Vercel, el visor sigue mostrando el shell y la conexión se indicará como pendiente de configurar.

El primer módulo a desarrollar es **Flujos y recogidas**, según [`docs/axes/01_Contrato_Flujos_y_Recogidas.md`](../../docs/axes/01_Contrato_Flujos_y_Recogidas.md).
