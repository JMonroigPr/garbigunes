from __future__ import annotations

import csv
import gzip
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from scripts.data_paths import external_data_root, path_label

RECORDS_INPUT = ROOT / "apps" / "legacy-dashboard" / "dashboard_records.json.gz"
EQUIVALENCES_INPUT = ROOT / "config" / "reference" / "residuos" / "residuos_salida_aw_equivalencias.csv"
OUTPUT_DIR = external_data_root() / "processed" / "quality"
CSV_OUTPUT = OUTPUT_DIR / "aw_equivalence_quality.csv"
JSON_OUTPUT = OUTPUT_DIR / "aw_equivalence_quality.json"


def parse_weight(value: str) -> float | None:
    value = value.strip()
    if not value:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def read_records() -> list[dict[str, Any]]:
    with gzip.open(RECORDS_INPUT, "rt", encoding="utf-8") as handle:
        return json.load(handle)["records"]["pesadas"]


def read_equivalences() -> dict[str, dict[str, Any]]:
    equivalences: dict[str, dict[str, Any]] = {}
    with EQUIVALENCES_INPUT.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            waste = (row.get("residuo_salida") or "").strip().upper()
            families = [item.strip() for item in (row.get("familias_aw") or "").split("|") if item.strip()]
            raw_weights = [parse_weight(item) for item in (row.get("pesos_aw") or "").split("|") if item.strip()]
            if len(raw_weights) != len(families) or any(weight is None or weight <= 0 for weight in raw_weights):
                weights = [1 / len(families)] * len(families) if families else []
                weight_source = "auto_equal"
            else:
                total = sum(weight for weight in raw_weights if weight is not None)
                weights = [(weight or 0) / total for weight in raw_weights]
                weight_source = "configured"
            if waste:
                equivalences[waste] = {
                    "families": families,
                    "weights": weights,
                    "weight_source": weight_source,
                    "criterion": row.get("criterio") or "",
                }
    return equivalences


def main() -> int:
    records = read_records()
    equivalences = read_equivalences()
    by_waste: dict[str, dict[str, float | int]] = defaultdict(lambda: {"kg": 0.0, "services": 0})
    for record in records:
        waste = (record.get("waste") or "").strip().upper()
        by_waste[waste]["kg"] = float(by_waste[waste]["kg"]) + float(record.get("kg") or 0)
        by_waste[waste]["services"] = int(by_waste[waste]["services"]) + 1

    total_kg = sum(float(value["kg"]) for value in by_waste.values())
    rows: list[dict[str, Any]] = []
    for waste, value in sorted(by_waste.items(), key=lambda item: -float(item[1]["kg"])):
        equivalence = equivalences.get(waste, {"families": [], "weights": [], "weight_source": "missing", "criterion": ""})
        families = equivalence["families"]
        weights = equivalence["weights"]
        weight_sum = sum(weights)
        weight_status = "missing" if not families else "ok" if abs(weight_sum - 1) <= 0.0005 else "review_weight"
        rows.append(
            {
                "residuo_salida": waste,
                "services": int(value["services"]),
                "tons": round(float(value["kg"]) / 1000, 3),
                "share_total_pct": round(float(value["kg"]) / total_kg * 100, 4) if total_kg else 0,
                "mapped_families": len(families),
                "familias_aw": "|".join(families),
                "allocation_weights": "|".join(f"{weight:.6f}" for weight in weights),
                "weight_sum": round(weight_sum, 6),
                "weight_source": equivalence["weight_source"],
                "weight_status": weight_status,
                "unweighted_duplicate_tons": round(max(0, len(families) - 1) * float(value["kg"]) / 1000, 3),
                "criterio": equivalence["criterion"],
            }
        )

    covered_kg = sum(float(by_waste[row["residuo_salida"]]["kg"]) for row in rows if row["mapped_families"])
    duplicate_kg = sum(row["unweighted_duplicate_tons"] * 1000 for row in rows)
    payload = {
        "total_wastes": len(rows),
        "mapped_wastes": sum(1 for row in rows if row["mapped_families"]),
        "missing_wastes": [row["residuo_salida"] for row in rows if not row["mapped_families"]],
        "total_tons": round(total_kg / 1000, 3),
        "covered_tons": round(covered_kg / 1000, 3),
        "covered_pct": round(covered_kg / total_kg * 100, 4) if total_kg else 0,
        "unweighted_duplicate_tons": round(duplicate_kg / 1000, 3),
        "unweighted_duplicate_pct_total": round(duplicate_kg / total_kg * 100, 4) if total_kg else 0,
        "rows": rows,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)
    JSON_OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Mapped wastes: {payload['mapped_wastes']} of {payload['total_wastes']}")
    print(f"Coverage: {payload['covered_tons']:,.1f} t of {payload['total_tons']:,.1f} t ({payload['covered_pct']:.2f}%)")
    print(f"Missing wastes: {', '.join(payload['missing_wastes']) or 'none'}")
    print(f"Unweighted duplicate risk: {payload['unweighted_duplicate_tons']:,.1f} t ({payload['unweighted_duplicate_pct_total']:.2f}% of total)")
    print(f"Wrote {path_label(CSV_OUTPUT)}")
    print(f"Wrote {path_label(JSON_OUTPUT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
