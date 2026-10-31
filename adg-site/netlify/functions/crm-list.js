/* Netlify Function: GET /.netlify/functions/crm-list
   Returns the ADG deal pipeline (leads + deal overlays). Passcode-gated. */
const { authed, listAll, STAGES } = require("../../lib/crm");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-adg-pass",
};
const json = (status, obj) => ({ statusCode: status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  const a = authed(event);
  if (!a.ok) return json(a.status, { error: a.error });
  try {
    const deals = await listAll();
    return json(200, { deals, stages: STAGES });
  } catch (e) {
    console.error("crm-list error:", e.message);
    return json(500, { error: "Unable to load pipeline" });
  }
};
