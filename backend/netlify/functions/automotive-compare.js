/* Netlify Function: POST /.netlify/functions/automotive-compare
   Body: { ids: [vehicle_id, ...2-5], profile?: {...} }
   Proxies an AI side-by-side comparison narrative to the workflow service. */
const { compareNarrative } = require("../../lib/autocommand");

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
    const r = await compareNarrative(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("automotive-compare error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Compare failed" }) };
  }
};
