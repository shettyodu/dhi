/* Phase 2 — external reference-price layer. Enriches benchmarked items with
   price points from LEGITIMATE, clearly-labeled sources, never guesses:
     • DHI catalog       — our own price (source of truth)
     • Peer benchmark    — anonymized median from the opt-in market index, shown
                           ONLY at/above a minimum participant count (privacy +
                           antitrust safety: no 1-source "peer" prices)
     • GSA / public       — real public prices DHI curates into a store (loaded by
                           an admin from GSA Advantage / published catalogs). This
                           is curated real data, NOT a scraped live feed.
   Admin (list/set/bulk) loads the GSA/public references; enrich() attaches the
   labeled references to matched rows for the benchmark + Product Finder. */
const CATALOG = require("../data/supplies-index.json");
const { getStore } = require("@netlify/blobs");
const { report } = require("./market-report");

const STORE = "reference-prices";
const MIN_PEERS = Number(process.env.SUPPLYSCOPE_MIN_PEERS || 3);
const num = (x) => (x === "" || x == null ? null : (isNaN(Number(x)) ? null : Number(x)));
const CAT = {}; CATALOG.forEach((x) => { CAT[x.id] = x; });

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

// Curated GSA/public references, keyed ref/<id>.
async function overrides() {
  const map = {};
  try {
    const { blobs } = await store().list({ prefix: "ref/" });
    for (const b of blobs || []) { let d = null; try { d = await store().get(b.key, { type: "json" }); } catch (e) { /* skip */ } if (d && d.id) map[d.id] = d; }
  } catch (e) { /* empty */ }
  return map;
}

// Peer medians from the anonymized index, gated to MIN_PEERS participants.
async function peerMap() {
  const m = {};
  try { const r = await report(); (r.json.items || []).forEach((i) => { if (i.obs >= MIN_PEERS && i.market_median != null) m[i.id] = { median: i.market_median, n: i.obs }; }); }
  catch (e) { /* index empty */ }
  return m;
}

// Attach a labeled `references` array to each matched row (best-effort).
async function enrich(rows) {
  const matched = (rows || []).filter((r) => r && r.matched && r.matched_id);
  if (!matched.length) return rows;
  const [ov, peers] = await Promise.all([overrides(), peerMap()]);
  rows.forEach((r) => {
    if (!r || !r.matched || !r.matched_id) return;
    const refs = [];
    if (r.benchmark_price != null) refs.push({ source: "dhi", label: "DHI catalog", price: r.benchmark_price });
    const g = ov[r.matched_id]; if (g && g.price != null) refs.push({ source: "public", label: g.source || "GSA / public", price: Number(g.price) });
    const p = peers[r.matched_id]; if (p) refs.push({ source: "peer", label: `Peer benchmark (${p.n})`, price: p.median, n: p.n });
    if (refs.length) r.references = refs;
  });
  return rows;
}

// --- Admin: load curated GSA/public references ------------------------------
async function setRef(body) {
  const id = String((body && body.id) || "").trim();
  if (!CAT[id]) return { status: 404, json: { error: "Unknown catalog id" } };
  const rec = { id, price: num(body.price), source: String((body && body.source) || "GSA / public").slice(0, 60), updated: new Date().toISOString() };
  try { await store().setJSON(`ref/${id}`, rec); }
  catch (e) { return { status: 503, json: { error: "Reference store not available." } }; }
  return { status: 200, json: { ok: true, ...rec } };
}

async function setBulk(body) {
  const rows = Array.isArray(body && body.rows) ? body.rows : [];
  if (!rows.length) return { status: 400, json: { error: "No rows provided" } };
  let saved = 0; const skipped = [];
  for (const r of rows) {
    const id = String((r && r.id) || "").trim();
    if (!id || !CAT[id]) { skipped.push(id || "(blank)"); continue; }
    const rec = { id, price: num(r.price), source: String((r && r.source) || "GSA / public").slice(0, 60), updated: new Date().toISOString() };
    try { await store().setJSON(`ref/${id}`, rec); saved++; } catch (e) { skipped.push(id); }
  }
  return { status: 200, json: { ok: true, saved, skipped } };
}

async function listRefs() {
  const [ov, peers] = await Promise.all([overrides(), peerMap()]);
  const items = CATALOG.map((x) => {
    const o = ov[x.id] || {}; const p = peers[x.id] || null;
    return {
      id: x.id, name: x.name, cat: x.cat,
      dhi_price: Number(x.p) > 0 ? Number(x.p) : null,
      ref_price: o.price != null ? o.price : null, ref_source: o.source || null,
      peer_median: p ? p.median : null, peer_n: p ? p.n : null,
    };
  });
  return { status: 200, json: { ok: true, items, min_peers: MIN_PEERS, generated: new Date().toISOString() } };
}

module.exports = { enrich, setRef, setBulk, listRefs, MIN_PEERS };
