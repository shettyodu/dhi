/* =====================================================================
   DHI → Wesco Purchase-Order export pipeline.

   Turns a DHI storefront order (cart of {id, qty}) into a standardized,
   server-authoritative Purchase Order in three interchange formats so it can
   map to whatever Wesco's QAD ERP intake accepts:
     1. Canonical JSON  (the primary contract; see backend/docs/wesco-po-export-schema.md)
     2. cXML OrderRequest (Ariba/Coupa/QAD punch-out style)
     3. X12 EDI 850      (classic ERP purchase order)

   Pricing/specs are ALWAYS taken server-side from the lighting catalog index
   (never trusted from the client). Items with no published price are emitted as
   priceStatus:"quote" (quantity + part flow through; price confirmed on quote) —
   we never fabricate a price. Prices are DHI list; final tax/freight/terms are
   settled at order acceptance.
   ===================================================================== */

const SCHEMA_VERSION = "1.0";

// Server-authoritative price/spec source: Keystone catalog index + additional
// suppliers (kept separate so no supplier's data is co-mingled at rest).
let KEYSTONE = [], SUPPLIERS = [];
try { KEYSTONE = require("../data/lighting-index.json"); } catch (e) { /* optional */ }
try { SUPPLIERS = require("../data/lighting-suppliers.json"); } catch (e) { /* optional */ }

const CATALOG = new Map();
for (const p of KEYSTONE) CATALOG.set(String(p.id).toLowerCase(), { rec: p, manufacturer: "Keystone Technologies" });
for (const p of SUPPLIERS) CATALOG.set(String(p.id).toLowerCase(), { rec: p, manufacturer: p.supplier || p.brand || "" });

// The selling entity (DHI). CAGE intentionally omitted until confirmed on SAM.gov.
const SUPPLIER = {
  name: "Digital Health International Inc.",
  duns: null,
  uei: "V93LC35DCVN5",
  address: { line1: "68 Jeans Way", city: "Benson", state: "NC", postalCode: "27504", country: "US" },
  contact: { name: "DHI Order Desk", email: "steve@digitalhealthinternational.com", phone: "+1-919-275-2474" },
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const clampQty = (q) => Math.max(1, Math.min(100000, parseInt(q, 10) || 1));
const xmlEsc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
// X12 element/segment separators; strip them from data to avoid corrupting the envelope.
const x12clean = (s) => String(s == null ? "" : s).replace(/[*~:^]/g, " ").trim();

/* ----------------------------- build ----------------------------- */
/* input: {
     items:   [{ id, qty }],                    // required
     poNumber, poDate, currency,                // optional (defaults applied)
     terms,                                      // e.g. "Net 30"
     buyer:   { name, contact:{name,email,phone}, address:{...} },   // Wesco / end customer
     shipTo:  { name, address:{...} }, billTo: {...},                // optional
     routing: { fulfiller, dropShip },           // defaults to WESCO drop-ship
     requisitioner, note
   }
   Deterministic: pass poDate/poNumber in; the function never calls Date.now(). */
function buildPO(input = {}) {
  const items = Array.isArray(input.items) ? input.items : [];
  const currency = /^[A-Z]{3}$/.test(String(input.currency || "")) ? input.currency : "USD";
  const lines = [];
  const unknown = [];
  let lineNo = 0;
  for (const it of items) {
    const id = String((it && it.id) || "").trim();
    if (!id) continue;
    const hit = CATALOG.get(id.toLowerCase());
    if (!hit) { unknown.push(id); continue; }        // unknown SKU — reported, not invented
    const qty = clampQty(it.qty);
    const rec = hit.rec;
    const unitPrice = rec.p == null ? null : round2(rec.p);
    lineNo += 1;
    lines.push({
      line: lineNo,
      sku: rec.id,                                    // DHI/Keystone catalog number
      manufacturerPartNumber: rec.id,
      manufacturer: hit.manufacturer,
      description: (rec.specs || rec.group || rec.cat || "").slice(0, 240),
      category: rec.cat || "",
      productFamily: rec.group || "",
      uom: "EA",
      quantity: qty,
      unitPrice,                                      // null => priced on quote
      extendedPrice: unitPrice == null ? null : round2(unitPrice * qty),
      priceStatus: unitPrice == null ? "quote" : "firm",
      currency,
      attributes: { watts: rec.w || "", lumens: rec.lm || "", cct: rec.cct || "", base: rec.base || "" },
    });
  }
  const firm = lines.filter((l) => l.priceStatus === "firm");
  const subtotal = round2(firm.reduce((s, l) => s + l.extendedPrice, 0));
  const quoteLines = lines.length - firm.length;

  const po = {
    schemaVersion: SCHEMA_VERSION,
    poNumber: String(input.poNumber || "").trim() || null,      // caller assigns; null = to be assigned
    poDate: input.poDate || null,                               // ISO 8601 date; caller stamps
    currency,
    orderType: "purchase-order",
    terms: input.terms || "Net 30",
    supplier: SUPPLIER,
    buyer: normParty(input.buyer),
    shipTo: input.shipTo ? normParty(input.shipTo) : null,
    billTo: input.billTo ? normParty(input.billTo) : null,
    requisitioner: input.requisitioner || null,
    routing: {
      fulfiller: (input.routing && input.routing.fulfiller) || "WESCO",
      dropShip: input.routing && typeof input.routing.dropShip === "boolean" ? input.routing.dropShip : true,
      source: "DHI storefront",
    },
    lines,
    totals: {
      currency,
      lineCount: lines.length,
      firmLineCount: firm.length,
      quoteOnlyLineCount: quoteLines,
      subtotal,                                                 // firm lines only
      taxEstimate: null,                                        // settled at acceptance (Avalara/Stripe Tax)
      freightEstimate: null,                                    // settled at acceptance (LTL/parcel rating)
      grandTotalEstimate: subtotal,                             // excl. tax & freight
      note: quoteLines ? `${quoteLines} line(s) are quote-only (no published price) — priced on order acceptance.` : "",
    },
    note: input.note ? String(input.note).slice(0, 500) : "",
    _unknownSkus: unknown,                                      // non-schema: caller may surface/reject
  };
  return po;
}

function normParty(p) {
  if (!p || typeof p !== "object") return null;
  const a = p.address || {};
  return {
    name: String(p.name || "").slice(0, 120),
    contact: p.contact ? {
      name: String(p.contact.name || "").slice(0, 120),
      email: String(p.contact.email || "").slice(0, 160),
      phone: String(p.contact.phone || "").slice(0, 40),
    } : null,
    address: {
      line1: String(a.line1 || "").slice(0, 120),
      line2: String(a.line2 || "").slice(0, 120),
      city: String(a.city || "").slice(0, 80),
      state: String(a.state || "").slice(0, 40),
      postalCode: String(a.postalCode || "").slice(0, 20),
      country: String(a.country || "US").slice(0, 2).toUpperCase(),
    },
    id: p.id ? String(p.id).slice(0, 60) : null,               // buyer's internal account id, if any
  };
}

/* --------------------------- cXML view --------------------------- */
/* cXML OrderRequest (a widely-supported punch-out/ERP order format). Reference
   representation for mapping — refine identity/credentials with Wesco. */
function toCXML(po) {
  const p = po || {};
  const addr = (party, role) => {
    if (!party) return "";
    const a = party.address || {};
    return `      <Contact role="${role}">
        <Name xml:lang="en">${xmlEsc(party.name)}</Name>
        <PostalAddress>
          <Street>${xmlEsc(a.line1)}</Street>
          <City>${xmlEsc(a.city)}</City>
          <State>${xmlEsc(a.state)}</State>
          <PostalCode>${xmlEsc(a.postalCode)}</PostalCode>
          <Country isoCountryCode="${xmlEsc(a.country || "US")}">${xmlEsc(a.country || "US")}</Country>
        </PostalAddress>${party.contact && party.contact.email ? `\n        <Email>${xmlEsc(party.contact.email)}</Email>` : ""}
      </Contact>`;
  };
  const items = (p.lines || []).map((l) => `    <ItemOut quantity="${l.quantity}" lineNumber="${l.line}">
      <ItemID><SupplierPartID>${xmlEsc(l.sku)}</SupplierPartID></ItemID>
      <ItemDetail>
        <UnitPrice><Money currency="${xmlEsc(l.currency)}">${l.unitPrice == null ? "0.00" : l.unitPrice.toFixed(2)}</Money></UnitPrice>
        <Description xml:lang="en">${xmlEsc(l.description)}</Description>
        <UnitOfMeasure>${xmlEsc(l.uom)}</UnitOfMeasure>
        <ManufacturerPartID>${xmlEsc(l.manufacturerPartNumber)}</ManufacturerPartID>
        <ManufacturerName>${xmlEsc(l.manufacturer)}</ManufacturerName>
        <Extrinsic name="priceStatus">${xmlEsc(l.priceStatus)}</Extrinsic>
      </ItemDetail>
    </ItemOut>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<cXML payloadID="${xmlEsc(p.poNumber || "PENDING")}" timestamp="${xmlEsc(p.poDate || "")}" xml:lang="en">
  <Request>
    <OrderRequest>
      <OrderRequestHeader orderID="${xmlEsc(p.poNumber || "PENDING")}" orderDate="${xmlEsc(p.poDate || "")}" type="new">
        <Total><Money currency="${xmlEsc(p.currency)}">${(p.totals && p.totals.subtotal || 0).toFixed(2)}</Money></Total>
${addr(p.shipTo || p.buyer, "shipTo")}
${addr(p.supplier ? { name: p.supplier.name, address: p.supplier.address, contact: p.supplier.contact } : null, "from")}
        <Comments>Fulfiller: ${xmlEsc(p.routing && p.routing.fulfiller)} · dropShip: ${p.routing && p.routing.dropShip}</Comments>
      </OrderRequestHeader>
${items}
    </OrderRequest>
  </Request>
</cXML>`;
}

/* --------------------------- EDI 850 view ------------------------ */
/* Simplified X12 4010 850 (Purchase Order). Envelope control numbers are caller-
   supplied (ctrl) so the function stays deterministic. Reference representation. */
function toEDI850(po, opts = {}) {
  const p = po || {};
  const ctrl = String(opts.control || "000000001").padStart(9, "0").slice(-9);
  const senderId = (opts.senderId || "DHI").padEnd(15, " ").slice(0, 15);
  const receiverId = (opts.receiverId || "WESCO").padEnd(15, " ").slice(0, 15);
  const dateY = (p.poDate || "").replace(/-/g, "").slice(2, 8) || "000000";  // YYMMDD
  const dateC = (p.poDate || "").replace(/-/g, "").slice(0, 8) || "00000000"; // CCYYMMDD
  const seg = [];
  seg.push(`ISA*00*          *00*          *ZZ*${senderId}*ZZ*${receiverId}*${dateY}*0000*U*00401*${ctrl}*0*P*:`);
  seg.push(`GS*PO*${x12clean(opts.senderId || "DHI")}*${x12clean(opts.receiverId || "WESCO")}*${dateC}*0000*${Number(ctrl)}*X*004010`);
  seg.push(`ST*850*0001`);
  seg.push(`BEG*00*NE*${x12clean(p.poNumber || "PENDING")}**${dateC}`);
  seg.push(`CUR*BY*${x12clean(p.currency || "USD")}`);
  if (p.terms) seg.push(`ITD*****${x12clean(p.terms).replace(/\D/g, "") || "30"}`);
  // Parties
  const n1 = (code, party) => { if (!party) return; const a = party.address || {}; seg.push(`N1*${code}*${x12clean(party.name)}`); if (a.line1) seg.push(`N3*${x12clean(a.line1)}`); if (a.city) seg.push(`N4*${x12clean(a.city)}*${x12clean(a.state)}*${x12clean(a.postalCode)}*${x12clean(a.country || "US")}`); };
  n1("VN", { name: p.supplier && p.supplier.name, address: p.supplier && p.supplier.address }); // vendor = DHI
  n1("BY", p.buyer);                                                                             // buyer
  n1("ST", p.shipTo || p.buyer);                                                                 // ship-to
  // Lines
  (p.lines || []).forEach((l) => {
    seg.push(`PO1*${l.line}*${l.quantity}*EA*${l.unitPrice == null ? "" : l.unitPrice.toFixed(2)}**VP*${x12clean(l.manufacturerPartNumber)}*MG*${x12clean(l.manufacturer)}`);
    seg.push(`PID*F****${x12clean(l.description).slice(0, 80)}`);
  });
  const totalQty = (p.lines || []).reduce((s, l) => s + l.quantity, 0);
  seg.push(`CTT*${(p.lines || []).length}*${totalQty}`);
  seg.push(`SE*${seg.length - 2}*0001`); // segments in transaction set (ST..SE inclusive) — approx for reference
  seg.push(`GE*1*${Number(ctrl)}`);
  seg.push(`IEA*1*${ctrl}`);
  return seg.join("~\n") + "~";
}

/* --------------------------- validate ---------------------------- */
function validate(po) {
  const errors = [];
  if (!po || !Array.isArray(po.lines) || !po.lines.length) errors.push("no valid line items");
  if (po && po._unknownSkus && po._unknownSkus.length) errors.push(`unknown SKUs: ${po._unknownSkus.join(", ")}`);
  if (po && !po.buyer) errors.push("missing buyer");
  return { ok: errors.length === 0, errors };
}

module.exports = { buildPO, toCXML, toEDI850, validate, SCHEMA_VERSION };
