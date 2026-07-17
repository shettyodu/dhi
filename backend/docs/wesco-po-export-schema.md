# DHI → Wesco Purchase-Order Export — API Endpoint Schema (v1.0)

**Owner:** Dr. Sachin Shetty (DHI) · **Status:** Built + locally tested, pending Wesco QAD intake spec · **Phase:** 1 (pre-Call 1)

This is the contract for how a purchase order leaves the DHI storefront and lands in Wesco's order-intake / QAD ERP. It emits the **same order in three formats** so we can map to whatever Wesco's intake accepts — pick one at integration time:

1. **Canonical JSON** — the primary, self-describing contract (below).
2. **cXML `OrderRequest`** — Ariba/Coupa/QAD punch-out style.
3. **X12 EDI 850** — classic ERP purchase order.

> **Honesty note:** prices are taken **server-side** from the DHI lighting catalog (never trusted from the browser). Items with no published price are emitted as `priceStatus:"quote"` — quantity and part number flow through, price is confirmed on acceptance. **We never fabricate a price.** Tax and freight are `null` here and settled at order acceptance (Avalara/Stripe Tax + LTL/parcel rating).

---

## Endpoint

```
POST /.netlify/functions/po-export
Content-Type: application/json
```

(Production base: `https://digitalhealthinternational.com` — same-origin from the storefront. A dedicated hostname / mutual-TLS or API-key auth can be added for a direct Wesco↔DHI system link; see **Open items**.)

### Request body

| Field | Type | Req | Notes |
|---|---|---|---|
| `items` | `[{ id, qty }]` | ✔ | `id` = DHI/Keystone catalog # or supplier model #; `qty` 1–100000 |
| `poNumber` | string | – | Buyer/DHI PO id; if omitted, returned `null` (assign downstream) |
| `poDate` | ISO 8601 date | – | e.g. `2026-07-17`; stamped by caller (deterministic) |
| `terms` | string | – | e.g. `Net 30` (default) |
| `currency` | ISO 4217 | – | default `USD` |
| `buyer` | Party | – | Wesco / end customer (see Party) |
| `shipTo` / `billTo` | Party | – | default: `shipTo` = `buyer` |
| `routing` | `{ fulfiller, dropShip }` | – | default `{ "WESCO", true }` |
| `note` | string | – | free text ≤ 500 chars |
| `format` | `json`\|`cxml`\|`edi850`\|`all` | – | default `all` |

**Party** = `{ name, id?, contact:{ name, email, phone }, address:{ line1, line2?, city, state, postalCode, country } }`

### Response

```
200  { ok:true,  po, cxml, edi850, validation, unknownSkus:[] }
422  { ok:false, ... , validation:{ ok:false, errors:[...] }, unknownSkus:[...] }   // unknown SKU / no lines
```

`unknownSkus` lists any requested `id` not found in the catalog — **reported, never silently priced or dropped from your view.**

---

## Canonical PO (JSON) — field dictionary

```jsonc
{
  "schemaVersion": "1.0",
  "poNumber": "DHI-WESCO-1001",
  "poDate": "2026-07-17",
  "currency": "USD",
  "orderType": "purchase-order",
  "terms": "Net 30",
  "supplier": {                    // the selling entity (DHI)
    "name": "Digital Health International Inc.",
    "uei": "V93LC35DCVN5", "duns": null,
    "address": { "line1": "68 Jeans Way", "city": "Benson", "state": "NC", "postalCode": "27504", "country": "US" },
    "contact": { "name": "DHI Order Desk", "email": "...", "phone": "+1-919-275-2474" }
  },
  "buyer":  { "name": "...", "contact": {...}, "address": {...}, "id": null },
  "shipTo": { ... }, "billTo": { ... },
  "routing": { "fulfiller": "WESCO", "dropShip": true, "source": "DHI storefront" },
  "lines": [
    {
      "line": 1,
      "sku": "KT-DDHBLEDT8-4-4L",           // DHI/Keystone catalog #
      "manufacturerPartNumber": "KT-DDHBLEDT8-4-4L",
      "manufacturer": "Keystone Technologies",
      "description": "4' 4-lamp T8 fixture ...",
      "category": "Fixtures", "productFamily": "High Bay",
      "uom": "EA",
      "quantity": 40,
      "unitPrice": 185.00,                   // null => priced on quote
      "extendedPrice": 7400.00,              // null when unitPrice null
      "priceStatus": "firm",                 // "firm" | "quote"
      "currency": "USD",
      "attributes": { "watts": "", "lumens": "", "cct": "4000K", "base": "G13" }
    }
  ],
  "totals": {
    "currency": "USD",
    "lineCount": 3, "firmLineCount": 1, "quoteOnlyLineCount": 2,
    "subtotal": 7400.00,                     // firm lines only
    "taxEstimate": null, "freightEstimate": null,
    "grandTotalEstimate": 7400.00,           // excl. tax & freight
    "note": "2 line(s) are quote-only ..."
  },
  "note": ""
}
```

### `firm` vs `quote` lines
- **`firm`** — DHI has a published list price (Keystone line, 974 priced SKUs today). `unitPrice`/`extendedPrice` populated; rolls into `subtotal`.
- **`quote`** — added-brand fixtures (Acuity, Signify, Cree, Eaton, Orion, Alcon) with **no distributor cost loaded yet**. Part + qty flow through; price confirmed on acceptance. *(Loading a Wesco price file flips these to `firm`.)*

---

## Format mapping (canonical → cXML → EDI 850)

| Canonical | cXML `OrderRequest` | X12 850 |
|---|---|---|
| `poNumber` | `OrderRequestHeader@orderID` / `cXML@payloadID` | `BEG03` |
| `poDate` | `@orderDate` / `@timestamp` | `BEG05`, `GS04` |
| `terms` | — (Extrinsic) | `ITD` |
| `currency` | `Money@currency` | `CUR02` |
| `supplier` (DHI) | `Contact role="from"` | `N1*VN` |
| `buyer` | `Contact role="shipTo"` (if no shipTo) | `N1*BY` |
| `shipTo` | `Contact role="shipTo"` | `N1*ST` |
| `lines[].sku` | `SupplierPartID` | `PO1 … VP` |
| `lines[].manufacturerPartNumber` | `ManufacturerPartID` | `PO1 … VP` |
| `lines[].manufacturer` | `ManufacturerName` | `PO1 … MG` |
| `lines[].quantity` | `ItemOut@quantity` | `PO102 (EA)` |
| `lines[].unitPrice` | `UnitPrice/Money` | `PO104` |
| `lines[].description` | `Description` | `PID*F` |
| `lines[].priceStatus` | `Extrinsic name="priceStatus"` | — |
| `totals.subtotal` | `OrderRequestHeader/Total/Money` | (`CTT` count/qty) |

---

## Security & integrity
- **Server-authoritative pricing** — client-sent prices are ignored; the server prices every line from the catalog index.
- **No fabricated data** — unknown SKUs surface in `unknownSkus`; missing prices become `quote`, never a guessed number.
- **CORS** locked to `ALLOWED_ORIGIN` when set. For a direct Wesco system link, add an API key or mutual-TLS and a signed payload (roadmap).
- Envelope control numbers (EDI ISA/GS) are caller-supplied so runs are reproducible/idempotent.

## Open items (need from Wesco to finalize the map)
1. **Which intake format** does QAD accept here — cXML, X12 850 (VAN/AS2), or a flat file/API? That decides the primary path.
2. **Trading-partner IDs** (ISA sender/receiver qualifiers + IDs, cXML `Credential` domains) and **transport** (AS2 endpoint / SFTP / REST callback).
3. **PO numbering** authority — DHI-assigned vs Wesco-assigned vs buyer-assigned.
4. **Drop-ship routing** confirmation and any required Wesco branch/DC codes.
5. **Firm pricing** for the six added brands (Wesco price file) to convert `quote` lines to `firm`.
