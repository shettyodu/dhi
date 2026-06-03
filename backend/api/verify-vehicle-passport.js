/* Vercel Function: GET|POST /api/verify-vehicle-passport  (thin wrapper)
   Shared logic in ../lib/passport.js. See note in create-vehicle-passport.js
   about Netlify Blobs being the primary persistence layer. */
const { verifyPassport } = require("../lib/passport");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    let query = {};
    if (req.method === "GET") query = req.query || {};
    else if (req.method === "POST") query = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    else return res.status(405).json({ error: "Method not allowed" });
    const r = await verifyPassport(query);
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error("verify-vehicle-passport error:", e.message);
    return res.status(500).json({ error: "Unable to verify passport" });
  }
};
