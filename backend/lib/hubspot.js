/* Push captured leads + creator applications into HubSpot CRM (free-tier friendly).
   - Upserts a contact by email and logs a note on the contact's timeline.
   - For customer leads, also creates a Deal in the default pipeline so the team
     gets the sales-funnel board (pipeline/stage discovered at runtime — no
     hard-coded IDs).
   Everything is best-effort + time-boxed and never blocks the primary capture.

   Config: HUBSPOT_TOKEN          HubSpot Private App token (Netlify env)
           HUBSPOT_CREATE_DEALS   "false" to skip deal creation (default on)
   No-ops gracefully when the token is unset. */

const TOKEN = process.env.HUBSPOT_TOKEN || "";
const BASE = "https://api.hubapi.com";
const TIMEOUT_MS = Number(process.env.HUBSPOT_TIMEOUT_MS || 4000);
const CREATE_DEALS = (process.env.HUBSPOT_CREATE_DEALS || "true").toLowerCase() !== "false";
// Write the per-vertical custom property `dhi_vertical`. OFF by default so we
// never send an unknown property (which would 400 the whole upsert) before the
// property exists in HubSpot. Flip HUBSPOT_VERTICAL_PROP=true once it's created.
const WRITE_VERTICAL_PROP = ["true", "1", "yes"].includes((process.env.HUBSPOT_VERTICAL_PROP || "").toLowerCase());

function isConfigured() { return !!TOKEN; }

// ---- Per-vertical tagging (Phase 1) ------------------------------------------
// Every contact/deal is labelled with the DHI vertical it belongs to. The label
// goes on the timeline note always (visible today, no extra scope) and into the
// `dhi_vertical` property once it exists (gated by WRITE_VERTICAL_PROP).
const VERTICAL_BY_LEAD_TYPE = {
  customer: "AutoCommand AI Marketplace",
  dealer: "AutoCommand AI Marketplace",
  supplier: "AutoCommand AI Marketplace",
  tokenization: "AutoCommand AI Marketplace",
};
const VERTICAL_BY_PROGRAM = {
  automotive: "AutoCommand AI Marketplace",
  lighting: "Lighting & Energy Efficiency",
};
function deriveVertical(lead) {
  const d = (lead && lead.details) || {};
  return d.vertical || VERTICAL_BY_LEAD_TYPE[lead && lead.type] || "";
}
function deriveInfluencerVertical(rec) {
  return VERTICAL_BY_PROGRAM[rec && rec.program] || (rec && rec.program) || "";
}

async function hsFetch(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
}
const hsPost = (p, b) => hsFetch("POST", p, b);
const hsGet = (p) => hsFetch("GET", p);

function splitName(name) {
  const n = String(name || "").trim();
  if (!n) return { firstname: "", lastname: "" };
  const parts = n.split(/\s+/);
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

function parseAmount(str) {
  const out = [];
  const re = /(\d[\d,\.]*)\s*(k)?/gi; let m;
  while ((m = re.exec(String(str || ""))) !== null) {
    let v = parseFloat(m[1].replace(/,/g, "")); if (isNaN(v)) continue;
    if (m[2]) v *= 1000; else if (v < 1000) v *= 1000;
    out.push(v);
  }
  return out.length ? Math.max(...out) : null;
}

// Upsert a contact by email + log a timeline note. Returns { ok, contactId }.
async function syncContact({ email, firstname, lastname, phone, company, lifecycle, leadStatus, noteBody, vertical }) {
  const props = { email, firstname: firstname || "", lastname: lastname || "" };
  if (phone) props.phone = phone;
  if (company) props.company = company;
  if (lifecycle) props.lifecyclestage = lifecycle;
  if (leadStatus) props.hs_lead_status = leadStatus;
  if (vertical && WRITE_VERTICAL_PROP) props.dhi_vertical = vertical;

  let contactId = null;
  try {
    const up = await hsPost("/crm/v3/objects/contacts/batch/upsert", { inputs: [{ idProperty: "email", id: email, properties: props }] });
    contactId = up.json && up.json.results && up.json.results[0] && up.json.results[0].id;
    if (!contactId) { console.error("hubspot upsert: no id", up.status, JSON.stringify(up.json || {}).slice(0, 240)); return { ok: false }; }
  } catch (e) {
    console.error("hubspot upsert error:", e.name === "AbortError" ? "timeout" : e.message);
    return { ok: false };
  }

  if (noteBody) {
    try {
      await hsPost("/crm/v3/objects/notes", {
        properties: { hs_note_body: noteBody, hs_timestamp: Date.now() },
        associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
      });
    } catch (e) { console.error("hubspot note error:", e.name === "AbortError" ? "timeout" : e.message); }
  }
  return { ok: true, contactId };
}

// Discover the first stage of the default deal pipeline (cached) — avoids
// hard-coding account-specific IDs.
let _dealStage; // undefined = not fetched, null = unavailable
async function firstDealStage() {
  if (_dealStage !== undefined) return _dealStage;
  try {
    const r = await hsGet("/crm/v3/pipelines/deals");
    const pipes = (r.json && r.json.results) || [];
    if (!pipes.length) { _dealStage = null; return null; }
    const pipe = pipes.find((p) => p.id === "default") || pipes.slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))[0];
    const stages = (pipe.stages || []).slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    _dealStage = stages.length ? { pipelineId: pipe.id, stageId: stages[0].id } : null;
  } catch (e) {
    console.error("hubspot pipelines error:", e.name === "AbortError" ? "timeout" : e.message);
    _dealStage = null;
  }
  return _dealStage;
}

async function createDeal({ contactId, dealname, amount, vertical }) {
  const st = await firstDealStage();
  if (!st) return { ok: false };
  const properties = { dealname, pipeline: st.pipelineId, dealstage: st.stageId };
  if (amount) properties.amount = String(Math.round(amount));
  if (vertical && WRITE_VERTICAL_PROP) properties.dhi_vertical = vertical;
  try {
    const r = await hsPost("/crm/v3/objects/deals", {
      properties,
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
    });
    return { ok: !!(r.json && r.json.id), dealId: r.json && r.json.id };
  } catch (e) {
    console.error("hubspot deal error:", e.name === "AbortError" ? "timeout" : e.message);
    return { ok: false };
  }
}

const LEAD_LABELS = {
  vertical: "Vertical", message: "Message", goal: "Goal", asset: "Asset",
  make: "Make", model: "Model", body_style: "Body style", year: "Year",
  mileage: "Max mileage", price: "Price range", payment: "Monthly payment",
  down_payment: "Down payment", fuel: "Fuel", drivetrain: "Drivetrain",
  credit: "Credit band", location: "Location", shipping: "Shipping",
  category: "Category", website: "Website", offer: "What they'd offer",
  inv: "Inventory size", tier: "Tier of interest", interest: "Interested in",
  accredited: "Accredited investor", role: "Role",
};

function leadNote(lead) {
  const d = lead.details || {};
  const src = (d.source || "").trim() || "the DHI website";
  const lines = [`New ${lead.type || "lead"} from ${src}.`, ""];
  for (const k of Object.keys(LEAD_LABELS)) if (d[k]) lines.push(`${LEAD_LABELS[k]}: ${d[k]}`);
  for (const k of Object.keys(d)) if (!LEAD_LABELS[k] && d[k] && k !== "source") lines.push(`${k}: ${d[k]}`);
  if (lead.referral_code) lines.push(`Referral code: ${lead.referral_code}`);
  if (lead.id) lines.push(`Lead ref: ${lead.id}`);
  if (lead.submittedAt) lines.push(`Submitted: ${lead.submittedAt}`);
  return lines.join("\n");
}

async function upsertLead(lead) {
  if (!isConfigured()) return { skipped: true };
  const email = String(lead.email || "").trim();
  if (!email) return { skipped: true };
  const { firstname, lastname } = splitName(lead.name);
  const d = lead.details || {};
  const vertical = deriveVertical(lead);
  if (vertical && !d.vertical) d.vertical = vertical; // surface it in the timeline note today
  const company = d.company || d.dealership || d.company_name;

  const c = await syncContact({ email, firstname, lastname, phone: lead.phone, company, lifecycle: "lead", leadStatus: "NEW", noteBody: leadNote(lead), vertical });
  if (!c.ok) return { ok: false };

  // Customer leads are real buyers → put them on the sales-funnel board as a Deal.
  if (CREATE_DEALS && lead.type === "customer") {
    const vehicle = [d.year, d.make, d.model].filter(Boolean).join(" ").trim();
    const dealname = `AutoCommand — ${vehicle || "vehicle"} (${lead.name || email})`;
    await createDeal({ contactId: c.contactId, dealname, amount: parseAmount(d.price), vertical });
  }
  return { ok: true, contactId: c.contactId };
}

function influencerNote(rec) {
  const lines = [`New creator / influencer application — AutoCommand ${rec.program || ""} program.`, ""];
  const v = deriveInfluencerVertical(rec);
  if (v) lines.push(`Vertical: ${v}`);
  if (rec.channel) lines.push(`Channel / handle: ${rec.channel}`);
  if (rec.audience) lines.push(`Audience: ${rec.audience}`);
  if (rec.code) lines.push(`Referral code: ${rec.code}`);
  if (rec.payoutModel) lines.push(`Payout: ${rec.payoutModel}`);
  if (rec.payoutNote) lines.push(`Notes: ${rec.payoutNote}`);
  if (rec.signedUpAt) lines.push(`Applied: ${rec.signedUpAt}`);
  return lines.join("\n");
}

async function upsertInfluencer(rec) {
  if (!isConfigured()) return { skipped: true };
  const email = String(rec.email || "").trim();
  if (!email) return { skipped: true };
  const { firstname, lastname } = splitName(rec.name);
  return syncContact({ email, firstname, lastname, lifecycle: "other", leadStatus: "NEW", noteBody: influencerNote(rec), vertical: deriveInfluencerVertical(rec) });
}

module.exports = { upsertLead, upsertInfluencer, isConfigured, leadNote, influencerNote, splitName, parseAmount, deriveVertical, deriveInfluencerVertical };
