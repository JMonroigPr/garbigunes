# Almacenamiento de datos

El repositorio `Garbiker_garbigunes` contiene código, documentación, migraciones y configuraciones ligeras. Las fuentes originales, copias de recepción, geodatos pesados y artefactos derivados se mantienen fuera del repositorio.

## Raíz externa

La raíz por defecto es la carpeta hermana:

```text
../Garbiker_garbigunes_data/
```

Puede cambiarse con la variable de entorno `GARBIKER_DATA_DIR`.

```text
Garbiker_garbigunes_data/
├── raw/          fuentes activas: histórico y actualizaciones
├── incoming/     copia inmutable de carpetas recibidas originalmente
├── archive/      backups previos de fuentes
├── reference/    geodatos y documentos de referencia no versionables
└── processed/    anomalías, controles de calidad y logs del pipeline
```

## Datos que permanecen en Git

- `config/reference/`: CSV pequeños, editables y versionables: aliases de puntos, ubicaciones, familias AW, equivalencias y reglas de calidad.
- `config/data_sources.json`: catálogo que resuelve cada fuente externa o configuración interna.
- `supabase/`: modelo, migraciones y reglas de acceso.

Supabase es la capa de consulta analítica. La raíz externa conserva los originales para trazabilidad, recargas y auditoría; no debe desplegarse en Vercel ni subirse a GitHub.
