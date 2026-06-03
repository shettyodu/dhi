/* Netlify Function: GET|POST /.netlify/functions/verify-vehicle-passport?vin=...
   Verifies a passport: recomputes the record hash and compares it to the
   on-chain anchor. Returns { verified, tokenId, computedHash, onChainHash, record }. */
const { verifyPassport } = require("../../lib/passport");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };

  let query = {};
  if (event.httpMethod === "GET") {
    query = event.queryStringParameters || {};
  } else if (event.httpMethod === "POST") {
    try { query = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  } else {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const r = await verifyPassport(query);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("verify-vehicle-passport error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Unable to verify passport" }) };
  }
};
