"""Rutas compartidas para fuentes externas y configuraciones versionadas."""

from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT.parent / "Garbiker_garbigunes_data"


def external_data_root() -> Path:
    """Devuelve la raíz local de datos pesados, fuera del repositorio."""
    configured = os.environ.get("GARBIKER_DATA_DIR", "").strip()
    path = Path(configured).expanduser() if configured else DEFAULT_DATA_DIR
    return (ROOT / path).resolve() if not path.is_absolute() else path.resolve()


def resolve_source_path(value: str) -> Path:
    """Resuelve rutas de config: `config/` vive en Git; el resto es externo."""
    path = Path(value)
    if path.is_absolute():
        return path
    if path.parts and path.parts[0] == "config":
        return ROOT / path
    return external_data_root() / path


def path_label(path: Path) -> str:
    """Etiqueta segura y portable para logs, sin exponer rutas locales completas."""
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT))
    except ValueError:
        pass
    try:
        return f"external-data/{resolved.relative_to(external_data_root())}"
    except ValueError:
        return path.name
