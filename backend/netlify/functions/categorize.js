/* Netlify Function: POST /.netlify/functions/categorize
   Body: { items: [{i, desc}] } (one batch, capped) → { ok, results:[{i,department,category,source}] }.
   Classification only — no prices, no storage. Powers the Phase 3 Supply Proposal. */
const { categorize } = require("../../lib/categorize");
const { limited, tooMany } = require("../../lib/rate-limit");

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
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return { statusCode: 400, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ error: "No items." }) };
  const rl = await limited(event, "categorize", 40, 60);
  if (rl.over) return tooMany(cors, rl.retryAfter);
  try {
    const results = await categorize(items);
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, results }) };
  } catch (e) {
    console.error("categorize error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Categorization failed." }) };
  }
};
