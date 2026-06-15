/* Netlify Function: POST /.netlify/functions/supplies-recalls
   Public — checks the openFDA device enforcement API for recent recalls in a
   product category. Body: { query: "gloves", limit?: 8 } */
const { recallsFor } = require("../../lib/recalls");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  let body = {}; try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await recallsFor(body.query, body.limit);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("supplies-recalls error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Recall lookup failed" }) };
  }
};
