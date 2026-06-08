/* Vercel Function: POST /api/gov-bids (thin wrapper)
   Government bid match-maker. Shared logic in ../lib/govbids.js. */
const { searchBids, listVerticals } = require("../lib/govbids");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dhi-admin");
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ADMIN_SECRET) return res.status(503).json({ error: "Tool not configured (set ADMIN_SECRET)" });
  const secret = req.headers["x-dhi-admin"] || "";
  if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (body.action === "verticals") return res.status(200).json({ ok: true, verticals: listVerticals() });
    const r = await searchBids({ query: body.query, vertical: body.vertical, daysBack: body.daysBack });
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error("gov-bids error:", e.message);
    return res.status(500).json({ error: "Bid search failed" });
  }
};
