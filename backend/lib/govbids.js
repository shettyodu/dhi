/* Government bid match-maker (Phase 1: federal + defense via SAM.gov).
   - LIVE when SAM_GOV_API_KEY is set → queries the SAM.gov Get Opportunities
     API (https://api.sam.gov/opportunities/v2/search).
   - Otherwise returns curated SAMPLE opportunities so the rep tool is fully
     demoable before the (free, ~10-business-day) API key is approved.
   - Maps DHI verticals → NAICS codes; turns plain-English queries into the
     right verticals/NAICS + a title term; scores each opportunity for fit.
   Returns { status, json }. Never throws to the caller. */

const SAM_API_KEY = process.env.SAM_GOV_API_KEY || "";
const SAM_URL = "https://api.sam.gov/opportunities/v2/search";
// SAM.gov's own website search backend — does FULL-TEXT matching (title + body),
// the same results a person sees on sam.gov. The official key'd API above only
// matches the solicitation TITLE, so a keyword like "waterline" returns far fewer
// hits there. We use this for free-text keyword searches to reach parity, and fall
// back to the official API if it's unavailable. No key required (public endpoint).
const SAM_WEB_URL = "https://sam.gov/api/prod/sgs/v1/search/";
const TIMEOUT_MS = Number(process.env.SAM_GOV_TIMEOUT_MS || 8000);

// DHI vertical → NAICS codes (for SAM filtering) + keywords (for NL matching).
const VERTICALS = {
  "lighting": { label: "Lighting & Energy Efficiency", naics: ["335110", "335129", "335139", "238210"], kw: ["light", "lighting", "led", "lamp", "fixture", "luminaire", "energy efficien", "retrofit"] },
  "medical-equipment": { label: "Medical Equipment & Technology", naics: ["339112", "334510", "423450"], kw: ["medical equipment", "ultrasound", "x-ray", "x ray", "imaging", "patient monitor", "diagnostic", "ventilator", "ecg", "defibrillator"] },
  "cybersecurity": { label: "Cybersecurity & Infrastructure", naics: ["541512", "541519", "541513", "517311"], kw: ["cyber", "cybersecurity", "security operations", "soc", "infosec", "information security", "endpoint", "ransomware", "zero trust"] },
  "decentralized-software": { label: "Decentralized Software", naics: ["541511", "541512", "518210"], kw: ["software", "ehr", "emr", "health record", "application development", "custom programming", "blockchain", "informatics"] },
  "data-analytics": { label: "Data & Analytics", naics: ["518210", "541511", "541512"], kw: ["data", "analytics", "artificial intelligence", "ai ", "interoperability", "cloud", "machine learning"] },
  "supplies": { label: "Supplies, Textiles & Linens", naics: ["339113", "423450", "322291", "314999"], kw: ["ppe", "gown", "drape", "surgical mask", "glove", "medical supplies", "textile", "linen", "consumable", "respirator", "n95"] },
  "clinics": { label: "Clinics & Modules", naics: ["236220", "339112", "621498"], kw: ["modular clinic", "mobile unit", "mobile medical", "prefab", "field hospital", "containerized"] },
  "wellness": { label: "Wellness & Digital Care", naics: ["621999", "621498", "541511"], kw: ["telehealth", "telemedicine", "remote patient monitoring", "behavioral health", "cognitive", "wellness"] },
  "insurance": { label: "Insurance & Risk Solutions", naics: ["524210", "524292", "523930"], kw: ["insurance", "benefits administration", "risk", "claims administration"] },
  "automotive": { label: "AutoCommand (vehicles & fleet)", naics: ["441110", "441120", "336111", "532112"], kw: ["vehicle", "automobile", "fleet", "passenger car", "light truck", "vehicle leasing"] },
};

const FAVORABLE_SETASIDE = /small business|sdvosb|service-disabled|8\(a\)|8a|wosb|edwosb|hubzone|veteran/i;

function num(s) { const n = Number(s); return isNaN(n) ? null : n; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d)) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}
function fmtDate(d) { const p = (x) => String(x).padStart(2, "0"); return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`; }

// ---- Plain-English → { verticals[], naics[], title } -------------------------
function interpret(query, vertical) {
  const out = { verticals: [], naics: [], title: "", matchedKw: [] };
  if (vertical && VERTICALS[vertical]) {
    out.verticals = [vertical];
    out.naics = VERTICALS[vertical].naics.slice();
    return out;
  }
  const q = String(query || "").toLowerCase();
  for (const [key, v] of Object.entries(VERTICALS)) {
    const hit = v.kw.find((k) => q.includes(k));
    if (hit) { out.verticals.push(key); out.matchedKw.push(hit); v.naics.forEach((n) => { if (!out.naics.includes(n)) out.naics.push(n); }); }
  }
  // When a vertical matched, filter by its NAICS only (combining NAICS + a title
  // term over-narrows SAM's title-only text search). When nothing matched, fall
  // back to a keyword title search on the query with stopwords stripped.
  if (!out.naics.length) {
    const STOP = new Set("are there any open bid bids opportunity opportunities for the a an and of to in on do does we i have has is it me find show get all current available new federal government defense commercial contract contracts solicitation solicitations rfp rfq rfi sources sought".split(" "));
    const words = q.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
    out.title = words.slice(0, 4).join(" ");
  }
  return out;
}

// ---- Scoring -----------------------------------------------------------------
function scoreOpportunity(opp, naicsSet) {
  let s = 50; const why = [];
  if (opp.naics && naicsSet.has(String(opp.naics))) { s += 25; why.push("NAICS match"); }
  const d = daysUntil(opp.deadline);
  if (d != null) {
    if (d < 0) { s -= 40; why.push("deadline passed"); }
    else if (d <= 3) { s -= 5; why.push("closes very soon"); }
    else if (d <= 60) { s += 15; why.push(`${d} days to respond`); }
    else { s += 5; why.push("ample lead time"); }
  }
  if (FAVORABLE_SETASIDE.test(opp.setAside || "")) { s += 10; why.push("favorable set-aside"); }
  return { score: clamp(Math.round(s), 0, 100), why };
}

// ---- SAM.gov live fetch ------------------------------------------------------
async function fetchSam(params) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = SAM_URL + "?" + new URLSearchParams(params).toString();
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) return { ok: false, status: r.status };
    const j = await r.json().catch(() => ({}));
    return { ok: true, data: j };
  } catch (e) {
    return { ok: false, status: e.name === "AbortError" ? 504 : 502, error: e.message };
  } finally { clearTimeout(timer); }
}

function normalizeSam(o) {
  return {
    id: o.noticeId || o.solicitationNumber || (o.title || "").slice(0, 40),
    title: o.title || "(untitled)",
    agency: o.fullParentPathName || o.organizationName || o.department || "",
    naics: o.naicsCode || (Array.isArray(o.naics) && o.naics[0] && o.naics[0].code) || "",
    type: o.type || o.baseType || "",
    posted: o.postedDate || "",
    deadline: o.responseDeadLine || o.responseDeadline || "",
    setAside: o.typeOfSetAside || o.typeOfSetAsideDescription || "",
    place: (o.placeOfPerformance && (o.placeOfPerformance.state && o.placeOfPerformance.state.name)) || "",
    solicitation: o.solicitationNumber || "",
    link: o.uiLink || (o.noticeId ? `https://sam.gov/opp/${o.noticeId}/view` : "https://sam.gov/search/"),
    descriptionLink: o.description || "", // SAM URL to the full solicitation text (fetched at proposal time)
    source: "SAM.gov",
  };
}

// ---- SAM.gov website full-text search (parity with sam.gov) ------------------
async function fetchSamWeb(term, size) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const qs = new URLSearchParams({ index: "opp", page: "0", mode: "search", sort: "-relevance", size: String(size || 100), mfe: "false", q: term, qMode: "ALL", is_active: "true" });
    const r = await fetch(SAM_WEB_URL + "?" + qs.toString(), { headers: { Accept: "application/hal+json", "User-Agent": "Mozilla/5.0 (DHI bid portal)" }, signal: ctrl.signal });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, status: e.name === "AbortError" ? 504 : 502 };
  } finally { clearTimeout(timer); }
}

function normalizeSamWeb(o) {
  const h = Array.isArray(o.organizationHierarchy) ? o.organizationHierarchy : [];
  const names = h.map((x) => x && x.name).filter(Boolean);
  const dept = names[0] || "", office = names[names.length - 1] || "";
  const agency = office && office !== dept ? `${dept} — ${office}` : (dept || office);
  const desc = (Array.isArray(o.descriptions) && o.descriptions[0] && o.descriptions[0].content) || "";
  return {
    id: o._id || o.solicitationNumber || (o.title || "").slice(0, 40),
    title: o.title || "(untitled)",
    agency,
    naics: o.naicsCode || (Array.isArray(o.naics) && o.naics[0] && o.naics[0].code) || "",
    type: (o.type && (o.type.value || o.type.code)) || o.typeOfNoticeDescription || "",
    posted: o.publishDate || o.modifiedDate || "",
    deadline: o.responseDate || o.responseDateActual || "",
    setAside: (o.typeOfSetAside && (o.typeOfSetAside.value || o.typeOfSetAside)) || "",
    place: "",
    solicitation: o.solicitationNumber || "",
    link: o._id ? `https://sam.gov/opp/${o._id}/view` : "https://sam.gov/search/",
    descriptionLink: "",
    descriptionText: desc.slice(0, 1200),
    source: "SAM.gov",
  };
}

async function searchSamWebsite(term) {
  const r = await fetchSamWeb(term, 100);
  if (!r.ok) return { error: true, status: r.status };
  const rows = (r.data && r.data._embedded && r.data._embedded.results) || [];
  const seen = new Set(), out = [];
  for (const o of rows) { const n = normalizeSamWeb(o); if (!seen.has(n.id)) { seen.add(n.id); out.push(n); } }
  return { error: false, opportunities: out, total: (r.data.page && r.data.page.totalElements) || out.length };
}

async function searchLive(interp, daysBack) {
  // Free-text keyword search (no vertical/NAICS match): use SAM.gov's website
  // full-text endpoint so the portal returns the SAME entries as sam.gov (matches
  // title AND solicitation body). Fall back to the official key'd API (title-only)
  // if the website search is unavailable.
  const keyword = !interp.naics.length && !!interp.title;
  if (keyword) {
    const web = await searchSamWebsite(interp.title);
    if (!web.error && web.opportunities.length) return { error: false, opportunities: web.opportunities, fulltext: true };
    const to = new Date(), from = new Date(Date.now() - 364 * 86400000);
    const r = await fetchSam({ api_key: SAM_API_KEY, postedFrom: fmtDate(from), postedTo: fmtDate(to), limit: "100", title: interp.title });
    if (!r.ok) return { error: true, status: r.status };
    const rows = (r.data && r.data.opportunitiesData) || [];
    const seen = new Set(), out = [];
    for (const o of rows) { const n = normalizeSam(o); if (!seen.has(n.id)) { seen.add(n.id); out.push(n); } }
    return { error: false, opportunities: out, fulltext: false };
  }
  return searchLiveNaics(interp, daysBack);
}

async function searchLiveNaics(interp, daysBack) {
  // Vertical/NAICS search via the official key'd API: filter by the matched DHI
  // NAICS codes over a ~90-day window (capped calls to protect the daily quota).
  const span = daysBack || 90;
  const to = new Date();
  const from = new Date(Date.now() - span * 86400000);
  const base = { api_key: SAM_API_KEY, postedFrom: fmtDate(from), postedTo: fmtDate(to), limit: "25", ptype: "o,p,k" };
  const naicsList = interp.naics.length ? interp.naics.slice(0, 3) : [null]; // cap calls to protect the daily quota
  const seen = new Set(); const out = [];
  for (const nc of naicsList) {
    const params = Object.assign({}, base);
    if (nc) params.ncode = nc;
    const r = await fetchSam(params);
    if (!r.ok) { if (!out.length && nc === naicsList[0]) return { error: true, status: r.status }; continue; }
    const rows = (r.data && r.data.opportunitiesData) || [];
    for (const o of rows) { const n = normalizeSam(o); if (!seen.has(n.id)) { seen.add(n.id); out.push(n); } }
  }
  return { error: false, opportunities: out };
}

// ---- Sample data (used until SAM_GOV_API_KEY is set) -------------------------
function sampleOpportunities() {
  const day = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString(); };
  return [
    { id: "SAMPLE-1", title: "LED Lighting Retrofit — VA Medical Center", agency: "Dept. of Veterans Affairs", naics: "335110", type: "Solicitation", posted: day(-6), deadline: day(21), setAside: "Service-Disabled Veteran-Owned Small Business", place: "North Carolina", solicitation: "36C24725R0123", link: "https://sam.gov/search/", source: "SAMPLE" },
    { id: "SAMPLE-2", title: "Portable Ultrasound & Patient Monitors — Field Medical Units", agency: "Defense Logistics Agency", naics: "339112", type: "Combined Synopsis/Solicitation", posted: day(-3), deadline: day(34), setAside: "Total Small Business", place: "TX", solicitation: "SPE2DH25T0456", link: "https://sam.gov/search/", source: "SAMPLE" },
    { id: "SAMPLE-3", title: "Managed Cybersecurity Services (SOC) — Civilian Agency", agency: "Dept. of Health & Human Services", naics: "541512", type: "Presolicitation", posted: day(-9), deadline: day(48), setAside: "8(a)", place: "DC", solicitation: "HHS-25-SOC-009", link: "https://sam.gov/search/", source: "SAMPLE" },
    { id: "SAMPLE-4", title: "Surgical Gowns, Drapes & PPE — IDIQ", agency: "Veterans Health Administration", naics: "339113", type: "Solicitation", posted: day(-1), deadline: day(12), setAside: "Total Small Business", place: "Multiple", solicitation: "36C10X25Q0777", link: "https://sam.gov/search/", source: "SAMPLE" },
    { id: "SAMPLE-5", title: "EHR Modernization & Health-Data Interoperability", agency: "Indian Health Service", naics: "541511", type: "Sources Sought", posted: day(-12), deadline: day(57), setAside: "", place: "AZ", solicitation: "IHS-25-EHR-RFI", link: "https://sam.gov/search/", source: "SAMPLE" },
    { id: "SAMPLE-6", title: "Telehealth & Remote Patient Monitoring Platform", agency: "Dept. of Defense — DHA", naics: "621999", type: "Solicitation", posted: day(-4), deadline: day(2), setAside: "HUBZone", place: "VA", solicitation: "DHA-25-TELE-014", link: "https://sam.gov/search/", source: "SAMPLE" },
  ];
}

// ---- Public entry ------------------------------------------------------------
async function searchBids({ query, vertical, daysBack } = {}) {
  const interp = interpret(query, vertical);
  const naicsSet = new Set(interp.naics);
  let opportunities, live = false, note = "", fulltext = false;

  if (SAM_API_KEY) {
    const r = await searchLive(interp, daysBack);
    if (r.error) {
      // SAM.gov unavailable / daily quota (429) → fall back to sample so the tool
      // is never empty, clearly labeled. (A daily cache, below, removes this.)
      const all = sampleOpportunities();
      opportunities = naicsSet.size ? all.filter((o) => naicsSet.has(String(o.naics))) : all;
      if (!opportunities.length) opportunities = all;
      note = r.status === 429
        ? "SAM.gov's daily quota was reached — showing sample opportunities. Live results resume after the quota resets."
        : "SAM.gov is unavailable right now — showing sample opportunities.";
    } else { opportunities = r.opportunities; live = true; fulltext = !!r.fulltext; }
  } else {
    // demo mode: filter the sample set by matched NAICS (or show all if no match)
    const all = sampleOpportunities();
    opportunities = naicsSet.size ? all.filter((o) => naicsSet.has(String(o.naics))) : all;
    if (!opportunities.length) opportunities = all; // never return empty in demo
    note = "Showing sample opportunities — connect a SAM.gov API key to go live.";
  }

  const scored = opportunities
    .map((o) => Object.assign({}, o, scoreOpportunity(o, naicsSet)))
    .sort((a, b) => b.score - a.score);

  // For a live free-text keyword search, set an explicit note so reps understand
  // the scope. Full-text (website) results match SAM.gov exactly; the title-only
  // fallback is narrower and is labeled as such.
  const keyword = !interp.naics.length && !!interp.title;
  if (live && keyword) {
    if (fulltext) {
      note = scored.length
        ? `Live SAM.gov results for “${interp.title}” — full-text match (same as searching sam.gov).`
        : `No open SAM.gov opportunities for “${interp.title}” right now.`;
    } else {
      note = scored.length
        ? `Live SAM.gov results with “${interp.title}” in the solicitation title (full-text search was unavailable).`
        : `No open SAM.gov solicitations with “${interp.title}” in the title (last 12 months).`;
    }
  }

  return {
    status: 200,
    json: {
      ok: true,
      live,
      note,
      interpreted: {
        verticals: interp.verticals.map((k) => VERTICALS[k].label),
        naics: interp.naics,
        title: interp.title,
      },
      count: scored.length,
      opportunities: scored,
    },
  };
}

function listVerticals() {
  return Object.entries(VERTICALS).map(([key, v]) => ({ key, label: v.label, naics: v.naics }));
}

module.exports = { searchBids, listVerticals, interpret, scoreOpportunity, VERTICALS, fetchSam, normalizeSam, fmtDate, searchSamWebsite, normalizeSamWeb };
