/* Netlify Function: POST /.netlify/functions/ship-confirm
   Captures the authorized PaymentIntent on WESCO ship-confirmation (EDI 856).
   Auth: header  x-dhi-secret: <SHIP_CONFIRM_SECRET>
   Body: { paymentIntentId, amountToCaptureCents? } */
const { shipConfirm } = require("../../lib/handlers");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  const secret = event.headers["x-dhi-secret"] || ""; // Netlify lowercases header keys
  if (secret !== process.env.SHIP_CONFIRM_SECRET) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }

  try {
    const r = await shipConfirm(body);
    return { statusCode: r.status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("ship-confirm error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
