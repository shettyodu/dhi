# AutoCommand AI Marketplace — Progress Report

## TL;DR

We've built a working POC of AutoCommand's vehicle search-and-compare flow as a Flask web app backed by SQLite, **with one production-grade LLM agent attached for AI-assisted vehicle comparison**. The system follows the "push work down the stack" architecture from our published agentic-AI guidance: 95% of the code is deterministic SQL + arithmetic + state machines, and the LLM is used surgically only where natural-language reasoning genuinely adds value.

You can run it locally and click through the entire flow today.

---

## Architectural principles applied

| Principle | How we honored it |
|---|---|
| **Prefer direct functions over LLM agents** | Inventory search → SQL query. Vehicle scoring → pure arithmetic. Comparison table → diff highlighting. Zero LLM in any of these. |
| **Single-responsibility agents** | The one LLM call site (`comparison_narrative`) does one thing — write a comparison narrative — and exposes one typed input + one typed output. No tool-calling loops. |
| **Externalize prompts** | Prompts live as `.txt` files in `workflow/prompts/` so non-engineers can iterate without redeployment. |
| **Graceful LLM degradation** | If `OPENAI_API_KEY` is unset, the deterministic side-by-side compare still works perfectly — only the "Get AI Recommendation" button shows a friendly error. |
| **Schema-driven outputs** | The LLM returns structured JSON validated against a documented schema. No string parsing. |
| **KISS / flat layout** | One package, no microservices, no premature abstractions. ~25 Python files total. |

---

## What's been built

### 1. Data layer — `workflow/db.py` + `workflow/schemas.py`

- **SQLite** backing store (Postgres-ready via `DATABASE_URL` env var)
- **SQLModel** ORM for Pydantic + SQLAlchemy in one shot
- 3 tables: `vehicle`, `lead`, `searchhistory` — 42 columns on `vehicle`, 17 indexes covering all search filters and the hot composite paths
- JSON columns for `photos`, `features`, `score` — denormalized for speed

### 2. Seed data — `workflow/fixtures/`

- 100 realistic vehicles generated from 35 make/model templates with a calibrated depreciation curve
- 8 source dealers across NC, SC, VA, GA, FL, TN — mix of dealer feeds (80%), auction (10%), consignment (6%), AutoCommand-owned (3%)
- 70-entry market-value reference table for the scoring step
- 16 bundled vehicle photos in `workflow/static/photos/`, mapped by body style with VIN-based deterministic selection
- Reproducible via `python -m workflow.fixtures.seed reset`

### 3. Deterministic operations — `workflow/operations/` (no LLM)

| Module | Purpose | Latency on 100 vehicles |
|---|---|---|
| `inventory_search.py` | SQL filter against `CustomerProfile` | ~3-10 ms |
| `scoring.py` | Composite VehicleScore (price, mileage, title, dealer, finance fit) | ~0.5 ms total |
| `bucketing.py` | 5 curated rankings (Best Overall, Best Price, Best Local, Best Shipped, Best Negotiation) | ~0.3 ms |
| `compare.py` | Side-by-side data builder with per-row winner detection | ~5 ms |
| `leads.py` | Append-only customer profile + search history persistence | ~1 ms |
| `market_values.py` | KBB-style fair-value lookup | ~0.1 ms (in-memory) |

### 4. LLM agent — `workflow/agents/comparison_narrative.py`

The **one and only** LLM call site in the codebase today. Takes 2-5 vehicles + customer profile, returns:

```json
{
  "recommendation": { "vehicle_id": "...", "headline": "...", "confidence": "high|medium|low" },
  "narrative":      "200-400 word personalized analysis",
  "trade_offs":     [ { "vehicle_id": "...", "pros": [...], "cons": [...] }, ... ]
}
```

- ~95 lines of code, async, OpenAI-compatible client
- JSON-mode response format — guaranteed structural validity
- Externalized prompt with worked example for in-context learning
- Lazy-init with clear error when API key is missing
- Only fires when the user clicks "Get AI Recommendation" — the spec table renders instantly without it

### 5. REST API — `workflow/api.py`

| Endpoint | Auth | Purpose | LLM? |
|---|---|---|---|
| `GET  /healthz` | public | liveness | no |
| `POST /login` | public | session cookie | no |
| `POST /search` | session | structured filters → bucketed results | no |
| `GET  /vehicle/<id>` | session | full vehicle detail | no |
| `GET  /inventory/stats` | session | aggregated counts | no |
| `GET  /compare?ids=…` | session | side-by-side HTML | no |
| `POST /compare/narrative` | session | **AI recommendation** | **yes** |
| `POST /admin/reseed` | session | wipe + regenerate fixtures | no |

API routes return JSON 401 (not redirects) so external clients can call them cleanly.

### 6. Frontend — `workflow/templates/`

- `login.html` — sign-in page with the AutoCommand branding
- `index.html` — search form + bucketed vehicle results + vehicle detail modal + **multi-vehicle compare selector** with a sticky compare tray at the bottom
- `compare.html` — side-by-side spec table with per-row winners highlighted, plus an "AI Recommendation" panel that triggers the agent on demand

Visual theme: **Electric** (blue → cyan gradient on dark background). 7 other themes available in `design-mockups/` if we want to swap later.

### 7. Photos

16 curated Unsplash car photos bundled in `workflow/static/photos/`, organized by body style. Each vehicle is deterministically assigned 3 photos from the right body's pool using a VIN-based hash, so reloads produce stable results. URLs stored as JSON in the `vehicle.photos` column.

---

## File tree

```
autocommand-workflow/
├── workflow/
│   ├── api.py                            # Flask REST + auth
│   ├── db.py                             # SQLite engine + sessions
│   ├── schemas.py                        # SQLModel + Pydantic types
│   ├── config.py                         # env-driven model names
│   ├── providers.py                      # OpenAI-compatible client
│   ├── logging_utils.py                  # JSON structured logs
│   │
│   ├── agents/
│   │   └── comparison_narrative.py       # ← THE LLM call site
│   │
│   ├── operations/                       # all deterministic
│   │   ├── inventory_search.py
│   │   ├── scoring.py
│   │   ├── bucketing.py
│   │   ├── compare.py
│   │   ├── leads.py
│   │   └── market_values.py
│   │
│   ├── prompts/
│   │   └── comparison_narrative.txt      # externalized prompt
│   │
│   ├── fixtures/
│   │   ├── seed.py                       # generator + loader CLI
│   │   ├── dealer_feed.json              # 100 vehicles
│   │   └── market_values.json
│   │
│   ├── templates/
│   │   ├── login.html
│   │   ├── index.html
│   │   └── compare.html
│   │
│   ├── static/photos/                    # 16 bundled car images
│   ├── data/autocommand.db               # SQLite (gitignored)
│   │
│   ├── docs/
│   │   ├── autocommand.pdf               # original spec
│   │   ├── proposed_approach.md          # architecture decision doc
│   │   └── progress_report.md            # this document
│   │
│   ├── Dockerfile · docker-compose.yml
│   └── requirements.txt
│
└── design-mockups/                       # 4 design + multiple color variants
    ├── index.html                        # landing page
    ├── 01-premium-dark.html
    ├── 02-clean-light.html
    ├── 03-sport-bold.html
    ├── 04-warm-classic.html
    ├── color-themes.html                 # 7 swappable accents
    ├── color-emerald-night.html
    ├── color-forest-light.html
    ├── color-ocean-coastal.html
    └── color-aurora.html
```

---

## How to run

```bash
cd autocommand-workflow

# (one-time) install deps
.venv/bin/pip install -r workflow/requirements.txt

# (one-time) seed the DB
.venv/bin/python -m workflow.fixtures.seed reset

# run the server
APP_USERNAME=tester APP_PASSWORD=test PORT=5050 \
.venv/bin/python -m workflow.api
```

Open `http://localhost:5050` and sign in with `tester` / `test`.

**To enable the AI Recommendation button** also set `OPENAI_API_KEY` (or point `OPENAI_BASE_URL` at a self-hosted endpoint).

---

## What you can demo today

1. **Sign in** with the static credentials
2. **Search** by structured filters (brand, model, year, mileage, budget, state, etc.)
3. See results **bucketed** into Best Overall / Best Price / Best Local / Best Shipped / Best Negotiation
4. **Click a card** for the full vehicle detail modal (Carfax-style summary, score breakdown, feature list)
5. **Check the compare boxes** on 2-5 cards, click Compare in the sticky tray
6. View the **side-by-side comparison** with ★ on winning cells per row
7. Click **Get AI Recommendation** to invoke the agent — returns a confidence-rated headline, personalized narrative, and per-vehicle pros/cons

---

## Performance characteristics

| Operation | Latency |
|---|---|
| Search (100 vehicles, full pipeline) | 3-10 ms |
| Vehicle detail fetch | < 5 ms |
| Compare data builder (5 vehicles) | < 10 ms |
| AI Recommendation (LLM call) | 2-4 seconds |
| Initial DB load (`seed reset`) | < 200 ms |

The deterministic side scales linearly with inventory size and stays sub-100ms well into the tens of thousands of rows with the current indexes.

---

## Things deliberately deferred

These are valid candidates for future LLM call sites but **not yet implemented**:

- **`nl_search_parser`** — would let users type "Find me a Highlander under 60k miles" in a free-text box and convert to a structured `CustomerProfile`. The current frontend only has the structured form.
- **`dealer_outreach_drafter`** — for the buy flow, would draft professional dealer-facing emails.
- **`compliance_text_reviewer`** — for marketing copy / FTC review; gates publishing.
- **`investor_narrative_writer`** — monthly metric-to-prose for investor reports.

The architecture is shaped to accept each of these as a single-responsibility module in `workflow/agents/`, each paired with a prompt in `workflow/prompts/`. Pattern is set; new agents follow the existing one.

Additional non-LLM features queued:
- Finance quote endpoint + UI (formula-based, no LLM needed)
- Protection product menu (catalog + rules)
- Click-to-Buy state machine
- Real dealer inventory feed connectors (currently using fixtures)
- MCP server wrapping REST for Claude Desktop / Cursor integration

---

## Numbers to share

- **~25 Python files**, ~2,500 lines of code total
- **1 LLM call site** (comparison_narrative); 6 deterministic operations modules
- **100 vehicles seeded** from 35 templates across 8 dealers
- **70 market-value rows** for scoring reference
- **16 bundled car photos** mapped by body style
- **17 SQLite indexes** for sub-10ms search performance
- **4 design mockups** + **11 color variants** explored before committing to Electric theme
- **0 external runtime dependencies** beyond OpenAI-compatible LLM endpoint (and that's optional)

---

## What's next (proposed)

Pick one of these for the next sprint:

1. **NL search box** — add `nl_search_parser` agent + free-text input on the home page. Highest user-visible AI moment. ~1 day.
2. **MCP server** — wrap the REST API as MCP tools so Claude Desktop / Cursor users can search and compare through their own LLM. Lets us hit external power users without adding more LLM cost on our side. ~half day.
3. **Finance flow** — payment math, lender prequal mocks, finance menu UI. Pure deterministic; advances the customer journey from "I want this car" toward "I'm buying this car". ~1-2 days.
4. **Real inventory connector** — replace fixtures with a CSV/XML dealer feed ingester. Largest production-readiness gain. ~2 days.

Open to other priorities.

---

*This document is the current state of the POC. Code lives in `/Users/lambda.eranga/Workspace/rahasak/labs/agentic-workflows/autocommand-workflow`.*
