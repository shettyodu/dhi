/* Market price index — captures ANONYMIZED supply pricing (item, vendor, price)
   from Supply Spend Check runs into Netlify Blobs, building DHI's proprietary
   benchmark dataset. No PII: the clinic's identity (name/email) lives only on the
   separate lead; here we keep pricing intelligence only. Mirrors leads.js store(). */
const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

const STORE = "market-pricing";

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

// rows: analyze() output. Keep only lines that carry pricing intelligence.
async function capture(rows) {
  const records = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.desc && (r.unit_price != null || r.vendor))
    .map((r) => ({
      product: String(r.desc).slice(0, 160),
      vendor: r.vendor ? String(r.vendor).slice(0, 80) : null,
      unit_price: r.unit_price != null ? Number(r.unit_price) : null,
      qty: r.qty != null ? Number(r.qty) : null,
      matched_id: r.matched_id || null,   // DHI catalog id when matched
      dhi_price: r.benchmark_price != null ? Number(r.benchmark_price) : null,
    }));
  if (!records.length) return { stored: 0 };
  try {
    const id = crypto.randomBytes(8).toString("hex");
    await store().setJSON(`pricing/${id}`, { source: "spend-check", records });
    return { stored: records.length };
  } catch (e) {
    console.error("market-index capture failed:", e.message);
    return { stored: 0, error: e.message };
  }
}

module.exports = { capture };
