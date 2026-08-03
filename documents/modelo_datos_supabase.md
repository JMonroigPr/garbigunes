# Modelo de datos Supabase

Este documento describe la capa analitica `analytics` del proyecto Garbigunes. El objetivo es separar el modelo de datos estable de las visualizaciones actuales del dashboard, para que el entregable final pueda cambiar sin rehacer la ingestion base.

## Principios

- Las tablas `fact_*` y `dim_*` contienen datos base reutilizables.
- Las tablas `config_*` contienen reglas o taxonomias editables.
- Las tablas `quality_*` conservan incidencias de calidad para revision, sin borrar evidencias.
- Las vistas `v_*` son agregados genericos de bajo acoplamiento: sirven para dashboards, QA y exploracion, pero no representan tarjetas concretas.
- Los ficheros pesados originales permanecen en `data/raw`; Supabase guarda datos limpios o agregados adecuados para consulta.

## Fuentes

El catalogo activo esta en `config/data_sources.json`.

- Salidas transportadas: pesadas de transporte Garbigunes, historico 2023-YTD mas actualizaciones 2025/2026.
- Captacion AW: registro historico de entradas 2018-2026 con CP y municipio de origen.
- Incidencias flota: historico 2022-2026YTD mas actualizacion 2025-2026.
- Flota: inventario actualizado de vehiculos.
- Refuerzos: historico mas actualizaciones 2025/2026.
- Configuracion: familias AW, equivalencias AW y reglas de calidad.

## Tablas principales

### `analytics.fact_salidas_transporte`

Grano: un servicio/pesada de salida transportada.

Campos clave:

- `service_date`, `month_key`
- `garbigune`, `site_key`, `residuo`
- `vehicle_plate`, `driver_name`
- `base`, `route_name`
- `kg`

Uso: eficiencia operativa de salidas, conductores, vehiculos, rutas y garbigunes. `site_key` es la clave preferente para cruzar con `analytics.dim_garbigunes`; `garbigune` conserva el texto operativo de origen.

### `analytics.fact_captacion_aw`

Grano: agregado mensual AW por garbigune, CP, residuo, familia, subfamilia, usuario y unidad.

Campos clave:

- `entry_date`, `month_key`
- `garbigune`, `site_key`
- `cp`
- `residuo_aw`, `familia_aw`, `subfamilia_aw`
- `user_type`, `unit`
- `entries`, `source_rows`
- `kg`

Uso: captacion territorial AW, flujos CP a Garbigune, composicion por familia y usuario.

Nota: si una entrada AW tiene peso anomalo, la entrada se mantiene en `entries/source_rows`, pero el peso queda en cuarentena y no suma a `kg` hasta validacion.

### `analytics.dim_garbigunes`

Grano: un Garbigune o punto movil.

Campos clave:

- `site_key`, `garbigune`
- `codigo_postal`, `direccion`, `lat`, `lon`
- `es_movil`, `activo`

Uso: mapas, cruces territoriales y normalizacion de nombres.

### `analytics.config_familias_aw`

Grano: un residuo AW.

Campos clave:

- `residuo_aw`
- `familia_aw`, `subfamilia_aw`
- `descripcion_familia`, `ejemplos`, `criterio`

Uso: taxonomia editable AW.

### `analytics.config_site_aliases`

Grano: un nombre operativo o alias de localizacion.

Campos clave:

- `raw_name`: nombre tal como aparece o se normaliza desde fuentes operativas.
- `site_key`: clave normalizada objetivo.
- `site_type`: `fixed`, `mobile`, `beach`, `non_fixed`, `external`, `quality` o `review`.
- `active`, `notes`

Uso: evitar aliases hardcodeados en Python y controlar de forma editable que nombres como `AMOREBIETA ETXANO` u `ORDUNA` crucen con `dim_garbigunes`. Los puntos no equivalentes a Garbigune fijo pueden mantenerse como `non_fixed` o `review`.

### `analytics.config_residuos_salida_aw_equivalencias`

Grano: una equivalencia entre un residuo de salida transportada y una familia AW.

Campos clave:

- `residuo_salida`
- `familia_aw`
- `family_rank`
- `criterio`
- `active`

Uso: comparar entradas AW y salidas transportadas por familias de residuo sin hardcodear la relacion en Python ni en el frontend. Un residuo de salida puede mapear a varias familias AW; `family_rank` conserva el orden/criterio del CSV editable.

### `analytics.etl_load_runs`

Grano: una ejecucion del pipeline local de datos.

Campos clave:

- `run_id`, `started_at`, `finished_at`, `status`
- `tables_requested`
- `load_counts`
- `validation`
- `coverage`, `active_sources`, `source_files`
- `log_json_path`, `log_markdown_path`
- `error_message`

Uso: trazabilidad de cargas. Permite saber que fuentes se usaron, cuantas filas se cargaron por tabla y si la validacion post-carga termino correctamente. Los logs completos permanecen en `data/processed/pipeline_logs/`; Supabase conserva el resumen consultable.

## Nuevas tablas de calidad y recursos

### `analytics.config_quality_rules`

Grano: una regla de calidad editable.

Campos clave:

- `rule_key`
- `domain`, `metric`
- `severity`
- `threshold_value`, `threshold_unit`
- `action`, `description`, `active`

Uso: centralizar umbrales y criterios de revision sin hardcodearlos en visualizaciones.

### `analytics.quality_aw_weight_anomalies`

Grano: una entrada AW con peso individual en revision.

Campos clave:

- `source_file`, `source_sheet`, `source_row`
- `anomaly_date`, `garbigune`, `site_key`
- `residuo_aw`, `familia_aw`, `subfamilia_aw`
- `user_type`, `origin_municipality`, `account_municipality`, `cp`, `unit`
- `original_kg`, `validated_kg`, `threshold_kg`
- `reason`, `client_question`, `proposed_action`
- `review_status`, `client_response`, `reviewed_at`

Uso: preparar preguntas al cliente y corregir pesos sin perder entradas.

### `analytics.quality_aw_weight_corrections`

Grano: una correccion validada para una anomalia AW.

Campos clave:

- `anomaly_id`
- `original_kg`
- `corrected_kg`
- `client_response`
- `reviewed_by`, `reviewed_at`
- `correction_status`
- `notes`

Uso: registrar el flujo de correccion sin modificar ni borrar la anomalia original. Esta tabla se edita en Supabase y no forma parte de las recargas masivas por defecto, para evitar perder respuestas del cliente o revisiones manuales.

### `analytics.dim_flota`

Grano: un vehiculo.

Campos clave:

- `vehicle_plate`
- `brand`, `model`, `fuel`
- `center`, `service`
- `registration_date`, `observations`

Uso: contexto de vehiculos para salidas e incidencias.

### `analytics.fact_incidencias_flota`

Grano: una incidencia de flota.

Campos clave:

- `incident_date`, `month_key`, `year`
- `area`, `center`
- `vehicle_plate`, `vehicle_description`
- `provider`
- `breakdown_type`, `breakdown_subgroup`, `breakdown_subsubgroup`
- `amount`, `amount_without_vat`
- `is_garbigunes_scope`

Uso: analisis de incidencias y talleres. Se carga todo el fichero y se marca si pertenece al ambito Garbigunes.

### `analytics.fact_refuerzos`

Grano: un refuerzo/cobertura.

Campos clave:

- `reinforcement_date`, `month_key`, `year`
- `covered_by`
- `place`, `place_key`, `place_type`, `site_key`
- `reason`
- `author`, `notes`

Uso: presion de recursos y coberturas. `place_key` permite agrupar Garbigunes, bases, móvil y otros puntos; `site_key` solo se informa cuando el lugar cruza con `analytics.dim_garbigunes`.

## Vistas genericas

- `analytics.v_salidas_monthly`: salidas por mes y dimensiones operativas.
- `analytics.v_aw_monthly`: captacion AW por mes y dimensiones territoriales/residuo.
- `analytics.v_aw_cp_flows`: flujos CP a Garbigune por mes y familia/subfamilia.
- `analytics.v_incidencias_monthly`: incidencias por mes, vehiculo, proveedor y tipo de averia.
- `analytics.v_refuerzos_monthly`: refuerzos por mes, lugar, motivo y persona.
- `analytics.v_vehicle_monthly_context`: salidas e incidencias mensuales por vehiculo.
- `analytics.v_quality_summary`: reglas activas y resumen de anomalias pendientes.
- `analytics.v_aw_weight_anomalies_review`: anomalias AW enriquecidas con correccion, `effective_kg` y estado efectivo de revision.
- `analytics.v_site_alias_quality`: comprueba si cada alias cruza con `dim_garbigunes`.
- `analytics.v_salidas_aw_family_monthly`: salidas transportadas agregadas por familia AW equivalente.
- `analytics.v_aw_vs_salidas_family_monthly`: comparativa mensual generica AW vs salidas por `site_key` y familia AW.
- `analytics.v_residuos_salida_aw_equivalence_quality`: cobertura de residuos de salida en la tabla de equivalencias.
- `analytics.v_etl_load_runs_latest`: ultimas ejecuciones del pipeline con fuentes, estado y rutas de logs.
- `analytics.v_etl_load_runs_table_counts`: historico de filas cargadas por tabla y ejecucion.

Estas vistas son deliberadamente genericas. Las vistas especificas para tarjetas del dashboard final deberian crearse solo cuando se cierre el diseno del entregable.

## Flujo recomendado

1. Actualizar ficheros en `data/raw` o `data/reference`.
2. Regenerar artefactos compactos:

```bash
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_dashboard_data.py
```

3. Cargar Supabase:

```bash
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/run_data_pipeline.py
```

El pipeline ejecuta build, carga y validacion, y guarda logs en `data/processed/pipeline_logs/`.
Tambien inserta un resumen auditable en `analytics.etl_load_runs`.

4. Si se quiere validar manualmente:

```bash
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/validate_supabase_load.py
```

5. Publicar Vercel si cambian artefactos del dashboard.
