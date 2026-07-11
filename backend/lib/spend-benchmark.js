/* Supply Spend Check — benchmark a provider's paid prices against DHI's supply
   catalog and surface potential savings. Buy-side only; the benchmark is DHI's
   own catalog price (honest, and ties straight to fulfillment). Deterministic
   token-overlap matching so it works with no external API. */
const CATALOG = require("../data/supplies-index.json");

const STOP = new Set(["the", "and", "for", "with", "each", "box", "case", "per", "of", "a", "an", "type", "level", "aami", "size", "sizes", "pack", "packs", "ct", "count", "pcs", "pc", "unit", "units", "medical", "surgical"]);
// tokens that strongly signal a product category (weighted higher in scoring)
const KEY = new Set(["glove", "gloves", "gown", "gowns", "mask", "masks", "respirator", "n95", "kn95", "coverall", "coveralls", "drape", "drapes", "scrub", "scrubs", "cap", "caps", "bouffant", "shield", "shields", "goggle", "goggles", "sanitizer", "sanitiser", "underpad", "underpads", "bedding", "kit", "sponge", "isolation", "nitrile", "latex", "vinyl", "otpack", "pack"]);
// map input synonyms → canonical category tokens (added to the token set)
const SYN = {
  nitrile: "glove", latex: "glove", vinyl: "glove", exam: "glove",
  n95: "mask", kn95: "mask", respirator: "mask", facemask: "mask", earloop: "mask",
  isolation: "gown", aprons: "gown", apron: "gown",
  bouffant: "cap", hairnet: "cap", surgeon: "cap",
  goggle: "shield", goggles: "shield", faceshield: "shield", visor: "shield",
  sanitiser: "sanitizer", handrub: "sanitizer", handgel: "sanitizer",
  chux: "underpad", underpad: "underpad",
  ppe: "coverall",
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const toks = (s) => norm(s).split(/\s+/).filter((t) => t && t.length > 1 && !STOP.has(t));

// Precompute a token set per catalog item (name + cat + group + specs).
// Only items with a valid positive price can serve as a benchmark.
const INDEX = CATALOG.filter((item) => Number(item.p) > 0).map((item) => {
  const set = new Set(toks([item.name, item.cat, item.group, item.specs].join(" ")));
  return { item, set };
});

function expand(tokens) {
  const out = new Set(tokens);
  for (const t of tokens) if (SYN[t]) out.add(SYN[t]);
  return out;
}

function bestMatch(desc, price) {
  const want = expand(toks(desc));
  if (!want.size) return null;
  const scored = [];
  let bestScore = 0;
  for (const { item, set } of INDEX) {
    let score = 0;
    for (const t of want) if (set.has(t)) score += KEY.has(t) ? 3 : 1;
    if (score >= 3) { scored.push({ item, score }); if (score > bestScore) bestScore = score; }
  }
  if (!scored.length) return null; // needs at least one category-level hit
  // Among the top-scoring candidates, prefer the nearest-equivalent by price — so
  // a "level-3 surgical gown" isn't matched to the cheapest generic gown (which
  // would overstate savings). Conservative by design.
  const top = scored.filter((s) => s.score >= bestScore - 1);
  let pick = top[0];
  if (price > 0) {
    let bestDist = Infinity;
    for (const s of top) {
      const p = Number(s.item.p);
      if (!(p > 0)) continue;
      const dist = Math.abs(Math.log(p / price));
      if (dist < bestDist) { bestDist = dist; pick = s; }
    }
  }
  return { item: pick.item, score: pick.score };
}

const money = (x) => { const n = Number(String(x).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };
const qtyOf = (x) => { const n = Number(String(x).replace(/[^0-9.\-]/g, "")); return isNaN(n) || n <= 0 ? 1 : Math.round(n); };

/* lines: [{ desc, unit_price, qty }] → benchmarked analysis */
function analyze(lines) {
  const rows = (Array.isArray(lines) ? lines : []).slice(0, 250).map((ln) => {
    const desc = String(ln.desc || ln.item || "").slice(0, 160).trim();
    const priceRaw = ln.unit_price != null ? ln.unit_price : ln.price;
    const price = (priceRaw === "" || priceRaw == null) ? null : money(priceRaw); // current price is optional
    const qty = qtyOf(ln.qty != null ? ln.qty : 1);
    const m = desc ? bestMatch(desc, price || 0) : null;
    if (!m) return { desc, qty, unit_price: price, matched: false };
    const bench = Number(m.item.p);
    if (!(bench > 0)) return { desc, qty, unit_price: price, matched: false };
    // No current price given → quote mode: show what DHI would charge, no "savings".
    if (price == null || price <= 0) {
      return { desc, qty, unit_price: null, matched: true, quote_only: true, benchmark_name: m.item.name, benchmark_price: bench, unit: m.item.unit, over_pct: null, line_spend: 0, line_savings: 0 };
    }
    // Guard against unit mismatches (per-each vs per-box): >12x either way isn't
    // comparable — skip rather than report a bogus saving.
    if (price / bench > 12 || bench / price > 12) {
      return { desc, qty, unit_price: price, matched: false };
    }
    const over = price - bench;
    const line_savings = over > 0 ? Math.round(over * qty * 100) / 100 : 0;
    return {
      desc, qty, unit_price: price, matched: true,
      benchmark_name: m.item.name, benchmark_price: bench, unit: m.item.unit,
      over_pct: bench > 0 ? Math.round((over / bench) * 100) : null,
      line_spend: Math.round(price * qty * 100) / 100,
      line_savings,
    };
  });

  const matched = rows.filter((r) => r.matched);
  const total_spend = Math.round(matched.reduce((s, r) => s + (r.line_spend || 0), 0) * 100) / 100;
  const total_savings = Math.round(matched.reduce((s, r) => s + (r.line_savings || 0), 0) * 100) / 100;
  return {
    rows,
    summary: {
      lines: rows.length,
      matched: matched.length,
      unmatched: rows.length - matched.length,
      total_spend,
      total_savings,
      savings_pct: total_spend > 0 ? Math.round((total_savings / total_spend) * 100) : 0,
      catalog_size: CATALOG.length,
    },
  };
}

module.exports = { analyze };
