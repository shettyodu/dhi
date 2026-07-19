/* Netlify Function: POST /.netlify/functions/admin-agents
   Admin-only provisioning of insurance agents (sets their sign-in password).
   Auth: header x-dhi-admin: <ADMIN_SECRET>.
   Body: { action: "provision", code, name, brand?, email?, password }
       | { action: "list" } */
const { provisionAgent, listAgents } = require("../../lib/agent-auth");
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
  try {
    const action = body.action || "list";
    const r = action === "provision" ? await provisionAgent(body) : { status: 200, json: { ok: true, agents: await listAgents() } };
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("admin-agents error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Request failed" }) };
  }
};
