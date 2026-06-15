/* Netlify Function: POST /.netlify/functions/portal
   Buyer portal data, gated by Netlify Identity. The caller must send the
   Identity bearer token (Authorization: Bearer <access_token>); Netlify then
   populates context.clientContext.user, which we trust for the user id.
   Body: { action: "save"|"list"|"remove", ... } */
const { connectLambda } = require("@netlify/blobs");
const { saveQuote, listQuotes, removeQuote } = require("../../lib/portal");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event, context) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  const user = context && context.clientContext && context.clientContext.user;
  if (!user || !user.sub) return { statusCode: 401, headers: cors, body: JSON.stringify({ ok: false, error: "Please sign in." }) };

  let body = {}; try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    let r;
    if (body.action === "list") r = await listQuotes(user.sub);
    else if (body.action === "remove") r = await removeQuote(user.sub, body.id);
    else r = await saveQuote(user.sub, body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("portal error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Portal request failed" }) };
  }
};
