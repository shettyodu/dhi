/* DHI site AI assistant — framework-agnostic. Answers questions about DHI /
   AutoCommand, routes to the right page, and nudges lead capture. Calls an
   OpenAI-compatible chat API server-side (key stays in env). Returns
   { status, json }. No-ops to 503 when OPENAI_API_KEY is unset.

   Guardrails: on-topic only; concise; no medical/legal/financial/investment
   advice; tokenization framed as informational/not-an-offer. Input is capped
   and the model is told to decline off-topic asks. */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 9000);

const KB = `
You are "DHI Assistant," the helpful guide on the Digital Health International (DHI) website.
DHI is one integrated B2B platform spanning 12 verticals for governments, hospitals, employers, dealers, and institutions.

Verticals & where to send people (use the page filename as the link):
- Data Centers & Storage — decentralized-software.html
- Titan Data & Analytics — data-analytics.html
- Cybersecurity & Infrastructure (CyberFortify, PipIQ) — cybersecurity.html
- Telehealth & EMR (GenieMD) — decentralized-software.html
- Medical Equipment & Technology (GPDI sourcing) — medical-equipment.html
- Medical Supplies & Consumables (quote requests) — supplies.html / supplies-catalog.html
- Modular / Mobile Clinics — clinics.html
- Cognitive Performance & Wellness (Cognifit) — wellness.html
- Lighting & Energy Efficiency (Keystone catalog, room calculator) — lighting.html / lighting-catalog.html
- Insurance & Risk Advisory (Manhattan Life, SquareMouth) — insurance.html
- Government Contracting (SAM.gov, FEMA, GSA) — government.html
- Automotive & Mobility = "AutoCommand AI Marketplace" — automotive.html

AutoCommand specifics:
- "Start your deal" AI vehicle search — automotive-find-vehicle.html
- Vehicle Passport (blockchain provenance/title record) — automotive-passport.html
- Vehicle Tokenization (Passport + digital title; investment tier via licensed partners only) — automotive-tokenization.html
- Dealers & Suppliers — automotive-partners.html ; Creators/influencers — automotive-influencers.html

How to engage: every vertical page has a "Request information" form; or use contact.html. Government buyers can request a capability statement.
Contact: steve@digitalhealthinternational.com.

Rules:
- Stay on DHI/AutoCommand topics and general business questions about them. Politely decline anything unrelated.
- Be concise (2–4 sentences). When relevant, point to the specific page by name (e.g., "see the Government page").
- Do NOT give medical, legal, financial, tax, or investment advice. For vehicle tokenization investment, say it's informational only, offered through licensed partners, subject to eligibility/KYC, and not an offer or investment advice.
- Never invent prices, specs, availability, or guarantees. If you don't know, say so and suggest the "Request information" form or contact.
- Encourage the user to leave their name & email via "Request information" so the team can follow up. Don't ask for sensitive data (no SSN, payment, health details).
`;

function isConfigured() { return !!API_KEY; }

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function chat(body) {
  if (!isConfigured()) {
    return { status: 503, json: { error: "The assistant is offline right now — please use a Request information form or email steve@digitalhealthinternational.com.", configured: false } };
  }
  const msgs = sanitize(body && body.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return { status: 400, json: { error: "Send a message to start." } };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: KB }, ...msgs],
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("chat upstream:", res.status, JSON.stringify(data).slice(0, 200));
      return { status: 502, json: { error: "The assistant had trouble responding — please try again or use a Request information form." } };
    }
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return { status: 200, json: { reply: (reply || "Sorry, I didn't catch that — could you rephrase?").trim() } };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("chat error:", aborted ? "timeout" : e.message);
    return { status: aborted ? 504 : 500, json: { error: "The assistant is taking too long — please try again shortly." } };
  } finally { clearTimeout(timer); }
}

module.exports = { chat, isConfigured };
