# Garbiker Garbigunes

Repositorio de datos, especificaciones y aplicaciones del piloto de inteligencia operativa de Garbigunes.

## Estructura

- `apps/garbigunes-piloto/`: shell funcional del nuevo visor por ejes, con filtros comunes y conexión inicial de solo lectura a Supabase.
- `apps/legacy-dashboard/`: prototipo histórico desplegable; se conserva para consulta y compatibilidad del pipeline actual.
- `archive/`: copias locales inmutables de hitos del prototipo. No se versionan los archivos duplicados de las aplicaciones.
- `config/reference/`: CSV pequeños y editables que versionan aliases, taxonomías, equivalencias y reglas de calidad.
- `docs/axes/`: especificaciones funcionales por eje.
- `docs/reference/`: auditorías, propuesta de fuentes y modelo de datos.
- `scripts/`: pipeline ETL, validación, carga Supabase y generadores de especificaciones.
- `supabase/`: migraciones y documentación de la capa analítica.
- `config/`: catálogo de fuentes y configuraciones compartidas.

Las fuentes pesadas y backups viven fuera del repositorio en `GARBIKER_DATA_DIR` (por defecto, `../Garbiker_garbigunes_data/`). Véase `docs/reference/Almacenamiento_de_Datos.md`.

## Ejes del entregable

1. Flujos y recogidas.
2. Especialización de residuos.
3. Captación territorial.
4. Recursos y cobertura.
5. Circularidad, reservada hasta que el equipo responsable aporte datos y definición funcional.

## Estado del prototipo histórico

La aplicación actual vive en `apps/legacy-dashboard/`. Su versión de referencia se archivó localmente el 2026-08-04 y continúa publicada en la URL indicada en `archive/2026-08-04_legacy-dashboard/README.md`.

El pipeline actual sigue generando los agregados de compatibilidad para `apps/legacy-dashboard/`; el nuevo visor deberá consumir contratos de datos y vistas de Supabase definidos por eje, no heredar el frontend monolítico.

## Pipeline de datos

```bash
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/run_data_pipeline.py
```

El comando genera agregados de compatibilidad, recarga Supabase, valida conteos y registra la ejecución en `analytics.etl_load_runs`.
