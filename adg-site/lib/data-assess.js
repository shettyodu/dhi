/* Asset Data Group — AI data-commercialization assessment.
   A company describes operational data it might commercialize; this returns a
   structured, honest, compliance-first assessment. OpenAI-compatible wiring.
   Returns { status, json:{ assessment } }. 503 when OPENAI_API_KEY is unset so the
   page falls back to lead capture.

   Honesty guardrails: not legal advice; value is an ESTIMATE grounded in the real
   ~$100k-$2M market (typical ~$200-300k); never guarantees a sale, price, or buyer,
   and never names specific AI labs; flags PII/PHI/CUI/contractual/regulatory issues;
   requires de-identification + legal review before any data leaves the company. */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 12000);

const KB = `
You are Asset Data Group's data-commercialization assessment assistant. Asset Data Group is a data asset commercialization firm, not simply a data broker. A company describes operational data it is considering commercializing (licensing to AI, analytics, and research buyers). Produce a preliminary, honest, compliance-first assessment. You are NOT a lawyer and do NOT give legal advice; you flag issues for review.

Grounding and honesty:
- Value: the real market for licensing corporate operational data runs roughly $100,000 to $2,000,000 per deal, with typical deals around $200,000 to $300,000. High-volume, unique, domain-specific, clean, well-documented data sits higher; small or generic data sits lower. Always present value as an ESTIMATE and a range, clearly labeled, dependent on volume, uniqueness, quality, and rights. NEVER guarantee a sale, a price, or a buyer, and NEVER name specific buyers or AI labs.
- Compliance first: flag anything that must be resolved before commercialization. This includes personally identifiable information (PII), protected health information (PHI, HIPAA), controlled unclassified information (CUI), customer or third-party data governed by contract or NDA, GDPR or CCPA personal data, and public-sector constraints (public records and FOIA, procurement rules) for government, municipal, or utility data. If PII, PHI, or CUI is present, de-identification and legal review are required before any licensing.
- Ownership: licensing requires that the company actually owns or holds the rights to license the data. Flag where rights are unclear.
- Always require human and legal review and de-identification before any data leaves the company's control.

Return ONLY a JSON object with this exact shape:
{
 "eligibility": "likely" | "needs_review" | "unlikely",
 "eligibilitySummary": "one or two sentences",
 "complianceFlags": ["each specific issue to resolve before commercialization"],
 "valueEstimate": "a clearly-labeled estimate range, e.g. 'Illustrative estimate: $150k-$400k, subject to volume, rights, and de-identification'",
 "dataSheet": {
   "suggestedUse": "what buyers might use this data to train, evaluate, or analyze",
   "deidentificationChecklist": ["concrete steps to de-identify and prepare the data"],
   "provenanceNeeded": ["ownership and provenance documentation to gather"]
 },
 "nextSteps": ["concrete next steps, including de-identification and legal review"],
 "disclaimer": "This is a preliminary, non-binding assessment. It is not legal advice, a quote, or a guarantee of a sale."
}
Be concise and practical.`;

function isConfigured() { return !!API_KEY; }

function describeInventory(inv) {
  inv = inv || {};
  const f = (k) => String(inv[k] == null ? "" : inv[k]).slice(0, 600).trim() || "not specified";
  return [
    "Company / industry: " + f("domain"),
    "Data types: " + f("dataTypes"),
    "Approximate volume / history: " + f("volume"),
    "Does the company own or hold rights to license this data? " + f("ownsRights"),
    "Does the data contain PII / PHI / customer or regulated data? " + f("pii"),
    "Is any of it government, municipal, or utility data? " + f("sector"),
    "Additional notes: " + f("notes"),
  ].join("\n");
}

async function callOpenAI(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 900, response_format: { type: "json_object" } }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(timer); }
}

async function assess(body) {
  if (!isConfigured()) {
    return { status: 503, json: { error: "Assessment is offline right now.", configured: false } };
  }
  const inv = (body && body.inventory) || {};
  if (!inv.dataTypes && !inv.domain && !inv.notes) {
    return { status: 400, json: { error: "Describe the data to assess." } };
  }
  const messages = [
    { role: "system", content: KB },
    { role: "user", content: "Assess this company's operational data for potential commercialization:\n\n" + describeInventory(inv) },
  ];
  try {
    const r = await callOpenAI(messages);
    if (!r.ok) {
      console.error("data-assess upstream:", r.status, JSON.stringify(r.data).slice(0, 160));
      return { status: 502, json: { error: "The assessment service had trouble responding. Please try again." } };
    }
    const content = r.data.choices && r.data.choices[0] && r.data.choices[0].message && r.data.choices[0].message.content;
    let assessment;
    try { assessment = JSON.parse(content); } catch (e) { return { status: 502, json: { error: "Could not parse the assessment. Please try again." } }; }
    return { status: 200, json: { assessment } };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("data-assess error:", aborted ? "timeout" : e.message);
    return { status: aborted ? 504 : 500, json: { error: "The assessment is taking too long. Please try again shortly." } };
  }
}

module.exports = { assess, isConfigured };
