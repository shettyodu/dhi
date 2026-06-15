/* Netlify Function: POST /.netlify/functions/gov-bid-alerts
   Internal rep tool — subscribe a saved gov-bid search to daily email alerts.
   Auth: header x-dhi-admin: <ADMIN_SECRET> (fail-closed, same as gov-bids).
   Body: { action: "subscribe", email, query?, vertical? } | { action: "list" } | { action: "remove", id } */
const { connectLambda } = require("@netlify/blobs");
const { subscribe, listSubs, removeSub } = require("../../lib/alerts");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {}; try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    let r;
    if (body.action === "list") r = await listSubs();
    else if (body.action === "remove") r = await removeSub(body.id);
    else r = await subscribe(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("gov-bid-alerts error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Alert request failed" }) };
  }
};
