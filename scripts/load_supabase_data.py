from __future__ import annotations

import argparse
import csv
import gzip
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
INPUT = ROOT / "input_data"
DASHBOARD = ROOT / "dashboard"
DATA_SOURCE_CONFIG = ROOT / "config" / "data_sources.json"
DATA_SOURCES = json.loads(DATA_SOURCE_CONFIG.read_text(encoding="utf-8"))["sources"] if DATA_SOURCE_CONFIG.exists() else {}

DEFAULT_SCHEMA = "analytics"
DEFAULT_BATCH_SIZE = 1000
POSTGRES_NUMERIC_14_3_LIMIT = 100_000_000_000

TABLE_ORDER = (
    "dim_garbigunes",
    "dim_flota",
    "config_site_aliases",
    "config_familias_aw",
    "config_quality_rules",
    "quality_aw_weight_anomalies",
    "fact_salidas_transporte",
    "fact_captacion_aw",
    "fact_incidencias_flota",
    "fact_refuerzos",
)

TABLE_DELETE_FILTERS = {
    "dim_garbigunes": "site_key=not.is.null",
    "dim_flota": "vehicle_plate=not.is.null",
    "config_site_aliases": "raw_name=not.is.null",
    "config_familias_aw": "residuo_aw=not.is.null",
    "config_quality_rules": "rule_key=not.is.null",
    "quality_aw_weight_anomalies": "id=not.is.null",
    "fact_salidas_transporte": "id=not.is.null",
    "fact_captacion_aw": "id=not.is.null",
    "fact_incidencias_flota": "id=not.is.null",
    "fact_refuerzos": "id=not.is.null",
}


def config_path(domain: str, key: str, fallback: Path) -> Path:
    value = DATA_SOURCES.get(domain, {}).get(key)
    return ROOT / value if value else fallback


GARBIKUNE_LOCATIONS_INPUT = config_path("garbigune_locations", "current", INPUT / "garbigunes_ubicaciones.csv")
SITE_ALIASES_INPUT = config_path("site_aliases", "current", ROOT / "data" / "reference" / "garbigunes" / "site_aliases.csv")
AW_FAMILIES_INPUT = config_path("aw_families", "current", INPUT / "residuos_aw_familias.csv")
QUALITY_RULES_INPUT = config_path("quality_rules", "current", ROOT / "data" / "reference" / "quality" / "quality_rules.csv")
AW_WEIGHT_ANOMALIES_INPUT = config_path("aw_weight_anomalies", "current", ROOT / "data" / "processed" / "quality" / "aw_weight_anomalies.csv")


class SupabaseError(RuntimeError):
    pass


def log(message: str) -> None:
    print(message, flush=True)


def read_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SupabaseError(f"Missing required environment variable: {name}")
    return value


def chunks(rows: Iterable[dict[str, Any]], batch_size: int) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def clean_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "si", "s"}


def clean_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return float(text.replace(",", "."))


def clean_int(value: Any) -> int:
    if value is None or value == "":
        return 0
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return 0
    return int(float(text.replace(",", ".")))


def clean_kg(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def clean_optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        text = str(value).strip()
        if not text or text.lower() == "nan":
            return None
        if "," in text:
            return float(text.replace(".", "").replace(",", "."))
        return float(text)
    except (TypeError, ValueError):
        return None


def build_helpers():
    try:
        from scripts import build_dashboard_data as helpers
    except ModuleNotFoundError as error:
        raise SupabaseError(
            "Missing local spreadsheet dependency while reading source files. "
            "Run with the project runtime Python used for dashboard builds, or install the missing dependency."
        ) from error
    return helpers


def clean_date(value: Any) -> str | None:
    helpers = build_helpers()
    parsed = helpers.parse_single_date(value)
    return str(parsed.date()) if parsed is not None else None


def clean_month(value: Any) -> str | None:
    date_value = clean_date(value)
    return date_value[:7] if date_value else None


def read_csv_dicts(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def read_gzip_json(path: Path) -> dict[str, Any]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def iter_dim_garbigunes() -> Iterator[dict[str, Any]]:
    path = GARBIKUNE_LOCATIONS_INPUT
    for row in read_csv_dicts(path):
        site_key = clean_text(row.get("site_key")) or clean_text(row.get("garbigune"))
        if not site_key:
            continue
        yield {
            "site_key": site_key,
            "garbigune": clean_text(row.get("garbigune")) or site_key,
            "codigo_postal": clean_text(row.get("codigo_postal")),
            "direccion": clean_text(row.get("direccion")),
            "lat": clean_float(row.get("lat")),
            "lon": clean_float(row.get("lon")),
            "fuente": clean_text(row.get("fuente")),
            "es_movil": "MOVIL" in site_key.upper() or "MOVIL" in (row.get("garbigune") or "").upper(),
            "activo": True,
        }


def iter_config_familias_aw() -> Iterator[dict[str, Any]]:
    path = AW_FAMILIES_INPUT
    for row in read_csv_dicts(path):
        residuo_aw = clean_text(row.get("residuo_aw"))
        if not residuo_aw:
            continue
        yield {
            "residuo_aw": residuo_aw,
            "familia_aw": clean_text(row.get("familia_aw")) or "SIN FAMILIA",
            "subfamilia_aw": clean_text(row.get("subfamilia_aw")) or "SIN SUBFAMILIA",
            "descripcion_familia": clean_text(row.get("descripcion_familia")),
            "ejemplos": clean_text(row.get("ejemplos")),
            "criterio": clean_text(row.get("criterio")),
            "activo": True,
        }


def iter_config_site_aliases() -> Iterator[dict[str, Any]]:
    for row in read_csv_dicts(SITE_ALIASES_INPUT):
        raw_name = clean_text(row.get("raw_name"))
        site_key = clean_text(row.get("site_key"))
        if not raw_name or not site_key:
            continue
        yield {
            "raw_name": raw_name.upper(),
            "site_key": site_key.upper(),
            "site_type": clean_text(row.get("site_type")) or "fixed",
            "active": clean_bool(row.get("active")),
            "notes": clean_text(row.get("notes")),
        }


def iter_config_quality_rules() -> Iterator[dict[str, Any]]:
    for row in read_csv_dicts(QUALITY_RULES_INPUT):
        rule_key = clean_text(row.get("rule_key"))
        if not rule_key:
            continue
        yield {
            "rule_key": rule_key,
            "domain": clean_text(row.get("domain")) or "general",
            "metric": clean_text(row.get("metric")) or rule_key,
            "severity": clean_text(row.get("severity")) or "warning",
            "threshold_value": clean_optional_float(row.get("threshold_value")),
            "threshold_unit": clean_text(row.get("threshold_unit")),
            "action": clean_text(row.get("action")),
            "description": clean_text(row.get("description")),
            "active": clean_bool(row.get("active")),
        }


def iter_quality_aw_weight_anomalies() -> Iterator[dict[str, Any]]:
    for row in read_csv_dicts(AW_WEIGHT_ANOMALIES_INPUT):
        yield {
            "source_file": clean_text(row.get("source_file")) or "unknown",
            "source_sheet": clean_text(row.get("source_sheet")),
            "source_row": clean_int(row.get("source_row")),
            "anomaly_date": clean_text(row.get("fecha")),
            "garbigune": clean_text(row.get("garbigune")),
            "site_key": clean_text(row.get("site_key")),
            "residuo_aw": clean_text(row.get("residuo_aw")),
            "familia_aw": clean_text(row.get("familia_aw")),
            "subfamilia_aw": clean_text(row.get("subfamilia_aw")),
            "user_type": clean_text(row.get("tipo_usuario")),
            "origin_municipality": clean_text(row.get("municipio_origen")),
            "account_municipality": clean_text(row.get("municipio_cuenta")),
            "cp": clean_text(row.get("cp")),
            "unit": clean_text(row.get("unidad")),
            "original_kg": clean_kg(row.get("peso_original_kg")),
            "validated_kg": clean_kg(row.get("peso_validado_kg")),
            "threshold_kg": clean_kg(row.get("umbral_kg")),
            "reason": clean_text(row.get("motivo")),
            "client_question": clean_text(row.get("pregunta_cliente")),
            "proposed_action": clean_text(row.get("accion_propuesta")),
            "review_status": "pending",
        }


def iter_dim_flota() -> Iterator[dict[str, Any]]:
    helpers = build_helpers()
    source = helpers.preferred_existing(helpers.FLOTA_UPDATED_INPUT, helpers.FLOTA_INPUT)
    frame = helpers.read_ods(source)
    for _, row in frame.iterrows():
        plate = helpers.clean_key(row.get("Matrícula"))
        if not plate:
            continue
        yield {
            "vehicle_plate": plate,
            "brand": clean_text(row.get("Marca")),
            "model": clean_text(row.get("Modelo")),
            "fuel": clean_text(row.get("COMBUSTIBLE")),
            "center": clean_text(row.get("Centro")),
            "service": clean_text(row.get("Servicio")),
            "registration_date": clean_date(row.get("Fecha matriculación")),
            "observations": clean_text(row.get("Observaciones")),
            "source_file": str(source.relative_to(ROOT)),
            "active": True,
        }


def iter_fact_salidas_transporte() -> Iterator[dict[str, Any]]:
    helpers = build_helpers()
    path = DASHBOARD / "dashboard_records.json.gz"
    payload = read_gzip_json(path)
    for row in payload.get("records", {}).get("pesadas", []):
        service_date = clean_text(row.get("date"))
        garbigune = clean_text(row.get("site")) or "SIN GARBIGUNE"
        residuo = clean_text(row.get("waste"))
        if not service_date or not residuo:
            continue
        yield {
            "service_date": service_date,
            "month_key": clean_text(row.get("month")) or service_date[:7],
            "garbigune": garbigune,
            "site_key": helpers.normalize_site(garbigune),
            "residuo": residuo,
            "vehicle_plate": clean_text(row.get("vehicle")),
            "driver_name": clean_text(row.get("driver")),
            "base": clean_text(row.get("base")),
            "route_name": clean_text(row.get("route")),
            "kg": clean_kg(row.get("kg")),
            "source_file": path.name,
        }


def iter_fact_captacion_aw() -> Iterator[dict[str, Any]]:
    path = DASHBOARD / "aw_capture_aggregates.json.gz"
    payload = read_gzip_json(path)
    for row in payload.get("records", []):
        entry_date = clean_text(row.get("date"))
        garbigune = clean_text(row.get("site")) or "SIN GARBIGUNE"
        residuo_aw = clean_text(row.get("waste"))
        if not entry_date or not residuo_aw:
            continue
        yield {
            "entry_date": entry_date,
            "month_key": clean_text(row.get("month")) or entry_date[:7],
            "garbigune": garbigune,
            "site_key": clean_text(row.get("site_key")),
            "residuo_aw": residuo_aw,
            "familia_aw": clean_text(row.get("waste_family")) or "SIN FAMILIA",
            "subfamilia_aw": clean_text(row.get("waste_subfamily")) or "SIN SUBFAMILIA",
            "user_type": clean_text(row.get("user_type")),
            "origin_municipality": clean_text(row.get("origin_municipality")),
            "account_municipality": clean_text(row.get("account_municipality")),
            "cp": clean_text(row.get("cp")),
            "unit": clean_text(row.get("unit")),
            "site_has_location": clean_bool(row.get("site_has_location")),
            "kg": clean_kg(row.get("kg")),
            "source_rows": clean_int(row.get("rows")),
            "entries": clean_int(row.get("entries")),
            "source_file": path.name,
        }


def iter_fact_incidencias_flota() -> Iterator[dict[str, Any]]:
    helpers = build_helpers()
    frame, sources = helpers.read_incidencias_sources()
    source_file = " + ".join(str(path.relative_to(ROOT)) for path in sources)
    for _, row in frame.iterrows():
        incident_date = clean_date(row.get("Fecha"))
        area = helpers.clean_key(row.get("Area"))
        vehicle_description = helpers.clean_key(row.get("Vehículo/maquinaria"))
        if not incident_date and not area and not vehicle_description:
            continue
        yield {
            "incident_date": incident_date,
            "month_key": clean_month(row.get("Fecha")),
            "year": clean_int(row.get("Año")),
            "area": clean_text(area),
            "center": clean_text(row.get("Centro")),
            "vehicle_plate": helpers.extract_vehicle_plate(row.get("Vehículo/maquinaria")),
            "vehicle_description": clean_text(vehicle_description),
            "fuel": clean_text(row.get("Combustible")),
            "provider": clean_text(row.get("Proveedor")),
            "breakdown_type": clean_text(row.get("Tipo avería")),
            "breakdown_subgroup": clean_text(row.get("subgrupo avería")),
            "breakdown_subsubgroup": clean_text(row.get("Sub-subgrupo avería")),
            "amount": clean_optional_float(row.get("Importe")),
            "amount_without_vat": clean_optional_float(row.get("Importe sin IVA")),
            "incident_code": clean_text(row.get("Código")),
            "delivery_note": clean_text(row.get("Nº Albaran")),
            "warranty": clean_text(row.get("Garantía")),
            "warranty_end_date": clean_date(row.get("Fecha fin de garantia")),
            "status": clean_text(row.get("Estado")),
            "has_invoice": clean_text(row.get("¿Tiene facturas?")),
            "framework_agreement": clean_text(row.get("Acuerdo marco")),
            "lot": clean_text(row.get("Lote")),
            "is_garbigunes_scope": "GARBIGUNES" in area.upper(),
            "source_file": source_file,
        }


def iter_fact_refuerzos() -> Iterator[dict[str, Any]]:
    helpers = build_helpers()
    frame, sources = helpers.read_refuerzos_sources()
    source_file = " + ".join(str(path.relative_to(ROOT)) for path in sources)
    for _, row in frame.iterrows():
        reinforcement_date = clean_date(row.get("Fecha"))
        place = helpers.clean_key(row.get("Lugar"))
        if not reinforcement_date and not place:
            continue
        year_value = clean_int(row.get("Año"))
        if not year_value and reinforcement_date:
            year_value = int(reinforcement_date[:4])
        yield {
            "reinforcement_date": reinforcement_date,
            "month_key": clean_month(row.get("Fecha")),
            "year": year_value,
            "covered_by": clean_text(row.get("Cubierta por")),
            "place": clean_text(place),
            "reason": clean_text(row.get("Motivo")),
            "author": clean_text(row.get("Autor registro")),
            "notes": clean_text(row.get("Observaciones")),
            "source_file": source_file,
        }


TABLE_LOADERS = {
    "dim_garbigunes": iter_dim_garbigunes,
    "dim_flota": iter_dim_flota,
    "config_site_aliases": iter_config_site_aliases,
    "config_familias_aw": iter_config_familias_aw,
    "config_quality_rules": iter_config_quality_rules,
    "quality_aw_weight_anomalies": iter_quality_aw_weight_anomalies,
    "fact_salidas_transporte": iter_fact_salidas_transporte,
    "fact_captacion_aw": iter_fact_captacion_aw,
    "fact_incidencias_flota": iter_fact_incidencias_flota,
    "fact_refuerzos": iter_fact_refuerzos,
}


def validate_batch(table: str, batch: list[dict[str, Any]], inserted: int) -> None:
    if table not in {"fact_salidas_transporte", "fact_captacion_aw"}:
        return
    for offset, row in enumerate(batch, start=1):
        kg = float(row.get("kg") or 0)
        if abs(kg) >= POSTGRES_NUMERIC_14_3_LIMIT:
            position = inserted + offset
            context = {
                key: row.get(key)
                for key in ("entry_date", "service_date", "garbigune", "residuo", "residuo_aw", "cp", "unit", "kg")
                if key in row
            }
            raise SupabaseError(
                f"{table}: row {position:,} has kg={kg:,.3f}, outside numeric(14,3). "
                f"Context: {context}"
            )


class SupabaseRestClient:
    def __init__(self, url: str, service_role_key: str, schema: str) -> None:
        self.url = url.rstrip("/")
        self.schema = schema
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Profile": schema,
            "Content-Profile": schema,
            "Prefer": "return=minimal",
        }

    def request(self, method: str, path: str, body: Any | None = None) -> tuple[int, str]:
        encoded_body = None if body is None else json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(
            f"{self.url}/rest/v1/{path}",
            data=encoded_body,
            headers=self.headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.status, response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            hint = ""
            if error.code in {404, 406} and self.schema not in {"public"}:
                hint = f" Ensure schema '{self.schema}' is exposed in Supabase API settings."
            raise SupabaseError(f"{method} {path} failed with HTTP {error.code}: {detail}{hint}") from error
        except urllib.error.URLError as error:
            raise SupabaseError(f"{method} {path} failed: {error}") from error

    def delete_all(self, table: str) -> None:
        filter_query = TABLE_DELETE_FILTERS[table]
        self.request("DELETE", f"{table}?{filter_query}")

    def insert_batch(self, table: str, batch: list[dict[str, Any]]) -> None:
        self.request("POST", table, batch)


def count_rows(rows: Iterable[dict[str, Any]]) -> int:
    return sum(1 for _ in rows)


def load_table(
    table: str,
    client: SupabaseRestClient | None,
    batch_size: int,
    dry_run: bool,
    skip_delete: bool,
) -> None:
    loader = TABLE_LOADERS[table]
    started = time.time()

    if dry_run:
        total = count_rows(loader())
        log(f"[dry-run] {table}: {total:,} rows ready")
        return

    assert client is not None
    if not skip_delete:
        log(f"{table}: deleting existing rows")
        client.delete_all(table)

    inserted = 0
    for batch in chunks(loader(), batch_size):
        validate_batch(table, batch, inserted)
        client.insert_batch(table, batch)
        inserted += len(batch)
        if inserted % (batch_size * 10) == 0:
            elapsed = time.time() - started
            log(f"{table}: inserted {inserted:,} rows in {elapsed:,.1f}s")

    elapsed = time.time() - started
    log(f"{table}: inserted {inserted:,} rows in {elapsed:,.1f}s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load local Garbigunes dashboard data into Supabase.")
    parser.add_argument("--schema", default=DEFAULT_SCHEMA, help=f"Target Postgres schema exposed by Supabase REST. Default: {DEFAULT_SCHEMA}")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help=f"Rows per insert request. Default: {DEFAULT_BATCH_SIZE}")
    parser.add_argument("--tables", nargs="+", choices=TABLE_ORDER, default=list(TABLE_ORDER), help="Subset of tables to reload.")
    parser.add_argument("--dry-run", action="store_true", help="Read and transform files, but do not connect to Supabase.")
    parser.add_argument("--skip-delete", action="store_true", help="Append rows without deleting existing table contents.")
    parser.add_argument("--env-file", default=".env.local", help="Optional env file to read before environment variables. Default: .env.local")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.batch_size < 1:
        raise SupabaseError("--batch-size must be positive")

    read_env_file(ROOT / args.env_file)

    client = None
    if not args.dry_run:
        client = SupabaseRestClient(
            url=require_env("SUPABASE_URL"),
            service_role_key=require_env("SUPABASE_SERVICE_ROLE_KEY"),
            schema=args.schema,
        )

    for table in args.tables:
        load_table(
            table=table,
            client=client,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
            skip_delete=args.skip_delete,
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SupabaseError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
