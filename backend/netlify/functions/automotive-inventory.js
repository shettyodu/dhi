/* Netlify Function: POST /.netlify/functions/automotive-inventory
   AutoCommand live inventory aggregation (Model A). Public, dormant-safe.
     { action: "status" }            → { configured }
     { action: "search", profile }   → { results: { buckets:[{vehicles}] } }
   Returns 503 until INVENTORY_PROVIDER + INVENTORY_API_KEY are configured. */
const { configured, searchInventory } = require("../../lib/inventory");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const json = (status, obj) => ({ statusCode: status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(obj) });

  try {
    if (body.action === "status") return json(200, { ok: true, configured: configured() });
    if (body.action === "search") {
      const r = await searchInventory(body.profile || body);
      return json(r.status, r.json);
    }
    return json(400, { error: "Unknown action (use status | search)" });
  } catch (e) {
    console.error("automotive-inventory error:", e.message);
    return json(500, { error: "Inventory search failed" });
  }
};
