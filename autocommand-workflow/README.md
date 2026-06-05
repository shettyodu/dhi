# AutoCommand Workflow — integration drop

This directory contains the full AutoCommand AI Marketplace POC backend + Flask
reference UI. Dropped here for the DHI integration team to review and wire into
the main DHI site.

It is a **standalone Python app** — not part of DHI's Netlify build. Treat it
as a separate service that the DHI frontend can call over HTTP.

---

## What's inside

```
autocommand-workflow/
├── workflow/                       Flask app (the entire service)
│   ├── api.py                      Flask REST routes + session auth
│   ├── db.py                       SQLite + SQLModel engine
│   ├── schemas.py                  Vehicle, Lead, CustomerProfile, etc.
│   ├── agents/                     LLM call sites (2 today)
│   │   ├── comparison_narrative.py
│   │   └── nl_search_parser.py
│   ├── operations/                 deterministic (no LLM)
│   │   ├── inventory_search.py
│   │   ├── scoring.py
│   │   ├── bucketing.py
│   │   ├── compare.py
│   │   ├── leads.py
│   │   └── market_values.py
│   ├── prompts/                    externalized agent prompts
│   ├── fixtures/                   100 seeded vehicles + market_values.json
│   ├── static/photos/              16 bundled car photos
│   ├── templates/                  reference UI (Flask Jinja)
│   ├── docs/
│   │   ├── proposed_approach.md    architecture rationale
│   │   └── progress_report.md      ← read this first
│   ├── Dockerfile · docker-compose.yml
│   └── requirements.txt
├── design-mockups/                 4 design + 11 color theme variants explored
└── mcp_server.py                   (optional) MCP wrapper around the REST API
```

## Read these first

1. **`workflow/docs/progress_report.md`** — full status, file map, what's been built, demo flow.
2. **`workflow/docs/proposed_approach.md`** — architecture decisions and the
   "push work down the stack" principle this project follows.

## Run it locally (standalone, no DHI integration)

```bash
cd autocommand-workflow

# create venv + install deps
python3 -m venv .venv
.venv/bin/pip install -r workflow/requirements.txt

# seed the SQLite DB with 100 mock vehicles
.venv/bin/python -m workflow.fixtures.seed reset

# run the API server (with optional LLM for the AI features)
APP_USERNAME=tester \
APP_PASSWORD=test \
PORT=5050 \
OPENAI_API_KEY=sk-...                     \
OPENAI_MODEL_NAME=gpt-5.5                 \
.venv/bin/python -m workflow.api
```

Open `http://localhost:5050`, sign in (`tester` / `test`), and you'll see the
search-and-compare flow we've built. Use of an LLM is optional — without
`OPENAI_API_KEY`, the deterministic search and side-by-side compare still work
perfectly. The two AI features (NL search box, AI-recommendation button on
compare page) just show a friendly "agent unavailable" message.

## REST endpoints available for DHI to call

| Endpoint | Method | Purpose | LLM? |
|---|---|---|---|
| `/search` | POST | Structured-filter search → bucketed results | no |
| `/search/nl` | POST | Free-text search → bucketed results | **yes** (nl_search_parser) |
| `/vehicle/<vehicle_id>` | GET | Full vehicle detail | no |
| `/inventory/stats` | GET | Aggregate counts (makes, states, body styles, …) | no |
| `/compare?ids=a,b,c` | GET | Side-by-side comparison HTML view | no |
| `/compare/narrative` | POST | AI-personalized comparison recommendation | **yes** (comparison_narrative) |
| `/static/photos/<file>.jpg` | GET | Bundled vehicle photos | no |
| `/healthz` | GET | Liveness check | no |

### Request shapes

`POST /search` body — all fields optional:
```json
{
  "make": "Toyota", "model": "Highlander",
  "year_min": 2022, "year_max": 2024,
  "mileage_max": 60000,
  "budget_max": 35000,
  "max_monthly_payment": 600,
  "body_style": "SUV",
  "fuel_type": "Hybrid",
  "drivetrain": "AWD",
  "location_state": "NC",
  "credit_tier_hint": "good"
}
```

`POST /search/nl` body:
```json
{ "query": "Find me a 2022-2024 Highlander under 60k miles, $35k, Raleigh, ~$600/mo" }
```

`POST /compare/narrative` body:
```json
{
  "ids": ["AC-2023-0042", "AC-2024-0017", "AC-2022-0033"],
  "profile": { "budget_max": 35000, "location_state": "NC", "credit_tier_hint": "good" }
}
```

All responses are JSON.

## For DHI integration

Two ways to wire this into the DHI site (we recommend the second):

1. **Link-out** — the existing DHI "Start Your Deal" button just opens this
   Flask app in a new tab. Easiest, but feels like leaving the DHI brand.

2. **API integration** — DHI's `automotive-find-vehicle.html` page makes
   `fetch()` calls to this Flask backend. Browser sees one site (DHI brand),
   backend remains separate. Requires:
   - CORS on this Flask app (5-line change in `workflow/api.py`)
   - Dropping login auth on the public search endpoints
   - The DHI page rebuilt with Tailwind to render results

   See `workflow/docs/progress_report.md` → "Things to think through" for
   specifics.

## Architecture principles

This service was built following the published guidance in our agentic-AI
deployment paper:

- **95% deterministic** code (SQL queries, arithmetic scoring, state machines)
- **Only 2 LLM call sites** today (NL search parser, comparison narrative) —
  used surgically where language reasoning genuinely adds value
- **Graceful degradation** — every LLM call has a non-LLM fallback path; the
  app stays functional when models are unreachable
- **Single-responsibility agents** — one prompt, one input, one output, no
  tool-call loops
- **Externalized prompts** — non-engineers can iterate on prompts (in
  `workflow/prompts/`) without redeployment

## Status

Working POC. Search, compare, and both LLM agents verified end-to-end against
100 seeded vehicles. ~25 Python files, ~2,500 LOC. SQLite backed; Postgres-ready
via `DATABASE_URL` env var.

Next steps (when ready):
- Add finance + protection menus (deterministic — no new agents)
- Real dealer inventory feed connector (CSV/XML/REST)
- Click-to-Buy state machine
- More LLM call sites as needed (dealer outreach drafter, compliance reviewer,
  investor narrative writer)

Questions: see `workflow/docs/progress_report.md` or talk to the AutoCommand team.
