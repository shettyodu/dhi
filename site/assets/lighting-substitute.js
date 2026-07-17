/* =====================================================================
   Lighting auto-substitution engine.
   Given a fixture (e.g. an out-of-stock Acuity high bay), find COMPLIANT
   alternatives from the catalog by matching the specs that actually matter:
   fixture family, lumen output, color temperature (CCT), and voltage — then
   rank, preferring in-stock. Pure logic (browser + node), no network.

   Honesty: "compliance" here means published-spec compatibility (type + lumens
   + CCT + voltage). It is a sourcing aid, not a photometric/plan certification —
   final equivalence is confirmed against the project's spec sheet. Stock status
   is illustrative until Wesco's live inventory feed is connected.

   Browser:  LightingSub.configure(PRODUCTS[, stockFn]); LightingSub.find(id|spec)
   Node:     const S = require('./lighting-substitute'); S.configure(list); ...
   ===================================================================== */
(function (root) {
  let PRODUCTS = [];
  let BY_ID = new Map();
  let STOCK = null; // optional (p) => "in" | "check" | "out"

  function configure(products, stockFn) {
    PRODUCTS = Array.isArray(products) ? products : [];
    BY_ID = new Map(PRODUCTS.map((p) => [String(p.id).toLowerCase(), p]));
    STOCK = typeof stockFn === "function" ? stockFn : null;
  }

  const sup = (p) => (p && p.supplier) || "Keystone Technologies";

  /* ---- default stock model (ILLUSTRATIVE until a live feed is wired) ----
     DHI's own Keystone line is treated as stocked; added-brand items (no cost/
     inventory loaded yet) are "check availability". A demo can override any SKU
     via setStock(). This is clearly a placeholder for Wesco's real feed. */
  const stockOverride = new Map();
  function setStock(id, status) { if (id) stockOverride.set(String(id).toLowerCase(), status); }
  function clearStock() { stockOverride.clear(); }
  function stockOf(p) {
    const o = stockOverride.get(String(p.id).toLowerCase());
    if (o) return o;
    if (STOCK) return STOCK(p);
    return sup(p) === "Keystone Technologies" ? "in" : "check";
  }

  /* ---------------- spec parsers ---------------- */
  // Canonical fixture family from group + specs keywords (robust across the
  // catalog's granular group names).
  const TYPE_RULES = [
    ["highbay", /high\s*bay|hibay|\bufo\b/i],
    ["troffer", /troffer|flat\s*panel|\bpanel\b|back\s*lit|edge\s*lit|volumetric/i],
    ["area", /area|site\s*light|shoebox|roadway|street|parking/i],
    ["wallpack", /wall\s*pack|wallpack/i],
    ["flood", /flood/i],
    ["canopy", /canopy|soffit|gas\s*station/i],
    ["vaportight", /vapor\s*tight|vaportight|\bvt\b|enclosed\s*gasket/i],
    ["strip", /strip\b|stairwell|wrap/i],
    ["downlight", /downlight|recessed\s*can|retrofit\s*down|wafer/i],
    ["linear", /recessed\s*linear|pendant\s*linear|surface\s*linear|architectural\s*linear|suspended\s*linear|continuum/i],
    ["sconce", /sconce|wall\s*mount\s*linear/i],
    ["track", /track/i],
    ["exit", /exit|emergency/i],
    ["lamp", /\blamp\b|a19|a21|\bpar\d|\bbr\d|\bt8\b|\bt5\b|corncob|\bhid\b|bulb/i],
  ];
  function fixtureType(p) {
    const hay = ((p.group || "") + " " + (p.specs || "") + " " + (p.cat || "")).toLowerCase();
    for (const [t, re] of TYPE_RULES) if (re.test(hay)) return t;
    return (p.group || p.cat || "other").toLowerCase();
  }

  // Is this an actual luminaire/lamp (a substitutable end product) rather than an
  // accessory — wire guard, mount kit, cable, sensor, driver, control? Accessories
  // pollute substitution, so they're excluded as candidates.
  function isLuminaire(p) {
    if (p.cat === "Controls" || p.cat === "Power Supplies") return false;
    const tag = ((p.id || "") + " " + (p.group || "")).toLowerCase();
    if (/(-kit\b)|\bkit\b|wire\s*guard|\bguard\b|bracket|\bcable\b|canopy\s*cover|accessor|\bsensor\b|photocell|receptacle|commission|\bwhip\b|\bcord\b|adapter|occupancy|dimmer|\bhook\b|\bchain\b/.test(tag)) return false;
    return true;
  }

  function parseLumens(s) {
    if (!s) return null;
    const t = String(s).replace(/,/g, "");
    const upTo = /up\s*to\s*(\d{3,7})/i.exec(t);
    if (upTo) return { min: Math.round(+upTo[1] * 0.5), max: +upTo[1] };
    const range = /(\d{3,7})\s*[-–]\s*(\d{3,7})/.exec(t);
    if (range) return { min: +range[1], max: +range[2] };
    const one = /(\d{3,7})/.exec(t);
    if (one) return { min: +one[1], max: +one[1] };
    return null;
  }
  function parseCCTs(s) {
    const set = new Set();
    if (!s) return set;
    const re = /(\d{4})\s*k/gi; let m;
    while ((m = re.exec(String(s)))) { const k = +m[1]; if (k >= 1800 && k <= 6800) set.add(k); }
    return set;
  }
  // Voltage capability flags from the description.
  function parseVolt(p) {
    const t = ((p.specs || "") + " " + (p.w || "")).toLowerCase();
    const uni = /mvolt|uvolt|\bunv\b|universal|120\s*[-–]\s*277|120\s*[-–]\s*347/.test(t);
    return {
      low: uni || /\b120\b|\b208\b|\b240\b|\b277\b/.test(t) || (!/\d{3}\s*v/.test(t)), // default assume commercial low if unspecified
      v347: uni || /\b347\b/.test(t) || /277\s*[-–]\s*480/.test(t),
      v480: /\b480\b/.test(t) || /277\s*[-–]\s*480/.test(t),
      known: /volt|mvolt|uvolt|unv|\b\d{3}\s*v|\b\d{3}\s*[-–]\s*\d{3}\b/.test(t),
    };
  }
  function parseWatts(s) {
    if (!s) return null;
    const t = String(s).replace(/,/g, "");
    const range = /(\d{1,4}(?:\.\d+)?)\s*[-–]\s*(\d{1,4}(?:\.\d+)?)/.exec(t);
    if (range) return { min: +range[1], max: +range[2] };
    const one = /(\d{1,4}(?:\.\d+)?)/.exec(t);
    if (one) return { min: +one[1], max: +one[1] };
    return null;
  }

  const mid = (r) => (r ? (r.min + r.max) / 2 : null);
  function rangesOverlap(a, b) { return a && b && a.min <= b.max && b.min <= a.max; }
  function lumenMatch(a, b) {
    if (!a || !b) return { ok: false, note: "" };
    if (rangesOverlap(a, b)) return { ok: true, note: "lumen ranges overlap" };
    const ma = mid(a), mb = mid(b), prox = Math.abs(ma - mb) / Math.max(ma, mb);
    if (prox <= 0.4) return { ok: true, note: "within ~" + Math.round(prox * 100) + "% output" };
    return { ok: false, note: "" };
  }
  function cctShared(a, b) {
    if (!a.size || !b.size) return null; // unknown
    for (const k of a) if (b.has(k)) return k;
    return 0;
  }
  function voltMatch(a, b) {
    if (!a.known || !b.known) return null;         // unknown -> neutral
    return (a.low && b.low) || (a.v347 && b.v347) || (a.v480 && b.v480);
  }

  function fmtLm(r) { return r ? (r.min === r.max ? r.min.toLocaleString() : r.min.toLocaleString() + "–" + r.max.toLocaleString()) : "—"; }

  /* ---------------- find ---------------- */
  // target: a catalog id (string) OR a spec object { type?, lm, cct, volt, group, specs, w }.
  function find(target, opts = {}) {
    const n = opts.n || 5;
    let base = null, baseId = null;
    if (typeof target === "string") { base = BY_ID.get(target.toLowerCase()); baseId = base && base.id; }
    else base = target || {};
    if (!base) return { base: null, results: [] };

    const bType = base.type || fixtureType(base);
    const bLm = parseLumens(base.lm), bCct = parseCCTs(base.cct), bVolt = parseVolt(base), bW = parseWatts(base.w);

    const scored = [];
    for (const p of PRODUCTS) {
      if (baseId && p.id === baseId) continue;
      if (!isLuminaire(p)) continue;                       // skip accessories/controls
      if (fixtureType(p) !== bType) continue;              // same fixture family (required)
      const lm = lumenMatch(bLm, parseLumens(p.lm));
      const cct = cctShared(bCct, parseCCTs(p.cct));
      const volt = voltMatch(bVolt, parseVolt(p));
      const st = stockOf(p);
      if (opts.inStockOnly && st !== "in") continue;

      let score = 0;
      const chips = [];
      if (lm.ok) { score += 40; chips.push({ ok: true, k: "Lumens", v: fmtLm(parseLumens(p.lm)) + " (" + lm.note + ")" }); }
      else if (parseLumens(p.lm)) chips.push({ ok: false, k: "Lumens", v: fmtLm(parseLumens(p.lm)) });
      if (cct) { score += 25; chips.push({ ok: true, k: "CCT", v: "shares " + cct + "K" }); }
      else if (cct === 0) chips.push({ ok: false, k: "CCT", v: (p.cct || "—") });
      if (volt === true) { score += 20; chips.push({ ok: true, k: "Voltage", v: "compatible" }); }
      else if (volt === false) chips.push({ ok: false, k: "Voltage", v: "differs" });
      if (bW && parseWatts(p.w)) { const prox = Math.abs(mid(bW) - mid(parseWatts(p.w))) / Math.max(mid(bW), mid(parseWatts(p.w))); if (prox <= 0.5) score += 10; }
      if (st === "in") score += 30;                         // prefer in-stock
      else if (st === "check") score += 5;
      // small preference for DHI's own line (margin) as a tie-breaker
      if (sup(p) === "Keystone Technologies") score += 4;

      // Tiers (honest about how much we can actually verify from published specs):
      //  - "compliant": same type + (lumens OR cct match) + voltage not conflicting
      //  - "candidate": same type but spec data too thin to verify (no lm & no cct)
      //  - "differs":   same type but a checked spec conflicts (e.g. voltage differs)
      const hasData = !!parseLumens(p.lm) || !!parseCCTs(p.cct).size;
      let tier;
      if ((lm.ok || !!cct) && volt !== false) tier = "compliant";
      else if (!hasData && volt !== false) tier = "candidate";
      else tier = "differs";
      const compliant = tier === "compliant";
      scored.push({ p, score, chips, stock: st, tier, compliant });
    }
    const rank = { compliant: 0, candidate: 1, differs: 2 };
    scored.sort((a, b) => (rank[a.tier] - rank[b.tier]) || (b.score - a.score));
    return {
      base: baseId ? base : Object.assign({ type: bType }, base),
      baseType: bType,
      results: scored.slice(0, n).map((x) => ({
        id: x.p.id, supplier: sup(x.p), group: x.p.group || x.p.cat, specs: x.p.specs,
        w: x.p.w || "", lm: x.p.lm || "", cct: x.p.cct || "", price: x.p.p,
        stock: x.stock, tier: x.tier, compliant: x.compliant, score: x.score, chips: x.chips,
      })),
    };
  }

  const api = { configure, find, setStock, clearStock, stockOf, fixtureType, parseLumens, parseCCTs, parseVolt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LightingSub = api;
})(typeof window !== "undefined" ? window : globalThis);
