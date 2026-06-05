# AutoCommand ↔ DHI site — Integration Plan

How the DHI site's **`automotive-find-vehicle.html` ("Start your deal")** connects
to the AutoCommand workflow service in this folder.

**Decisions:** Host on **Render**. Site authenticates to the API via **`X-API-Key`**.

---

## Architecture — Netlify Function proxy (no direct browser calls)

```
Browser  (automotive-find-vehicle.html)
   │  same-origin fetch — no CORS, no exposed secrets
   ▼
Netlify Function  /.netlify/functions/automotive-*      (backend/lib + thin wrapper)
   │  server→server, sends X-API-Key; OpenAI key never reaches the browser
   ▼
Flask service (this folder, on Render)  /search /search/nl /vehicle /compare ...
   ├─ SQLite (100 seeded cars now → Cox HomeNet / dealer feed later)
   └─ OpenAI (NL search + compare narrative)
```

Why proxy: no CORS, secrets stay server-side, everything served under the DHI
domain, and it matches the site's existing `lib/* + function-wrapper` pattern.
Latency budget is fine — `/search` ≈ 9 ms; LLM endpoints ≈ 1–4 s (Netlify limit 10 s).

---

## Phase 0 — Deploy the service to Render
1. New **Web Service** from the repo, root `autocommand-workflow/workflow/` (uses the existing `Dockerfile`).
2. Add a small **persistent disk** mounted at the SQLite path (`workflow/data/`).
3. Env vars (Render dashboard):
   - `OPENAI_API_KEY` — **rotated** production key, with a spend cap
   - `OPENAI_MODEL_NAME` — `gpt-4o-mini` (cheap) or `gpt-5`
   - `APP_USERNAME` / `APP_PASSWORD` — strong, for the reference UI
   - `AUTOCOMMAND_API_KEY` — the shared token the proxy will send (see Phase 1)
4. Seed on first boot: `python -m workflow.fixtures.seed reset`.
5. Confirm `GET /healthz` → 200.

## Phase 1 — Netlify proxy functions  (DHI repo: `backend/`)
New `backend/lib/autocommand.js` + thin wrappers (+ `backend/api/*` Vercel mirrors):

| Function | Calls upstream | LLM |
|---|---|---|
| `automotive-search` | `POST /search` | no |
| `automotive-search-nl` | `POST /search/nl` | yes |
| `automotive-vehicle` | `GET /vehicle/:id` | no |
| `automotive-compare` | `POST /compare` + `/compare/narrative` | yes |

Reads `AUTOCOMMAND_API_URL` + `AUTOCOMMAND_API_KEY` from Netlify env; forwards the
key as `X-API-Key`. Returns `{status,json}` like the rest of the backend.

## Phase 2 — Rebuild `automotive-find-vehicle.html`
- Structured fields (make/model/year/budget/payment/location) → `/search` params.
- Optional **"Tell us what you want"** free-text box → `/search/nl`.
- Render **all matches + the 5 ranked buckets** (Best Overall / Price / Local /
  Shipped / Negotiation); each card shows photo, price, location, and the **"why"
  scorecard** (% vs market, mileage class, dealer reliability, title status).
- Keep **lead capture** — `/search` returns a `lead_id`; persist it (and/or also
  POST the existing `submit-lead`) so no lead is lost.

## Phase 3 — Compare
Select 2–5 cars → `/compare`, plus **"Why this one?"** → `/compare/narrative`.

## Phase 4 — Real data (separate track)
Replace seeded SQLite with the Cox HomeNet / Tim dealer feed; SQLite → managed
Postgres; rate limiting + monitoring; production OpenAI key with budget cap.

---

## ▶ Ask for the workflow author (small change on your side)

Please add a lightweight **`X-API-Key`** guard so the DHI Netlify proxy can call
the REST API server-to-server (the browser never sees the key):

- If env `AUTOCOMMAND_API_KEY` is set, require requests to these endpoints to send
  header `X-API-Key: <that value>` — else `401`:
  `/search`, `/search/nl`, `/vehicle/<id>`, `/inventory/stats`,
  `/compare`, `/compare/narrative`.
- Keep the existing **session login** for the human reference UI (both auth paths
  coexist: a valid session **or** a valid `X-API-Key` passes).
- Leave `/healthz` open.

A Flask `before_request` check (~15 lines) covers it.

Also, before anything public-facing:
- Unify the default login password (README `test` vs `api.py autocommand2026` vs `docker-compose urla2026`).
- Strip leftover `mortgageq` / `urla-workflow` / "URLA" naming.

---

## Secrets / config (all env vars — never commit)
`AUTOCOMMAND_API_URL`, `AUTOCOMMAND_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL_NAME`.

## Verified working (local smoke test, 2026-06-05)
`/healthz`, `/login`, `/inventory/stats` (100 cars), `/search` (all matches + 5
buckets + scorecards + `lead_id`), `/vehicle/:id`, `/compare`, reference UI, photos.
With an OpenAI key: `/search/nl` (free-text → structured filters) and
`/compare/narrative` (grounded recommendation + trade-offs) both work.
