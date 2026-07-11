/* Netlify Function: POST /.netlify/functions/market-report
   Admin-only DHI-vs-market pricing report from the captured price index.
   Auth: header  x-dhi-admin: <ADMIN_SECRET> */
const { report, clearDemo } = require("../../lib/market-report");
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
  const secret = event.headers["x-dhi-admin"] || "";
  if (secret !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }

  try {
    const r = body.action === "clear-demo" ? await clearDemo() : await report();
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("market-report error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Report failed" }) };
  }
};
