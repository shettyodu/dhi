/* Admin read/prune for captured leads + influencer signups (Netlify Blobs).
   Auth is enforced in the function wrapper (x-dhi-admin header). Returns
   { status, json }. Exposes PII — keep behind the admin secret. */

const { getStore } = require("@netlify/blobs");

const LEADS = "automotive-leads";
const SIGNUPS = "influencer-signups";

function store(name) {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name, siteID, token }) : getStore(name);
}

async function readAll(name, { skipPrefix } = {}) {
  const s = store(name);
  const out = [];
  const { blobs } = await s.list();
  for (const b of blobs || []) {
    if (skipPrefix && b.key.startsWith(skipPrefix)) continue; // e.g. influencer by-email index
    let rec = null;
    try { rec = await s.get(b.key, { type: "json" }); } catch (e) {}
    if (rec && typeof rec === "object") out.push({ ...rec, _store: name, _key: b.key });
  }
  return out;
}

async function listAll() {
  let leads = [], signups = [];
  try { leads = await readAll(LEADS); } catch (e) { console.error("list leads:", e.message); }
  try { signups = await readAll(SIGNUPS, { skipPrefix: "by-email/" }); } catch (e) { console.error("list signups:", e.message); }
  const byDateDesc = (a, b) => String(b.submittedAt || b.signedUpAt || "").localeCompare(String(a.submittedAt || a.signedUpAt || ""));
  leads.sort(byDateDesc);
  signups.sort(byDateDesc);
  return { status: 200, json: { leads, signups, counts: { leads: leads.length, signups: signups.length } } };
}

async function deleteRecord(body) {
  const name = String((body && body.store) || "");
  const key = String((body && body.key) || "");
  if (![LEADS, SIGNUPS].includes(name) || !key) return { status: 400, json: { error: "store and key required" } };
  try {
    await store(name).delete(key);
    return { status: 200, json: { ok: true } };
  } catch (e) {
    console.error("admin delete:", e.message);
    return { status: 500, json: { error: "Delete failed" } };
  }
}

module.exports = { listAll, deleteRecord };
