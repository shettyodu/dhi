/* Product Finder — the "search beyond our catalog" layer for the procurement
   portal. For any free-text need (any department: central sterile, lab,
   engineering, admin, surgery…) it returns:
     • a real DHI catalog match + price when we carry it (source of truth), and
     • an AI identification layer: normalized product, category/department, what
       to check, and an OPTIONAL indicative list-price range — clearly labeled an
       estimate, never contract pricing, null when the model isn't confident, and
     • targeted marketplace search links so buyers "shop the shops" from one place.
   Honesty: DHI price is real; everything external is a labeled estimate or a link.
   No scraping, no invented contract prices. */
const { analyze } = require("./spend-benchmark");

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.SUPPLYSCOPE_LLM_TIMEOUT_MS || 7000);

const enc = (s) => encodeURIComponent(String(s || "").trim());

// Targeted places to compare price/availability. Direct search where the URL is
// stable; Google site-scoped where deep links are brittle (gov/medical distributors).
function sourceLinks(query, department) {
  const q = enc(query);
  const g = (site) => `https://www.google.com/search?q=${enc(query + " " + site)}`;
  const base = [
    { label: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { label: "Amazon Business", url: `https://www.amazon.com/s?k=${q}` },
    { label: "GSA Advantage", url: `https://www.google.com/search?q=${enc("site:gsaadvantage.gov " + query)}` },
  ];
  const dept = String(department || "").toLowerCase();
  if (/eng|facil|maint|plant/.test(dept)) { base.push({ label: "Grainger", url: `https://www.grainger.com/search?searchQuery=${q}` }, { label: "Uline", url: `https://www.uline.com/Product/AdvSearchResult?keywords=${q}` }); }
  else if (/lab|patho|research/.test(dept)) { base.push({ label: "Fisher Scientific", url: g("fishersci.com") }, { label: "Grainger", url: `https://www.grainger.com/search?searchQuery=${q}` }); }
  else if (/sterile|surg|or\b|periop|patient|nurs/.test(dept)) { base.push({ label: "Medical distributors", url: g("medline OR mckesson OR cardinalhealth") }); }
  else if (/admin|office|it\b/.test(dept)) { base.push({ label: "Staples / office", url: g("staples OR officedepot") }, { label: "Amazon", url: `https://www.amazon.com/s?k=${q}` }); }
  else { base.push({ label: "Grainger", url: `https://www.grainger.com/search?searchQuery=${q}` }, { label: "Medical distributors", url: g("medline OR mckesson OR cardinalhealth") }); }
  // de-dupe by label
  const seen = new Set(); return base.filter((s) => (seen.has(s.label) ? false : seen.add(s.label)));
}

const SYS = [
  "You are a procurement product-identification assistant for a hospital system's buyers across ALL departments (central sterile, lab, engineering/facilities, admin/office, surgery, patient care).",
  "Given a free-text item need, identify the product and return STRICT JSON only.",
  "Schema: {normalized_name:string, category:string, department:string, unit:string, considerations:string[2..4], indicative_low:number|null, indicative_high:number|null, price_basis:string, note:string}.",
  "considerations = 2-4 short things a buyer should specify/verify (size, grade, spec, compatibility).",
  "indicative_low/high = a TYPICAL public LIST/retail unit-price range in USD ONLY for common commodity items you are confident about; otherwise BOTH null. This is an estimate to orient the buyer, NOT a contract or benchmark price.",
  "price_basis = one short phrase describing what the range represents (e.g. 'typical online list, per each') or '' if null.",
  "Hard rules: never fabricate a precise price; when unsure, use null. Do not claim to know what any specific supplier or GPO charges. Buy-side only. No medical or clinical advice.",
].join(" ");

async function askAI(query, department) {
  if (!API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0.2, max_tokens: 320,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: `Item need: ${query}${department ? `\nDepartment: ${department}` : ""}` },
        ],
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    const txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!txt) return null;
    let o; try { o = JSON.parse(txt); } catch (e) { return null; }
    const n = (x) => (x == null || isNaN(Number(x)) ? null : Number(x));
    let lo = n(o.indicative_low), hi = n(o.indicative_high);
    if (lo != null && hi != null && lo > hi) { const t = lo; lo = hi; hi = t; }
    return {
      normalized_name: String(o.normalized_name || query).slice(0, 120),
      category: String(o.category || "").slice(0, 60),
      department: String(o.department || department || "").slice(0, 60),
      unit: String(o.unit || "each").slice(0, 24),
      considerations: Array.isArray(o.considerations) ? o.considerations.slice(0, 4).map((c) => String(c).slice(0, 120)) : [],
      indicative_low: lo, indicative_high: hi,
      price_basis: lo != null ? String(o.price_basis || "typical online list").slice(0, 80) : "",
      note: String(o.note || "").slice(0, 240),
    };
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}

async function find(body) {
  const query = String((body && body.query) || "").trim();
  const department = String((body && body.department) || "").trim();
  if (query.length < 2) return { status: 400, json: { error: "Enter a product to search." } };

  // Source of truth: does DHI carry it?
  let dhi = null;
  try {
    const r = analyze([{ desc: query, qty: 1 }]);
    const row = r && r.rows && r.rows[0];
    if (row && row.matched) dhi = { name: row.benchmark_name, price: row.benchmark_price, id: row.matched_id || null };
  } catch (e) { /* catalog optional */ }

  const ai = await askAI(query, department);
  const sources = sourceLinks(query, ai ? ai.department || department : department);

  return { status: 200, json: { ok: true, query, department, dhi, ai, sources, ai_enabled: !!API_KEY } };
}

module.exports = { find, sourceLinks };
