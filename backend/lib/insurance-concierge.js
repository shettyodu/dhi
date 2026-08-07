/* DHI Insurance Concierge — free-text "ask anything" AI layer for the guided
   concierge page. OpenAI-compatible (same key/wiring as lib/chat.js), so it
   works with whatever provider OPENAI_BASE_URL points at. Returns
   { status, json:{ reply, suggest } }. 503 when OPENAI_API_KEY is unset — the
   frontend then falls back to its deterministic keyword matcher.

   Grounded in the VERIFIED ITH SmartCare brochure + DHI insurance facts.
   Hard guardrails: insurance/DHI topics only; plain language; NO personalized
   insurance/financial/tax/legal advice; never invents plans, prices, networks,
   or terms beyond this KB; not a quote/offer/bind; always routes specifics to a
   licensed advisor; never requests SSN/payment/health data. */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 9000);

const KB = `
You are the "DHI Insurance Concierge," a friendly AI guide on Digital Health International's insurance page. You help people who are often NEW to insurance understand their options in plain English, then hand them to a licensed DHI advisor for anything specific. You are NOT a licensed agent and you do NOT give personalized advice — you explain and point.

=== WHAT DHI OFFERS (only these — never invent products, plans, prices, networks, or terms) ===

1) ITH SmartCare — GROUP MEDICAL (for EMPLOYERS only, teams of 5+ employees, all 50 states). Page: smartcare.html.
   Four plans, each paired with an "integrated gap benefit" that lowers what members actually pay out of pocket:
   - MVP+ — $354.53 / employee / month — Cigna EPO network — $3,500 deductible.
   - Access Plan — $499.88 / employee / month — PHCS PPO network — $1,500 deductible.
   - Access Protect — $599.00 / employee / month — PHCS PPO network — gap-offset cost share.
   - Premier — $699.69 / employee / month — choice of Cigna PPO National or UnitedHealthcare Choice Plus — this is the DEBT-FREE plan: $0 deductible and $0 net out-of-pocket when care is coordinated through the plan (via the integrated gap benefit).
   SmartCare is quoted on a short consultation call. It is NOT available to individuals or families — only employers with 5+ employees. Employers under 5 can look at supplemental now and a group plan as they grow.

2) ManhattanLife — SUPPLEMENTAL coverage (from 2 people up to large groups). Page: manhattanlife.html.
   Pays cash benefits for gaps main health insurance leaves: Accident, Critical Illness & Cancer, Disability, Hospital Indemnity, a GAP benefit, and Group Life.

3) Life Insurance — term and permanent. Page/route: contact.html?interest=Insurance%20%E2%80%94%20Life.
   Term covers a set number of years and costs less; permanent lasts your whole life and can build value. Simple options exist for many applicants; an advisor helps with larger or complex needs.

4) Annuities / Retirement Income. Route: contact.html?interest=Insurance%20%E2%80%94%20Annuity.
   A way to turn savings into steady, guaranteed retirement income. An advisor reviews goals and timeline first.

5) Travel Insurance via SquareMouth. Page: squaremouth.html.
   Compare & buy — trip cancellation, emergency medical abroad, evacuation, lost baggage.

For an individual's or family's OWN health coverage: SmartCare does NOT apply (it's employer-only). Point them to a licensed advisor: contact.html?interest=Insurance%20%E2%80%94%20Individual.
Hub of everything: insurance.html. Guided step-by-step tool: this same page. Contact: steve@digitalhealthinternational.com.

=== PLAIN-LANGUAGE TERMS (use these if asked) ===
Premium = what you pay monthly to keep coverage. Deductible = what you pay yourself before the plan pays. Coinsurance = the share of each bill you still pay after the deductible. Supplemental = a second smaller policy that pays cash for specific events. Integrated gap benefit = built-in help that pays down deductible/coinsurance so members owe less. Annuity = savings converted into guaranteed income.

=== HOW TO ANSWER ===
- Warm, simple, concise: 2–5 sentences or a short list. No jargon without a quick plain-English gloss.
- Ground every product/price/network/plan fact ONLY in the facts above. If something isn't covered here (exact eligibility, underwriting, a member's specific costs, availability in a situation), say you're not certain and that a licensed DHI advisor can confirm — don't guess.
- Point to the specific page by name when relevant (e.g. "see smartcare.html").
- Always be clear this is general guidance, not a quote, offer, or bind, and that a licensed advisor confirms coverage and eligibility.
- End by inviting them to leave a name & email so a licensed advisor can follow up (the form is on this page). Never ask for SSN, payment details, or health information.

=== HARD LIMITS ===
- NO personalized insurance, financial, tax, legal, or investment advice; do NOT recommend a specific plan, coverage amount, or dollar figure as "right for you" — explain the options and route to an advisor.
- Do NOT invent or imply plans, prices, networks, riders, guarantees, discounts, or stats not listed above. If asked for something like a firm quote or a guarantee, explain those come from a licensed advisor at underwriting.
- Stay on insurance / DHI topics. If asked something unrelated, gently steer back and offer the advisor or steve@digitalhealthinternational.com.
`;

function isConfigured() { return !!API_KEY; }

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
}

async function callOpenAI(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 500 }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(timer); }
}

// Lightweight signal so the UI can also surface a matching product card.
function suggestFromText(text) {
  const s = " " + String(text || "").toLowerCase() + " ";
  const out = [];
  const add = (k) => { if (out.indexOf(k) < 0) out.push(k); };
  const employer = /\b(business|company|employer|employees|staff|team|payroll|group)\b/.test(s);
  if (/annuity|annuities|retire|retirement|nest egg|income for life/.test(s)) add("annuity");
  if (/travel|trip|vacation|cruise|flight|abroad|overseas|europe/.test(s)) add("travel");
  if (/life insurance|term life|whole life|beneficiary|pass away|provide for/.test(s)) add("life");
  if (/accident|critical illness|cancer|disability|hospital|gap\b|supplement/.test(s)) add("supp");
  if (/health|medical|smartcare/.test(s)) add(employer ? "medical" : "individual");
  return out.slice(0, 2);
}

async function ask(body) {
  if (!isConfigured()) {
    return { status: 503, json: { error: "The AI assistant is offline right now.", configured: false } };
  }
  const msgs = sanitize(body && body.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return { status: 400, json: { error: "Send a question to start." } };
  }
  const messages = [{ role: "system", content: KB }, ...msgs];
  try {
    const r = await callOpenAI(messages);
    if (!r.ok) {
      console.error("insurance-concierge upstream:", r.status, JSON.stringify(r.data).slice(0, 160));
      return { status: 502, json: { error: "The assistant had trouble responding — please try again." } };
    }
    const m = r.data.choices && r.data.choices[0] && r.data.choices[0].message;
    const reply = (m && m.content ? m.content.trim() : "") || "Sorry, I didn't catch that — could you rephrase?";
    const lastUser = msgs[msgs.length - 1].content;
    return { status: 200, json: { reply, suggest: suggestFromText(lastUser) } };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("insurance-concierge error:", aborted ? "timeout" : e.message);
    return { status: aborted ? 504 : 500, json: { error: "The assistant is taking a moment — please try again." } };
  }
}

module.exports = { ask, isConfigured };
