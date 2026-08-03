# Supabase

Proyecto Supabase: `Garbigunes`

- Project URL: `https://lixjsmvxnihwlysnixvj.supabase.co`
- Project ID: `lixjsmvxnihwlysnixvj`

## Crear tablas iniciales

Ejecutar el contenido de:

```text
supabase/migrations/20260731_0001_initial_analytics_schema.sql
```

en Supabase:

1. Abrir el proyecto `Garbigunes`.
2. Ir a `SQL Editor`.
3. Crear una nueva query.
4. Pegar la migración completa.
5. Ejecutar.

La migración crea el esquema `analytics` y estas tablas:

- `analytics.fact_salidas_transporte`
- `analytics.fact_captacion_aw`
- `analytics.dim_garbigunes`
- `analytics.config_familias_aw`

Despues ejecutar tambien:

```text
supabase/migrations/20260803_0002_grant_analytics_api_permissions.sql
```

Esta segunda migracion concede permisos al rol `service_role` para poder cargar datos por la API REST.

## Siguiente paso

Crear un script de carga desde los ficheros locales hacia Supabase usando la connection string o las credenciales de API del proyecto.

## Cargar datos

El script de carga es:

```text
scripts/load_supabase_data.py
```

Necesita una clave `service_role`, no la `anon key`.

Crear un fichero local `.env.local` en la raiz del proyecto:

```bash
SUPABASE_URL=https://lixjsmvxnihwlysnixvj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=pegar_service_role_key_aqui
```

`.env.local` esta excluido de Git.

Antes de cargar datos por REST, comprobar en Supabase que el esquema `analytics` esta expuesto en:

```text
Project Settings > API > Data API Settings > Exposed schemas
```

Debe incluir:

```text
analytics
```

Probar transformaciones sin conectar:

```bash
python3 scripts/load_supabase_data.py --dry-run
```

Los facts se cargan desde los artefactos generados en `dashboard/`. Antes de cargar salidas o captacion AW, regenerar el dashboard si han cambiado las fuentes:

```bash
python3 scripts/build_dashboard_data.py
```

La politica actual de fuentes es:

- historico principal desde `input_data`;
- actualizaciones parciales desde `input_data/datos_actualizados`;
- en ventanas temporales solapadas se prioriza `datos_actualizados`;
- Captacion AW mantiene `Registro detalles residuos_2026-2018.xlsx` porque conserva `C.P.` y municipio origen.

Cargar dimensiones/configuracion:

```bash
python3 scripts/load_supabase_data.py --tables dim_garbigunes config_familias_aw
```

Cargar salidas:

```bash
python3 scripts/load_supabase_data.py --tables fact_salidas_transporte
```

Cargar captacion AW, que es la tabla mas grande:

```bash
python3 scripts/load_supabase_data.py --tables fact_captacion_aw --batch-size 1000
```

Por defecto, cada tabla se borra antes de recargarse. Para anadir filas sin borrar:

```bash
python3 scripts/load_supabase_data.py --tables fact_salidas_transporte --skip-delete
```

## Errores frecuentes

Si aparece `Invalid schema: analytics`, falta exponer `analytics` en `Project Settings > API > Data API Settings > Exposed schemas`.

Si aparece `permission denied for schema analytics`, ejecutar en SQL Editor:

```text
supabase/migrations/20260803_0002_grant_analytics_api_permissions.sql
```
