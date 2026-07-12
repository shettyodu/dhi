/* Savings-realization tracker — DHI's ROI / gainshare billing ledger. Per tenant,
   records IDENTIFIED savings (what a benchmark surfaced) vs. CAPTURED savings
   (what they actually switched and realized) over time, and computes the gainshare
   fee. This is OUR billing/ROI record — aggregate figures we confirm, NOT the
   tenant's raw spend data — so it's consistent with the "nothing stored" firewall
   on the client tool. Admin-gated in the function wrapper. */
const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

const STORE = "savings-ledger";
const num = (x) => (x === "" || x == null || isNaN(Number(x)) ? 0 : Number(x));
const r2 = (n) => Math.round(n * 100) / 100;

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

async function add(body) {
  const rec = {
    id: crypto.randomUUID(),
    tenant: (String((body && body.tenant) || "").slice(0, 60).trim()) || "unspecified",
    date: String((body && body.date) || new Date().toISOString().slice(0, 10)).slice(0, 10),
    identified: r2(num(body && body.identified)),
    captured: r2(num(body && body.captured)),
    note: String((body && body.note) || "").slice(0, 200),
    created: new Date().toISOString(),
  };
  try { await store().setJSON(`entry/${rec.id}`, rec); }
  catch (e) { return { status: 503, json: { error: "Ledger store not available." } }; }
  return { status: 200, json: { ok: true, entry: rec } };
}

async function all() {
  const out = [];
  try {
    const { blobs } = await store().list({ prefix: "entry/" });
    for (const b of blobs || []) { let d = null; try { d = await store().get(b.key, { type: "json" }); } catch (e) { /* skip */ } if (d && d.id) out.push(d); }
  } catch (e) { /* empty */ }
  return out;
}

async function remove(id) {
  try { await store().delete(`entry/${String(id || "")}`); }
  catch (e) { return { status: 503, json: { error: "Delete failed." } }; }
  return { status: 200, json: { ok: true } };
}

function rollup(entries, pct) {
  const by = {}; let ti = 0, tc = 0;
  entries.forEach((e) => {
    const t = e.tenant || "unspecified";
    const r = by[t] = by[t] || { tenant: t, identified: 0, captured: 0, entries: 0 };
    r.identified += e.identified || 0; r.captured += e.captured || 0; r.entries++;
    ti += e.identified || 0; tc += e.captured || 0;
  });
  const tenants = Object.values(by).map((r) => ({
    tenant: r.tenant, identified: r2(r.identified), captured: r2(r.captured), entries: r.entries,
    capture_rate: r.identified > 0 ? Math.round((r.captured / r.identified) * 100) : null,
    gainshare_fee: r2(r.captured * pct),
  })).sort((a, b) => b.captured - a.captured);
  return { tenants, totals: { identified: r2(ti), captured: r2(tc), gainshare_fee: r2(tc * pct), capture_rate: ti > 0 ? Math.round((tc / ti) * 100) : null } };
}

async function list(body) {
  const pct = Number(body && body.gainshare_pct) > 0 ? Number(body.gainshare_pct) : 0.25;
  let entries = await all();
  if (body && body.tenant) entries = entries.filter((e) => e.tenant === body.tenant);
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { status: 200, json: { ok: true, entries, rollup: rollup(entries, pct), gainshare_pct: pct } };
}

module.exports = { add, list, remove };
