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

Para la capa de calidad, flota, refuerzos y vistas genericas, ejecutar tambien:

```text
supabase/migrations/20260803_0003_quality_and_generic_views.sql
```

Esta tercera migracion crea:

- `analytics.config_quality_rules`
- `analytics.quality_aw_weight_anomalies`
- `analytics.dim_flota`
- `analytics.fact_incidencias_flota`
- `analytics.fact_refuerzos`
- vistas genericas `analytics.v_*` de bajo acoplamiento

Para normalizar el cruce de salidas con Garbigunes, ejecutar despues:

```text
supabase/migrations/20260803_0004_add_site_key_to_salidas.sql
```

Esta migracion anade `site_key` a `analytics.fact_salidas_transporte` y actualiza `analytics.v_salidas_monthly`.

Para gestionar aliases de localizaciones sin hardcodearlos en Python, ejecutar:

```text
supabase/migrations/20260803_0005_site_aliases.sql
```

Esta migracion crea `analytics.config_site_aliases` y `analytics.v_site_alias_quality`.

Para normalizar lugares de refuerzos, ejecutar:

```text
supabase/migrations/20260803_0006_refuerzos_place_keys.sql
```

Esta migracion anade `place_key`, `place_type` y `site_key` a `analytics.fact_refuerzos` y actualiza `analytics.v_refuerzos_monthly`.

Para comparar salidas transportadas con familias AW, ejecutar:

```text
supabase/migrations/20260803_0007_waste_aw_equivalences.sql
```

Esta migracion crea `analytics.config_residuos_salida_aw_equivalencias` y vistas genericas para salidas por familia AW y comparativa AW vs salidas.

Para registrar ejecuciones del pipeline de datos, ejecutar:

```text
supabase/migrations/20260803_0008_etl_load_runs.sql
```

Esta migracion crea `analytics.etl_load_runs` y las vistas `analytics.v_etl_load_runs_latest` y `analytics.v_etl_load_runs_table_counts`.

Para registrar correcciones revisadas de anomalias AW, ejecutar:

```text
supabase/migrations/20260803_0009_aw_weight_corrections.sql
```

Esta migracion crea `analytics.quality_aw_weight_corrections`, `analytics.v_aw_weight_anomalies_review` y actualiza `analytics.v_quality_summary`.

Para evitar doble conteo en equivalencias multiples, ejecutar:

```text
supabase/migrations/20260803_0010_weighted_aw_equivalences.sql
```

Esta migracion anade `allocation_weight` a `analytics.config_residuos_salida_aw_equivalencias` y actualiza las vistas AW vs salidas para usar kg ponderados. La tabla editable se carga desde `data/reference/residuos/residuos_salida_aw_equivalencias.csv`, donde `pesos_aw` debe sumar 1 por residuo de salida.

Para separar matriculas y codigos internos en incidencias, ejecutar:

```text
supabase/migrations/20260803_0011_normalize_incident_assets.sql
```

Esta migracion anade `asset_code` a `analytics.fact_incidencias_flota`, actualiza vistas de incidencias y evita que codigos internos tipo `C0392 - - -` se traten como matriculas.

Para preparar acceso desde Vercel con `anon/publishable key`, ejecutar:

```text
supabase/migrations/20260803_0012_public_rls_policies.sql
```

Esta migracion activa RLS en tablas base, revoca lectura publica amplia y expone solo tablas de configuracion seguras y vistas agregadas sin conductores, matriculas ni respuestas de cliente:

- `analytics.v_public_salidas_monthly`
- `analytics.v_public_incidencias_monthly`
- `analytics.v_public_refuerzos_monthly`
- vistas AW agregadas y vistas de calidad no sensibles

## Siguiente paso

Crear un script de carga desde los ficheros locales hacia Supabase usando la connection string o las credenciales de API del proyecto.

## Cargar datos

El flujo recomendado es usar el pipeline completo:

```bash
python3 scripts/run_data_pipeline.py
```

Este comando ejecuta build, carga Supabase y validacion, y guarda logs en:

```text
data/processed/pipeline_logs/
```

Tambien registra un resumen de la ejecucion en `analytics.etl_load_runs`: fuentes activas, ficheros fuente, tablas solicitadas, filas cargadas, resultado de validacion y rutas de los logs locales.

Para probar sin cargar Supabase:

```bash
python3 scripts/run_data_pipeline.py --load-dry-run --skip-validate
```

Para probar completamente en local sin registrar la ejecucion en Supabase:

```bash
python3 scripts/run_data_pipeline.py --skip-build --load-dry-run --skip-validate --skip-register
```

El script de carga individual sigue disponible:

```text
scripts/load_supabase_data.py
```

Necesita una clave `service_role`, no la `anon key`.

La `anon/publishable key` solo debe usarse desde el navegador para leer las vistas publicas concedidas por `20260803_0012_public_rls_policies.sql`. No usarla para cargas ni para leer tablas `fact_*`.

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
python3 scripts/load_supabase_data.py --tables dim_garbigunes dim_flota config_site_aliases config_familias_aw config_residuos_salida_aw_equivalencias config_quality_rules
```

Cargar calidad AW:

```bash
python3 scripts/load_supabase_data.py --tables quality_aw_weight_anomalies
```

Las correcciones de anomalias AW no se recargan desde ficheros locales por defecto. Se editan en Supabase en `analytics.quality_aw_weight_corrections` para no sobrescribir respuestas del cliente ni revisiones manuales.

Cargar salidas:

```bash
python3 scripts/load_supabase_data.py --tables fact_salidas_transporte
```

Si cambian `config_site_aliases`, recargar despues `fact_salidas_transporte` para que `site_key` quede actualizado.

Cargar captacion AW, que es la tabla mas grande:

```bash
python3 scripts/load_supabase_data.py --tables fact_captacion_aw --batch-size 1000
```

Cargar incidencias y refuerzos:

```bash
python3 scripts/load_supabase_data.py --tables fact_incidencias_flota fact_refuerzos
```

Si se aplica la migracion de `asset_code`, recargar despues `fact_incidencias_flota` para separar matriculas y codigos internos.

Si cambian `config_site_aliases`, recargar despues `fact_refuerzos` para actualizar `place_key`, `place_type` y `site_key`.

Validar conteos despues de cargar:

```bash
python3 scripts/validate_supabase_load.py
```

Validar cobertura y pesos de equivalencias salida -> AW:

```bash
python3 scripts/validate_aw_equivalences.py
```

Si `python3` del sistema no tiene las dependencias de Excel/ODS, usar el runtime del proyecto:

```bash
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/load_supabase_data.py
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/validate_supabase_load.py
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
