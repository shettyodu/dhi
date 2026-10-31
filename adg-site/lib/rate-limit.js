/* Best-effort per-IP rate limiting using Netlify Blobs. Fixed-window counter. Blobs
   is eventually consistent and not atomic, so this is approximate — but it caps
   sustained abuse (and the OpenAI cost that abuse of the AI endpoints would cause)
   without getting in the way of normal use. Fail-open on any error, so a limiter
   hiccup never breaks the endpoint. */

const { getStore } = require("@netlify/blobs");

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: "adg-ratelimit", siteID, token }) : getStore("adg-ratelimit");
}

function clientIp(event) {
  const h = (event && event.headers) || {};
  return (h["x-nf-client-connection-ip"] || (h["x-forwarded-for"] || "").split(",")[0] || "unknown").trim() || "unknown";
}

async function limited(event, name, max, windowSec) {
  const ip = clientIp(event).replace(/[^a-zA-Z0-9._:-]/g, "_");
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `${name}/${ip}/${bucket}`;
  try {
    const cur = (await store().get(key, { type: "json", consistency: "strong" })) || { n: 0 };
    const n = (cur.n || 0) + 1;
    await store().setJSON(key, { n });
    if (n > max) return { over: true, retryAfter: windowSec };
    return { over: false };
  } catch (e) {
    return { over: false }; // fail open — never break the endpoint over the limiter
  }
}

function tooMany(cors, retryAfter) {
  return {
    statusCode: 429,
    headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(retryAfter || 60) },
    body: JSON.stringify({ error: "Too many requests — please slow down and try again shortly." }),
  };
}

module.exports = { limited, tooMany, clientIp };
