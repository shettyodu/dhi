/* Scheduled (daily) refresh of the Government bid cache.
   - Scheduled invocations (Netlify cron, see netlify.toml) run the refresh.
   - Manual invocations must carry x-dhi-admin: <ADMIN_SECRET> (lets a rep force
     a refresh from the tool). Pulls per-NAICS opportunities from SAM.gov into
     the Blobs cache the rep tool reads from. */
const { connectLambda } = require("@netlify/blobs");
const { refreshCache } = require("../../lib/govcache");

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }

  // Netlify scheduled invocations include a body with `next_run`.
  let scheduled = false;
  try { scheduled = !!JSON.parse(event.body || "{}").next_run; } catch (e) { /* ignore */ }

  if (!scheduled) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin" }, body: "" };
    if (!process.env.ADMIN_SECRET || (event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
  }

  try {
    const r = await refreshCache({ daysBack: 45 });
    console.log("gov-bids-refresh:", JSON.stringify(r));
    return { statusCode: r.ok ? 200 : 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*" }, body: JSON.stringify(r) };
  } catch (e) {
    console.error("gov-bids-refresh error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: "Refresh failed" }) };
  }
};
