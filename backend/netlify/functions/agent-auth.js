/* Netlify Function: POST /.netlify/functions/agent-auth
   Insurance agent sign-in. Body: { code, password } -> { ok, token, agent }.
   503 if AGENT_AUTH_SECRET unset; 401 on bad credentials. Rate-limited. */
const { login } = require("../../lib/agent-auth");
const { connectLambda } = require("@netlify/blobs");
const { limited, tooMany } = require("../../lib/rate-limit");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  const rl = await limited(event, "agent-auth", 8, 60);   // throttle brute force
  if (rl.over) return tooMany(cors, rl.retryAfter);

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await login({ code: body.code, password: body.password });
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("agent-auth error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Sign-in failed" }) };
  }
};
