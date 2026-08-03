from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import load_supabase_data as loader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = "analytics"

DEFAULT_TABLES = (
    "dim_garbigunes",
    "dim_flota",
    "config_site_aliases",
    "config_familias_aw",
    "config_residuos_salida_aw_equivalencias",
    "config_quality_rules",
    "quality_aw_weight_anomalies",
    "fact_salidas_transporte",
    "fact_captacion_aw",
    "fact_incidencias_flota",
    "fact_refuerzos",
)

DEFAULT_VIEWS = (
    "v_salidas_monthly",
    "v_aw_monthly",
    "v_aw_cp_flows",
    "v_incidencias_monthly",
    "v_incident_asset_code_quality",
    "v_refuerzos_monthly",
    "v_vehicle_monthly_context",
    "v_quality_summary",
    "v_aw_weight_anomalies_review",
    "v_site_alias_quality",
    "v_salidas_aw_family_monthly",
    "v_aw_vs_salidas_family_monthly",
    "v_residuos_salida_aw_equivalence_quality",
)


class ValidationError(RuntimeError):
    pass


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValidationError(f"Missing required environment variable: {name}")
    return value


def supabase_count(url: str, key: str, schema: str, relation: str) -> int:
    request = urllib.request.Request(f"{url.rstrip('/')}/rest/v1/{relation}?select=*&limit=1")
    for header, value in {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept-Profile": schema,
        "Range-Unit": "items",
        "Range": "0-0",
        "Prefer": "count=exact",
    }.items():
        request.add_header(header, value)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            content_range = response.headers.get("content-range", "")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise ValidationError(f"{relation}: HTTP {error.code}: {detail}") from error
    if "/" not in content_range:
        raise ValidationError(f"{relation}: missing content-range header")
    return int(content_range.rsplit("/", 1)[1])


def local_count(table: str) -> int:
    return sum(1 for _ in loader.TABLE_LOADERS[table]())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate local expected counts against Supabase analytics tables and generic views.")
    parser.add_argument("--schema", default=DEFAULT_SCHEMA)
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--tables", nargs="+", choices=DEFAULT_TABLES, default=list(DEFAULT_TABLES))
    parser.add_argument("--views", nargs="+", default=list(DEFAULT_VIEWS))
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    loader.read_env_file(ROOT / args.env_file)
    url = require_env("SUPABASE_URL")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")

    results: list[dict[str, Any]] = []
    ok = True
    for table in args.tables:
        expected = local_count(table)
        actual = supabase_count(url, key, args.schema, table)
        match = expected == actual
        ok = ok and match
        results.append({"relation": table, "kind": "table", "expected": expected, "actual": actual, "status": "ok" if match else "mismatch"})

    for view in args.views:
        actual = supabase_count(url, key, args.schema, view)
        results.append({"relation": view, "kind": "view", "actual": actual, "status": "ok"})

    if args.json:
        print(json.dumps({"status": "ok" if ok else "mismatch", "results": results}, ensure_ascii=False, indent=2))
    else:
        for item in results:
            if item["kind"] == "table":
                print(f"{item['relation']}: local={item['expected']:,} supabase={item['actual']:,} {item['status']}")
            else:
                print(f"{item['relation']}: rows={item['actual']:,} {item['status']}")
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
