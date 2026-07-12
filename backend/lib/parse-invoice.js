/* AI invoice reader — extracts purchase line items from raw/messy invoice or
   order text (the "stop making me type" pain). Extraction ONLY: it never invents
   an item, quantity, price, or vendor — it returns just what's present in the
   text. Structured output feeds the same benchmark pipeline. */
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.SUPPLYSCOPE_LLM_TIMEOUT_MS || 12000);

const SYS = [
  "You extract purchase line items from a raw or messy medical-supply invoice, packing slip, or order.",
  "Return STRICT JSON only: {\"lines\":[{\"description\":string,\"quantity\":number|null,\"unit_price\":number|null,\"vendor\":string|null,\"department\":string|null}]}.",
  "Extract ONLY what is present in the text. Never invent an item, quantity, price, or vendor. If a field is absent, use null.",
  "unit_price is the per-unit price if shown; if only an extended/total price and a quantity are shown, divide to get unit price. vendor = the supplier/distributor named on the document.",
  "Skip summary lines (subtotal, tax, freight, total). Buy-side extraction only — no commentary.",
].join(" ");

const num = (x) => (x == null || x === "" || isNaN(Number(x)) ? null : Number(x));

async function parseInvoice(text) {
  if (!API_KEY) return { status: 503, json: { error: "AI reader unavailable (no API key set)." } };
  const src = String(text || "").trim();
  if (src.length < 10) return { status: 400, json: { error: "Paste some invoice text first." } };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 1500, response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYS }, { role: "user", content: "Invoice text:\n" + src.slice(0, 9000) }] }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    const txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!txt) return { status: 502, json: { error: "Reader returned nothing — try again." } };
    let o; try { o = JSON.parse(txt); } catch (e) { return { status: 502, json: { error: "Couldn't read that invoice — paste as columns instead." } }; }
    const lines = (Array.isArray(o.lines) ? o.lines : []).map((l) => ({
      desc: String(l.description || "").slice(0, 160).trim(),
      qty: num(l.quantity) || 1,
      unit_price: num(l.unit_price),
      vendor: l.vendor ? String(l.vendor).slice(0, 80).trim() : null,
      dept: l.department ? String(l.department).slice(0, 60).trim() : null,
    })).filter((l) => l.desc);
    return { status: 200, json: { ok: true, lines, count: lines.length } };
  } catch (e) {
    return { status: 500, json: { error: "Reader failed — try again." } };
  } finally { clearTimeout(timer); }
}

module.exports = { parseInvoice };
