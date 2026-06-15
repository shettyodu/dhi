/* Netlify Function: POST /.netlify/functions/gov-award-intel
   Internal rep tool — "who's winning this kind of work" for a NAICS code.
   Auth: header  x-dhi-admin: <ADMIN_SECRET>  (fail-closed, same as gov-bids).
   Body: { naics: "335110", years?: 3, limit?: 25 } */
const { awardIntel } = require("../../lib/award-intel");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await awardIntel(body.naics, { years: body.years || 3, limit: body.limit || 25 });
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("gov-award-intel error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Award lookup failed" }) };
  }
};
