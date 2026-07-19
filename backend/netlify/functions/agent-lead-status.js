/* Netlify Function: POST /.netlify/functions/agent-lead-status
   An agent updates the status of ONE of their own leads.
   Auth: signed session token (Authorization: Bearer <token> or body.token).
   Body: { key, status }  status in new|contacted|quoted|bound|lost.
   403 if the lead isn't the caller's; 401 on bad token. */
const { verifyToken, updateLeadStatus } = require("../../lib/agent-auth");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const token = auth.replace(/^Bearer\s+/i, "") || body.token || "";

  const session = verifyToken(token);
  if (!session) return { statusCode: 401, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Not signed in" }) };

  try {
    const r = await updateLeadStatus(session.code, body.key, body.status);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("agent-lead-status error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Update failed" }) };
  }
};
