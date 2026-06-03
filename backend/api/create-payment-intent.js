/* Vercel Function: POST /api/create-payment-intent  (thin wrapper)
   Shared logic lives in ../lib/handlers.js (same code Netlify uses). */
const { createPaymentIntent } = require("../lib/handlers");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const r = await createPaymentIntent(body);
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error("create-payment-intent error:", e.message);
    return res.status(500).json({ error: "Unable to create payment" });
  }
};
