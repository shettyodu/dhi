/* Government award intelligence — who's winning similar contracts.
   Queries USAspending.gov (free, no key) for recent awards under a NAICS code,
   so a rep sees the incumbents, typical award sizes, and top recipients for any
   opportunity. Returns { status, json }. Never throws to the caller. */

const USA_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const TIMEOUT_MS = Number(process.env.USASPENDING_TIMEOUT_MS || 10000);

const num = (x) => { const n = Number(x); return isNaN(n) ? 0 : n; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function fetchJSON(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: await r.json().catch(() => null) };
  } catch (e) { return { ok: false, status: e.name === "AbortError" ? 504 : 502 }; }
  finally { clearTimeout(timer); }
}

// Recent awards (contracts) under a NAICS, newest-large first, plus top-recipient
// rollup so reps instantly see who keeps winning this kind of work.
async function awardIntel(naics, { years = 3, limit = 25 } = {}) {
  const code = String(naics || "").replace(/[^0-9]/g, "");
  if (!code) return { status: 400, json: { ok: false, error: "A NAICS code is required." } };
  const to = new Date();
  const from = new Date(); from.setFullYear(from.getFullYear() - Math.max(1, Math.min(10, years)));
  const body = {
    filters: {
      award_type_codes: ["A", "B", "C", "D"], // definitive + IDV contract awards
      naics_codes: [code],
      time_period: [{ start_date: iso(from), end_date: iso(to) }],
    },
    fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Period of Performance Start Date"],
    sort: "Award Amount", order: "desc", limit: Math.max(1, Math.min(100, limit)),
  };
  const r = await fetchJSON(USA_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) return { status: 502, json: { ok: false, error: "Award data is unavailable right now (USAspending.gov)." } };

  const rows = (r.data && r.data.results) || [];
  const recent = rows.map((x) => ({
    id: x["Award ID"] || "",
    recipient: x["Recipient Name"] || "",
    amount: num(x["Award Amount"]),
    agency: x["Awarding Agency"] || "",
    date: x["Period of Performance Start Date"] || "",
  }));
  const byRec = {};
  for (const a of recent) { if (!a.recipient) continue; (byRec[a.recipient] = byRec[a.recipient] || { name: a.recipient, total: 0, count: 0 }); byRec[a.recipient].total += a.amount; byRec[a.recipient].count++; }
  const topRecipients = Object.values(byRec).sort((a, b) => b.total - a.total).slice(0, 5);
  const amounts = recent.map((a) => a.amount).filter((n) => n > 0).sort((a, b) => a - b);
  const median = amounts.length ? (amounts.length % 2 ? amounts[(amounts.length - 1) / 2] : (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2) : 0;

  return {
    status: 200,
    json: {
      ok: true, naics: code, window_years: years,
      count: recent.length,
      total: recent.reduce((s, a) => s + a.amount, 0),
      median_award: median,
      topRecipients,
      recent: recent.slice(0, 8),
      source: "USAspending.gov",
    },
  };
}

module.exports = { awardIntel };
