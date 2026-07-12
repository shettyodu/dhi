/* Netlify Function: POST /.netlify/functions/submit-lead
   Captures an AutoCommand customer/dealer/supplier lead into Netlify Blobs. */
const { submitLead } = require("../../lib/leads");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }

  // Honeypot: a hidden "hp" field only bots fill. Silently accept so bots don't
  // learn they were caught — but store nothing.
  if (body.hp && String(body.hp).trim()) {
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, id: "received" }) };
  }


  try {
    const r = await submitLead(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("submit-lead error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Unable to submit" }) };
  }
};
