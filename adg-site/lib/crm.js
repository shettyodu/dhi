/* Asset Data Group — CRM / deal-pipeline logic.
   Reads the leads already captured by submit-lead (Netlify Blobs store "adg-leads")
   and overlays deal state (stage, owner, value, notes) stored in "adg-crm". Manual
   deals (not from the web form) live in "adg-crm" too. Everything is gated by a
   passcode (env ADG_ADMIN_SECRET) so the pipeline is never public. */

const { getStore } = require("@netlify/blobs");

const STAGES = ["new", "assessing", "packaging", "marketing", "negotiating", "won", "lost"];

function store(name) {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name, siteID, token }) : getStore(name);
}

// Passcode gate. Locked (503) until ADG_ADMIN_SECRET is set on the site; 401 on a
// wrong passcode. The page sends the passcode in the x-adg-pass header.
function authed(event) {
  const secret = process.env.ADG_PASSCODE || process.env.ADG_ADMIN_SECRET || "";
  if (!secret) return { ok: false, status: 503, error: "CRM is locked — set ADG_PASSCODE on the ADG site to enable it." };
  const given = (event.headers && (event.headers["x-adg-pass"] || event.headers["X-Adg-Pass"])) || "";
  if (given !== secret) return { ok: false, status: 401, error: "Wrong passcode." };
  return { ok: true };
}

function clip(v, n, dflt) {
  if (v == null) return dflt != null ? dflt : "";
  return String(v).trim().slice(0, n);
}

function baseFromLead(r) {
  return {
    id: r.id, company: r.company || "", name: r.name || "", email: r.email || "",
    source: r.source || "", vertical: r.vertical || "", submittedAt: r.submittedAt || "",
    details: r.details || {}, referral: r.referral_code || "",
    stage: "new", owner: "", value: "", crmNotes: "", updatedAt: "",
    sortTs: Date.parse(r.submittedAt || "") || 0, manual: false,
  };
}

async function listAll() {
  const leads = store("adg-leads"), crm = store("adg-crm");
  const byId = {};
  try {
    const l = await leads.list();
    for (const b of (l.blobs || [])) {
      const rec = await leads.getJSON(b.key).catch(() => null);
      if (rec && rec.id) byId[rec.id] = baseFromLead(rec);
    }
  } catch (e) { /* store may not exist yet */ }
  try {
    const c = await crm.list();
    for (const b of (c.blobs || [])) {
      const o = await crm.getJSON(b.key).catch(() => null);
      if (!o || !o.id) continue;
      const base = byId[o.id] || {
        id: o.id, company: o.company || "", name: o.name || "", email: o.email || "",
        source: o.source || "Manual", vertical: "asset-data-group",
        submittedAt: o.createdAt || o.updatedAt || "", details: {}, referral: "",
        stage: "new", owner: "", value: "", crmNotes: "", updatedAt: "",
        sortTs: Date.parse(o.createdAt || o.updatedAt || "") || 0, manual: true,
      };
      byId[o.id] = Object.assign(base, {
        stage: STAGES.includes(o.stage) ? o.stage : base.stage,
        owner: o.owner != null ? o.owner : base.owner,
        value: o.value != null ? o.value : base.value,
        crmNotes: o.crmNotes != null ? o.crmNotes : base.crmNotes,
        updatedAt: o.updatedAt || base.updatedAt,
        company: o.company || base.company, name: o.name || base.name, email: o.email || base.email,
      });
    }
  } catch (e) { /* no overlays yet */ }
  return Object.values(byId).sort((a, b) => (b.sortTs || 0) - (a.sortTs || 0));
}

async function saveDeal(body) {
  body = body || {};
  const crm = store("adg-crm");
  const id = (body.id && String(body.id)) ||
    ("manual-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  const existing = (await crm.getJSON(id).catch(() => null)) || {};
  const rec = {
    id,
    stage: STAGES.includes(body.stage) ? body.stage : (existing.stage || "new"),
    owner: clip(body.owner, 80, existing.owner),
    value: clip(body.value, 40, existing.value),
    crmNotes: clip(body.crmNotes, 4000, existing.crmNotes),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (body.manual || existing.manual) {
    rec.manual = true;
    rec.company = clip(body.company, 160, existing.company);
    rec.name = clip(body.name, 120, existing.name);
    rec.email = clip(body.email, 160, existing.email);
    rec.source = clip(body.source, 120, existing.source) || "Manual";
  }
  await crm.setJSON(id, rec);
  return { ok: true, id };
}

module.exports = { STAGES, authed, listAll, saveDeal };
