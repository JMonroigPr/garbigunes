# Dashboard Garbigunes Garbiker

Dashboard estático para analizar operaciones de garbigunes fijos y móvil, logística de recogida de residuos y captación AW en Bizkaia.

## Estructura

- `dashboard/`: aplicación HTML/CSS/JS desplegable como sitio estático.
- `scripts/build_dashboard_data.py`: genera los datos agregados y los ficheros consumidos por el dashboard.
- `data/`: estructura activa de fuentes históricas, actualizaciones y referencias.
- `config/data_sources.json`: catálogo de fuentes y política de combinación.
- `input_data/`: carpeta original recibida, mantenida como respaldo/compatibilidad.
- `documents/`: documentos de análisis y propuestas.

## Generación de datos

```bash
/Users/javiermonroig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_dashboard_data.py
```

El dashboard consume:

- `dashboard/dashboard_data.js`
- `dashboard/dashboard_records.json.gz`
- `dashboard/dashboard_records.js` como fallback local
- `dashboard/aw_capture_aggregates.json.gz`
- `dashboard/bizkaia_codigos_postales.geojson`

## Nota sobre datos pesados

`input_data/Registro detalles residuos_2026-2018.xlsx` pesa más de 100 MB y no puede subirse a GitHub con Git normal. Se mantiene excluido en `.gitignore`. Para versionarlo habría que añadir Git LFS.
