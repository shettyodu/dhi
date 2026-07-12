/* Netlify Function: POST /.netlify/functions/savings-ledger
   Admin only (x-dhi-admin: ADMIN_SECRET). action: "add" | "delete" | default "list".
   DHI's ROI / gainshare billing ledger — identified vs captured savings by tenant. */
const { add, list, remove } = require("../../lib/savings-ledger");
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

  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Admin not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const action = body.action || "list";
  try {
    const r = action === "add" ? await add(body) : action === "delete" ? await remove(body.id) : await list(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("savings-ledger error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Request failed" }) };
  }
};
