/* Netlify Function: POST /.netlify/functions/insurance-ai
   Internal (gated) AI helpers for the insurance vertical.
   Auth: header x-dhi-admin: <ADMIN_SECRET> (fail-closed).
   Body: { action: "proposal", company, employees, state, currentCoverage, notes }
       | { action: "outreach", segment, tone, cta }
   Returns DRAFTS for licensed/compliance review — never sends anything. */
const { generateSmartCareProposal, generateOutreachEmail } = require("../../lib/insurance");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = body.action === "outreach"
      ? await generateOutreachEmail(body)
      : await generateSmartCareProposal(body);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("insurance-ai error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Generation failed" }) };
  }
};
