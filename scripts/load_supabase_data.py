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
INPUT = ROOT / "input_data"
DASHBOARD = ROOT / "dashboard"

DEFAULT_SCHEMA = "analytics"
DEFAULT_BATCH_SIZE = 1000

TABLE_ORDER = (
    "dim_garbigunes",
    "config_familias_aw",
    "fact_salidas_transporte",
    "fact_captacion_aw",
)

TABLE_DELETE_FILTERS = {
    "dim_garbigunes": "site_key=not.is.null",
    "config_familias_aw": "residuo_aw=not.is.null",
    "fact_salidas_transporte": "id=not.is.null",
    "fact_captacion_aw": "id=not.is.null",
}


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
    return float(str(value).replace(",", "."))


def clean_int(value: Any) -> int:
    if value is None or value == "":
        return 0
    return int(float(value))


def clean_kg(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def read_csv_dicts(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def read_gzip_json(path: Path) -> dict[str, Any]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def iter_dim_garbigunes() -> Iterator[dict[str, Any]]:
    path = INPUT / "garbigunes_ubicaciones.csv"
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
    path = INPUT / "residuos_aw_familias.csv"
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


def iter_fact_salidas_transporte() -> Iterator[dict[str, Any]]:
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


TABLE_LOADERS = {
    "dim_garbigunes": iter_dim_garbigunes,
    "config_familias_aw": iter_config_familias_aw,
    "fact_salidas_transporte": iter_fact_salidas_transporte,
    "fact_captacion_aw": iter_fact_captacion_aw,
}


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
