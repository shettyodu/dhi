/* Insurance vertical AI helpers — SmartCare group medical (via InsurTech Hub).
   Two generators used by the internal (gated) Insurance Ops tool:
     - generateSmartCareProposal(profile): a tailored group proposal/summary.
     - generateOutreachEmail(params): a COMPLIANT outreach-email DRAFT for review.
   Both are GROUNDED in confirmed SmartCare facts and bound by compliance
   guardrails (no competitor names, no guarantees, required disclaimer, licensed
   review). They produce DRAFTS for licensed/compliance review — never sends.
   Falls back to fact-based templates when OPENAI_API_KEY is unset. */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 25000);

// Approved language can be supplied via env once Leo/Julia finalize it; until
// then the generators use compliant placeholder language + guardrails.
const APPROVED_LANGUAGE = process.env.SMARTCARE_APPROVED_LANGUAGE || "";

const SMARTCARE = {
  name: "SmartCare (group medical, via partner InsurTech Hub)",
  design: "Self-funded group medical with NO deductible and NO coinsurance (debt-free design).",
  price: "Approximately $699 per employee per month, with a 2-year rate lock.",
  networks: "Built on major national networks (UnitedHealthcare and Cigna), backed by stop-loss and reinsurance for stability.",
  eligibility: "Small businesses with as few as 2 employees; available in all 50 states.",
  savings: "Typically 20–30% less than comparable traditional group plans (savings vary by group).",
  positioning: "Debt-free positioning: roughly 60% of U.S. personal bankruptcies involve medical debt; removing deductibles and coinsurance keeps a covered event from becoming medical debt.",
};

const DISCLAIMER =
  "DRAFT for licensed/compliance review — NOT an offer of coverage. SmartCare is offered through InsurTech Hub and licensed representatives. Rates are illustrative; benefits, eligibility, and pricing are confirmed at underwriting and savings vary by group.";

const GUARDRAILS =
  "COMPLIANCE GUARDRAILS (mandatory): Do NOT name or compare to any specific competitor (never write Blue Cross, Blue Shield, Aetna, Kaiser, etc.). Use only the general '20–30% savings vs. comparable traditional plans' framing. Make NO guarantees of savings, acceptance, or price. State that a licensed advisor confirms eligibility and pricing. Include the provided disclaimer verbatim at the end. Keep every claim factual and consistent with the SmartCare facts provided — invent nothing.";

function factBlock() {
  return Object.entries(SMARTCARE).map(([k, v]) => `- ${v}`).join("\n");
}

async function callOpenAI(system, user) {
  if (!API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.4, max_tokens: 1200 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

function illustrativeCost(employees) {
  const n = parseInt(String(employees || "").replace(/[^\d]/g, ""), 10);
  if (!n || n < 1) return null;
  return { employees: n, monthly: n * 699, annual: n * 699 * 12 };
}
function usd(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

// ---- SmartCare group proposal -----------------------------------------------
async function generateSmartCareProposal(profile) {
  const p = profile || {};
  const cost = illustrativeCost(p.employees);
  const costLine = cost ? `Illustrative cost: ${cost.employees} employees × ~$699/mo = ${usd(cost.monthly)}/month (~${usd(cost.annual)}/year), subject to underwriting.` : "Illustrative cost: ~$699 per employee/month, subject to underwriting.";
  const system =
    "You are a proposal writer for DHI's insurance vertical, drafting a SmartCare group-medical proposal for a small business. " +
    "Use ONLY the SmartCare facts provided. " + GUARDRAILS;
  const user =
    `PROSPECT\nCompany: ${p.company || "[Company]"}\nEmployees: ${p.employees || "[#]"}\nState: ${p.state || "[State]"}\nCurrent coverage: ${p.currentCoverage || "[unknown]"}\nNotes: ${p.notes || "—"}\n\n` +
    `SMARTCARE FACTS\n${factBlock()}\n\n${costLine}\n\n` +
    (APPROVED_LANGUAGE ? `APPROVED MARKETING LANGUAGE (prefer this phrasing):\n${APPROVED_LANGUAGE}\n\n` : "") +
    `DISCLAIMER (include verbatim at the end):\n${DISCLAIMER}\n\n` +
    `Write a concise proposal: 1) Summary & why SmartCare fits this business, 2) Plan design (debt-free, networks, rate lock), 3) Illustrative cost, 4) Next steps (licensed advisor + digital enrollment). Mark it a draft for review.`;
  let text = await callOpenAI(system, user);
  if (!text) {
    text = [
      `SMARTCARE GROUP PROPOSAL (DRAFT) — for ${p.company || "[Company]"}`,
      ``, `1) Summary`,
      `SmartCare is a self-funded group medical plan for small businesses (2+ employees, all 50 states) with a debt-free design — no deductible, no coinsurance.`,
      ``, `2) Plan design`,
      `- ${SMARTCARE.networks}`, `- ${SMARTCARE.price}`, `- ${SMARTCARE.savings}`, `- ${SMARTCARE.positioning}`,
      ``, `3) Illustrative cost`, costLine,
      ``, `4) Next steps`, `A licensed advisor confirms eligibility and pricing; enrollment is fully digital.`,
      ``, DISCLAIMER,
    ].join("\n");
  }
  return { status: 200, json: { ok: true, ai: !!API_KEY, cost, proposal: text } };
}

// ---- Compliant outreach email draft -----------------------------------------
async function generateOutreachEmail(params) {
  const q = params || {};
  const system =
    "You are drafting a COMPLIANT outreach email for DHI's insurance vertical promoting the SmartCare group-medical plan to small businesses. " +
    "Use ONLY the SmartCare facts provided. " + GUARDRAILS + " Keep it short, professional, and clearly from a licensed insurance context; include a clear opt-out line and that a licensed advisor will assist.";
  const user =
    `AUDIENCE: ${q.segment || "small-business owners / HR decision-makers"}\nTONE: ${q.tone || "professional, warm, concise"}\nCALL TO ACTION: ${q.cta || "Request a no-obligation SmartCare group quote"}\n\n` +
    `SMARTCARE FACTS\n${factBlock()}\n\n` +
    (APPROVED_LANGUAGE ? `APPROVED MARKETING LANGUAGE (prefer this phrasing):\n${APPROVED_LANGUAGE}\n\n` : "") +
    `DISCLAIMER (include at the end):\n${DISCLAIMER}\n\n` +
    `Write: a subject line, a 120–160 word body, a CTA, and a compliant footer (licensed-advisor note + opt-out). Output as a ready-to-redline draft.`;
  let text = await callOpenAI(system, user);
  if (!text) {
    text = [
      `SUBJECT: Group health for your team — no deductibles, ~$699/employee`,
      ``,
      `Hi [First name],`,
      ``,
      `Most small-business health plans leave employees exposed to deductibles and coinsurance. SmartCare is different — a self-funded group medical plan (UnitedHealthcare & Cigna networks) with no deductible and no coinsurance, for teams as small as 2, in all 50 states. It's typically 20–30% less than comparable traditional plans, with a 2-year rate lock at about $699/employee per month.`,
      ``,
      `Would you like a no-obligation quote for [Company]? A licensed advisor will walk you through it.`,
      ``,
      `[Name] · Digital Health International`,
      ``,
      DISCLAIMER,
      `To opt out of future messages, reply STOP/UNSUBSCRIBE.`,
    ].join("\n");
  }
  return { status: 200, json: { ok: true, ai: !!API_KEY, approvedLanguageUsed: !!APPROVED_LANGUAGE, email: text } };
}

module.exports = { generateSmartCareProposal, generateOutreachEmail, SMARTCARE, DISCLAIMER };
