/* AI proposal generator for the Government Bid Match-Maker.
   Given an opportunity, finds the matching DHI vertical, and writes a complete
   draft proposal GROUNDED in real DHI facts + partner-catalog products/standards
   (see capabilities.js) — the model is instructed not to invent certifications,
   past performance, customers, or pricing. Falls back to a fact-based template
   when OPENAI_API_KEY is unset or the API errors. Returns { status, json }. */

const { CORP, profileFor } = require("./capabilities");
const { VERTICALS } = require("./govbids");

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 25000);

// NAICS → vertical id (first vertical whose NAICS list contains the code).
function verticalForNaics(naics) {
  const n = String(naics || "");
  for (const [key, v] of Object.entries(VERTICALS)) if (v.naics.includes(n)) return key;
  return null;
}

function factSheet(profile) {
  const lines = [];
  if (profile.partners && profile.partners.length) lines.push("Partners: " + profile.partners.join("; "));
  if (profile.offerings) lines.push("Offerings/products:\n  - " + profile.offerings.join("\n  - "));
  if (profile.quality && profile.quality.length) lines.push("Quality: " + profile.quality.join("; "));
  if (profile.standards && profile.standards.length) lines.push("Standards/certifications: " + profile.standards.join("; "));
  if (profile.differentiators && profile.differentiators.length) lines.push("Differentiators: " + profile.differentiators.join("; "));
  return lines.join("\n");
}

function corpSheet() {
  return [
    `Company: ${CORP.name} — HQ ${CORP.hq}.`,
    `Positioning: ${CORP.positioning}`,
    `Leadership: ${CORP.leadership}`,
    `Registrations: ${CORP.registrations.join("; ")}.`,
    `Contracting: ${CORP.contracting}`,
  ].join("\n");
}

function opportunitySheet(o) {
  return [
    `Title: ${o.title || "(untitled)"}`,
    `Agency: ${o.agency || "—"}`,
    `Solicitation #: ${o.solicitation || "—"}`,
    `NAICS: ${o.naics || "—"}    Type: ${o.type || "—"}`,
    `Set-aside: ${o.setAside || "Full & open"}`,
    `Place of performance: ${o.place || "—"}`,
    `Response deadline: ${o.deadline || "—"}`,
  ].join("\n");
}

// Fact-based fallback proposal (no AI) — still complete, just templated.
function templateProposal(o, profile) {
  const due = o.deadline ? String(o.deadline).slice(0, 10) : "TBD";
  return [
    `DRAFT PROPOSAL — ${CORP.name}`,
    `RE: ${o.title || "Solicitation"} — ${o.agency || ""}  (Sol. ${o.solicitation || "—"})`,
    ``,
    `1. EXECUTIVE SUMMARY`,
    `${CORP.name}, ${CORP.hq} (SAM.gov-registered), is pleased to respond. We deliver ${profile.label} through ${(profile.partners || []).join(", ") || "vetted partners"}, aligned to this requirement.`,
    ``,
    `2. UNDERSTANDING OF THE REQUIREMENT`,
    `[Summarize the agency's need in our words, referencing the solicitation scope.]`,
    ``,
    `3. TECHNICAL APPROACH`,
    `Proposed solution draws on:`,
    ...(profile.offerings || []).map((x) => `  - ${x}`),
    profile.quality && profile.quality.length ? `Quality: ${profile.quality.join("; ")}.` : "",
    ``,
    `4. PAST PERFORMANCE & CAPABILITIES`,
    `[Insert relevant prior engagements and references.] Differentiators: ${(profile.differentiators || []).join("; ")}.`,
    ``,
    `5. KEY PERSONNEL & MANAGEMENT`,
    `[Name key personnel, roles, timeline/milestones.]`,
    ``,
    `6. PRICING APPROACH`,
    `[Line-item pricing with partner quotes — to be completed. Volume discounts available.]`,
    ``,
    `7. COMPLIANCE & CERTIFICATIONS`,
    `${(profile.standards || []).join("; ") || "[Applicable standards]"}. Reps & certs, set-aside eligibility (${o.setAside || "full & open"}), and required forms to be attached.`,
    ``,
    `8. SUBMISSION`,
    `File via ${o.source || "SAM.gov"} (${o.link || "https://sam.gov"}) before ${due}.`,
    ``,
    `[DRAFT — human review and final content required before submission.]`,
  ].filter((l) => l !== "").join("\n");
}

async function callOpenAI(o, profile) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const system =
      "You are an expert U.S. Government proposal writer for Digital Health International Inc. (DHI). " +
      "Write a COMPLETE, well-structured draft proposal responding to the solicitation. " +
      "Use ONLY the DHI facts, partners, products, and standards provided — do NOT invent certifications, past performance, customers, or specific prices. " +
      "Where specifics are unknown (pricing, named past performance, key personnel), insert clearly-marked [BRACKETED PLACEHOLDERS] for the team to complete. " +
      "Begin with a note that it is an AI-generated draft requiring human review. Use numbered section headings.";
    const user =
      `SOLICITATION\n${opportunitySheet(o)}\n\nDHI CORPORATE FACTS\n${corpSheet()}\n\n` +
      `MATCHED CAPABILITY — ${profile.label}\n${factSheet(profile)}\n\n` +
      `Write these sections: 1) Cover Letter & Executive Summary, 2) Understanding of the Requirement, 3) Technical Approach (cite our specific products/partners/standards above), 4) Past Performance & Capabilities, 5) Key Personnel & Management, 6) Pricing Approach (placeholders), 7) Compliance & Certifications, 8) Submission. Keep it realistic, concise, and grounded only in the facts above.`;
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.4, max_tokens: 1900 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return text || null;
  } catch (e) {
    return null;
  } finally { clearTimeout(timer); }
}

async function generateProposal(opportunity) {
  const o = opportunity || {};
  const vKey = o.vertical || verticalForNaics(o.naics);
  const profile = profileFor(vKey);
  if (!profile) {
    return { status: 422, json: { ok: false, error: "No DHI vertical matches this opportunity's NAICS — proposal generation is for matched verticals only." } };
  }
  let proposal = null, ai = false;
  if (API_KEY) { proposal = await callOpenAI(o, profile); ai = !!proposal; }
  if (!proposal) proposal = templateProposal(o, profile);
  return { status: 200, json: { ok: true, ai, vertical: profile.label, proposal } };
}

module.exports = { generateProposal, verticalForNaics };
