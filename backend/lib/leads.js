/* Framework-agnostic lead intake for the AutoCommand automotive marketplace.
   One endpoint captures customer / dealer / supplier leads into Netlify Blobs.
   Returns { status, json }. No payments or transactions — capture only.
   Mirrors lib/influencer.js (store() explicit-config + automatic fallback). */

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");
const hubspot = require("./hubspot");

const STORE = "automotive-leads";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TYPES = ["customer", "dealer", "supplier"];

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}
function clip(s, n) { return String(s == null ? "" : s).trim().slice(0, n || 500); }

async function submitLead(body) {
  const b = body || {};
  const type = String(b.type || "").trim().toLowerCase();
  if (!TYPES.includes(type)) return { status: 400, json: { error: "Unknown lead type" } };

  const name = clip(b.name, 120);
  const email = clip(b.email, 160);
  const phone = clip(b.phone, 40);
  if (!name) return { status: 400, json: { error: "Name is required" } };
  if (!EMAIL_RE.test(email)) return { status: 400, json: { error: "A valid email is required" } };

  // Keep arbitrary form fields (sanitized) so each lead type can carry its own
  // questions without a schema change. Strip the known top-level keys.
  const details = {};
  for (const k of Object.keys(b)) {
    if (["type", "name", "email", "phone", "referral_code"].includes(k)) continue;
    details[clip(k, 40)] = clip(b[k], 800);
  }

  const id = `${slug(email)}-${crypto.randomBytes(2).toString("hex")}`;
  const record = {
    id,
    type,
    name,
    email,
    phone,
    referral_code: clip(b.referral_code, 64),
    details,
    status: "new",
    submittedAt: new Date().toISOString(),
  };

  let blob;
  try { blob = store(); }
  catch (e) {
    console.error("leads blobs not configured:", e.message);
    return { status: 503, json: { error: "We couldn't submit that right now — please email us and we'll follow up." } };
  }
  try {
    await blob.setJSON(`${type}/${id}`, record);
  } catch (e) {
    console.error("leads blobs write failed:", e.message);
    return { status: 503, json: { error: "We couldn't submit that right now — please email us and we'll follow up." } };
  }

  // Best-effort sync to HubSpot CRM — never blocks or fails the lead capture.
  let crm = { skipped: true };
  try { crm = await hubspot.upsertLead(record); }
  catch (e) { console.error("hubspot sync error:", e.message); crm = { ok: false }; }

  return { status: 200, json: { ok: true, id, type, crm: crm.ok ? "synced" : crm.skipped ? "off" : "deferred" } };
}

module.exports = { submitLead };
