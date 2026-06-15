/* Buyer-portal data — per-user saved quotes/lists in Netlify Blobs, namespaced
   by the authenticated Netlify Identity user id. Returns { status, json }.
   The caller (function) must pass a verified userId from Identity (clientContext). */

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const STORE = "portal";
function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}
const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n || 500);
const safeId = (s) => String(s || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

async function saveQuote(userId, body) {
  const uid = safeId(userId); if (!uid) return { status: 401, json: { ok: false, error: "Sign in required." } };
  const items = Array.isArray(body.items) ? body.items.slice(0, 500).map((l) => ({ id: clip(l.id, 80), qty: Math.max(1, parseInt(l.qty, 10) || 1), v: clip(l.v, 80) })) : [];
  if (!items.length) return { status: 400, json: { ok: false, error: "No items to save." } };
  const id = crypto.randomBytes(6).toString("hex");
  const rec = { id, name: clip(body.name, 120) || "Saved quote", kind: clip(body.kind, 40) || "quote", store_key: clip(body.store_key, 60), items, total: body.total == null ? null : Number(body.total), count: items.length, createdAt: new Date().toISOString() };
  try { await store().setJSON(`u/${uid}/${id}`, rec); }
  catch (e) { return { status: 503, json: { ok: false, error: "Couldn't save right now — please try again." } }; }
  return { status: 200, json: { ok: true, id, quote: rec } };
}

async function listQuotes(userId) {
  const uid = safeId(userId); if (!uid) return { status: 401, json: { ok: false, error: "Sign in required." } };
  let blob; try { blob = store(); } catch (e) { return { status: 503, json: { ok: false, error: "unavailable" } }; }
  const out = [];
  try { const { blobs } = await blob.list({ prefix: `u/${uid}/` }); for (const b of blobs || []) { const r = await blob.getJSON(b.key).catch(() => null); if (r) out.push(r); } }
  catch (e) { /* empty */ }
  out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return { status: 200, json: { ok: true, count: out.length, quotes: out } };
}

async function removeQuote(userId, id) {
  const uid = safeId(userId); if (!uid) return { status: 401, json: { ok: false, error: "Sign in required." } };
  try { await store().delete(`u/${uid}/${safeId(id)}`); } catch (e) { /* ignore */ }
  return { status: 200, json: { ok: true } };
}

module.exports = { saveQuote, listQuotes, removeQuote };
