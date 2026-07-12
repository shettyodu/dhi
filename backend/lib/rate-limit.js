/* Basic per-IP rate-limit guard for public endpoints (abuse + OpenAI cost + spam).
   Fixed-window counter in Netlify Blobs. FAIL-OPEN: any store error returns
   not-limited, so a Blobs hiccup never blocks legitimate traffic. */
const { getStore, connectLambda } = require("@netlify/blobs");

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: "rate-limit", siteID, token }) : getStore("rate-limit");
}

function clientIp(event) {
  const h = (event && event.headers) || {};
  return (h["x-nf-client-connection-ip"] || (h["x-forwarded-for"] || "").split(",")[0] || "unknown").trim() || "unknown";
}

// Returns { over: boolean, ip, retryAfter?, remaining? }. name = endpoint bucket.
async function limited(event, name, max = 20, windowSec = 60) {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  const ip = clientIp(event);
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  // Sanitize: Blobs keys can't contain ':' etc., and IPv6 addresses (common on
  // cloud egress) are full of colons — an unsanitized key silently fails to write.
  const safeIp = ip.replace(/[^a-zA-Z0-9]/g, "_");
  const key = `rl/${name}/${safeIp}/${bucket}`;
  let n = 0;
  // Eventual-consistency read (strong reads require an edge URL this runtime lacks
  // and would throw). Reads may lag a sub-second burst, but sustained abuse — the
  // thing we actually care about — trips reliably as the counter propagates.
  try { const cur = await store().get(key, { type: "json" }); n = (cur && cur.n) || 0; }
  catch (e) { return { over: false, ip }; } // fail-open
  if (n >= max) return { over: true, ip, retryAfter: windowSec };
  try { await store().setJSON(key, { n: n + 1 }); } catch (e) { /* best-effort */ }
  return { over: false, ip, remaining: max - (n + 1) };
}

// Standard 429 response body/headers for a limited request.
function tooMany(cors, retryAfter) {
  return { statusCode: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(retryAfter || 60) }, body: JSON.stringify({ error: "Too many requests — please slow down and try again shortly." }) };
}

module.exports = { limited, tooMany, clientIp };
