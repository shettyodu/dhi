/* Netlify Function: POST /.netlify/functions/admin-leads
   Admin-only view/prune of captured leads + influencer signups.
   Auth: header  x-dhi-admin: <ADMIN_SECRET>
   Body: { action: "list" } | { action: "delete", store, key } */
const { listAll, deleteRecord } = require("../../lib/admin");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  // Fail closed: must be configured AND match.
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Admin not configured (set ADMIN_SECRET)" }) };
  const secret = event.headers["x-dhi-admin"] || ""; // Netlify lowercases header keys
  if (secret !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }

  try {
    const action = body.action || "list";
    const r = action === "delete" ? await deleteRecord(body) : await listAll();
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("admin-leads error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Admin request failed" }) };
  }
};
