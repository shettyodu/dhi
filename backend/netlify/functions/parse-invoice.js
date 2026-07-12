/* Netlify Function: POST /.netlify/functions/parse-invoice
   Body: { text } → { ok, lines:[{desc,qty,unit_price,vendor,dept}], count }.
   AI invoice reader — extraction only, no storage. */
const { parseInvoice } = require("../../lib/parse-invoice");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  try {
    const r = await parseInvoice(body.text);
    return { statusCode: r.status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(r.json) };
  } catch (e) {
    console.error("parse-invoice error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Reader failed." }) };
  }
};
