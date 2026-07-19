/* Netlify Function: POST /.netlify/functions/agent-leads
   Returns ONLY the authenticated agent's leads. Auth via a signed session token
   (Authorization: Bearer <token> or body.token). 401 on bad/expired token. */
const { verifyToken, leadsForAgent } = require("../../lib/agent-auth");
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
    const leads = await leadsForAgent(session.code);
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, code: session.code, leads }) };
  } catch (e) {
    console.error("agent-leads error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Could not load leads" }) };
  }
};
