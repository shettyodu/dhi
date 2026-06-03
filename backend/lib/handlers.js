/* Framework-agnostic core logic shared by the Netlify and Vercel wrappers.
   Each function takes plain inputs and returns { status, json } (or { status, body }
   for the webhook). The thin platform wrappers handle HTTP plumbing/CORS/auth. */
const stripeLib = require("stripe");
const { reprice } = require("./pricing");

function stripe() { return stripeLib(process.env.STRIPE_SECRET_KEY); }

// Stripe product tax code for the line items. Default: general tangible goods.
// Override with STRIPE_TAX_CODE if you classify lighting differently.
const TAX_CODE = process.env.STRIPE_TAX_CODE || "txcd_99999999";

async function createPaymentIntent(body) {
  const { items, ship, exempt, email, referral_code } = body || {};
  const referral = String(referral_code || "").trim().slice(0, 64);
  if (!Array.isArray(items) || !items.length) return { status: 400, json: { error: "No items" } };

  // Authoritative repricing from the server-side price table (never trust client totals).
  const q = reprice({ items, ship: ship || {}, exempt: !!exempt });
  if (!q.lines.length) return { status: 400, json: { error: "No purchasable items" } };

  let amountCents = q.amountCents;
  let taxCents = Math.round(q.tax * 100);
  let taxCalcId = null;
  let taxSource = "estimate";

  // Filing-grade tax via Stripe Tax. Falls back to the estimate table if Stripe
  // Tax isn't enabled/active on the account or the call fails.
  try {
    const address = {
      line1: (ship && (ship.line1 || ship.address)) || undefined,
      city: (ship && ship.city) || undefined,
      state: (ship && ship.state) || q.state || undefined,
      postal_code: (ship && ship.zip) || undefined,
      country: "US",
    };
    const calc = await stripe().tax.calculations.create({
      currency: q.currency,
      line_items: q.lines.map((l) => ({
        amount: Math.round(l.lineTotal * 100),
        reference: l.id,
        quantity: l.qty,
        tax_code: TAX_CODE,
      })),
      shipping_cost: { amount: Math.round(q.shipping * 100) },
      customer_details: { address, address_source: "shipping", tax_exempt: exempt ? "exempt" : "none" },
      expand: ["line_items"],
    });
    amountCents = calc.amount_total;            // subtotal + shipping + computed tax
    taxCents = calc.tax_amount_exclusive;
    taxCalcId = calc.id;
    taxSource = "stripe_tax";
  } catch (e) {
    console.warn("Stripe Tax unavailable, using estimate:", e.message);
  }

  if (amountCents < 50) return { status: 400, json: { error: "Order total too low" } };

  const pi = await stripe().paymentIntents.create({
    amount: amountCents,
    currency: q.currency,
    capture_method: "manual",          // authorize now, capture on WESCO ship-confirm
    payment_method_types: ["card"],
    receipt_email: email || undefined,
    description: "DHI Lighting order",
    metadata: {
      skus: q.lines.map((l) => `${l.qty}x${l.id}`).join(",").slice(0, 480),
      subtotal: String(q.subtotal), tax: String((taxCents / 100).toFixed(2)),
      shipping: String(q.shipping), tax_source: taxSource,
      tax_calculation: taxCalcId || "",
      ship_state: q.state || "", ship_zip: (ship && ship.zip) || "",
      referral_code: referral,   // affiliate attribution — influencer payout on completed sales
    },
  });

  return {
    status: 200,
    json: {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      breakdown: {
        subtotal: q.subtotal,
        tax: Math.round(taxCents) / 100,
        shipping: q.shipping,
        total: amountCents / 100,
        taxSource,
        state: q.state,
      },
    },
  };
}

async function shipConfirm(body) {
  const { paymentIntentId, amountToCaptureCents } = body || {};
  if (!paymentIntentId) return { status: 400, json: { error: "Missing paymentIntentId" } };

  const opts = {};
  if (amountToCaptureCents) opts.amount_to_capture = amountToCaptureCents;
  const pi = await stripe().paymentIntents.capture(paymentIntentId, opts);

  // Record the Stripe Tax transaction for filing (from the calculation made at order time).
  let taxTransaction = null;
  const calcId = pi.metadata && pi.metadata.tax_calculation;
  if (calcId) {
    try {
      const tx = await stripe().tax.transactions.createFromCalculation({ calculation: calcId, reference: pi.id });
      taxTransaction = tx.id;
    } catch (e) {
      console.warn("Tax transaction not recorded (calculation may have expired):", e.message);
    }
  }
  return { status: 200, json: { ok: true, status: pi.status, captured: pi.amount_received, taxTransaction } };
}

async function stripeWebhook(rawBody, signature) {
  let event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return { status: 400, body: `Webhook Error: ${e.message}` };
  }
  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
      console.log("Authorized, awaiting WESCO ship-confirm to capture:", event.data.object.id); break;
    case "payment_intent.succeeded":
      console.log("Captured/paid:", event.data.object.id); break;
    case "payment_intent.payment_failed":
      console.log("Payment failed:", event.data.object.id); break;
    default:
      console.log("Unhandled event:", event.type);
  }
  return { status: 200, json: { received: true } };
}

module.exports = { createPaymentIntent, shipConfirm, stripeWebhook };
