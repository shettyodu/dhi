/* Netlify Function: POST /.netlify/functions/product-finder
   Body: { query, department? } → DHI catalog match + AI identification +
   targeted marketplace search links. Read-only, no storage. */
const { find } = require("../../lib/product-finder");
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
  const rl = await limited(event, "product-finder", 30, 60);
  if (rl.over) return tooMany(cors, rl.retryAfter);
  try {
    const r = await find(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("product-finder error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Search failed — please try again." }) };
  }
};
