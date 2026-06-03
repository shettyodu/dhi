# DHI Lighting — Payments Backend (Netlify)

Three serverless functions that turn the front-end checkout's "validate card"
step into a real Stripe charge, with **capture-on-ship** for WESCO drop-shipping.
Shared logic in `lib/` is reused by both Netlify (primary) and Vercel wrappers.

| Function | URL (Netlify) | Purpose |
|---|---|---|
| create-payment-intent | `/.netlify/functions/create-payment-intent` | Reprices the cart **server-side** (never trusts client prices), authorizes the card (manual capture). Returns `clientSecret`. |
| ship-confirm | `/.netlify/functions/ship-confirm` | Called when WESCO confirms shipment (EDI 856) → **captures** the payment (optionally the final freight-adjusted amount). |
| stripe-webhook | `/.netlify/functions/stripe-webhook` | Verifies Stripe events for logging / order records. |

```
backend/
├─ netlify/functions/   # Netlify handlers (exports.handler)
├─ api/                 # Vercel handlers (alternative)
├─ lib/                 # shared logic: handlers.js + pricing.js
├─ data/prices.json     # server-side source of truth (974 SKUs)
├─ netlify.toml         # Netlify config (functions dir, bundler, included files)
└─ .env.example
```

---

## 1. Prerequisites
- A **Stripe** account (start in **test mode**): Dashboard → Developers → API keys
  give you `pk_test_…` (publishable) and `sk_test_…` (secret).
- A free **Netlify** account + the CLI: `npm i -g netlify-cli`.

## 2. Configure & install
```bash
cd backend
cp .env.example .env      # fill in your keys (local dev only)
npm install
```
You'll set these as **Environment variables** in Netlify (Site → Settings →
Environment variables) — not committed:
- `STRIPE_SECRET_KEY` = `sk_test_…`
- `SHIP_CONFIRM_SECRET` = a long random string (protects capture-on-ship)
- `ALLOWED_ORIGIN` = your website origin, e.g. `https://www.digitalhealthinternational.com`
- `STRIPE_WEBHOOK_SECRET` = added in step 4

## 3. Deploy (Netlify)
Deploy this **`backend/` folder** as the site base.
```bash
cd backend
netlify login
netlify init        # create/link a site; set base directory = backend
netlify env:import .env          # or add vars in the dashboard
netlify deploy --build --prod    # note the URL, e.g. https://dhi-pay.netlify.app
```
- Local testing: `netlify dev` serves functions at
  `http://localhost:8888/.netlify/functions/…`.
- Git-based deploys also work: connect the repo, set **Base directory** = `backend`,
  **Functions directory** = `netlify/functions` (netlify.toml already sets this).

## 4. Stripe webhook (recommended)
Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
- Events: `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
  `payment_intent.payment_failed`
- Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`, redeploy.

## 5. Point the website at it
In `site/assets/checkout.js`:
```js
const CFG = {
  stripeKey: "pk_test_YOUR_PUBLISHABLE_KEY",
  paymentIntentEndpoint: "https://YOUR-SITE.netlify.app/.netlify/functions/create-payment-intent",
  ...
};
```
The card step now authorizes a real (test) payment. Test cards:
`4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline). They appear in
your Stripe Dashboard (test mode) as **uncaptured** authorizations.

## 6. Capture on shipment (the WESCO step)
When WESCO ships (EDI **856 ASN**), your EDI middleware (SPS Commerce / Orderful)
— or an internal "mark shipped" action — calls:
```bash
curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/ship-confirm \
  -H "x-dhi-secret: $SHIP_CONFIRM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_123","amountToCaptureCents":34442}'
```
Omit `amountToCaptureCents` to capture the full authorization; include it to capture
the final freight-adjusted total once the **810 invoice** is known.

## 7. Go live
Swap test keys for live keys, finish Stripe activation, keep `ALLOWED_ORIGIN` on the
production domain.

---

### ⚠️ Notes
- **Auth window:** a manual-capture authorization holds ~7 days (≤30 with Stripe
  extended auth). For longer WESCO lead times, prefer **ACH** or **save the payment
  method and create the PaymentIntent at ship time**. PO/net-terms orders avoid this.
- **Prices:** `data/prices.json` is the server's source of truth. Re-run
  `npm run build-prices` whenever catalog prices change.
- **Tax:** `create-payment-intent` uses **Stripe Tax** for filing-grade rates, and
  **falls back to the estimate table** if Stripe Tax isn't active. To enable it:
  Stripe Dashboard → **Tax** → set your **origin address** and turn Tax on, and add
  the registrations/states where you collect. Optionally set `STRIPE_TAX_CODE`
  (default `txcd_99999999`, general tangible goods). On capture, `ship-confirm`
  records the Stripe **tax transaction** for filing. (Shipping fees are still the
  estimate — add EasyPost for live freight.)
- **Redeploy after code changes:** this repo was updated to add Stripe Tax — run
  your deploy again (`netlify deploy --build --prod` or push to the connected repo).
- **Vercel alternative:** the `api/` folder has equivalent handlers
  (`/api/create-payment-intent`, etc.) using the same `lib/` logic — deploy with
  `vercel --prod` instead if you prefer.
