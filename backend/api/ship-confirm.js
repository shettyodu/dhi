/* Vercel Function: POST /api/ship-confirm  (thin wrapper)
   Captures the authorized PaymentIntent on WESCO ship-confirmation.
   Auth: header  x-dhi-secret: <SHIP_CONFIRM_SECRET> */
const { shipConfirm } = require("../lib/handlers");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-dhi-secret"] || "") !== process.env.SHIP_CONFIRM_SECRET)
    return res.status(401).json({ error: "Unauthorized" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const r = await shipConfirm(body);
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error("ship-confirm error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};
