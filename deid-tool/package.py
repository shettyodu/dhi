#!/usr/bin/env python3
"""
Asset Data Group — data asset package generator.

Turns a CLEANED (de-identified) dataset plus its audit report into a buyer-facing
"data asset package": a polished, self-contained HTML data-sheet (coverage stats,
a data dictionary, sample rows, and a de-identification attestation with provenance)
plus a machine-readable JSON manifest for marketplace listings.

    # first de-identify, producing the cleaned file + audit report
    python3 deid.py -i raw.csv --config plan.json -o cleaned.csv -r report

    # then package it
    python3 package.py -i cleaned.csv --report report.json -o package.html \
        --title "Field-service operational dataset" --owner "Regional distributor (anonymized)"

Standard library only. The HTML is self-contained (inline CSS, no external calls),
so it can be emailed, printed, or hosted as-is.
"""

import argparse
import csv
import html
import json
import os
import re
import sys
from datetime import datetime, timezone

from evaluate import evaluate_dataset

VERSION = "0.1.0"

ACTION_LABEL = {
    "keep": "kept", "drop": "removed", "redact": "removed",
    "mask": "masked", "hash": "tokenized (one-way)",
    "generalize_date": "generalized to year", "generalize_zip": "generalized to 3-digit ZIP",
    "scrub_text": "free-text scrubbed",
}


def read_csv(path, delim=","):
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f, delimiter=delim)
        headers = r.fieldnames or []
        rows = [{k: (v if v is not None else "") for k, v in row.items()} for row in r]
    return headers, rows


def infer_type(vals):
    if not vals:
        return "empty", ""
    s = vals[:1000]
    yr = re.compile(r"(19|20)\d{2}$")
    dt = re.compile(r"(\d{4}-\d{2}(-\d{2})?|\d{1,2}/\d{1,2}/\d{4})$")
    i = re.compile(r"-?\d+$")
    fl = re.compile(r"-?\d+(\.\d+)?$")
    if all(yr.match(v) for v in s):
        ys = [int(v) for v in s]
        return "year", "%d – %d" % (min(ys), max(ys))
    if all(dt.match(v) for v in s):
        ds = sorted(s)
        return "date", "%s – %s" % (ds[0], ds[-1])
    if all(i.match(v) for v in s):
        ns = [int(v) for v in s]
        return "integer", "%d – %d" % (min(ns), max(ns))
    if all(fl.match(v) for v in s):
        ns = [float(v) for v in s]
        return "number", "%.2f – %.2f" % (min(ns), max(ns))
    distinct = len(set(vals))
    if distinct <= 50 and distinct <= max(2, len(vals) * 0.25):
        return "categorical", "%d categories" % distinct
    avglen = sum(len(v) for v in s) / len(s)
    if avglen > 30:
        return "free text", ""
    return "identifier / code", ""


def analyze(headers, rows):
    n = len(rows)
    cols, temporal = [], []
    for h in headers:
        vals = [r.get(h, "") for r in rows]
        nonempty = [v for v in vals if v != ""]
        typ, extra = infer_type(nonempty)
        c = {
            "name": h, "type": typ, "range": extra,
            "fill": round(100 * len(nonempty) / n) if n else 0,
            "distinct": len(set(nonempty)),
            "example": (nonempty[0] if nonempty else ""),
        }
        cols.append(c)
        if typ in ("year", "date"):
            years = [int(m.group(0)) for v in nonempty for m in [re.search(r"(19|20)\d{2}", v)] if m]
            if years:
                temporal.append([h, min(years), max(years)])
    return {"records": n, "n_columns": len(headers), "columns": cols, "temporal": temporal}


def history_label(temporal):
    """A concise year span for the summary — prefer activity dates over birth dates."""
    if not temporal:
        return "—"
    act = [t for t in temporal if not re.search(r"dob|birth", t[0], re.I)] or temporal
    lo = min(t[1] for t in act)
    hi = max(t[2] for t in act)
    return str(lo) if lo == hi else "%d – %d" % (lo, hi)


def esc(s):
    return html.escape("" if s is None else str(s))


def attestation(report):
    """Build the de-identification attestation from the deid audit report (if given)."""
    if not report:
        return None
    meta = report.get("meta", {})
    plan = report.get("columns", {})
    applied = []
    for col, spec in plan.items():
        act = spec.get("action", "keep")
        if act == "keep":
            continue
        applied.append((col, ACTION_LABEL.get(act, act)))
    ft = report.get("freetext_counts", {})
    return {
        "tool_version": meta.get("tool_version", ""),
        "run_at": meta.get("run_at", ""),
        "source_sha256": meta.get("input_sha256", ""),
        "name_detection": meta.get("ner", ""),
        "applied": applied,
        "freetext": ft,
    }


def render_html(meta, stats, att):
    rows_prev = min(8, stats["records"])
    hist = history_label(stats["temporal"])

    def dict_rows():
        out = []
        for c in stats["columns"]:
            rng = esc(c["range"]) if c["range"] else '<span style="color:#94a3b8">—</span>'
            out.append(
                "<tr><td class=mono>%s</td><td>%s</td><td>%s</td><td class=num>%d%%</td><td class=num>%s</td><td class=mono>%s</td></tr>"
                % (esc(c["name"]), esc(c["type"]), rng, c["fill"], "{:,}".format(c["distinct"]), esc(c["example"][:42])))
        return "".join(out)

    def sample_table():
        hs = "".join("<th>%s</th>" % esc(c["name"]) for c in stats["columns"])
        body = ""
        for r in meta["sample"][:rows_prev]:
            body += "<tr>" + "".join("<td class=mono>%s</td>" % esc(str(r.get(c["name"], ""))[:40]) for c in stats["columns"]) + "</tr>"
        return "<thead><tr>%s</tr></thead><tbody>%s</tbody>" % (hs, body)

    att_html = ""
    if att:
        applied = "".join("<tr><td class=mono>%s</td><td>%s</td></tr>" % (esc(c), esc(a)) for c, a in att["applied"])
        ft = "".join("<span class=chip>%s · %s</span>" % (esc(k), v) for k, v in sorted(att["freetext"].items(), key=lambda x: -x[1]))
        att_html = """
        <section>
          <h2>De-identification &amp; provenance</h2>
          <p class=lead>Direct and patterned identifiers were removed, masked, tokenized, or generalized before packaging. The actions applied to each field are recorded below. A formal HIPAA Expert Determination, where required, is performed separately by a qualified expert.</p>
          <div class=meta-grid>
            <div><span class=k>Prepared with</span><span class=v>ADG de-identification tool v%s</span></div>
            <div><span class=k>Name detection</span><span class=v>%s</span></div>
            <div><span class=k>Source integrity (SHA-256)</span><span class="v mono">%s</span></div>
            <div><span class=k>Prepared (UTC)</span><span class=v>%s</span></div>
          </div>
          %s
          <table class=tbl><thead><tr><th>Field</th><th>Treatment</th></tr></thead><tbody>%s</tbody></table>
        </section>""" % (
            esc(att["tool_version"]), esc(att["name_detection"]), esc(att["source_sha256"]),
            esc(att["run_at"]),
            ('<p class=lead style="margin-top:14px"><b>Free-text redactions:</b> %s</p>' % ft) if ft else "",
            applied or "<tr><td colspan=2>No transformations recorded.</td></tr>")

    value_html = ""
    if meta.get("value"):
        value_html = '<div class=stat><div class=stat-n>%s</div><div class=stat-l>Indicative value</div></div>' % esc(meta["value"])

    overview = esc(meta.get("overview") or
                   "A de-identified operational dataset prepared by Asset Data Group for licensing to AI, analytics, and research buyers. Coverage, structure, and field-level detail are summarized below.")
    use = ('<section><h2>Suggested use</h2><p class=lead>%s</p></section>' % esc(meta["use"])) if meta.get("use") else ""

    ev = meta.get("evaluation")
    eval_html = ""
    if ev:
        bars = "".join(
            '<div class=fac><div class=fac-l>%s</div><div class=fac-bar><div class=fac-fill style="width:%d%%"></div></div><div class=fac-s>%d</div></div>'
            % (esc(f["label"]), f["score"], f["score"]) for f in ev["factors"])
        eval_html = ('<section><h2>Evaluation</h2><div class=evalhead>'
                     '<div class=score><div class=score-n>%d<span>/100</span></div><div class=score-l>Overall · Tier %s</div></div>'
                     '<div class=facs>%s</div></div><p class=fine>%s</p></section>'
                     % (ev["overall"], esc(ev["tier"]), bars, esc(ev["disclaimer"])))

    return """<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1">
<title>%(title)s — Asset Data Group data package</title>
<style>
  :root{--dc:#4f46e5;--ink:#0a2540;--mut:#64748b;--line:#e2e8f0}
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:0;background:#f1f5f9;line-height:1.5}
  .sheet{max-width:900px;margin:24px auto;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  header{padding:26px 34px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px}
  .mark{display:grid;place-items:center;height:38px;width:38px;border-radius:10px;color:#fff;font-weight:800;background:linear-gradient(135deg,#6366f1,#4f46e5)}
  .brand{font-weight:800;color:var(--ink)} .kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dc);font-weight:700}
  main{padding:26px 34px}
  h1{font-size:23px;color:var(--ink);margin:0 0 4px} .subtitle{color:var(--mut);margin:0 0 20px}
  h2{font-size:15px;color:var(--ink);margin:26px 0 8px;border-top:1px solid var(--line);padding-top:18px}
  section:first-of-type h2{border-top:0;padding-top:0}
  .lead{color:#334155;margin:0}
  .stats{display:flex;flex-wrap:wrap;gap:12px;margin:4px 0 6px}
  .stat{flex:1;min-width:150px;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .stat-n{font-size:22px;font-weight:800;color:var(--ink)} .stat-l{font-size:12px;color:var(--mut)}
  table{border-collapse:collapse;width:100%%;font-size:12.5px;margin-top:8px;display:block;overflow-x:auto}
  th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;white-space:nowrap} th{background:#f8fafc;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.03em}
  td.num,th.num{text-align:right} .mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin:12px 0}
  .meta-grid .k{display:block;font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.03em} .meta-grid .v{font-weight:600;font-size:13px;word-break:break-all}
  .chip{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;margin:2px 4px 2px 0}
  .evalhead{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-top:6px}
  .score{background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 18px;text-align:center;min-width:120px}
  .score-n{font-size:30px;font-weight:800;color:var(--dc)} .score-n span{font-size:14px;color:#818cf8}
  .score-l{font-size:12px;color:#4338ca;font-weight:700;margin-top:2px}
  .facs{flex:1;min-width:280px}
  .fac{display:flex;align-items:center;gap:10px;margin:5px 0}
  .fac-l{width:150px;font-size:12px;color:#334155} .fac-s{width:26px;text-align:right;font-size:12px;font-weight:700;color:var(--ink)}
  .fac-bar{flex:1;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden} .fac-fill{height:100%%;background:var(--dc)}
  .fine{color:#94a3b8;font-size:11px;margin-top:10px}
  footer{padding:18px 34px;border-top:1px solid var(--line);color:#94a3b8;font-size:11px;line-height:1.6}
  @media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}}
</style></head><body>
<div class=sheet>
  <header><span class=mark>A</span><div><div class=kicker>Asset Data Group · data asset package</div><div class=brand>Asset Data Group</div></div></header>
  <main>
    <section>
      <h1>%(title)s</h1>
      <p class=subtitle>%(owner)s</p>
      <div class=stats>
        <div class=stat><div class=stat-n>%(records)s</div><div class=stat-l>Records</div></div>
        <div class=stat><div class=stat-n>%(ncols)s</div><div class=stat-l>Fields</div></div>
        <div class=stat><div class=stat-n>%(hist)s</div><div class=stat-l>History</div></div>
        %(value)s
      </div>
      <p class=lead style="margin-top:12px">%(overview)s</p>
    </section>
    %(use)s
    %(eval)s
    <section>
      <h2>Data dictionary</h2>
      <table class=tbl><thead><tr><th>Field</th><th>Type</th><th>Range / detail</th><th class=num>Fill</th><th class=num>Distinct</th><th>Example (de-identified)</th></tr></thead><tbody>%(dict)s</tbody></table>
    </section>
    <section>
      <h2>Sample (de-identified)</h2>
      <table class=tbl>%(sample)s</table>
    </section>
    %(att)s
  </main>
  <footer>
    Prepared by Asset Data Group, a data asset commercialization firm. This package summarizes a de-identified dataset for evaluation; figures are factual summaries of the prepared data. It is not legal, financial, or tax advice, a quote, or a guarantee of a sale. Licensing terms, permitted uses, and any required compliance determinations are agreed separately, subject to the owner's approval. Contact: contact@assetdatagrp.com · Generated %(gen)s.
  </footer>
</div></body></html>""" % {
        "title": esc(meta["title"]), "owner": esc(meta.get("owner") or "Owner anonymized"),
        "records": "{:,}".format(stats["records"]), "ncols": stats["n_columns"], "hist": esc(hist),
        "value": value_html, "overview": overview, "use": use, "eval": eval_html,
        "dict": dict_rows(), "sample": sample_table(), "att": att_html,
        "gen": meta["gen"],
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Generate a buyer-facing data asset package")
    ap.add_argument("--input", "-i", required=True, help="cleaned (de-identified) CSV")
    ap.add_argument("--report", help="deid audit report .json (for the de-identification attestation)")
    ap.add_argument("--output", "-o", default="package.html", help="HTML data-sheet output")
    ap.add_argument("--manifest", help="also write a JSON manifest to this path")
    ap.add_argument("--title", default="Operational dataset", help="asset title")
    ap.add_argument("--owner", help="anonymized owner description, e.g. 'Regional distributor (anonymized)'")
    ap.add_argument("--overview", help="one-paragraph description")
    ap.add_argument("--use", help="suggested use / applications")
    ap.add_argument("--value", help="indicative value string; if omitted, the rubric's band is used")
    ap.add_argument("--uniqueness", choices=["low", "medium", "high"], default="medium", help="rubric input")
    ap.add_argument("--rights", choices=["unclear", "partial", "owns"], default="partial", help="rubric input")
    ap.add_argument("--demand", choices=["low", "medium", "high"], default="medium", help="rubric input")
    ap.add_argument("--no-evaluate", action="store_true", help="skip the evaluation rubric")
    ap.add_argument("--tsv", action="store_true", help="input is tab-separated")
    args = ap.parse_args(argv)

    if not os.path.isfile(args.input):
        ap.error("input not found: %s" % args.input)
    headers, rows = read_csv(args.input, "\t" if args.tsv else ",")
    if not headers:
        ap.error("no columns in input")

    report = None
    if args.report and os.path.isfile(args.report):
        with open(args.report, encoding="utf-8") as f:
            report = json.load(f)

    stats = analyze(headers, rows)
    att = attestation(report)
    evaluation = None if args.no_evaluate else evaluate_dataset(
        stats, report, {"uniqueness": args.uniqueness, "rights": args.rights, "demand": args.demand})
    value = args.value or ((evaluation["valueBand"] + " (illustrative)") if evaluation else None)
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    meta = {"title": args.title, "owner": args.owner, "overview": args.overview, "use": args.use,
            "value": value, "sample": rows, "gen": gen, "evaluation": evaluation}

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(render_html(meta, stats, att))

    if args.manifest:
        manifest = {
            "generator": "adg-package/%s" % VERSION, "generatedAt": gen,
            "title": args.title, "owner": args.owner, "value": value,
            "records": stats["records"], "fields": stats["n_columns"],
            "history": stats["temporal"],
            "schema": [{"name": c["name"], "type": c["type"], "fillPct": c["fill"], "distinct": c["distinct"]} for c in stats["columns"]],
            "evaluation": evaluation,
            "deidentification": att,
        }
        with open(args.manifest, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

    sys.stderr.write("Package written: %s  (%s records, %d fields)%s\n" % (
        args.output, "{:,}".format(stats["records"]), stats["n_columns"],
        ("  manifest: " + args.manifest) if args.manifest else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
