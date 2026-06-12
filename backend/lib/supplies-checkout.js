/* Supplies card checkout — Stripe Checkout Sessions (Stripe-hosted page; no card
   data touches DHI). DORMANT until STRIPE_SECRET_KEY is set, so it ships safely
   and "flips on" the moment keys are configured.

   Pricing is server-authoritative from data/prices.json (never trust the client).
   Only items that carry a price can be card-purchased; quote-only items (p:null)
   route to a Purchase Order / quote instead. */
const stripeLib = require("stripe");
const PRICES = require("../data/prices.json");

// Requires BOTH a Stripe key AND an explicit opt-in flag, so supplies card
// checkout stays OFF even though the Stripe key is already present (shared with
// the lighting checkout). Flip on = set SUPPLIES_CARD_ENABLED=1.
function configured() {
  return !!process.env.STRIPE_SECRET_KEY && /^(1|true|on|yes)$/i.test(String(process.env.SUPPLIES_CARD_ENABLED || ""));
}
function stripe() { return stripeLib(process.env.STRIPE_SECRET_KEY); }

async function createCheckoutSession({ items, origin } = {}) {
  if (!configured()) {
    return { status: 503, json: { ok: false, configured: false, error: "Card checkout isn't configured yet — submit a purchase order or request a quote." } };
  }
  const list = Array.isArray(items) ? items : [];
  const line_items = [], skus = [];
  for (const it of list) {
    const id = String((it && it.id) || "");
    const qty = Math.max(1, Math.min(9999, parseInt(it && it.qty, 10) || 1));
    const rec = PRICES[id];
    if (!rec || rec.p == null) continue;            // quote-only item — not card-purchasable
    const name = (String((it && it.name) || id) + (it && it.v ? ` — ${it.v}` : "")).slice(0, 250);
    line_items.push({
      quantity: qty,
      price_data: { currency: "usd", unit_amount: Math.round(Number(rec.p) * 100), product_data: { name, metadata: { sku: id } } },
    });
    skus.push(`${qty}x${id}`);
  }
  if (!line_items.length) {
    return { status: 400, json: { ok: false, quoteOnly: true, error: "These items are quote-only — submit a purchase order or request a quote." } };
  }
  const base = String(origin || process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) return { status: 400, json: { ok: false, error: "Missing site origin for checkout return URLs." } };
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      phone_number_collection: { enabled: true },
      billing_address_collection: "auto",
      success_url: `${base}/supplies-po.html?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/supplies-po.html?canceled=1`,
      metadata: { skus: skus.join(",").slice(0, 480), source: "supplies-card" },
    });
    return { status: 200, json: { ok: true, url: session.url } };
  } catch (e) {
    console.error("supplies checkout error:", e.message);
    return { status: 502, json: { ok: false, error: "Card checkout is temporarily unavailable — please submit a purchase order." } };
  }
}

module.exports = { configured, createCheckoutSession };
