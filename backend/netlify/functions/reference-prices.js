/* Netlify Function: POST /.netlify/functions/reference-prices
   Admin only (x-dhi-admin: ADMIN_SECRET). Loads curated GSA/public reference
   prices per SKU. action: "set" | "bulk" | default "list". Reading references
   happens server-side inside supply-spend-check / product-finder, not here. */
const { listRefs, setRef, setBulk } = require("../../lib/reference-prices");
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
    const r = action === "bulk" ? await setBulk(body) : action === "set" ? await setRef(body) : await listRefs();
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("reference-prices error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Request failed" }) };
  }
};
