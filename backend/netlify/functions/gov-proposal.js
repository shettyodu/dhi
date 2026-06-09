/* Netlify Function: POST /.netlify/functions/gov-proposal
   Generate a complete draft proposal for a matched bid opportunity, grounded in
   DHI's capabilities + partner-catalog products (capabilities.js → proposal.js).
   Auth: header x-dhi-admin: <ADMIN_SECRET> (fail-closed). Body: { opportunity } */
const { generateProposal } = require("../../lib/proposal");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await generateProposal(body.opportunity || body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("gov-proposal error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Proposal generation failed" }) };
  }
};
