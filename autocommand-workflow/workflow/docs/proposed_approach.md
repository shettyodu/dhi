# AutoCommand AI Marketplace — Proposed Agentic AI Workflow

## TL;DR

The product spec lists **11 AI agents**. Following the production-deployment principles in our prior work, **only 4 of those genuinely require an LLM**. The rest are SQL queries, arithmetic formulas, API integrations, and state machines that should be plain Python.

The proposed system has:

- **4 narrow LLM call sites** for tasks that need language reasoning
- **~25 deterministic operations** (queries, formulas, API calls, state machines) for everything else
- **2 self-hosted models** (one general-purpose LLM for routine sites, one reasoning-specialist model for compliance-critical work)
- **A workflow orchestrator** stitching all of this together via a job queue + Postgres

Expected outcome: a system that's **~100× cheaper, ~100× faster, deterministic on financial math, fully auditable, and operationally simple** compared to a 11-agent implementation.

---

## Context

**AutoCommand AI Marketplace** is a digital-first used-vehicle acquisition platform:

- Customer searches for a vehicle by structured filters or natural language
- System aggregates inventory across dealer feeds, auctions, consignment, and AutoCommand-owned stock
- AI-assisted scoring, financing, protection product menus, dealer outreach, compliance, shipping
- Backed by a small physical dealership in New Bern/Raleigh, NC for credibility, paperwork, and limited owned inventory
- Targets ~34 vehicle transactions/month (~$10M annual transaction volume) in year 1

The full business spec lives in [autocommand.pdf](./autocommand.pdf). This document covers only the AI workflow architecture.

---

## Architectural philosophy

> **Push work down the stack. Use LLMs only where language reasoning is genuinely required.**

Three rules guide every design decision:

1. **Direct function calls over tool calls.** If an operation is deterministic — payment math, inventory queries, API requests — do it in code. Don't wrap it in a tool call wrapped in an agent loop.
2. **Single-responsibility agents.** Each LLM call site has one purpose, one input type, one output type. No multi-tool meta-agents.
3. **Externalize prompts.** Prompts live as text files versioned alongside code, loadable at runtime — non-engineers iterate without redeployment.

These rules are taken directly from our published guidance on production agentic AI deployment.

---

## The customer journey (end-to-end)

```
        SEARCH      COMPARE      FINANCE     PROTECT     BUY          DELIVER    RETAIN
          │            │            │           │          │             │           │
          ▼            ▼            ▼           ▼          ▼             ▼           ▼
       Capture     Score &     Quote        Show       Click-to-     Quote &     Track,
       profile     curate      lenders      product    Buy           book        nudge,
                   vehicles                 menu       activates     carriers    upsell
                                                       transaction               renewals
                                                       file
```

7 customer-facing stages. Each stage is composed of deterministic operations + (optionally) one narrow LLM call.

---

## LLM call sites — the only places we invoke a model

Four call sites total. Each is a single function with typed input/output and an externalized prompt.

| # | Call site | Stage | Input | Output | Model | Why an LLM is required here |
|---|---|---|---|---|---|---|
| 1 | `nl_search_parser` | Search | Free-form text from customer | `CustomerProfile` (Pydantic) | self-hosted LLM | Converting unstructured intent ("find me a Highlander under 60k for ~$35k in Raleigh") into typed filters |
| 2 | `dealer_outreach_drafter` | Buy | Vehicle context + customer info | Professional email body (str) | self-hosted LLM | Generating context-aware, polite professional emails at scale |
| 3 | `compliance_text_reviewer` | Compliance | Marketing/product wording | `{verdict: pass/fail, issues: [...], rewrite: str}` | reasoning model + general model consortium | Comparing prose against FTC Used Car Rule, Endorsement Guides, etc. |
| 4 | `investor_narrative_writer` | Retain | Metrics dict for prior month | Investor-report prose (str) | self-hosted LLM | Turning metrics into a professional monthly narrative |

Everything else in the system is plain Python.

### Site 1 — `nl_search_parser`

```yaml
purpose:        Convert free-form text into a structured CustomerProfile
input:          str (natural language search input)
output:         CustomerProfile (Pydantic model)
model:          self-hosted LLM (vLLM, JSON-strict mode via SGLang)
when_invoked:   Customer types into search box instead of using structured form
                (estimated ~20% of search traffic; 80% uses the form, no LLM at all)
fallback:       On parse failure, error → "We couldn't parse that, please use the structured form"
prompt:         workflow/prompts/nl_search_parser.txt
target_latency: < 2s p95
```

### Site 2 — `dealer_outreach_drafter`

```yaml
purpose:        Draft a professional email to a dealer for hold/availability/OTD
input:          { vehicle, customer_profile, desired_action, deal_id }
output:         { subject: str, body: str }
model:          self-hosted LLM
when_invoked:   After Dealer Agent state machine determines "send_outreach" step
                (every transaction goes through this once)
fallback:       Template-based email (lower quality but always available)
prompt:         workflow/prompts/dealer_outreach_drafter.txt
target_latency: < 3s p95
```

### Site 3 — `compliance_text_reviewer` ⭐

The highest-stakes call site. Uses the consortium pattern from our paper.

```yaml
purpose:        Review marketing or product wording against FTC rules
input:          { text_to_review: str, regulation_context: str }
output:         {
                  verdict: "pass" | "fail",
                  issues: [{rule_id, severity, excerpt, explanation}],
                  suggested_rewrite: str | None
                }
models:         consortium: [reasoning-specialist model, general-purpose LLM]
consolidator:   small consolidator model (conservative bias: fail-if-any-flag)
when_invoked:   Every new marketing copy, protection product wording change, podcast script,
                landing page change. Stops a publish step until pass.
fallback:       No automatic fallback — failure routes to human reviewer
prompt:         workflow/prompts/compliance_text_reviewer.txt
target_latency: < 30s (acceptable; not a hot path)
```

### Site 4 — `investor_narrative_writer`

```yaml
purpose:        Turn a month's KPI dict into investor-report prose
input:          MonthlyMetrics (Pydantic: leads, units, revenue, attach rates, …)
output:         Markdown narrative (~500–1000 words)
model:          self-hosted LLM
when_invoked:   Monthly cron job; output reviewed by humans before sending
fallback:       Template with metrics inserted (always works)
prompt:         workflow/prompts/investor_narrative_writer.txt
target_latency: < 60s (not user-facing)
```

---

## Deterministic operations — everything that is NOT an LLM call

These are plain Python functions, SQL queries, or external API calls. No LLM in the loop.

### Stage 1 — Search

| Operation | Type | Notes |
|---|---|---|
| `parse_structured_form(form_data) → CustomerProfile` | Function | Pydantic binding |
| `store_lead(profile) → lead_id` | SQL INSERT | CRM lead row |
| `query_inventory(profile) → list[Vehicle]` | SQL/Elasticsearch | Filters, ranking |

### Stage 2 — Compare

| Operation | Type | Notes |
|---|---|---|
| `lookup_market_value(year, make, model, trim) → float` | Table lookup | KBB-style reference table |
| `score_vehicle(v, profile) → VehicleScore` | Arithmetic | Pure formula; deterministic |
| `pull_carfax(vin) → HistoryReport` | API call | Carfax / AutoCheck |
| `classify_risk(history_report) → list[RiskFlag]` | Rule engine | Title brand checks, etc. |
| `bucket_vehicles(scored_list) → BucketedResults` | Function | Best Overall / Best Price / etc. |

### Stage 3 — Finance

| Operation | Type | Notes |
|---|---|---|
| `monthly_payment(principal, rate, term) → float` | Formula | Exact math, no approximation |
| `select_lenders(credit_tier) → list[Lender]` | SQL | Rule-based routing |
| `prequal_at_lender(lender, profile, vehicle) → FinanceOption` | API call | One per lender |
| `rank_finance_options(options) → list[FinanceOption]` | Function | Sort by monthly payment |
| `record_finance_consent(deal_id, profile) → ConsentRecord` | SQL INSERT | Audit trail |

### Stage 4 — Protect

| Operation | Type | Notes |
|---|---|---|
| `eligible_protection_products(vehicle, route, credit) → list[Product]` | SQL + rules | Catalog with filters |
| `quote_protection(product, vehicle) → PriceQuote` | Formula | Per-product pricing |

### Stage 5 — Buy

| Operation | Type | Notes |
|---|---|---|
| `create_transaction_file(deal_id) → TransactionFile` | SQL INSERT + workflow state | Initiated on "Buy" click |
| `dispatch_post_purchase_jobs(deal_id) → None` | Job queue | Fan-out of all downstream tasks |
| `track_dealer_response(deal_id, message) → DealerResponse` | SQL UPDATE | State machine |
| `generate_buyers_guide(deal) → PDF` | PDF builder | FTC-required disclosure |
| `prepare_purchase_contract(deal) → PDF` | PDF builder | From template |

### Stage 6 — Deliver

| Operation | Type | Notes |
|---|---|---|
| `quote_shipping(origin, dest, service_level) → list[ShippingQuote]` | API call | Central Dispatch / uShip / etc. |
| `book_shipping(quote, deal_id) → BookingConfirmation` | API call | After customer confirms |
| `track_shipment(booking_id) → ShipmentStatus` | API call | Polled or webhook |

### Stage 7 — Retain

| Operation | Type | Notes |
|---|---|---|
| `record_event(deal_id, event_type, payload) → EventID` | SQL INSERT | Append-only event log |
| `compute_monthly_metrics(month) → MonthlyMetrics` | SQL aggregation | Leads, units, revenue, attach rates |
| `schedule_retention_actions(deal) → None` | Job queue | Renewal reminders, trade-cycle nudges |

### Compliance (runs continuously, not a stage)

| Operation | Type | Notes |
|---|---|---|
| `check_required_disclosures(deal) → list[MissingDisclosure]` | Rule engine | Boolean checks |
| `verify_documents_attached(deal) → bool` | File check | Buyers Guide, finance docs, etc. |
| `enforce_document_retention(deal) → None` | Cron | Per FTC retention rules |

**Total**: ~25 deterministic operations. None of these need an LLM.

---

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          AutoCommand Workflow Engine                             │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Web Layer (Flask)                                                        │   │
│  │  - Customer-facing UI (search, results, finance, protect, buy)            │   │
│  │  - Login / session                                                        │   │
│  │  - REST API surface (used by UI + MCP server externally)                  │   │
│  └────────────┬─────────────────────────────────────────────────────────────┘   │
│               │                                                                  │
│  ┌────────────▼─────────────────────────────────────────────────────────────┐   │
│  │  Workflow Orchestrator (Python, state-machine driven)                     │   │
│  │  - Customer-journey state per deal                                        │   │
│  │  - Calls deterministic functions for ~25 operations                       │   │
│  │  - Invokes LLM call sites where needed (4 of them)                        │   │
│  │  - Pushes long-running work to job queue                                  │   │
│  └────┬──────────────────────────┬───────────────────────────────┬───────────┘   │
│       │                          │                               │               │
│  ┌────▼──────┐    ┌─────────────▼───────────┐    ┌──────────────▼──────────┐   │
│  │ Postgres  │    │   Job Queue (RQ/Celery) │    │   LLM Inference Layer    │   │
│  │           │    │                         │    │                          │   │
│  │ - leads   │    │ - dispatch_post_buy     │    │  Server A: vLLM serving  │   │
│  │ - deals   │    │ - send_dealer_outreach  │    │   general-purpose LLM    │   │
│  │ - vehicles│    │ - book_shipping         │    │   (sites 1, 2, 4)        │   │
│  │ - events  │    │ - generate_buyers_guide │    │                          │   │
│  │ - finance │    │ - schedule_retention    │    │  Server B: vLLM serving  │   │
│  │ - inv-srch│    │                         │    │   reasoning model        │   │
│  │   index   │    │                         │    │   (compliance site only) │   │
│  └───────────┘    └─────────────────────────┘    └──────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  External Integrations (deterministic API calls)                          │   │
│  │  - Carfax / AutoCheck   - RouteOne / Dealertrack (lender prequal)         │   │
│  │  - Central Dispatch     - DocuSign (e-signature)                          │   │
│  │  - uShip                - Dealer DMS feeds (XML/CSV/REST/webhook)         │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data flow for one customer journey

```
1. Customer enters free text         ┌───────────────────────────┐
   "2022-2024 Highlander, < 60k mi, ─┤ LLM call #1: nl_parse     │
    Raleigh, ~$35k"                  └────────────┬──────────────┘
                                                  │
                                                  ▼
                                          CustomerProfile
                                                  │
   ┌──────────────────────────────────────────────┼────────────────┐
   │                  Deterministic Pipeline      ▼                 │
   │   ┌──────────────────────────────────────────────────────┐    │
   │   │ query_inventory(profile)  → list[Vehicle]            │    │
   │   │ for each vehicle:                                    │    │
   │   │     score_vehicle(v, profile)  → VehicleScore        │    │
   │   │     pull_carfax(vin)           → HistoryReport       │    │
   │   │ bucket_vehicles(scored)        → BucketedResults     │    │
   │   └──────────────────────────────────────────────────────┘    │
   └─────────────────────────────┬──────────────────────────────────┘
                                 ▼
                          UI renders results
                                 │
   Customer picks a vehicle ─────┘
                                 │
   ┌──────────────────────────────────────────────────────────────┐
   │                  Deterministic Pipeline                       │
   │   monthly_payment(price, rate, term)  → payment              │
   │   select_lenders(credit_tier)         → [lender, …]          │
   │   for each lender:  prequal_at_lender → FinanceOption        │
   │   eligible_protection_products(v)     → [product, …]         │
   └──────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                          UI renders finance + protection
                                 │
   Customer clicks Buy ──────────┘
                                 │
   ┌──────────────────────────────────────────────────────────────┐
   │   create_transaction_file                                     │
   │   dispatch_post_purchase_jobs:                                │
   │     • send_dealer_outreach ──┐                                │
   │     • generate_buyers_guide  │  ┌─────────────────────────┐   │
   │     • advance_finance        │  │ LLM call #2:            │   │
   │     • book_shipping          ├──┤  dealer_outreach_drafter│   │
   │     • notify_onsite_team     │  └─────────────────────────┘   │
   │     • run_compliance_checks ─┘                                │
   └──────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                          Deal moves to "in flight" — humans handle
                          paperwork, dealer confirms, car ships,
                          customer takes delivery.
                                 │
   Each event recorded ──────────┘
                                 │
                                 ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Monthly:                                                     │
   │     compute_monthly_metrics(month)  → MonthlyMetrics         │
   │     ┌────────────────────────────────────────────────────┐   │
   │     │ LLM call #4: investor_narrative_writer             │   │
   │     └────────────────────────────────────────────────────┘   │
   │     → send investor PDF                                      │
   └──────────────────────────────────────────────────────────────┘

   Whenever marketing/product wording changes:
   ┌──────────────────────────────────────────────────────────────┐
   │ LLM call #3 (consortium): compliance_text_reviewer            │
   │   reasoning model + general LLM → consolidator → pass/fail   │
   └──────────────────────────────────────────────────────────────┘
```

---

## Infrastructure

```
LLM serving:
  - 2 GPU servers (1× H100 80GB each, or 1× H100 + 1× quantized 2×consumer)
  - vLLM (general) + SGLang (for nl_search_parser JSON mode)
  - OpenAI-compatible HTTP API surface → trivial integration

Application:
  - Single Python service (Flask + Waitress)
  - Postgres for persistent state
  - Redis + RQ (or Celery) for job queue
  - S3-compatible object store for documents (Buyers Guide PDFs, contracts, photos)
  - Search index: Postgres full-text initially; Elasticsearch later if needed

Deployment:
  - Docker containers
  - Kubernetes for orchestration (per our paper's recommendation)
  - One namespace per environment (dev/staging/prod)
  - Horizontal-scale the app; vertical-scale the GPU servers
```

### Model choices (self-hosted)

| Call site | Model class | Inference | Hardware |
|---|---|---|---|
| `nl_search_parser` | general-purpose LLM | SGLang (JSON-strict) | Server A |
| `dealer_outreach_drafter` | general-purpose LLM | vLLM | Server A |
| `compliance_text_reviewer` | reasoning model + general LLM (consortium) | vLLM | Server A + B |
| `investor_narrative_writer` | general-purpose LLM | vLLM | Server A |
| (consolidator for compliance) | small consolidator model | vLLM | Could share Server A |

Model selection is deployment-time configuration — any sufficiently capable open-weight model with a tokenizer-friendly chat template works. We recommend evaluating 2–3 options against representative inputs before committing.

MVP option: **collapse to a single general-purpose LLM server**, one model handling all four sites. Compliance loses consortium safety net but stays operable. Add Server B once compliance volume justifies it.

---

## Reuse from URLA workflow

The URLA project already shipped the infrastructure shell. AutoCommand can copy the same skeleton and replace the domain logic:

| URLA piece | AutoCommand reuse |
|---|---|
| `api.py` (Flask + login + sessions + job system) | Reuse as-is, add new routes |
| `workflow.py` (orchestration patterns) | Same pattern, replace functions |
| `providers.py` (OpenAI/Anthropic-compatible client) | Reuse, point at vLLM endpoints |
| `tools.py` (utility functions, prompt loader) | Reuse `load_prompt`; new domain utils |
| `templates/index.html`, `login.html` | Reuse dark theme; rebuild content |
| `Dockerfile`, `docker-compose.yml` | Reuse as-is |
| Schemas, prompts, fixtures, the workflow body | All new — domain-specific |

Infrastructure is essentially free. Effort goes into domain logic.

---

## Build phases

We propose shipping in 4 phases. Each phase produces a runnable demo.

### Phase 1 — Search + Compare (target: 2–3 weeks)

Scope:
- `nl_search_parser` (LLM call #1)
- `query_inventory`, `score_vehicle`, `pull_carfax` (mocked), `bucket_vehicles`
- Web UI: search box (form + free-text), result cards with scorecards
- Mock data: ~100 vehicles in `fixtures/dealer_feed.json`

Deliverable: customer can search and see ranked, scored results.

### Phase 2 — Finance + Protect (target: 1–2 weeks)

Scope:
- `monthly_payment`, `select_lenders`, `prequal_at_lender` (mocked lenders)
- `eligible_protection_products`, protection catalog
- UI: finance menu + protection menu on a selected vehicle

Deliverable: customer can see lender choices + add-ons for a picked car.

### Phase 3 — Buy + Compliance + Shipping (target: 2–3 weeks)

Scope:
- `dealer_outreach_drafter` (LLM call #2)
- `create_transaction_file`, `dispatch_post_purchase_jobs`
- `generate_buyers_guide` (template-based PDF)
- `quote_shipping`, `book_shipping` (mocked carriers)
- `compliance_text_reviewer` (LLM call #3 with consortium)
- Backend job queue + state machine

Deliverable: customer can click Buy; downstream tasks fan out; compliance checks gate publishes.

### Phase 4 — Retain + Reporting (target: 1–2 weeks)

Scope:
- `record_event`, event log
- `compute_monthly_metrics`
- `investor_narrative_writer` (LLM call #4)
- Operator dashboards
- Retention job scheduler

Deliverable: monthly investor report generated automatically; team has live dashboard.

### After phase 4 — production hardening

- Real Carfax API integration
- Real lender integrations (RouteOne / Dealertrack)
- Real shipping carriers (Central Dispatch / uShip)
- Dealer feed connectors
- DocuSign integration
- AWS Kubernetes deployment with autoscaling

---

## Compliance & legal considerations

Every decision below comes from constraints in the business plan:

| Constraint | Implementation |
|---|---|
| **AI must not autonomously bind the company to contracts, finance, credit pulls, etc.** | Workflow always pauses at "human approval required" gates before any legally binding action |
| **FTC Used Car Rule — Buyers Guide on every used vehicle** | `generate_buyers_guide` runs deterministically on every transaction; not optional |
| **FTC Endorsement Guides — paid promotion disclosure** | `compliance_text_reviewer` runs against every podcast script, ad copy, landing page |
| **FTC Safeguards Rule — security on customer financial data** | MFA, encrypted storage, access controls, audit log of who saw what when |
| **No unauthorized scraping** | Inventory only from authorized feeds (dealer agreements, API partners, auctions); never from public sites without permission |
| **State-by-state finance rules** | `prequal_at_lender` and lender filtering must consider customer's state |
| **Insurance terminology requires licensing** | Protection products labeled per FTC guidance; never called "insurance" without a license |

The Compliance Agent is the only call site where false negatives are catastrophic — hence the consortium pattern.

---

## What's deliberately NOT in scope (for now)

- **Vehicle photo analysis** — Could add a vision model later for "does this car match its listing photos." Out of scope for Phase 1–4.
- **Voice agent** — No phone calls. All customer interaction via web; dealer outreach via email/SMS only.
- **Real-time bidding at auctions** — Auction sourcing is human-driven with AI scoring assistance, not autonomous bidding.
- **International compliance** — US-focused initially. Export deals handled manually for now.
- **Multi-language support** — English only initially.

---

## Open questions for the team

1. **Inventory feed format priorities** — Which dealer partner formats do we target first? (Suggest: CDK XML, vAuto CSV, Homenet API.)
2. **Lender partners** — Are we routing through RouteOne/Dealertrack, or starting with direct lender integrations? Lender choice affects credit-tier routing logic.
3. **Carfax vs AutoCheck** — Both viable; pick one for Phase 1 mock and the real-API swap in production.
4. **NC dealer license timeline** — Lot operations gated on this; clarify so phases can map to legal readiness.
5. **CRM** — Build our own minimal CRM (event log + Postgres) or integrate HubSpot/Salesforce? Minimal recommended for Phase 1; revisit at Phase 4.
6. **Self-hosting GPU location** — Cloud (AWS p4d/p5) or on-prem? Affects unit economics significantly at scale.
7. **Consortium-or-not for compliance in MVP** — Single model is simpler; consortium is safer. Recommend single in MVP, add second model when compliance review volume justifies it.

---

## Why this approach

| Concern | Why this design addresses it |
|---|---|
| **Cost** | 4 LLM calls per customer journey instead of 11 agents per call. Self-hosted = fixed cost regardless of volume. |
| **Latency** | Inventory search in <100ms (SQL) vs ~2s (LLM). Payment math in microseconds (formula) vs ~1s (LLM). Customer journey feels instant. |
| **Correctness** | Financial math is exact. Compliance checks are auditable. Inventory results are reproducible. |
| **Auditability** | Every state change is in Postgres. Every event is in the event log. LLM calls are logged with input + output. |
| **Compliance posture** | Critical legal-binding actions never delegated to an LLM. Compliance reviewer uses consortium for safety. |
| **Operability** | 2 GPU servers + 1 app service + Postgres + Redis. A small team can run this. |
| **Iterability** | Prompts are text files non-engineers can edit. Deterministic code has unit tests. Models can be swapped via environment variables. |
| **Compounding moat** | Every transaction adds to the event log → analytics → smarter scoring + retention → better unit economics. The data, not the LLM, becomes the moat. |

---

## Next step recommendation

Start **Phase 1** immediately:

1. Define `CustomerProfile` and `Vehicle` Pydantic schemas
2. Build `fixtures/dealer_feed.json` with 100 realistic vehicles
3. Implement `query_inventory` and `score_vehicle` (deterministic only)
4. Write `nl_search_parser` prompt; wire up to the self-hosted LLM endpoint
5. Build the search-and-results UI
6. Ship a demo at the end of Sprint 1

Phase 1 validates the architecture. If it feels right, the remaining phases follow the same pattern.

---

*This document is a proposal. Open to revision before implementation begins.*
