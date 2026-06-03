/* Vercel Function: POST /api/admin-leads (thin wrapper)
   Shared logic in ../lib/admin.js. Netlify Blobs persistence — Netlify is primary. */
const { listAll, deleteRecord } = require("../lib/admin");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dhi-admin");
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ADMIN_SECRET) return res.status(503).json({ error: "Admin not configured (set ADMIN_SECRET)" });
  const secret = req.headers["x-dhi-admin"] || "";
  if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = body.action || "list";
    const r = action === "delete" ? await deleteRecord(body) : await listAll();
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error("admin-leads error:", e.message);
    return res.status(500).json({ error: "Admin request failed" });
  }
};
