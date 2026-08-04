# Scripts

- `run_data_pipeline.py`: ejecución completa de build de compatibilidad, carga, validación y registro ETL.
- `build_dashboard_data.py`: generador de agregados para `apps/legacy-dashboard/`.
- `load_supabase_data.py`: carga por lotes hacia Supabase.
- `validate_supabase_load.py`: contraste de conteos locales, tablas y vistas.
- `validate_aw_equivalences.py`: control de equivalencias entre residuos de salida y familias AW.
- `generate_*_spec_pdf.py`: generadores reproducibles de especificaciones por eje en `docs/axes/`.

Los scripts de datos mantienen compatibilidad con el prototipo mientras se construye la nueva aplicación en `apps/garbigunes-piloto/`. Las fuentes pesadas se resuelven desde `GARBIKER_DATA_DIR`, fuera del repositorio; los CSV editables permanecen en `config/reference/`.
