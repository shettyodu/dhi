/* Vercel Function: POST /api/stripe-webhook  (thin wrapper)
   Needs the RAW body for signature verification, so body parsing is disabled. */
const { stripeWebhook } = require("../lib/handlers");

module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await readRaw(req);
  const r = await stripeWebhook(raw, req.headers["stripe-signature"]);
  if (r.body !== undefined) return res.status(r.status).send(r.body);
  return res.status(r.status).json(r.json);
};
