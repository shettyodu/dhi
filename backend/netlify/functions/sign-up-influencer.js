/* Netlify Function: POST /.netlify/functions/sign-up-influencer
   Registers a lighting-program influencer and returns a referral code + link. */
const { signUpInfluencer } = require("../../lib/influencer");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  // Wire the Netlify Blobs context for Lambda-compatibility functions (required
  // before getStore() — modern v2 functions get this automatically).
  try { connectLambda(event); } catch (e) { /* older runtime / auto-context */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }

  try {
    const r = await signUpInfluencer(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("sign-up-influencer error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Unable to complete sign-up" }) };
  }
};
