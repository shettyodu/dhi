/* Netlify Function: POST /.netlify/functions/supply-pricing
   action:"public" → storefront price list (no auth).
   action:"list" | "set" → admin (x-dhi-admin: ADMIN_SECRET). */
const { list, setPrice, setBulk, publicList } = require("../../lib/supply-pricing");
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

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const action = body.action || "public";

  try {
    // Public price list — no auth (sell prices only).
    if (action === "public") {
      const r = await publicList();
      return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
    }
    // Admin actions — gated.
    if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Admin not configured (set ADMIN_SECRET)" }) };
    if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

    const r = action === "bulk" ? await setBulk(body) : action === "set" ? await setPrice(body) : await list();
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("supply-pricing error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Request failed" }) };
  }
};
