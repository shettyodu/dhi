/* Netlify Function: POST /.netlify/functions/supply-spend-check
   Benchmarks a provider's supply line items against DHI's catalog and returns
   potential savings. Read-only analysis — no storage, no lead required. */
const { analyze } = require("../../lib/spend-benchmark");
const { assess } = require("../../lib/supply-advisor");
const market = require("../../lib/market-index");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return { statusCode: 400, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Add at least one line item." }) };

  try {
    const result = analyze(lines);
    const assessment = assess(result); // agentic buy-side advisor, grounded in the result
    // Build the proprietary price index — anonymized, opt-in. Never blocks the result.
    if (body.consent) { try { await market.capture(result.rows); } catch (e) { /* best-effort */ } }
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, ...result, assessment }) };
  } catch (e) {
    console.error("supply-spend-check error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Analysis failed — please try again." }) };
  }
};
