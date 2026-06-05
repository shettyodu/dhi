/* Push captured leads into HubSpot CRM (free-tier friendly).
   Upserts a contact by email and logs a note on the contact's timeline with the
   full lead detail — so the sales team works the funnel + timeline in HubSpot.

   Config: HUBSPOT_TOKEN  (a HubSpot Private App access token, set in Netlify env)
   - No-ops gracefully when the token is unset.
   - Time-boxed and best-effort: never blocks or fails the primary lead capture.
   Returns { ok } | { skipped } | { ok:false }. */

const TOKEN = process.env.HUBSPOT_TOKEN || "";
const BASE = "https://api.hubapi.com";
const TIMEOUT_MS = Number(process.env.HUBSPOT_TIMEOUT_MS || 4000);

function isConfigured() { return !!TOKEN; }

async function hsPost(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
}

function splitName(name) {
  const n = String(name || "").trim();
  if (!n) return { firstname: "", lastname: "" };
  const parts = n.split(/\s+/);
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

const LABELS = {
  make: "Make", model: "Model", body_style: "Body style", year: "Year",
  mileage: "Max mileage", price: "Price range", payment: "Monthly payment",
  down_payment: "Down payment", fuel: "Fuel", drivetrain: "Drivetrain",
  credit: "Credit band", location: "Location", shipping: "Shipping",
  category: "Category", website: "Website", offer: "What they'd offer",
  inv: "Inventory size", tier: "Tier of interest",
};

function noteBody(lead) {
  const d = lead.details || {};
  const lines = [`New ${lead.type || "lead"} from the AutoCommand website.`, ""];
  for (const k of Object.keys(LABELS)) if (d[k]) lines.push(`${LABELS[k]}: ${d[k]}`);
  for (const k of Object.keys(d)) if (!LABELS[k] && d[k]) lines.push(`${k}: ${d[k]}`);
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
  const props = { email, firstname, lastname, lifecyclestage: "lead", hs_lead_status: "NEW" };
  if (lead.phone) props.phone = lead.phone;
  const d = lead.details || {};
  const company = d.company || d.dealership || d.company_name;
  if (company) props.company = company;

  let contactId = null;
  try {
    const up = await hsPost("/crm/v3/objects/contacts/batch/upsert", {
      inputs: [{ idProperty: "email", id: email, properties: props }],
    });
    contactId = up.json && up.json.results && up.json.results[0] && up.json.results[0].id;
    if (!contactId) {
      console.error("hubspot upsert: no contact id", up.status, JSON.stringify(up.json || {}).slice(0, 240));
      return { ok: false };
    }
  } catch (e) {
    console.error("hubspot upsert error:", e.name === "AbortError" ? "timeout" : e.message);
    return { ok: false };
  }

  // Best-effort: log a note on the contact's timeline (note→contact assoc = 202).
  try {
    await hsPost("/crm/v3/objects/notes", {
      properties: { hs_note_body: noteBody(lead), hs_timestamp: Date.now() },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
    });
  } catch (e) {
    console.error("hubspot note error:", e.name === "AbortError" ? "timeout" : e.message);
  }

  return { ok: true, contactId };
}

module.exports = { upsertLead, isConfigured, noteBody, splitName };
