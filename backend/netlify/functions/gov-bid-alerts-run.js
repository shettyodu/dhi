/* Scheduled Netlify Function — runs daily (schedule in netlify.toml).
   Checks every saved gov-bid alert for new SAM.gov matches and emails them via
   Gmail. No-op (clean 200) when Gmail isn't configured, so the schedule never
   fails. */
const { connectLambda } = require("@netlify/blobs");
const { runAlerts } = require("../../lib/alerts");

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  try {
    const r = await runAlerts();
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) {
    console.error("gov-bid-alerts-run error:", e.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
