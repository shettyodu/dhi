/* DHI cross-vertical AI procurement assistant — framework-agnostic.
   Beyond Q&A, it can SEARCH live data via tools: the Keystone lighting catalog,
   DHI medical supplies, and live SAM.gov government opportunities — so answers
   are grounded in real products, prices, and bids. OpenAI-compatible, key in env.
   Returns { status, json:{reply} }. 503 when OPENAI_API_KEY is unset.

   Guardrails: on-topic only; concise; no medical/legal/financial/investment
   advice; never invents prices/specs — uses tool results or says it doesn't know. */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const STEP_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 8000);

let LIGHTING = [], SUPPLIES = [], LIGHTING_SUP = [];
try { LIGHTING = require("../data/lighting-index.json"); } catch (e) { /* optional */ }
try { LIGHTING_SUP = require("../data/lighting-suppliers.json"); } catch (e) { /* optional */ }
try { SUPPLIES = require("../data/supplies-index.json"); } catch (e) { /* optional */ }
// The lighting search spans the Keystone catalog + additional major-brand
// suppliers (Acuity, Signify, Cree, Eaton, Orion, Alcon) — kept in separate
// files so no supplier's data is co-mingled at rest.
LIGHTING = LIGHTING.concat(LIGHTING_SUP);
let searchBids = null;
try { ({ searchBids } = require("./govbids")); } catch (e) { /* optional */ }

const KB = `
You are "DHI Assistant," the AI concierge on the Digital Health International (DHI) website — one integrated B2B/B2G platform across 12 verticals for governments, hospitals, employers, dealers, and institutions.

You can SEARCH live data with tools. Use them whenever the user asks about specific products, prices, specs, or government opportunities — never guess these:
- search_lighting: Keystone LED catalog (lamps, fixtures, power supplies, controls). For wattage/CCT/base/price/product questions → cite catalog #s and prices and point to lighting-catalog.html.
- search_supplies: DHI medical supplies & textiles (gowns, gloves, masks, coveralls, drapes, packs). Point to supplies-catalog.html.
- search_gov_bids: live U.S. federal opportunities (SAM.gov). Point to government.html / the bid portal; mention deadlines and set-asides.

Verticals & pages: Lighting & Energy (lighting.html, lighting-catalog.html, ROI: lighting-roi.html); Medical Supplies (supplies.html, supplies-catalog.html); Government Contracting (government.html); Medical Equipment (medical-equipment.html); Cybersecurity (cybersecurity.html); Data/Analytics (data-analytics.html); Telehealth/EMR & Software (decentralized-software.html); Clinics (clinics.html); Wellness (wellness.html); Insurance (insurance.html); AutoCommand vehicles (automotive.html, find a vehicle: automotive-find-vehicle.html, Vehicle Passport: automotive-passport.html).

Rules:
- Use a tool for any product/price/spec/bid question, then answer from the results (cite real catalog #s, prices, or opportunity titles + deadlines). If a search returns nothing, say so and suggest the "Request information" form.
- Be concise (2–5 sentences or a short list). Point to the specific page by name.
- No medical, legal, financial, tax, or investment advice. Vehicle tokenization is informational only, via licensed partners, not an offer.
- Never invent prices, specs, availability, or guarantees. Encourage leaving a name & email via "Request information"; never ask for SSN/payment/health data.
- Contact: steve@digitalhealthinternational.com.`;

const TOOLS = [
  { type: "function", function: { name: "search_lighting", description: "Search the Keystone LED lighting catalog by keyword, type, wattage, color temperature (CCT), base, or use. Returns matching products with catalog number, specs, and unit price.", parameters: { type: "object", properties: { query: { type: "string", description: "e.g. '4000K high bay', 'A19 E26 dimmable', 'exit sign'" } }, required: ["query"] } } },
  { type: "function", function: { name: "search_supplies", description: "Search DHI medical supplies & textiles (gowns, gloves, masks, coveralls, drapes, OT packs, linens). Returns products with specs and unit price.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "search_gov_bids", description: "Search live U.S. federal government contract opportunities (SAM.gov) by keyword or vertical. Returns open solicitations with agency, deadline, and set-aside.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
];

function isConfigured() { return !!API_KEY; }

function searchIndex(arr, q, n) {
  const terms = String(q || "").toLowerCase().split(/[\s,]+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const scored = [];
  for (const p of arr) {
    const hay = (p.id + " " + (p.group || "") + " " + (p.name || "") + " " + (p.specs || "") + " " + (p.cat || "") + " " + (p.cct || "") + " " + (p.base || "") + " " + (p.w || "")).toLowerCase();
    let s = 0; for (const t of terms) if (hay.indexOf(t) >= 0) s++;
    if (s) scored.push({ s, p });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, n).map((x) => x.p);
}

async function runTool(name, args) {
  const q = (args && args.query) || "";
  if (name === "search_lighting") {
    return { results: searchIndex(LIGHTING, q, 8).map((p) => ({ catalog: p.id, brand: p.supplier || "Keystone Technologies", type: p.group || p.cat, specs: p.specs, price: p.p != null ? "$" + p.p : "request quote" })) };
  }
  if (name === "search_supplies") {
    return { results: searchIndex(SUPPLIES, q, 8).map((p) => ({ sku: p.id, name: p.name, specs: p.specs, price: p.p != null ? "$" + p.p + "/" + (p.unit || "ea") : "request quote" })) };
  }
  if (name === "search_gov_bids") {
    if (!searchBids) return { results: [], note: "Gov search unavailable." };
    try {
      const r = await searchBids({ query: q });
      return { results: ((r.json && r.json.opportunities) || []).slice(0, 6).map((o) => ({ title: o.title, agency: o.agency, deadline: o.deadline, setAside: o.setAside || "Full & open", naics: o.naics, link: o.link })) };
    } catch (e) { return { results: [], note: "Gov search failed." }; }
  }
  return { results: [] };
}

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function callOpenAI(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STEP_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ model: MODEL, temperature: 0.3 }, payload)),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(timer); }
}

async function chat(body) {
  if (!isConfigured()) {
    return { status: 503, json: { error: "The assistant is offline right now — please use a Request information form or email steve@digitalhealthinternational.com.", configured: false } };
  }
  const msgs = sanitize(body && body.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return { status: 400, json: { error: "Send a message to start." } };
  }
  const messages = [{ role: "system", content: KB }, ...msgs];
  try {
    // Round 1 — model may request tool calls.
    let r = await callOpenAI({ messages, tools: TOOLS, tool_choice: "auto", max_tokens: 600 });
    if (!r.ok) { console.error("chat upstream:", r.status, JSON.stringify(r.data).slice(0, 160)); return { status: 502, json: { error: "The assistant had trouble responding — please try again." } }; }
    let m = r.data.choices && r.data.choices[0] && r.data.choices[0].message;
    if (m && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      messages.push(m);
      for (const tc of m.tool_calls.slice(0, 3)) {
        let args = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) { /* ignore */ }
        const out = await runTool(tc.function.name, args);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 4000) });
      }
      // Round 2 — final grounded answer.
      r = await callOpenAI({ messages, max_tokens: 600 });
      if (!r.ok) return { status: 502, json: { error: "The assistant had trouble responding — please try again." } };
      m = r.data.choices && r.data.choices[0] && r.data.choices[0].message;
    }
    const reply = (m && m.content) || "Sorry, I didn't catch that — could you rephrase?";
    return { status: 200, json: { reply: reply.trim() } };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("chat error:", aborted ? "timeout" : e.message);
    return { status: aborted ? 504 : 500, json: { error: "The assistant is taking too long — please try again shortly." } };
  }
}

module.exports = { chat, isConfigured, searchIndex };
