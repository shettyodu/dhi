/* Netlify Function: POST /.netlify/functions/automotive-search-nl
   Proxies a natural-language vehicle search to the AutoCommand workflow service
   (LLM-backed upstream; degrades to 503 when the upstream has no OpenAI key). */
const { searchVehiclesNL } = require("../../lib/autocommand");

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
    const r = await searchVehiclesNL(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("automotive-search-nl error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Search failed" }) };
  }
};
