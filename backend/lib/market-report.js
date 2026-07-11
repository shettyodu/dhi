/* DHI-vs-market back-office report. Reads the anonymized market-pricing index
   (captured by Supply Spend Check), aggregates by DHI catalog item, and flags
   SKUs where DHI is priced above what others pay — so Karthik can renegotiate.
   Auth is enforced in the function wrapper (x-dhi-admin). Returns {status,json}. */
const CATALOG = require("../data/supplies-index.json");
const { getStore } = require("@netlify/blobs");

const STORE = "market-pricing";
const BY_ID = {};
CATALOG.forEach((x) => { BY_ID[x.id] = { name: x.name, p: Number(x.p), unit: x.unit, cat: x.cat }; });

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}
const r2 = (n) => Math.round(n * 100) / 100;
function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function topVendors(map) { return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v} (${n})`); }

async function report() {
  const s = store();
  let blobs = [];
  try { ({ blobs } = await s.list({ prefix: "pricing/" })); }
  catch (e) { return { status: 503, json: { error: "Price index not available yet." } }; }

  const recs = [];
  for (const b of blobs || []) {
    let d = null; try { d = await s.get(b.key, { type: "json" }); } catch (e) { /* skip */ }
    if (d && Array.isArray(d.records)) recs.push(...d.records);
  }

  const groups = {}, unmatched = {}, vendors = {};
  for (const rec of recs) {
    if (rec.vendor) vendors[rec.vendor] = (vendors[rec.vendor] || 0) + 1;
    if (rec.matched_id && rec.unit_price != null && Number(rec.unit_price) > 0) {
      (groups[rec.matched_id] = groups[rec.matched_id] || []).push(rec);
    } else if (!rec.matched_id && rec.product) {
      const k = String(rec.product).toLowerCase().trim();
      unmatched[k] = unmatched[k] || { product: rec.product, n: 0 };
      unmatched[k].n++;
    }
  }

  const items = Object.entries(groups).map(([id, rs]) => {
    const prices = rs.map((x) => Number(x.unit_price)).filter((n) => n > 0);
    const cat = BY_ID[id] || {};
    const dhi = cat.p != null ? cat.p : (rs[0].dhi_price != null ? Number(rs[0].dhi_price) : null);
    const med = median(prices);
    const vmap = {}; rs.forEach((x) => { if (x.vendor) vmap[x.vendor] = (vmap[x.vendor] || 0) + 1; });
    return {
      id, name: cat.name || id, dhi_price: dhi, obs: prices.length,
      market_min: r2(Math.min(...prices)), market_median: med == null ? null : r2(med),
      market_avg: r2(prices.reduce((a, b) => a + b, 0) / prices.length), market_max: r2(Math.max(...prices)),
      delta_vs_median: (dhi != null && med) ? Math.round(((dhi - med) / med) * 1000) / 10 : null,
      dhi_high: dhi != null && med != null && dhi > med,
      vendors: topVendors(vmap),
    };
  }).sort((a, b) => (Number(b.dhi_high) - Number(a.dhi_high)) || ((b.delta_vs_median ?? -999) - (a.delta_vs_median ?? -999)));

  return {
    status: 200,
    json: {
      ok: true,
      generated: new Date().toISOString(),
      observations: recs.length,
      tracked_skus: items.length,
      dhi_high_count: items.filter((i) => i.dhi_high).length,
      items,
      unmatched: Object.values(unmatched).sort((a, b) => b.n - a.n).slice(0, 50),
      vendors: Object.entries(vendors).map(([v, n]) => ({ vendor: v, n })).sort((a, b) => b.n - a.n).slice(0, 20),
    },
  };
}

module.exports = { report };
