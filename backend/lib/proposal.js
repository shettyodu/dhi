/* AI proposal generator for the Government Bid Match-Maker.
   Produces a near-submission-ready package GROUNDED in real DHI facts + partner
   catalog (capabilities.js):
     A) Ingests the actual SAM.gov solicitation text so the Understanding +
        Technical Approach are tailored to the real scope (not just the title).
     B) Splits the output into volumes (Technical & Management, Past Performance)
        + a Price volume + a Forms & Compliance checklist.
     C) Pricing scaffold — a line-item price table seeded from our partner catalog.
   The model is told not to invent certifications, past performance, customers,
   or prices; unknowns become [BRACKETED PLACEHOLDERS]. Returns { status, json }. */

const { CORP, profileFor } = require("./capabilities");
const { VERTICALS } = require("./govbids");

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 28000);
const SAM_API_KEY = process.env.SAM_GOV_API_KEY || "";

function verticalForNaics(naics) {
  const n = String(naics || "");
  for (const [key, v] of Object.entries(VERTICALS)) if (v.naics.includes(n)) return key;
  return null;
}

// ---- A) ingest the actual solicitation text ---------------------------------
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
    return String(text).replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch (e) { return ""; } finally { clearTimeout(timer); }
}

function corpSheet() {
  return [
    `Company: ${CORP.name} — HQ ${CORP.hq}.`, `Positioning: ${CORP.positioning}`,
    `Leadership: ${CORP.leadership}`, `Registrations: ${CORP.registrations.join("; ")}.`,
    `Contracting: ${CORP.contracting}`,
  ].join("\n");
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
function oppSheet(o) {
  return [
    `Title: ${o.title || "(untitled)"}`, `Agency: ${o.agency || "—"}`,
    `Solicitation #: ${o.solicitation || "—"}`, `NAICS: ${o.naics || "—"}    Type: ${o.type || "—"}`,
    `Set-aside: ${o.setAside || "Full & open"}`, `Place of performance: ${o.place || "—"}`,
    `Response deadline: ${o.deadline || "—"}`,
  ].join("\n");
}

// ---- C) pricing scaffold (Volume III) ---------------------------------------
function pricingVolume(profile, o) {
  const rows = (profile.offerings || []).map((off, i) =>
    `${String(i + 1).padStart(2, " ")}. ${off}\n     Partner: ${(profile.partners || ["—"])[0]}   Qty: [QTY]   Unit: [QUOTE]   Extended: [QUOTE]`);
  return [
    `VOLUME III — PRICE / COST PROPOSAL`,
    `Opportunity: ${o.title || ""}  (Sol. ${o.solicitation || "—"})`,
    ``,
    `Line items (seeded from DHI's ${profile.label} partner catalog — confirm quantities and obtain partner quotes):`,
    ``,
    ...rows,
    ``,
    `Subtotal: [SUBTOTAL]    Freight/Install (if applicable): [QUOTE]    TOTAL: [TOTAL]`,
    ``,
    `Notes: Volume discounts available for large procurements. All pricing is subject to partner quotes and confirmation of the solicitation's CLIN structure and period of performance.`,
  ].join("\n");
}

// ---- B) forms & compliance checklist ----------------------------------------
function formsChecklist(o) {
  const type = String(o.type || "").toLowerCase();
  const sa = String(o.setAside || "");
  const items = ["Active SAM.gov registration + UEI (verify not expired)", "Representations & Certifications — complete/confirm in SAM.gov"];
  if (/rfq|request for qu/.test(type)) items.push("SF-18 (Request for Quotations) response");
  else if (/combined|commercial|solicitation/.test(type)) items.push("SF-1449 (Solicitation/Contract — Commercial Items), blocks completed & signed");
  else items.push("SF-33 (Solicitation, Offer and Award), blocks completed & signed");
  if (sa) items.push(`Set-aside eligibility evidence for: ${sa} (e.g., SBA/VetCert/8(a)/HUBZone certification)`);
  items.push("Acknowledge all amendments to the solicitation (SF-30)");
  items.push("Technical & Management volume (Vol I–II) — attached");
  items.push("Price volume (Vol III) with completed CLIN pricing — attached");
  items.push("Any solicitation-specific attachments / required forms");
  items.push("Submit via the portal before the response deadline" + (o.deadline ? ` (${String(o.deadline).slice(0, 10)})` : ""));
  return ["FORMS & COMPLIANCE CHECKLIST", "", ...items.map((s, i) => `[ ] ${s}`)].join("\n");
}

// ---- AI narrative (Volumes I–II), tailored to the real scope ----------------
async function callOpenAI(o, profile, scopeText) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const system =
      "You are an expert U.S. Government proposal writer for Digital Health International Inc. (DHI). " +
      "Write the Technical & Management narrative (Volumes I–II) of a proposal responding to the solicitation. " +
      "Use ONLY the DHI facts, partners, products, and standards provided — do NOT invent certifications, past performance, customers, or specific prices. " +
      (scopeText ? "Tailor the 'Understanding of the Requirement' and 'Technical Approach' specifically to the SOLICITATION SCOPE provided (reference its actual tasks/requirements). " : "") +
      "Where specifics are unknown, insert clearly-marked [BRACKETED PLACEHOLDERS]. Begin with a note that it is an AI-generated draft requiring human review. Use numbered section headings.";
    const user =
      `SOLICITATION\n${oppSheet(o)}\n\n` +
      (scopeText ? `SOLICITATION SCOPE (verbatim excerpt — tailor to this)\n${scopeText}\n\n` : "") +
      `DHI CORPORATE FACTS\n${corpSheet()}\n\nMATCHED CAPABILITY — ${profile.label}\n${factSheet(profile)}\n\n` +
      `Write: 1) Cover Letter & Executive Summary, 2) Understanding of the Requirement, 3) Technical Approach (cite our specific products/partners/standards above; map them to the scope's tasks), 4) Management Approach, 5) Past Performance & Capabilities, 6) Key Personnel. Concise, realistic, grounded only in the facts above. (The Price volume and forms checklist are produced separately — do not write them.)`;
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.4, max_tokens: 2000 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

// fact-based fallback narrative (no AI)
function templateNarrative(o, profile, scopeText) {
  return [
    `DRAFT — Technical & Management (Vols I–II). AI-generated draft requires human review.`,
    ``, `1. COVER LETTER & EXECUTIVE SUMMARY`,
    `${CORP.name}, ${CORP.hq} (SAM.gov-registered), responds to "${o.title || "this solicitation"}" for ${o.agency || "the agency"}. We deliver ${profile.label} via ${(profile.partners || []).join(", ") || "vetted partners"}.`,
    ``, `2. UNDERSTANDING OF THE REQUIREMENT`,
    scopeText ? `Per the solicitation scope: ${scopeText.slice(0, 600)}…  [Summarize and confirm.]` : `[Summarize the agency's need from the solicitation scope.]`,
    ``, `3. TECHNICAL APPROACH`, ...(profile.offerings || []).map((x) => `  - ${x}`),
    profile.quality && profile.quality.length ? `Quality: ${profile.quality.join("; ")}.` : "",
    ``, `4. MANAGEMENT APPROACH`, `[Roles, timeline/milestones, QA.]`,
    ``, `5. PAST PERFORMANCE & CAPABILITIES`, `[Relevant prior engagements & references.] Differentiators: ${(profile.differentiators || []).join("; ")}.`,
    ``, `6. KEY PERSONNEL`, `${CORP.leadership} [Add project key personnel.]`,
  ].filter((l) => l !== "").join("\n");
}

async function generateProposal(opportunity) {
  const o = opportunity || {};
  const vKey = o.vertical || verticalForNaics(o.naics);
  const profile = profileFor(vKey);
  if (!profile) return { status: 422, json: { ok: false, error: "No DHI vertical matches this opportunity's NAICS — proposal generation is for matched verticals only." } };

  const scopeText = await fetchScope(o.descriptionLink);
  let narrative = null, ai = false;
  if (API_KEY) { narrative = await callOpenAI(o, profile, scopeText); ai = !!narrative; }
  if (!narrative) narrative = templateNarrative(o, profile, scopeText);

  const price = pricingVolume(profile, o);
  const forms = formsChecklist(o);

  const parts = [
    { name: "Technical & Management (Vol I–II)", content: narrative },
    { name: "Price (Vol III)", content: price },
    { name: "Forms & Compliance Checklist", content: forms },
  ];
  const header = `PROPOSAL PACKAGE — ${CORP.name}\nRE: ${o.title || "Solicitation"} — ${o.agency || ""} (Sol. ${o.solicitation || "—"})\n${scopeText ? "Tailored to the live SAM.gov solicitation scope." : "Based on opportunity metadata (full solicitation text unavailable)."}\n` + "=".repeat(70);
  const full = [header, "", ...parts.map((p) => `\n========== ${p.name.toUpperCase()} ==========\n\n${p.content}`)].join("\n");

  return { status: 200, json: { ok: true, ai, vertical: profile.label, scopeUsed: !!scopeText, parts, proposal: full } };
}

module.exports = { generateProposal, verticalForNaics };
