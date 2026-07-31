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

## Siguiente paso

Crear un script de carga desde los ficheros locales hacia Supabase usando la connection string o las credenciales de API del proyecto.
