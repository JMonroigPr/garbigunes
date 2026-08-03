from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOG_DIR = ROOT / "data" / "processed" / "pipeline_logs"
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


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_dashboard_metadata() -> dict[str, Any]:
    data_file = ROOT / "dashboard" / "dashboard_data.js"
    if not data_file.exists():
        return {}
    text = data_file.read_text(encoding="utf-8")
    match = re.search(r"window\.DASHBOARD_DATA = (.*);\s*$", text, re.S)
    if not match:
        return {}
    payload = json.loads(match.group(1))
    return {
        "generatedAt": payload.get("generatedAt"),
        "coverage": payload.get("coverage", {}),
        "activeSources": payload.get("activeSources", {}),
        "sourceFiles": payload.get("sourceFiles", []),
        "captureMeta": payload.get("capture", {}).get("meta", {}),
    }


def run_step(name: str, command: list[str]) -> dict[str, Any]:
    started = time.time()
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    elapsed = time.time() - started
    return {
        "name": name,
        "command": command,
        "returncode": result.returncode,
        "elapsedSeconds": round(elapsed, 2),
        "stdout": result.stdout,
        "stderr": result.stderr,
        "status": "ok" if result.returncode == 0 else "error",
    }


def parse_load_counts(output: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    pattern = re.compile(r"^(?:\[dry-run\]\s+)?([a-zA-Z0-9_]+): (?:inserted|)(?:\s*)?([0-9,]+) rows (?:ready|in .*)$")
    for line in output.splitlines():
        match = pattern.match(line.strip())
        if match:
            counts[match.group(1)] = int(match.group(2).replace(",", ""))
    return counts


def parse_validation(output: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    table_pattern = re.compile(r"^([a-zA-Z0-9_]+): local=([0-9,]+) supabase=([0-9,]+) ([a-z]+)$")
    view_pattern = re.compile(r"^([a-zA-Z0-9_]+): rows=([0-9,]+) ([a-z]+)$")
    for line in output.splitlines():
        clean = line.strip()
        table_match = table_pattern.match(clean)
        if table_match:
            rows.append(
                {
                    "relation": table_match.group(1),
                    "kind": "table",
                    "local": int(table_match.group(2).replace(",", "")),
                    "supabase": int(table_match.group(3).replace(",", "")),
                    "status": table_match.group(4),
                }
            )
            continue
        view_match = view_pattern.match(clean)
        if view_match:
            rows.append(
                {
                    "relation": view_match.group(1),
                    "kind": "view",
                    "rows": int(view_match.group(2).replace(",", "")),
                    "status": view_match.group(3),
                }
            )
    return rows


def write_markdown(log_path: Path, payload: dict[str, Any]) -> None:
    lines = [
        f"# Pipeline run {payload['runId']}",
        "",
        f"- Started: `{payload['startedAt']}`",
        f"- Finished: `{payload['finishedAt']}`",
        f"- Status: `{payload['status']}`",
        f"- Elapsed seconds: `{payload['elapsedSeconds']}`",
        "",
        "## Steps",
        "",
    ]
    for step in payload["steps"]:
        lines.extend(
            [
                f"### {step['name']}",
                "",
                f"- Status: `{step['status']}`",
                f"- Return code: `{step['returncode']}`",
                f"- Elapsed seconds: `{step['elapsedSeconds']}`",
                "",
                "```bash",
                " ".join(step["command"]),
                "```",
                "",
            ]
        )
        if step["stdout"]:
            lines.extend(["```text", step["stdout"].strip(), "```", ""])
        if step["stderr"]:
            lines.extend(["```text", step["stderr"].strip(), "```", ""])

    if payload.get("loadCounts"):
        lines.extend(["## Load Counts", ""])
        for table, count in payload["loadCounts"].items():
            lines.append(f"- `{table}`: {count:,}")
        lines.append("")

    if payload.get("validation"):
        lines.extend(["## Validation", ""])
        for item in payload["validation"]:
            if item["kind"] == "table":
                lines.append(f"- `{item['relation']}`: local {item['local']:,}, Supabase {item['supabase']:,}, `{item['status']}`")
            else:
                lines.append(f"- `{item['relation']}`: {item['rows']:,} rows, `{item['status']}`")
        lines.append("")

    metadata = payload.get("dashboardMetadata", {})
    if metadata.get("coverage"):
        lines.extend(["## Coverage", ""])
        for key, value in metadata["coverage"].items():
            lines.append(f"- `{key}`: {value}")
        lines.append("")

    if metadata.get("activeSources"):
        lines.extend(["## Active Sources", ""])
        for key, value in metadata["activeSources"].items():
            lines.append(f"- `{key}`: {value}")
        lines.append("")

    log_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Garbigunes data build, Supabase load and validation as one logged pipeline.")
    parser.add_argument("--tables", nargs="+", default=list(DEFAULT_TABLES), help="Tables to load and validate. Defaults to all pipeline tables.")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--schema", default="analytics")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--log-dir", default=str(DEFAULT_LOG_DIR))
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--skip-load", action="store_true")
    parser.add_argument("--skip-validate", action="store_true")
    parser.add_argument("--load-dry-run", action="store_true", help="Run load_supabase_data.py with --dry-run.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    payload: dict[str, Any] = {
        "runId": run_id,
        "startedAt": now_iso(),
        "finishedAt": None,
        "status": "running",
        "elapsedSeconds": None,
        "options": vars(args),
        "steps": [],
        "loadCounts": {},
        "validation": [],
        "dashboardMetadata": {},
        "dataSources": load_json(ROOT / "config" / "data_sources.json"),
    }

    python = sys.executable
    steps: list[tuple[str, list[str]]] = []
    if not args.skip_build:
        steps.append(("build_dashboard_data", [python, "scripts/build_dashboard_data.py"]))
    if not args.skip_load:
        command = [
            python,
            "scripts/load_supabase_data.py",
            "--schema",
            args.schema,
            "--env-file",
            args.env_file,
            "--batch-size",
            str(args.batch_size),
            "--tables",
            *args.tables,
        ]
        if args.load_dry_run:
            command.append("--dry-run")
        steps.append(("load_supabase_data", command))
    if not args.skip_validate:
        steps.append(
            (
                "validate_supabase_load",
                [
                    python,
                    "scripts/validate_supabase_load.py",
                    "--schema",
                    args.schema,
                    "--env-file",
                    args.env_file,
                    "--tables",
                    *args.tables,
                ],
            )
        )

    status = "ok"
    for name, command in steps:
        step = run_step(name, command)
        payload["steps"].append(step)
        if name == "load_supabase_data":
            payload["loadCounts"] = parse_load_counts(step["stdout"])
        if name == "validate_supabase_load":
            payload["validation"] = parse_validation(step["stdout"])
        if step["returncode"] != 0:
            status = "error"
            break

    payload["dashboardMetadata"] = read_dashboard_metadata()
    payload["finishedAt"] = now_iso()
    payload["elapsedSeconds"] = round(time.time() - started, 2)
    payload["status"] = status

    json_path = log_dir / f"{run_id}_pipeline.json"
    md_path = log_dir / f"{run_id}_pipeline.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(md_path, payload)

    print(f"Pipeline status: {status}")
    print(f"JSON log: {json_path.relative_to(ROOT)}")
    print(f"Markdown log: {md_path.relative_to(ROOT)}")
    return 0 if status == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
