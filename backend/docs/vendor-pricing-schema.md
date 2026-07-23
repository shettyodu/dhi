# Vendor Pricing Schema (implementable spec)

Companion to `marketing/lighting/Vendor-Pricing-Framework.pdf`. This is the
concrete data model engineering builds against, and the exact set of fields a
vendor owns. No live pricing ships until the commercial model (notice window,
lock terms, antitrust guardrails, vendor data agreement) is agreed — see the
framework PDF §5–§7.

## Record: one price per (vendor, sku, zone)

```jsonc
{
  "vendor_id": "acuity",             // tenant key — a vendor edits ONLY its own records
  "brand": "Lithonia Lighting",      // display brand (may differ from vendor_id)
  "sku": "IBG 18L MVOLT",            // catalog id (matches catalog-data / suppliers)
  "uom": "each",                     // each | box(N) | ft | ...
  "currency": "USD",                 // ISO 4217 — supports a global user base
  "zone": "US",                      // pricing zone (see Zones below); "US" = national default

  "price_type": "list",              // quote | list | locked | dynamic  (see below)
  "list_price": 512.00,              // BUYER-FACING price. null => treated as quote-on-request
  "floor_price": 438.00,             // INTERNAL only. never returned to buyers or other vendors

  "effective_date": "2026-08-01",    // when this price becomes active
  "expires_date": "2027-07-31",      // end of validity (locks a quote through this date)
  "change_notice_days": 90,          // min notice before a change may take effect

  "freight_terms": "FOB factory",    // FOB factory | FOB destination | prepaid&add | ...
  "min_order_qty": 1,
  "lead_time_days": 21,

  "agent_controlled": true,          // rep/agent controls this market
  "commission_pct": 0,               // INTERNAL only; 0 if net pricing

  "updated_by": "vendor:acuity",     // audit
  "updated_at": "2026-07-23T14:00:00Z",
  "version": 3,
  "source": "vendor-portal"          // vendor-portal | import | contract
}
```

### price_type
| type | buyer sees | vendor may change | notes |
|---|---|---|---|
| `quote` | "Request quote" | n/a | default today; honest fallback, never fabricate a price |
| `list` | `list_price` | with ≥ `change_notice_days` notice | published price |
| `locked` | `list_price` | not until `expires_date` | contract / GSA; term-fixed |
| `dynamic` | `list_price` | within an agreed band, rate-limited | Phase 4 |

### Zones (product cost only)
`zone` selects a regional product multiplier set. Resolution order for a buyer in
region R: exact `zone==R` record → parent region → `"US"`/national → else `quote`.
Labor is **separate** and vendor-independent (below).

## Labor rates — separate table, distributor-owned (vendors never set labor)

```jsonc
{ "zone": "US-VA-757", "install_rate_per_fixture": 65.00, "currency": "USD", "source": "distributor", "updated_at": "..." }
```

Bid unit price = product `list_price` (zone-resolved) + labor `install_rate_*` (if
the bid includes install) + freight + margin. Product and labor are combined only
at bid time, never stored together.

## Access isolation (non-negotiable)
- A vendor token authorizes read/write to records where `vendor_id == token.vendor` only.
- No endpoint returns cross-vendor `list_price`, `floor_price`, `commission_pct`, or volumes.
- `floor_price` and `commission_pct` are **never** serialized to any buyer-facing or
  cross-vendor response — strip at the API boundary, not just the UI.
- Auth reuses the insurance pattern: scrypt password hash + HMAC-signed session token,
  per-tenant Netlify Blobs store, fail-closed if the signing secret is unset.

## Antitrust guardrail (must hold in code, not just policy)
- The platform never sets or suggests a floor/target across vendors.
- No vendor can see, and no response leaks, another vendor's pricing.
- No feature nudges vendors toward a common price. Legal sign-off required before P2.

## Catalog integration
- A `list`/`locked` record with a non-null `list_price` populates the catalog SKU's
  price field (currently `p`); `quote` leaves it null → "Request quote" in the UI.
- Same field already drives the quote cart, Bid Builder pricing, and PO-export (EDI 850).
- Resolution at read time: `resolvePrice(sku, buyerZone, currency)` →
  `{ price, type, effective, expires }` or `{ type: "quote" }`.

## Build order
- **P2:** vendor auth + per-tenant store + `list` records + `resolvePrice()` + vendor
  portal UI (edit own SKUs, effective-dating, audit). Populate catalog price for opted-in SKUs.
- **P3:** `locked` + zones + labor table → bid pricing in Bid Builder.
- **P4:** `dynamic` with bands + rate limits.

Do **not** build the portal until pilot vendor agreements + legal sign-off exist
(framework §6). Sample records: `backend/data/vendor-pricing.sample.json`.
