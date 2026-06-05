/* Netlify Function: GET /.netlify/functions/automotive-vehicle?id=AC-2024-0001
   Proxies a single-vehicle lookup to the AutoCommand workflow service. */
const { getVehicle } = require("../../lib/autocommand");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  const id = (event.queryStringParameters || {}).id || "";
  try {
    const r = await getVehicle(id);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("automotive-vehicle error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Lookup failed" }) };
  }
};
