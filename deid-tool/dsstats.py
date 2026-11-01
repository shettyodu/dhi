"""Asset Data Group — shared dataset statistics (used by package.py and evaluate.py)."""

import csv
import re


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
        cols.append({
            "name": h, "type": typ, "range": extra,
            "fill": round(100 * len(nonempty) / n) if n else 0,
            "distinct": len(set(nonempty)),
            "example": (nonempty[0] if nonempty else ""),
        })
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


def scan(path, delim=",", sample_n=8, distinct_cap=20000, type_sample=1000):
    """Single-pass, bounded-memory statistics for a CSV of any size. Returns
    (stats, sample_rows). Memory is capped: per-column distinct tracking stops at
    distinct_cap, type inference uses the first type_sample non-empty values, and only
    the first sample_n full rows are retained."""
    per, headers, sample_rows, n = {}, None, [], 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f, delimiter=delim)
        headers = r.fieldnames or []
        for h in headers:
            per[h] = {"nonempty": 0, "distinct": set(), "capped": False, "samples": []}
        for row in r:
            n += 1
            if len(sample_rows) < sample_n:
                sample_rows.append({k: (v if v is not None else "") for k, v in row.items()})
            for h in headers:
                v = row.get(h, "") or ""
                if v == "":
                    continue
                p = per[h]
                p["nonempty"] += 1
                if not p["capped"]:
                    p["distinct"].add(v)
                    if len(p["distinct"]) >= distinct_cap:
                        p["capped"] = True
                if len(p["samples"]) < type_sample:
                    p["samples"].append(v)
    cols, temporal = [], []
    for h in headers:
        p = per[h]
        typ, extra = infer_type(p["samples"])
        cols.append({
            "name": h, "type": typ, "range": extra,
            "fill": round(100 * p["nonempty"] / n) if n else 0,
            "distinct": len(p["distinct"]), "distinct_capped": p["capped"],
            "example": (p["samples"][0] if p["samples"] else ""),
        })
        if typ in ("year", "date"):
            years = [int(m.group(0)) for v in p["samples"] for m in [re.search(r"(19|20)\d{2}", v)] if m]
            if years:
                temporal.append([h, min(years), max(years)])
    return {"records": n, "n_columns": len(headers), "columns": cols, "temporal": temporal}, sample_rows
