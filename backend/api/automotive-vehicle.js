/* Vercel mirror: GET /api/automotive-vehicle?id=... — shared logic in ../lib/autocommand.js */
const { getVehicle } = require("../lib/autocommand");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const id = (req.query && req.query.id) || "";
    const r = await getVehicle(id);
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error("automotive-vehicle error:", e.message);
    return res.status(500).json({ error: "Lookup failed" });
  }
};
