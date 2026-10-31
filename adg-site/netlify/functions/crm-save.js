/* Netlify Function: POST /.netlify/functions/crm-save
   Upserts a deal overlay (stage/owner/value/notes) or a manual deal. Passcode-gated. */
const { authed, saveDeal } = require("../../lib/crm");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-adg-pass",
};
const json = (status, obj) => ({ statusCode: status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const a = authed(event);
  if (!a.ok) return json(a.status, { error: a.error });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await saveDeal(body);
    return json(200, r);
  } catch (e) {
    console.error("crm-save error:", e.message);
    return json(500, { error: "Unable to save" });
  }
};
