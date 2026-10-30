/* Netlify Function: POST /.netlify/functions/domain-assess
   Asset Data Group — website-based pre-qualifier.
   Body: { domain: "company.com" }. Returns { assessment }.
   503 when OPENAI_API_KEY is unset. */
const { assess } = require("../../lib/domain-assess");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  // TEMP diagnostic — reports OpenAI upstream status without exposing the key. Remove after.
  if (event.queryStringParameters && event.queryStringParameters.debug === "upstream") {
    const key = process.env.OPENAI_API_KEY || "";
    const model = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    let up = { reached: false };
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      });
      const txt = await res.text();
      up = { reached: true, status: res.status, ok: res.ok, errorSnippet: res.ok ? "" : txt.slice(0, 200) };
    } catch (e) { up = { reached: false, err: e.message }; }
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ keyLen: key.length, keyPrefix: key.slice(0, 7), model, base, upstream: up }) };
  }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await assess(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("domain-assess error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Estimate unavailable" }) };
  }
};
