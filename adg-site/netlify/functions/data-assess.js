/* Netlify Function: POST /.netlify/functions/data-assess
   Asset Data Group — AI data-commercialization assessment.
   Body: { inventory: { domain, dataTypes, volume, ownsRights, pii, sector, notes } }
   Returns { assessment }. 503 when OPENAI_API_KEY is unset (page falls back to capture). */
const { assess } = require("../../lib/data-assess");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
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
