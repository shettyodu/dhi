/* Daily opportunity cache for the Government Bid Match-Maker.
   A scheduled refresh pulls per-NAICS opportunities from SAM.gov into Netlify
   Blobs once a day; the rep tool then reads from the cache — instant searches
   and near-zero live API calls, so we stay well under SAM.gov's daily quota.

   refreshCache()     — one SAM call per unique vertical NAICS → store snapshot.
   readCache()        — read the latest snapshot ({ refreshedAt, opportunities }).
   searchFromCache()  — filter/score the cached snapshot for a query (no API call);
                        returns null when the cache is empty so the caller can fall
                        back to a live/sample search. */

const { getStore } = require("@netlify/blobs");
const { VERTICALS, fetchSam, normalizeSam, interpret, scoreOpportunity, fmtDate } = require("./govbids");

const STORE = "gov-opportunities";
const KEY = "latest";
const SAM_API_KEY = process.env.SAM_GOV_API_KEY || "";

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

function uniqueNaics() {
  const s = new Set();
  Object.values(VERTICALS).forEach((v) => v.naics.forEach((n) => s.add(n)));
  return [...s];
}

// Pull one page per unique NAICS and store a deduped snapshot. Resilient: a
// failed NAICS (e.g., a transient 429/504) is counted and skipped, not fatal.
async function refreshCache({ daysBack = 45 } = {}) {
  if (!SAM_API_KEY) return { ok: false, error: "SAM_GOV_API_KEY not set" };
  const to = new Date();
  const from = new Date(Date.now() - daysBack * 86400000);
  const base = { api_key: SAM_API_KEY, postedFrom: fmtDate(from), postedTo: fmtDate(to), ptype: "o,p,k", limit: "50" };
  const seen = new Set();
  const opportunities = [];
  let calls = 0, errors = 0;
  for (const nc of uniqueNaics()) {
    const r = await fetchSam(Object.assign({}, base, { ncode: nc }));
    calls++;
    if (!r.ok) { errors++; continue; }
    const rows = (r.data && r.data.opportunitiesData) || [];
    for (const o of rows) { const n = normalizeSam(o); if (!seen.has(n.id)) { seen.add(n.id); opportunities.push(n); } }
  }
  const payload = { refreshedAt: new Date().toISOString(), count: opportunities.length, opportunities };
  try { await store().setJSON(KEY, payload); }
  catch (e) { return { ok: false, error: "cache write failed: " + e.message, calls, errors, count: opportunities.length }; }
  return { ok: true, count: opportunities.length, calls, errors, refreshedAt: payload.refreshedAt };
}

async function readCache() {
  try { return (await store().get(KEY, { type: "json" })) || null; }
  catch (e) { return null; }
}

// Filter + score the cached snapshot for a query. Returns null if no cache yet
// (so the caller falls back to a live/sample search).
async function searchFromCache({ query, vertical } = {}) {
  const cache = await readCache();
  if (!cache || !Array.isArray(cache.opportunities) || !cache.opportunities.length) return null;
  const interp = interpret(query, vertical);
  const naicsSet = new Set(interp.naics);
  let list = cache.opportunities;
  if (naicsSet.size) list = list.filter((o) => naicsSet.has(String(o.naics)));
  else if (interp.title) { const t = interp.title.toLowerCase(); list = list.filter((o) => (o.title || "").toLowerCase().includes(t)); }
  const scored = list.map((o) => Object.assign({}, o, scoreOpportunity(o, naicsSet))).sort((a, b) => b.score - a.score);
  const day = (cache.refreshedAt || "").slice(0, 10);
  return {
    ok: true,
    live: true,
    source: "cache",
    refreshedAt: cache.refreshedAt,
    note: day ? `Live SAM.gov data · cached ${day}` : "Live SAM.gov data (cached)",
    interpreted: { verticals: interp.verticals.map((k) => VERTICALS[k].label), naics: interp.naics, title: interp.title },
    count: scored.length,
    opportunities: scored,
  };
}

module.exports = { refreshCache, readCache, searchFromCache };
