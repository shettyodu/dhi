/* FDA recall lookup for medical supplies — openFDA device enforcement API
   (free, no key). Lets buyers check recent recalls for a product category, a
   real safety differentiator. Returns { status, json }. Never throws. */

const URL = "https://api.fda.gov/device/enforcement.json";
const TIMEOUT_MS = Number(process.env.FDA_TIMEOUT_MS || 9000);

const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n || 240);
function fmtDate(d) { const s = String(d || ""); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s; }

async function recallsFor(query, limit) {
  const q = String(query || "").replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (!q) return { status: 400, json: { ok: false, error: "Enter a product or category to check." } };
  const terms = q.split(/\s+/).slice(0, 5).join("+");
  const params = new URLSearchParams({ search: `product_description:${terms}`, limit: String(Math.min(20, Math.max(1, limit || 8))), sort: "recall_initiation_date:desc" });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(URL + "?" + params.toString(), { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (r.status === 404) return { status: 200, json: { ok: true, query: q, count: 0, recalls: [] } }; // openFDA 404 = no matches
    if (!r.ok) return { status: 502, json: { ok: false, error: "FDA recall data is unavailable right now." } };
    const data = await r.json().catch(() => ({}));
    const recalls = ((data && data.results) || []).map((x) => ({
      date: fmtDate(x.recall_initiation_date),
      firm: clip(x.recalling_firm, 80),
      classification: clip(x.classification, 16),
      status: clip(x.status, 24),
      reason: clip(x.reason_for_recall, 240),
      product: clip(x.product_description, 160),
      state: clip(x.state, 4),
    }));
    return { status: 200, json: { ok: true, query: q, count: (data.meta && data.meta.results && data.meta.results.total) || recalls.length, recalls, source: "openFDA (device enforcement)" } };
  } catch (e) {
    return { status: e.name === "AbortError" ? 504 : 502, json: { ok: false, error: "FDA recall lookup timed out — please try again." } };
  } finally { clearTimeout(timer); }
}

module.exports = { recallsFor };
