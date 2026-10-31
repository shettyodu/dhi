#!/usr/bin/env python3
"""
Asset Data Group — de-identification tool.

Runs where your data lives. Point it at a CSV export; it removes, masks, tokenizes,
or generalizes the identifiers, scrubs PII out of free-text columns, and writes a
cleaned file plus an audit report of exactly what it did. Only the cleaned output
ever needs to leave your environment.

Design goals:
  - ZERO required dependencies. Core runs on the Python 3 standard library only,
    so it works behind an air-gapped firewall with no `pip install`.
  - Review before you run: `--detect` proposes rules for you to inspect/edit;
    `--dry-run` produces the audit report WITHOUT writing any cleaned data.
  - Honest about limits: structured + patterned PII (emails, phones, SSNs, cards,
    dates, ZIPs, IDs) is handled with the standard library. Detecting PEOPLE'S NAMES
    inside free text needs an NER model — spaCy is used automatically if installed,
    otherwise the report says so and recommends it for production.

This is a de-identification aid. It is not legal advice and does not, by itself,
constitute a HIPAA Expert Determination — that requires a qualified expert's review.
"""

import argparse
import csv
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone

VERSION = "0.1.0"
SAMPLE_ROWS = 300  # rows sampled for auto-detection

# --------------------------------------------------------------------------- #
# Recognizers — regexes for patterned identifiers (used on values and free text)
# --------------------------------------------------------------------------- #
PATTERNS = OrderedDict([
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")),
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("PHONE", re.compile(r"(?<!\d)(?:\+?1[.\-\s]?)?\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4}(?!\d)")),
    ("CREDIT_CARD", re.compile(r"\b\d(?:[ \-]?\d){12,15}\b")),
    ("IPV4", re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b")),
    ("URL", re.compile(r"\bhttps?://[^\s,;]+", re.I)),
    ("ZIP", re.compile(r"\b\d{5}(?:-\d{4})?\b")),
])

DATE_PATTERNS = [
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),          # 2024-06-15
    re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"),       # 6/15/2024
    re.compile(r"\b(\d{1,2})-(\d{1,2})-(\d{4})\b"),       # 6-15-2024
]

# HIPAA Safe Harbor: the initial 3 ZIP digits of these low-population prefixes
# must be changed to 000.
RESTRICTED_ZIP3 = {"036", "059", "063", "102", "203", "556", "692", "790",
                   "821", "823", "830", "831", "878", "879", "884", "890", "893"}

# header keyword -> (semantic type, default action). First match wins.
HEADER_HINTS = [
    (re.compile(r"(^|_)(ssn|social.?security)", re.I), ("ssn", "redact")),
    (re.compile(r"(^|_)e-?mail", re.I), ("email", "mask")),
    (re.compile(r"(^|_)(phone|mobile|cell|fax|tel)", re.I), ("phone", "mask")),
    (re.compile(r"(^|_)(dob|birth|dateofbirth)", re.I), ("dob", "generalize_date")),
    (re.compile(r"(date|_dt$|timestamp|_at$)", re.I), ("date", "generalize_date")),
    (re.compile(r"(^|_)(zip|postal|postcode)", re.I), ("zip", "generalize_zip")),
    (re.compile(r"(^|_)(street|address|addr|addr1|addr2)", re.I), ("address", "redact")),
    (re.compile(r"(^|_)(city|town)", re.I), ("city", "redact")),
    (re.compile(r"(^|_)(first.?name|last.?name|full.?name|fname|lname|contact.?name|patient.?name|customer.?name|^name$)", re.I), ("name", "hash")),
    (re.compile(r"(^|_)(mrn|medical.?record)", re.I), ("mrn", "hash")),
    (re.compile(r"(^|_)(ssn|dl|driver.?licen[cs]e|passport|national.?id)", re.I), ("gov_id", "redact")),
    (re.compile(r"(^|_)(account|acct|member|policy|customer.?id|cust.?id|patient.?id|card)", re.I), ("account", "hash")),
    (re.compile(r"(^|_)(note|notes|comment|comments|description|remark|memo|narrative|text)", re.I), ("freetext", "scrub_text")),
]

# When no header hint matches, classify by sampling the column's values.
VALUE_CLASSIFIERS = [
    ("email", "mask", PATTERNS["EMAIL"]),
    ("ssn", "redact", PATTERNS["SSN"]),
    ("phone", "mask", PATTERNS["PHONE"]),
]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def luhn_ok(digits):
    """Validate a card number with the Luhn checksum (cuts credit-card false positives)."""
    digs = [int(c) for c in digits if c.isdigit()]
    if not 13 <= len(digs) <= 16:
        return False
    checksum, parity = 0, len(digs) % 2
    for i, d in enumerate(digs):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def token(value, salt, prefix="id"):
    """Stable, one-way pseudonym. Same value -> same token within this run (preserves
    record linkage); not reversible without the salt, which is discarded by default."""
    h = hmac.new(salt, value.encode("utf-8"), hashlib.sha256).hexdigest()[:10]
    return "%s_%s" % (prefix, h)


def mask_email(v):
    m = PATTERNS["EMAIL"].search(v)
    if not m:
        return "[EMAIL]"
    local, _, domain = m.group(0).partition("@")
    tld = domain.rsplit(".", 1)[-1] if "." in domain else "x"
    return "%s***@***.%s" % (local[:1] or "x", tld)


def mask_tail(v, keep=4):
    digits = re.sub(r"\D", "", v)
    if len(digits) <= keep:
        return "****"
    return "***-***-" + digits[-keep:] if keep == 4 and len(digits) >= 10 else "****" + digits[-keep:]


def generalize_date(v, level="year"):
    for pat in DATE_PATTERNS:
        m = pat.search(v)
        if not m:
            continue
        g = m.groups()
        year = g[0] if len(g[0]) == 4 else g[2]
        if level == "year":
            return year
        month = g[1] if len(g[0]) == 4 else g[0]
        return "%s-%02d" % (year, int(month))
    return "[DATE]"  # unparseable but header said date


def generalize_zip(v):
    m = PATTERNS["ZIP"].search(v)
    if not m:
        return ""
    z3 = re.sub(r"\D", "", m.group(0))[:3]
    if len(z3) < 3:
        return ""
    return "000" if z3 in RESTRICTED_ZIP3 else z3


# Column types whose actual values we also scrub OUT of free-text columns — the
# identifiers we already found in structured data shouldn't survive in the notes.
IDTYPE_LABEL = {"name": "NAME", "account": "ACCOUNT", "mrn": "MRN", "address": "ADDRESS",
                "city": "LOCATION", "email": "EMAIL", "phone": "PHONE", "ssn": "SSN",
                "gov_id": "ID"}


def build_known(row, plan):
    """Per-row list of (compiled pattern, label) for the exact identifier values in this
    row's structured columns, so they can be redacted from its free-text columns too."""
    pats, seen = [], set()

    def add(v, label):
        v = (v or "").strip()
        if len(v) >= 3 and v.lower() not in seen:
            seen.add(v.lower())
            pats.append((re.compile(r"(?<!\w)" + re.escape(v) + r"(?!\w)", re.I), label))

    for h, spec in plan.items():
        label = IDTYPE_LABEL.get(spec.get("type"))
        if not label:
            continue
        v = row.get(h, "")
        add(v, label)
        if spec.get("type") == "name":        # also redact each name part (first/last alone)
            for tok in str(v).split():
                if len(tok) >= 3:
                    add(tok, "NAME")
    pats.sort(key=lambda p: -len(p[0].pattern))   # longest (full values) first
    return pats


def scrub_text(text, salt, counters, nlp=None, known=None):
    """Redact known identifier values, then patterned PII (and names if an NER model is
    supplied) from free text."""
    if not text:
        return text
    # Exact identifier values carried over from this row's structured columns.
    for pat, label in (known or []):
        text, n = pat.subn("[%s]" % label, text)
        if n:
            counters[label] += n
    # Names / locations / orgs (NER), on the remaining text.
    if nlp is not None:
        doc = nlp(text)
        # redact longest spans first so offsets stay valid
        for ent in sorted(doc.ents, key=lambda e: e.start_char, reverse=True):
            label = {"PERSON": "NAME", "GPE": "LOCATION", "LOC": "LOCATION",
                     "ORG": "ORG"}.get(ent.label_)
            if label:
                counters[label] += 1
                text = text[:ent.start_char] + ("[%s]" % label) + text[ent.end_char:]
    # Patterned identifiers.
    def repl(kind):
        def _r(m):
            if kind == "CREDIT_CARD" and not luhn_ok(m.group(0)):
                return m.group(0)
            counters[kind] += 1
            return "[%s]" % kind
        return _r
    for kind, pat in PATTERNS.items():
        if kind in ("ZIP",):   # ZIP is too noisy to blanket-redact inside prose
            continue
        text = pat.sub(repl(kind), text)
    return text


# --------------------------------------------------------------------------- #
# Column plan (auto-detection)
# --------------------------------------------------------------------------- #
def classify_column(header, samples):
    for pat, (ctype, action) in HEADER_HINTS:
        if pat.search(header):
            return ctype, action
    # fall back to value sampling
    nonempty = [s for s in samples if s]
    if nonempty:
        for ctype, action, pat in VALUE_CLASSIFIERS:
            hits = sum(1 for s in nonempty if pat.search(s))
            if hits >= max(2, int(0.6 * len(nonempty))):
                return ctype, action
    return "other", "keep"


def build_plan(headers, sample_rows, profile=None):
    plan = OrderedDict()
    for h in headers:
        samples = [r.get(h, "") for r in sample_rows]
        ctype, action = classify_column(h, samples)
        # strict HIPAA Safe Harbor tightens pseudonymization to removal
        if profile == "hipaa-safe-harbor" and action == "hash":
            action = "redact"
        plan[h] = {"type": ctype, "action": action}
    return plan


# --------------------------------------------------------------------------- #
# Row transform
# --------------------------------------------------------------------------- #
def transform_value(value, spec, salt, counters, text_counters, nlp):
    action = spec["action"]
    ctype = spec["type"]
    if value is None:
        value = ""
    if action == "keep":
        return value
    if value == "" and action != "scrub_text":
        return value
    counters[spec["type"] + ":" + action] += 1
    if action == "drop" or action == "redact":
        return ""
    if action == "mask":
        return mask_email(value) if ctype == "email" else (
            mask_tail(value) if ctype == "phone" else mask_tail(value, 2))
    if action == "hash":
        prefix = {"name": "subj", "mrn": "mrn", "account": "acct"}.get(ctype, "id")
        return token(value, salt, prefix)
    if action == "generalize_date":
        return generalize_date(value, "year")
    if action == "generalize_zip":
        return generalize_zip(value)
    if action == "scrub_text":
        return scrub_text(value, salt, text_counters, nlp)
    return value


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def load_nlp(disable):
    if disable:
        return None, "disabled (--no-ner)"
    try:
        import spacy  # noqa
        try:
            nlp = spacy.load("en_core_web_sm", disable=["lemmatizer", "tagger", "parser"])
            return nlp, "spaCy en_core_web_sm"
        except Exception:
            return None, ("spaCy installed but model 'en_core_web_sm' missing — run "
                          "`python -m spacy download en_core_web_sm` to enable name detection")
    except Exception:
        return None, ("not installed — names in free text are NOT detected. Install spaCy "
                      "(`pip install spacy` + model) for production use")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def human_report(meta, plan, counters, text_counters):
    lines = []
    lines.append("ASSET DATA GROUP — DE-IDENTIFICATION AUDIT REPORT")
    lines.append("=" * 54)
    lines.append("Tool version:   %s" % meta["tool_version"])
    lines.append("Run at (UTC):   %s" % meta["run_at"])
    lines.append("Input file:     %s" % meta["input_file"])
    lines.append("Input SHA-256:  %s" % meta["input_sha256"])
    lines.append("Rows processed: %s" % meta["rows"])
    lines.append("Mode:           %s" % meta["mode"])
    lines.append("Profile:        %s" % (meta["profile"] or "default"))
    lines.append("Name detection: %s" % meta["ner"])
    lines.append("Salt:           random per run, discarded (one-way tokens)")
    lines.append("")
    lines.append("COLUMN ACTIONS")
    lines.append("-" * 54)
    for col, spec in plan.items():
        n = counters.get(spec["type"] + ":" + spec["action"], 0)
        note = "" if spec["action"] in ("keep",) else "  (%d cell%s)" % (n, "" if n == 1 else "s")
        lines.append("  %-28s %-16s %s%s" % (col[:28], spec["action"], spec["type"], note))
    if text_counters:
        lines.append("")
        lines.append("FREE-TEXT REDACTIONS")
        lines.append("-" * 54)
        for kind, n in sorted(text_counters.items(), key=lambda x: -x[1]):
            lines.append("  %-14s %d" % (kind, n))
    lines.append("")
    lines.append("Note: this is a de-identification aid, not legal advice. A HIPAA Expert")
    lines.append("Determination still requires review by a qualified expert.")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Asset Data Group de-identification tool")
    ap.add_argument("--input", "-i", required=True, help="input CSV path")
    ap.add_argument("--output", "-o", help="cleaned CSV output path")
    ap.add_argument("--config", "-c", help="JSON config (column plan) to use instead of auto-detect")
    ap.add_argument("--report", "-r", help="audit report path (writes .json and .txt)")
    ap.add_argument("--profile", choices=["hipaa-safe-harbor"], help="apply a stricter rule profile")
    ap.add_argument("--detect", action="store_true", help="auto-detect and print the proposed plan, then exit")
    ap.add_argument("--dry-run", action="store_true", help="produce the audit report WITHOUT writing cleaned data")
    ap.add_argument("--no-ner", action="store_true", help="disable spaCy name detection even if installed")
    ap.add_argument("--salt", help="hex salt for tokenization (default: random per run)")
    args = ap.parse_args(argv)

    if not os.path.isfile(args.input):
        ap.error("input file not found: %s" % args.input)

    # Read headers + a detection sample.
    with open(args.input, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        sample = []
        for i, row in enumerate(reader):
            if i >= SAMPLE_ROWS:
                break
            sample.append(row)

    if not headers:
        ap.error("no columns found in input CSV")

    # Build the column plan (config overrides auto-detect).
    if args.config:
        with open(args.config, encoding="utf-8") as f:
            cfg = json.load(f)
        plan = OrderedDict((h, cfg["columns"].get(h, {"type": "other", "action": "keep"})) for h in headers)
    else:
        plan = build_plan(headers, sample, args.profile)

    if args.detect:
        out = {"columns": plan}
        sys.stdout.write(json.dumps(out, indent=2) + "\n")
        sys.stderr.write("\nReview the plan above, save it to a file, edit if needed, and pass it with --config.\n")
        return 0

    nlp, ner_status = load_nlp(args.no_ner)
    salt = bytes.fromhex(args.salt) if args.salt else secrets.token_bytes(16)
    counters = Counter()
    text_counters = Counter()
    rows = 0

    writer = None
    out_f = None
    if not args.dry_run:
        if not args.output:
            ap.error("--output is required unless --dry-run or --detect is used")
        out_f = open(args.output, "w", newline="", encoding="utf-8")
        writer = csv.DictWriter(out_f, fieldnames=[h for h in headers if plan[h]["action"] != "drop"])
        writer.writeheader()

    with open(args.input, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rows += 1
            known = build_known(row, plan)
            clean = {}
            for h in headers:
                spec = plan[h]
                if spec["action"] == "drop":
                    continue
                if spec["action"] == "scrub_text":
                    clean[h] = scrub_text(row.get(h, ""), salt, text_counters, nlp, known)
                else:
                    clean[h] = transform_value(row.get(h, ""), spec, salt, counters, text_counters, nlp)
            if writer:
                writer.writerow(clean)

    if out_f:
        out_f.close()

    meta = {
        "tool_version": VERSION,
        "run_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "input_file": os.path.basename(args.input),
        "input_sha256": sha256_file(args.input),
        "rows": rows,
        "mode": "dry-run (no output written)" if args.dry_run else "applied",
        "profile": args.profile,
        "ner": ner_status,
    }
    report = {"meta": meta, "columns": plan,
              "structured_counts": dict(counters), "freetext_counts": dict(text_counters)}

    text = human_report(meta, plan, counters, text_counters)
    if args.report:
        base = args.report[:-5] if args.report.endswith(".json") else args.report
        with open(base + ".json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        with open(base + ".txt", "w", encoding="utf-8") as f:
            f.write(text + "\n")
    sys.stderr.write(text + "\n")
    if not args.dry_run:
        sys.stderr.write("\nCleaned data written to: %s\n" % args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
