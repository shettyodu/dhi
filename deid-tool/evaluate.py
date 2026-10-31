#!/usr/bin/env python3
"""
Asset Data Group — evaluation rubric.

Scores a dataset on a consistent set of commercial factors so every opportunity is
assessed the same way. Some factors are measured from the data (volume, history,
breadth, completeness); the judgment factors (uniqueness, rights, demand) are inputs.
Produces a weighted 0-100 score, an A/B/C tier, and an illustrative value band grounded
in the real operational-data market (~$100k-$2M). It is a prioritization heuristic, not
a quote or a guarantee.

    python3 evaluate.py -i cleaned.csv --report report.json \
        --uniqueness high --rights owns --demand medium
"""

import argparse
import json
import os
import sys

import dsstats

WEIGHTS = {
    "volume": 0.20, "history": 0.12, "breadth": 0.15, "quality": 0.13,
    "uniqueness": 0.18, "rights": 0.10, "compliance": 0.07, "demand": 0.05,
}
LABELS = {
    "volume": "Volume", "history": "History depth", "breadth": "Breadth & structure",
    "quality": "Completeness", "uniqueness": "Uniqueness / specificity",
    "rights": "Rights clarity", "compliance": "Compliance readiness", "demand": "Market demand",
}
CHOICE = {
    "uniqueness": {"low": 35, "medium": 65, "high": 90},
    "demand": {"low": 40, "medium": 65, "high": 90},
    "rights": {"unclear": 20, "partial": 55, "owns": 90},
}
DEFAULTS = {"uniqueness": "medium", "demand": "medium", "rights": "partial"}


def _step(x, bands):
    for thr, sc in bands:
        if x <= thr:
            return sc
    return bands[-1][1]


def _score_factors(stats, report, inputs):
    recs = stats.get("records", 0)
    vol = _step(recs, [(1000, 25), (10000, 45), (100000, 65), (1000000, 82), (float("inf"), 95)])

    temporal = stats.get("temporal", [])
    span = (max(t[2] for t in temporal) - min(t[1] for t in temporal) + 1) if temporal else 0
    hist = _step(span, [(1, 30), (3, 50), (6, 70), (10, 85), (float("inf"), 95)]) if span else 30

    nf = stats.get("n_columns", 0)
    fieldsc = _step(nf, [(4, 35), (10, 58), (20, 76), (float("inf"), 90)])
    cols = stats.get("columns", [])
    avgfill = round(sum(c["fill"] for c in cols) / max(1, len(cols)))
    breadth = round((fieldsc + avgfill) / 2)
    quality = avgfill

    uniq = CHOICE["uniqueness"][inputs.get("uniqueness", DEFAULTS["uniqueness"])]
    demand = CHOICE["demand"][inputs.get("demand", DEFAULTS["demand"])]
    rights = CHOICE["rights"][inputs.get("rights", DEFAULTS["rights"])]

    comp = 70
    if report:
        plan = report.get("columns", {})
        sensitive = sum(1 for s in plan.values() if s.get("action") in ("redact", "hash", "mask", "generalize_zip"))
        ft = 1 if sum(report.get("freetext_counts", {}).values()) else 0
        comp = _step(sensitive + ft, [(1, 88), (3, 75), (6, 62), (float("inf"), 50)])

    return {"volume": vol, "history": hist, "breadth": breadth, "quality": quality,
            "uniqueness": uniq, "rights": rights, "compliance": comp, "demand": demand}


def _tier(overall):
    return "A" if overall >= 75 else "B" if overall >= 55 else "C"


def _value_band(overall):
    return _step(overall, [(44, "$75k – $200k"), (59, "$150k – $350k"), (74, "$250k – $600k"),
                           (84, "$450k – $1.0M"), (float("inf"), "$800k – $1.8M")])


def evaluate_dataset(stats, report=None, inputs=None):
    inputs = inputs or {}
    f = _score_factors(stats, report, inputs)
    overall = round(sum(f[k] * WEIGHTS[k] for k in WEIGHTS))
    return {
        "factors": [{"key": k, "label": LABELS[k], "score": f[k], "weight": WEIGHTS[k]} for k in WEIGHTS],
        "overall": overall, "tier": _tier(overall), "valueBand": _value_band(overall),
        "inputs": {k: inputs.get(k, DEFAULTS[k]) for k in DEFAULTS},
        "disclaimer": ("Illustrative score and value band, grounded in the real operational-data "
                       "market (~$100k-$2M). Not a quote or a guarantee; actual value depends on "
                       "verified rights, demand, and buyer diligence."),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Score a dataset on the ADG evaluation rubric")
    ap.add_argument("--input", "-i", required=True, help="dataset CSV (cleaned or raw)")
    ap.add_argument("--report", help="deid audit report .json (feeds compliance-readiness)")
    ap.add_argument("--uniqueness", choices=["low", "medium", "high"], default="medium")
    ap.add_argument("--rights", choices=["unclear", "partial", "owns"], default="partial")
    ap.add_argument("--demand", choices=["low", "medium", "high"], default="medium")
    ap.add_argument("--json", dest="json_out", help="write the result JSON to this path")
    ap.add_argument("--tsv", action="store_true")
    args = ap.parse_args(argv)

    if not os.path.isfile(args.input):
        ap.error("input not found: %s" % args.input)
    headers, rows = dsstats.read_csv(args.input, "\t" if args.tsv else ",")
    stats = dsstats.analyze(headers, rows)
    report = None
    if args.report and os.path.isfile(args.report):
        with open(args.report, encoding="utf-8") as f:
            report = json.load(f)
    result = evaluate_dataset(stats, report, {"uniqueness": args.uniqueness, "rights": args.rights, "demand": args.demand})

    lines = ["ASSET DATA GROUP — EVALUATION", "=" * 32,
             "Overall score: %d / 100   (Tier %s)" % (result["overall"], result["tier"]),
             "Illustrative value: %s" % result["valueBand"], "", "Factors:"]
    for fa in result["factors"]:
        bar = "#" * round(fa["score"] / 5)
        lines.append("  %-26s %3d  %-20s (w %.0f%%)" % (fa["label"], fa["score"], bar, fa["weight"] * 100))
    lines += ["", result["disclaimer"]]
    sys.stderr.write("\n".join(lines) + "\n")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
