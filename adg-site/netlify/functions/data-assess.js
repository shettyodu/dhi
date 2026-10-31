/* Netlify Function: POST /.netlify/functions/data-assess
   Asset Data Group — AI data-commercialization assessment.
   Body: { inventory: { domain, dataTypes, volume, ownsRights, pii, sector, notes } }
   Returns { assessment }. 503 when OPENAI_API_KEY is unset (page falls back to capture). */
const { assess } = require("../../lib/data-assess");
const { connectLambda } = require("@netlify/blobs");
const { limited, tooMany } = require("../../lib/rate-limit");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  const rl = await limited(event, "data-assess", 20, 600);
  if (rl.over) return tooMany(cors, rl.retryAfter);
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await assess(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("data-assess error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Assessment unavailable" }) };
  }
};
