/* Netlify Function: POST /.netlify/functions/stripe-webhook
   Verifies Stripe's signature (uses the RAW body) and logs key events. */
const { stripeWebhook } = require("../../lib/handlers");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  const sig = event.headers["stripe-signature"];
  const r = await stripeWebhook(raw, sig);
  return { statusCode: r.status, body: r.body !== undefined ? r.body : JSON.stringify(r.json) };
};
