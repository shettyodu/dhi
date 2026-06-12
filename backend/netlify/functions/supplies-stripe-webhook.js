/* Netlify Function: POST /.netlify/functions/supplies-stripe-webhook
   Records paid supplies card orders. DORMANT until STRIPE_SECRET_KEY and a
   webhook signing secret (STRIPE_WEBHOOK_SECRET_SUPPLIES, falling back to
   STRIPE_WEBHOOK_SECRET) are set. On checkout.session.completed it stores the
   paid order to the leads store (type "po", paid=true) + HubSpot.

   Stripe dashboard → Developers → Webhooks → add endpoint:
     https://<site>/.netlify/functions/supplies-stripe-webhook
     event: checkout.session.completed   → copy the signing secret to
     STRIPE_WEBHOOK_SECRET_SUPPLIES. */
const stripeLib = require("stripe");
const { submitLead } = require("../../lib/leads");
const { connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  const secret = process.env.STRIPE_WEBHOOK_SECRET_SUPPLIES || process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) return { statusCode: 503, body: "Webhook not configured" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const sig = event.headers["stripe-signature"];
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  let evt;
  try { evt = stripeLib(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(raw, sig, secret); }
  catch (e) { return { statusCode: 400, body: `Webhook Error: ${e.message}` }; }

  try {
    if (evt.type === "checkout.session.completed") {
      const s = evt.data.object || {};
      const cd = s.customer_details || {};
      await submitLead({
        type: "po",
        name: cd.name || "Card customer",
        email: cd.email || "card-order@dhi.invalid",
        phone: cd.phone || "",
        company: "",
        line_items: (s.metadata && s.metadata.skus) || "",
        paid: "true",
        amount_total: String((s.amount_total || 0) / 100),
        stripe_session: s.id || "",
        ship_to: cd.address ? [cd.address.line1, cd.address.line2, cd.address.city, cd.address.state, cd.address.postal_code].filter(Boolean).join(", ") : "",
        source: "supplies-card-paid",
      });
    }
  } catch (e) {
    console.error("supplies webhook record error:", e.message);
    // still 200 so Stripe doesn't retry forever; the charge already succeeded.
  }
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
