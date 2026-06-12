/* Netlify Function: POST /.netlify/functions/supplies-checkout
   Customer-facing supplies card checkout (Stripe Checkout Session).
   Public (no admin gate) — Stripe hosts the payment page.
     { action: "status" }                 → { configured }
     { action: "create", items, origin? } → { url }  (redirect the browser there) */
const { configured, createCheckoutSession } = require("../../lib/supplies-checkout");

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
    if (body.action === "create") {
      let origin = body.origin || event.headers.origin || "";
      if (!origin && event.headers.referer) { try { origin = new URL(event.headers.referer).origin; } catch (e) {} }
      const r = await createCheckoutSession({ items: body.items, origin });
      return json(r.status, r.json);
    }
    return json(400, { error: "Unknown action (use status | create)" });
  } catch (e) {
    console.error("supplies-checkout error:", e.message);
    return json(500, { error: "Checkout failed" });
  }
};
