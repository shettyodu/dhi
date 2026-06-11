/* AI proposal generator for the Government Bid Match-Maker.
   Produces an evaluation-ready, page-limit-aware proposal package GROUNDED in
   real DHI facts + partner catalog (capabilities.js).

   Because a single serverless call can't emit 12–15 pages within the function
   timeout, the Technical & Management volume is generated SECTION BY SECTION —
   each section is a focused, in-depth call sized to its page budget. The
   front-end orchestrates: fetch scope once → generate each section → append the
   code-built Price volume + Forms checklist → assemble the full package.

   Compliance/quality: tailored to the ingested solicitation scope; a requirements
   cross-walk in the technical section; LEAN staffing (no over-committed labor/FTE
   obligations, per Steven Burch); unknowns become [BRACKETED PLACEHOLDERS]; the
   model invents no certifications, past performance, customers, or prices. */

const { CORP, profileFor } = require("./capabilities");
const { VERTICALS } = require("./govbids");

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 28000);
const SAM_API_KEY = process.env.SAM_GOV_API_KEY || "";
const WORDS_PER_PAGE = 500;

function verticalForNaics(naics) {
  const n = String(naics || "");
  for (const [key, v] of Object.entries(VERTICALS)) if (v.naics.includes(n)) return key;
  return null;
}

// Volume sections + default page weights (default total ≈ 13 pages of narrative).
const SECTIONS = [
  { key: "exec", title: "Cover Letter, Executive Summary & Understanding", pages: 2,
    ask: "Write the Cover Letter, an Executive Summary, and a DETAILED Understanding of the Requirement. Tie the Understanding to the solicitation scope's specific objectives, tasks, constraints, and evaluation focus. State 2–3 concrete win themes / discriminators for DHI. Substantive, not generic." },
  { key: "technical", title: "Technical Approach", pages: 5,
    ask: "Write a DETAILED Technical Approach — the heart of the volume. First, a brief REQUIREMENTS COMPLIANCE CROSS-WALK (table: requirement → how DHI complies → reference). Then break the approach down BY the specific tasks/requirements in the solicitation scope and address EACH with: our proposed solution, methodology/steps, the specific DHI products/partners/standards used (from the facts), inputs/outputs, deliverables, and acceptance criteria. It must read as evaluation-ready and traceable to the scope — never generic filler." },
  { key: "management", title: "Management, Schedule & Transition", pages: 3,
    ask: "Write the Management Approach: program organization & governance; a phased SCHEDULE with milestones and a transition-in plan; communications, status reporting, and deliverable management; subcontractor/partner management. Keep STAFFING LEAN — describe how DHI plus partners deliver the outcomes WITHOUT over-committing to specific FTE counts, labor categories, or staffing obligations. Do not create unnecessary staffing complexity." },
  { key: "riskqa", title: "Risk Management & Quality Assurance", pages: 2,
    ask: "Write Risk Management (a concise table of key risks → likelihood/impact → mitigation) and Quality Assurance (QA/QC methodology, a quality surveillance & performance-metrics approach, and how compliance with applicable standards — e.g., HIPAA/NIST 800-53/CE/ISO as relevant — is verified)." },
  { key: "pastperf", title: "Past Performance & Key Personnel", pages: 2,
    ask: "Write Past Performance (2–3 relevant examples framed to THIS requirement, using [BRACKETED PLACEHOLDERS] for client names, contract values, periods of performance, and references — invent no specific contracts) and Key Personnel (roles, responsibilities, and qualifications mapped to the requirements; use [PLACEHOLDERS] for names/résumés)." },
];
const DEFAULT_TOTAL_PAGES = SECTIONS.reduce((a, s) => a + s.pages, 0);

function profileAndVertical(o) {
  const vKey = o.vertical || verticalForNaics(o.naics);
  return { vKey, profile: profileFor(vKey) };
}
function factSheet(p) {
  const L = [];
  if (p.partners && p.partners.length) L.push("Partners: " + p.partners.join("; "));
  if (p.offerings) L.push("Offerings/products:\n  - " + p.offerings.join("\n  - "));
  if (p.quality && p.quality.length) L.push("Quality: " + p.quality.join("; "));
  if (p.standards && p.standards.length) L.push("Standards/certifications: " + p.standards.join("; "));
  if (p.differentiators && p.differentiators.length) L.push("Differentiators: " + p.differentiators.join("; "));
  return L.join("\n");
}
function corpSheet() {
  return [`Company: ${CORP.name} — HQ ${CORP.hq}.`, `Positioning: ${CORP.positioning}`, `Leadership: ${CORP.leadership}`, `Registrations: ${CORP.registrations.join("; ")}.`, `Contracting: ${CORP.contracting}`].join("\n");
}
function oppSheet(o) {
  return [`Title: ${o.title || "(untitled)"}`, `Agency: ${o.agency || "—"}`, `Solicitation #: ${o.solicitation || "—"}`, `NAICS: ${o.naics || "—"}    Type: ${o.type || "—"}`, `Set-aside: ${o.setAside || "Full & open"}`, `Place of performance: ${o.place || "—"}`, `Response deadline: ${o.deadline || "—"}`].join("\n");
}

// ---- A) ingest the actual solicitation text (once) --------------------------
async function fetchScope(link) {
  if (!link || !SAM_API_KEY) return "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const sep = link.includes("?") ? "&" : "?";
    const res = await fetch(link + sep + "api_key=" + encodeURIComponent(SAM_API_KEY), { signal: ctrl.signal });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    let text = "";
    if (ct.includes("json")) { const j = await res.json().catch(() => null); text = (j && (j.description || j.body)) || (typeof j === "string" ? j : ""); }
    else text = await res.text().catch(() => "");
    return String(text).replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim().slice(0, 9000);
  } catch (e) { return ""; } finally { clearTimeout(timer); }
}

async function callOpenAI(system, user, maxTokens, jsonMode) {
  if (!API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const payload = { model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.4, max_tokens: maxTokens };
    if (jsonMode) payload.response_format = { type: "json_object" };
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

// ---- generate ONE volume section (sized to its page budget) -----------------
async function generateSection(opportunity, sectionKey, scopeText, pageLimit) {
  const o = opportunity || {};
  const { profile } = profileAndVertical(o);
  if (!profile) return { status: 422, json: { ok: false, error: "No DHI vertical matches this opportunity's NAICS." } };
  const section = SECTIONS.find((s) => s.key === sectionKey);
  if (!section) return { status: 400, json: { ok: false, error: "Unknown section" } };

  const limit = Math.max(6, Math.min(40, parseInt(pageLimit, 10) || DEFAULT_TOTAL_PAGES));
  const pageBudget = Math.max(1, Math.round(section.pages * (limit / DEFAULT_TOTAL_PAGES)));
  const maxTokens = Math.min(2400, Math.round(pageBudget * WORDS_PER_PAGE * 1.4)); // ~1.4 tokens/word; capped to fit the function timeout (each section is a separate call)

  const system =
    "You are a senior U.S. Government proposal writer for Digital Health International Inc. (DHI). Write ONE section of a formal proposal at the depth and rigor a source-selection board expects. " +
    "Use ONLY the DHI facts, partners, products, and standards provided — invent NO certifications, past performance, customers, or specific prices. " +
    (scopeText ? "Tailor the content specifically to the SOLICITATION SCOPE provided and make it traceable to its requirements. " : "") +
    "Use [BRACKETED PLACEHOLDERS] for unknowns. Use clear headings/sub-headings, tables where useful, and complete paragraphs — substantive, no filler or padding.";
  const user =
    `WRITE ONLY THIS SECTION: ${section.title}\nTarget length: about ${pageBudget} page(s) (~${pageBudget * WORDS_PER_PAGE} words) — be thorough but do not pad.\nSECTION INSTRUCTIONS: ${section.ask}\n\n` +
    `SOLICITATION\n${oppSheet(o)}\n\n` +
    (scopeText ? `SOLICITATION SCOPE (verbatim excerpt — tailor to this)\n${scopeText}\n\n` : "") +
    `DHI CORPORATE FACTS\n${corpSheet()}\n\nMATCHED CAPABILITY — ${profile.label}\n${factSheet(profile)}\n`;

  let content = await callOpenAI(system, user, maxTokens);
  if (!content) content = `## ${section.title}\n[Draft unavailable — generate again. Section: ${section.ask}]`;
  return { status: 200, json: { ok: true, ai: !!API_KEY, key: section.key, title: section.title, pages: pageBudget, content } };
}

// ---- C) pricing scaffold (Volume III) — code-built ---------------------------
function pricingVolume(profile, o) {
  const rows = (profile.offerings || []).map((off, i) => `${String(i + 1).padStart(2, " ")}. ${off}\n     Partner: ${(profile.partners || ["—"])[0]}   Qty: [QTY]   Unit: [QUOTE]   Extended: [QUOTE]`);
  return [`VOLUME III — PRICE / COST PROPOSAL`, `Opportunity: ${o.title || ""}  (Sol. ${o.solicitation || "—"})`, ``,
    `Line items (seeded from DHI's ${profile.label} partner catalog — confirm quantities and obtain partner quotes; map to the solicitation's CLIN structure):`, ``,
    ...rows, ``, `Subtotal: [SUBTOTAL]    Freight/Install (if applicable): [QUOTE]    TOTAL: [TOTAL]`, ``,
    `Notes: Volume discounts available for large procurements. Pricing subject to partner quotes and the CLIN structure / period of performance.`].join("\n");
}

// ---- B) forms & compliance checklist — code-built ----------------------------
function formsChecklist(o) {
  const type = String(o.type || "").toLowerCase(); const sa = String(o.setAside || "");
  const items = ["Active SAM.gov registration + UEI (verify not expired)", "Representations & Certifications — complete/confirm in SAM.gov"];
  if (/rfq|request for qu/.test(type)) items.push("SF-18 (Request for Quotations) response");
  else if (/combined|commercial|solicitation/.test(type)) items.push("SF-1449 (Solicitation/Contract — Commercial Items), blocks completed & signed");
  else items.push("SF-33 (Solicitation, Offer and Award), blocks completed & signed");
  if (sa) items.push(`Set-aside eligibility evidence for: ${sa} (e.g., SBA/VetCert/8(a)/HUBZone)`);
  items.push("Acknowledge all amendments (SF-30)", "Technical & Management volume — attached", "Price volume (Vol III) with completed CLIN pricing — attached", "Any solicitation-specific attachments / required forms", "Submit via the portal before the response deadline" + (o.deadline ? ` (${String(o.deadline).slice(0, 10)})` : ""));
  return ["FORMS & COMPLIANCE CHECKLIST", "", ...items.map((s) => `[ ] ${s}`)].join("\n");
}

function staticVolumes(opportunity) {
  const o = opportunity || {};
  const { profile } = profileAndVertical(o);
  if (!profile) return { status: 422, json: { ok: false, error: "No DHI vertical matches this opportunity's NAICS." } };
  return { status: 200, json: { ok: true, price: pricingVolume(profile, o), forms: formsChecklist(o) } };
}

// ---- Requirements compliance matrix (Section L / M / SOW → volume → status) --
async function generateComplianceMatrix(opportunity, scopeText) {
  const o = opportunity || {};
  const system =
    "You are a U.S. Government proposal compliance manager for Digital Health International Inc. " +
    "Build a REQUIREMENTS COMPLIANCE MATRIX from the solicitation — the cross-reference a source-selection board uses to confirm a proposal addresses every requirement. Output STRICT JSON only.";
  const user =
    `Produce a compliance matrix as JSON of the form: {"rows":[{"ref":"L-1","source":"L","requirement":"<concise, specific requirement>","volume":"<where DHI addresses it: Vol I Technical | Vol II Management | Vol III Price | Forms/Reps & Certs>","compliance":"Comply"}]}.\n` +
    `- Cover Section L (proposal instructions/format/page limits), Section M (evaluation factors/subfactors), and the key SOW/PWS tasks & deliverables.\n` +
    `- 14–24 rows, most heavily-weighted or mandatory first; each requirement specific and traceable.\n` +
    `- "compliance" defaults to "Comply"; use "Comply with exception" only when clearly warranted.\n` +
    `- If the scope text is thin, infer the standard requirements for this opportunity type & NAICS.\n\n` +
    `SOLICITATION\n${oppSheet(o)}\n\nSCOPE (verbatim excerpt)\n${(scopeText || "(metadata only — infer standard requirements)").slice(0, 7000)}`;
  const content = await callOpenAI(system, user, 1900, true);
  let rows = [];
  if (content) {
    try { const j = JSON.parse(content); rows = Array.isArray(j) ? j : (j.rows || j.matrix || []); } catch (e) { rows = []; }
  }
  rows = (Array.isArray(rows) ? rows : []).filter((r) => r && (r.requirement || r.req)).map((r, i) => ({
    ref: String(r.ref || r.id || `R-${i + 1}`).slice(0, 12),
    source: String(r.source || "SOW").toUpperCase().replace(/[^A-Z&/ -]/g, "").slice(0, 6) || "SOW",
    requirement: String(r.requirement || r.req || "").replace(/\s+/g, " ").trim().slice(0, 400),
    volume: String(r.volume || r.section || "Vol I Technical").slice(0, 60),
    compliance: String(r.compliance || "Comply").slice(0, 40),
  }));
  return { status: 200, json: { ok: true, ai: !!API_KEY, rows } };
}

module.exports = { fetchScope, generateSection, staticVolumes, generateComplianceMatrix, SECTIONS, verticalForNaics };
