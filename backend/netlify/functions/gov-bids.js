/* Netlify Function: POST /.netlify/functions/gov-bids
   Internal rep tool — government bid match-maker (SAM.gov, federal + defense).
   Auth: header  x-dhi-admin: <ADMIN_SECRET>   (fail-closed, same as admin-leads)
   Body: { action: "search", query?, vertical?, daysBack? } | { action: "verticals" } */
const { searchBids, listVerticals } = require("../../lib/govbids");
const { searchFromCache } = require("../../lib/govcache");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  // Fail closed: must be configured AND match.
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  const secret = event.headers["x-dhi-admin"] || "";
  if (secret !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }

  try {
    if (body.action === "verticals") {
      return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, verticals: listVerticals() }) };
    }
    // Prefer the daily cache (no live API call); fall back to a live/sample search.
    const cached = await searchFromCache({ query: body.query, vertical: body.vertical }).catch(() => null);
    const json = cached || (await searchBids({ query: body.query, vertical: body.vertical, daysBack: body.daysBack })).json;
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(json) };
  } catch (e) {
    console.error("gov-bids error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Bid search failed" }) };
  }
};
