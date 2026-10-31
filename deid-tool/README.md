# Asset Data Group — de-identification tool

Runs **where your data lives**. Point it at a CSV export; it removes, masks, tokenizes,
or generalizes the identifiers, scrubs PII out of free-text columns, and writes a
**cleaned file** plus an **audit report** of exactly what it did. Only the cleaned
output ever needs to leave your environment.

- **Zero required dependencies.** Core runs on the Python 3 standard library only —
  no `pip install`, works on an air-gapped machine behind your firewall.
- **Review before you run.** `--detect` proposes a rule plan for you to inspect and
  edit; `--dry-run` produces the audit report **without** writing any cleaned data.
- **Linkage preserved.** Identifiers can be *tokenized* (one-way hash) so the same
  value maps to the same code across rows — records still link, but aren't identifiable.

## Quick start

```bash
# 1. See what it detects and how it proposes to handle each column (nothing is written)
python3 deid.py -i sample/sample_input.csv --detect > plan.json

# 2. Dry run — produce the audit report only, review what WOULD be removed
python3 deid.py -i sample/sample_input.csv --config plan.json --dry-run -r report

# 3. Run it — write the cleaned file + the audit report
python3 deid.py -i sample/sample_input.csv --config plan.json -o cleaned.csv -r report

# Or skip the config and apply the strict HIPAA Safe Harbor profile directly
python3 deid.py -i sample/sample_input.csv --profile hipaa-safe-harbor -o cleaned.csv -r report
```

## Input & output formats

CSV, TSV, JSON, JSON-Lines, and **SQLite** work with the standard library (no install).
**Parquet** (pyarrow) and **Excel/.xlsx** (openpyxl) work if those packages are present.
Format is inferred from the file extension, or forced with `--format` / `--out-format`.

```bash
python3 deid.py -i data.jsonl -o clean.jsonl -r report          # JSON Lines
python3 deid.py -i export.parquet -o clean.parquet -r report    # Parquet (needs pyarrow)
python3 deid.py -i app.db --table work_orders -o clean.csv -r report      # SQLite table
python3 deid.py -i app.db --query "SELECT * FROM wo WHERE year=2024" -o clean.csv
```

Reading straight from a database export (CSV/Parquet) is the recommended path for a
one-time historical pull — simpler than an API integration.

## Package it for buyers

Once a dataset is cleaned, turn it into a **buyer-facing data-sheet** — coverage
stats, a data dictionary, sample rows, and a de-identification attestation (with the
source SHA-256 and the exact treatments applied) — plus a machine-readable manifest:

```bash
python3 package.py -i cleaned.csv --report report.json -o package.html --manifest package.json \
    --title "Field-service operational dataset" \
    --owner "Regional distributor (anonymized)" \
    --use "Training field-service and agentic workflow models." \
    --value "\$180k–\$450k (illustrative)"
```

`package.html` is self-contained (inline CSS, no external calls) so it can be emailed,
printed, or hosted as-is. The manifest (`package.json`) is the structured form for a
marketplace listing. The attestation is built from the de-id audit report, so the
provenance ties back to the exact cleaning run.

### Evaluation rubric

The package includes an **evaluation**: a consistent 0–100 score across eight factors
(volume, history, breadth, completeness, uniqueness, rights, compliance readiness,
demand), an A/B/C tier, and an illustrative value band grounded in the real market.
Measured factors come from the data; judgment factors are inputs. Run it on its own
with `evaluate.py`, or let `package.py` include it automatically:

```bash
python3 evaluate.py -i cleaned.csv --report report.json --uniqueness high --rights owns --demand medium
# package.py accepts the same --uniqueness / --rights / --demand and uses the band for value
```

It is a prioritization heuristic, not a quote or a guarantee.

## Run it as a local app (web UI)

For people who'd rather drag a file in than use the command line:

```bash
python3 serve.py        # then open http://127.0.0.1:8000
```

It binds to `127.0.0.1` (this machine only) and runs the same `deid.py` locally — the
file you choose is **not uploaded anywhere**. Choose *Detect rules*, *Dry run*, or
*De-identify*, optionally tick *HIPAA Safe Harbor*, and download the cleaned file plus
the audit report.

## Run it in a container (Docker)

The container is the batteries-included, portable form — spaCy name detection and the
Parquet/Excel formats are baked in. Hand it to a client to run behind their firewall.

```bash
docker build -t adg-deid .
docker run --rm -v "$PWD/data:/data" adg-deid -i /data/input.csv --detect
docker run --rm -v "$PWD/data:/data" adg-deid \
    -i /data/input.csv --profile hipaa-safe-harbor -o /data/cleaned.csv -r /data/report
# or the web UI from the container:
docker run --rm -p 8000:8000 -v "$PWD/data:/data" \
    --entrypoint python adg-deid serve.py --host 0.0.0.0
```

## Actions

| Action | What it does |
|---|---|
| `keep` | leave the column unchanged |
| `drop` | remove the column entirely |
| `redact` | blank the value (use for SSNs, addresses, gov IDs) |
| `mask` | partial reveal (`j***@***.com`, `***-***-1234`) |
| `hash` | one-way token, stable within the run (`subj_9f3a1b2c4d`) — preserves linkage |
| `generalize_date` | date → year (Safe Harbor) |
| `generalize_zip` | ZIP5 → first 3 digits; restricted low-population prefixes → `000` |
| `scrub_text` | redact emails/phones/SSNs/cards/IPs/URLs (+ names/locations if spaCy is installed) from free text |

## Names in free text (the one place spaCy helps)

Structured and patterned PII (emails, phones, SSNs, cards, IPs, dates, ZIPs, IDs) is
handled with the standard library. Detecting **people's names** inside prose needs an
NER model:

```bash
pip install "spacy>=3.5"
python -m spacy download en_core_web_sm
```

If spaCy is present it's used automatically; if not, free-text scrubbing still removes
the patterned identifiers and the audit report states that names were **not** detected
and recommends enabling it. For production — and for any health data — turn it on.

## HIPAA Safe Harbor coverage

The `--profile hipaa-safe-harbor` profile maps to the 18 Safe Harbor identifiers:

| # | Identifier | Handling |
|---|---|---|
| 1 | Names | removed (names in free text need spaCy) |
| 2 | Geographic < state | city redacted, ZIP → 3-digit (restricted → `000`) |
| 3 | Dates (except year) | generalized to year |
| 4–6 | Phone / fax / email | masked or redacted |
| 7 | SSN | redacted |
| 8 | Medical record numbers | removed/tokenized |
| 9–15 | Account, certificate, license, vehicle, device, URL, IP | redacted / tokenized |
| 16–17 | Biometric / full-face photos | not applicable to CSV text |
| 18 | Other unique identifiers | tokenize via `hash`, or `redact` |

**Important:** this tool is a de-identification *aid*, not legal advice, and it does
**not** by itself constitute a HIPAA **Expert Determination** — that requires review
and sign-off by a qualified statistical/privacy expert. Safe Harbor also requires the
covered entity to have no actual knowledge that the remaining data could re-identify
an individual.

## Notes

- Input is read as UTF-8 (BOM-tolerant). Output is UTF-8 CSV.
- The tokenization salt is random per run and discarded by default, so tokens are not
  reversible. Pass `--salt <hex>` only if you need tokens to be stable across separate
  runs (keep that salt secret).
- The audit report records the tool version, run time, input file name + SHA-256
  (provenance), row count, per-column actions with counts, and free-text redaction
  counts — suitable to attach to a data-sheet for the buyer's review.
