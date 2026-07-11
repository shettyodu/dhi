/* Supply pricing engine — Karthik sets manufacturer cost + sell price per SKU;
   the storefront shows the effective sell price. Stored in Netlify Blobs
   (supply-pricing), keyed by catalog id. Admin (list/set) exposes cost + margin;
   publicList() exposes only the sell price (never cost/margin). */
const CATALOG = require("../data/supplies-index.json");
const { getStore } = require("@netlify/blobs");
const { report } = require("./market-report");

const STORE = "supply-pricing";
const num = (x) => (x === "" || x == null ? null : (isNaN(Number(x)) ? null : Number(x)));

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

async function overrides() {
  const map = {};
  try {
    const { blobs } = await store().list({ prefix: "price/" });
    for (const b of blobs || []) { let d = null; try { d = await store().get(b.key, { type: "json" }); } catch (e) { /* skip */ } if (d && d.id) map[d.id] = d; }
  } catch (e) { /* empty index */ }
  return map;
}

async function setPrice(body) {
  const id = String(body.id || "").trim();
  const item = CATALOG.find((x) => x.id === id);
  if (!item) return { status: 404, json: { error: "Unknown catalog id" } };
  const rec = { id, cost: num(body.cost), sell: num(body.sell), updated: new Date().toISOString() };
  try { await store().setJSON(`price/${id}`, rec); }
  catch (e) { return { status: 503, json: { error: "Pricing store not available." } }; }
  return { status: 200, json: { ok: true, ...rec } };
}

// Bulk set — one call writes many rows (paste-from-spreadsheet import). Unknown
// ids are skipped and reported rather than failing the whole batch.
async function setBulk(body) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return { status: 400, json: { error: "No rows provided" } };
  let saved = 0; const skipped = [];
  for (const r of rows) {
    const id = String((r && r.id) || "").trim();
    if (!id || !CATALOG.find((x) => x.id === id)) { skipped.push(id || "(blank)"); continue; }
    const rec = { id, cost: num(r.cost), sell: num(r.sell), updated: new Date().toISOString() };
    try { await store().setJSON(`price/${id}`, rec); saved++; }
    catch (e) { skipped.push(id); }
  }
  return { status: 200, json: { ok: true, saved, skipped } };
}

// Admin view — cost, sell, margin, and a market-median reference (from the index).
async function list() {
  const ov = await overrides();
  const med = {};
  try { const r = await report(); (r.json.items || []).forEach((i) => { med[i.id] = i.market_median; }); } catch (e) { /* index empty */ }
  const items = CATALOG.map((x) => {
    const o = ov[x.id] || {};
    const base = Number(x.p) > 0 ? Number(x.p) : null;
    const sell = o.sell != null ? o.sell : base;
    const cost = o.cost != null ? o.cost : null;
    const margin = (sell != null && cost != null && sell > 0) ? Math.round(((sell - cost) / sell) * 1000) / 10 : null;
    return { id: x.id, name: x.name, cat: x.cat, unit: x.unit, base, cost, sell, margin, market_median: med[x.id] != null ? med[x.id] : null, managed: o.sell != null || o.cost != null };
  });
  return { status: 200, json: { ok: true, items, generated: new Date().toISOString() } };
}

// Storefront view — effective sell price only. No cost, no margin.
async function publicList() {
  const ov = await overrides();
  const items = CATALOG.map((x) => {
    const o = ov[x.id] || {};
    const price = o.sell != null ? o.sell : (Number(x.p) > 0 ? Number(x.p) : null);
    return { id: x.id, name: x.name, cat: x.cat, group: x.group, specs: x.specs, unit: x.unit, price };
  }).filter((x) => x.price != null);
  return { status: 200, json: { ok: true, items } };
}

module.exports = { list, setPrice, setBulk, publicList };
