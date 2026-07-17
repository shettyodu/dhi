/* DHI AI Lighting Advisor — a grounded, level-adaptive lighting sales engineer.
   Powers the "AI Advisor" on lighting-catalog / lighting-advisor pages.

   It adapts to the user's expertise IN ONE FLOW:
   - Novice: plain-English use-cases ("light a 30,000 sq ft warehouse, 25 ft
     ceilings") -> it asks the few questions that matter and recommends fixtures
     + quantities with a rationale.
   - Expert: granular specs ("4000K, 480V, 0-10V dim, DLC Premium, Type III")
     -> it fine-tunes the selection and builds the quote.

   Grounding + honesty (same guardrails as chat.js):
   - Recommends ONLY real catalog numbers. Every returned item id is validated
     against the live merged index server-side; hallucinated ids are dropped.
   - Never invents prices/specs. Competitor-brand items with no DHI price show
     "Request quote" downstream — the model is told not to state a price.

   Returns { status, json:{ reply, items:[{id, qty, reason}], asked } }.
   503 when OPENAI_API_KEY is unset. */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const STEP_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 9000);

// Merge the Keystone catalog index with the additional-suppliers index. Kept in
// two files so no supplier's data is co-mingled at rest (mirrors the client).
let KEYSTONE = [], SUPPLIERS = [];
try { KEYSTONE = require("../data/lighting-index.json"); } catch (e) { /* optional */ }
try { SUPPLIERS = require("../data/lighting-suppliers.json"); } catch (e) { /* optional */ }
const INDEX = KEYSTONE.concat(SUPPLIERS);
const BY_ID = new Map(INDEX.map((p) => [String(p.id).toLowerCase(), p]));

const KB = `You are the "DHI Lighting Advisor," an expert lighting sales engineer on the Digital Health International (DHI) website. DHI resells LED lighting from Keystone Technologies (its primary line) plus major manufacturers — Acuity Brands (Lithonia), Signify (Philips), Cree Lighting, Eaton (Cooper), Orion Energy Systems, and Alcon Lighting.

YOUR JOB: help ANY user — a first-timer or a seasoned electrical contractor/spec — arrive at the right fixtures and quantities, then build a quote.

ADAPT TO THE USER, in one conversation:
- If they speak in plain terms ("I need to light a warehouse / parking lot / office"), guide them: infer what you can, and ask at most 2-3 high-impact questions (space size & ceiling height, indoor/outdoor, mounting, any color-temperature or dimming preference). Explain choices simply (e.g. "high bays for tall ceilings", "4000K reads as clean neutral white").
- If they speak in specs (wattage, lumens, CCT, voltage, distribution type, DLC, 0-10V, mounting), skip the basics and match precisely; respect every constraint they give and refine on follow-ups.

TOOLS: call search_catalog to find real products before recommending. Search by intent ("high bay 4000K", "Type III area light", "2x4 troffer 0-10V", "wall pack photocell"). You may call it several times to cover fixture types.

RECOMMENDING:
- Only recommend catalog numbers returned by search_catalog. NEVER invent a catalog number, price, wattage, or lumen figure. If you don't have data, say so or search again.
- Suggest realistic quantities when the user gave enough to estimate (e.g. warehouse sq ft & ceiling height -> a sensible high-bay count with a spacing rule of thumb), and SHOW your quick reasoning. If you can't estimate, recommend the fixture and ask for the count.
- You may mix brands, or focus on one if the user asks. Note DHI's Keystone line as a value option when relevant.
- Do NOT state prices. Say pricing is confirmed on the quote (many items are quote-on-request).

OUTPUT: after any tool calls, respond with a JSON object ONLY, no prose outside it:
{
  "reply": "<your conversational answer in short markdown — friendly, concise, with your reasoning and any follow-up question>",
  "items": [ { "id": "<exact catalog number from search results>", "qty": <integer estimate or 1>, "reason": "<why this fixture, one short phrase>" } ],
  "asked": <true if you asked the user a question and are waiting on them, else false>
}
Keep "items" to the genuinely recommended products (0-8). Omit items you're only mentioning. Always return valid JSON.`;

const TOOLS = [
  { type: "function", function: {
    name: "search_catalog",
    description: "Search the merged DHI lighting catalog (Keystone + Acuity/Lithonia, Signify/Philips, Cree, Eaton/Cooper, Orion, Alcon) by intent, fixture type, wattage, CCT, distribution, or use-case. Returns real products with catalog number, brand, type, specs, wattage, lumens, CCT.",
    parameters: { type: "object", properties: { query: { type: "string", description: "e.g. '4000K high bay', '2x4 troffer 0-10v', 'Type III area light 480v', 'wall pack photocell'" } }, required: ["query"] },
  } },
];

function isConfigured() { return !!API_KEY; }

// Lightweight scored substring search over the merged index.
function searchIndex(q, n) {
  const terms = String(q || "").toLowerCase().split(/[\s,]+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const scored = [];
  for (const p of INDEX) {
    const hay = (p.id + " " + (p.brand || "") + " " + (p.supplier || "") + " " + (p.group || "") +
      " " + (p.specs || "") + " " + (p.cat || "") + " " + (p.cct || "") + " " + (p.w || "") + " " + (p.lm || "")).toLowerCase();
    let s = 0; for (const t of terms) if (hay.indexOf(t) >= 0) s++;
    if (s) scored.push({ s, p });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, n).map((x) => x.p);
}

function runTool(name, args) {
  if (name === "search_catalog") {
    const q = (args && args.query) || "";
    return {
      results: searchIndex(q, 10).map((p) => ({
        catalog: p.id,
        brand: p.supplier || p.brand || "Keystone Technologies",
        type: p.group || p.cat,
        specs: p.specs,
        watts: p.w || "",
        lumens: p.lm || "",
        cct: p.cct || "",
        price: p.p != null ? "$" + p.p : "quote on request",
      })),
    };
  }
  return { results: [] };
}

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
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

// Validate model output: keep only items whose id is a real catalog number, and
// attach the authoritative catalog record so the client renders trusted data.
function validateItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || typeof it.id !== "string") continue;
    const rec = BY_ID.get(it.id.trim().toLowerCase());
    if (!rec) continue;                    // drop hallucinated catalog numbers
    if (seen.has(rec.id)) continue;        // de-dupe
    seen.add(rec.id);
    let qty = parseInt(it.qty, 10); if (!(qty > 0)) qty = 1;
    out.push({ id: rec.id, qty, reason: String(it.reason || "").slice(0, 160),
      cat: rec.cat, group: rec.group || "", supplier: rec.supplier || "Keystone Technologies" });
    if (out.length >= 8) break;
  }
  return out;
}

async function advise(body) {
  if (!isConfigured()) {
    return { status: 503, json: { error: "The Lighting Advisor is offline right now — please use the Request a Quote form or email steve@digitalhealthinternational.com.", configured: false } };
  }
  const msgs = sanitize(body && body.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return { status: 400, json: { error: "Send a message to start." } };
  }
  const messages = [{ role: "system", content: KB }, ...msgs];
  try {
    // Round 1 — model may request catalog searches.
    let r = await callOpenAI({ messages, tools: TOOLS, tool_choice: "auto", max_tokens: 700 });
    if (!r.ok) { console.error("advisor upstream:", r.status, JSON.stringify(r.data).slice(0, 160)); return { status: 502, json: { error: "The advisor had trouble responding — please try again." } }; }
    let m = r.data.choices && r.data.choices[0] && r.data.choices[0].message;
    let hops = 0;
    while (m && Array.isArray(m.tool_calls) && m.tool_calls.length && hops < 3) {
      messages.push(m);
      for (const tc of m.tool_calls.slice(0, 4)) {
        let args = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) { /* ignore */ }
        const out = runTool(tc.function.name, args);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 4000) });
      }
      hops++;
      // Ask for the final structured answer as JSON.
      r = await callOpenAI({ messages, tools: TOOLS, tool_choice: "auto", response_format: { type: "json_object" }, max_tokens: 700 });
      if (!r.ok) return { status: 502, json: { error: "The advisor had trouble responding — please try again." } };
      m = r.data.choices && r.data.choices[0] && r.data.choices[0].message;
    }
    // If the model answered without any tool call, coerce a final JSON turn.
    let payload = {};
    try { payload = JSON.parse((m && m.content) || "{}"); } catch (e) {
      // one more pass forcing JSON
      messages.push({ role: "user", content: "Respond now with the JSON object only (reply, items, asked)." });
      const rr = await callOpenAI({ messages, response_format: { type: "json_object" }, max_tokens: 700 });
      const mm = rr.ok && rr.data.choices && rr.data.choices[0] && rr.data.choices[0].message;
      try { payload = JSON.parse((mm && mm.content) || "{}"); } catch (e2) { payload = { reply: (m && m.content) || "" }; }
    }
    const reply = String(payload.reply || "").trim() || "Tell me about the space you're lighting — size, ceiling height, indoor or outdoor — and I'll recommend fixtures.";
    const items = validateItems(payload.items);
    return { status: 200, json: { reply, items, asked: !!payload.asked } };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("advisor error:", aborted ? "timeout" : e.message);
    return { status: aborted ? 504 : 500, json: { error: "The advisor is taking too long — please try again shortly." } };
  }
}

module.exports = { advise, isConfigured, searchIndex };
