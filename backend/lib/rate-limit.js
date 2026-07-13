/* Rate-limit guard backed by Upstash Redis (atomic INCR — reliable, unlike Blobs
   which has no atomic counter and cached reads). INERT / fail-open until the env
   vars UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, so deploying this
   changes nothing until you provision a (free) Upstash Redis and add the creds. */
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function clientIp(event) {
  const h = (event && event.headers) || {};
  return (h["x-nf-client-connection-ip"] || (h["x-forwarded-for"] || "").split(",")[0] || "unknown").trim() || "unknown";
}

async function redis(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`${URL}/${path}`, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: ctrl.signal });
    const j = await res.json().catch(() => ({}));
    return j.result;
  } finally { clearTimeout(t); }
}

// Fixed-window counter: INCR the window key, set its TTL on first hit.
async function limited(event, name, max = 20, windowSec = 60) {
  if (!URL || !TOKEN) return { over: false, disabled: true }; // inert until configured
  const ip = clientIp(event).replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `rl:${name}:${ip}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const ekey = encodeURIComponent(key);
  try {
    const n = await redis(`incr/${ekey}`);
    if (n === 1) { try { await redis(`expire/${ekey}/${windowSec}`); } catch (e) { /* best-effort TTL */ } }
    if (typeof n === "number" && n > max) return { over: true, ip, retryAfter: windowSec };
    return { over: false, ip };
  } catch (e) { return { over: false, ip }; } // fail-open on any error
}

function tooMany(cors, retryAfter) {
  return { statusCode: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(retryAfter || 60) }, body: JSON.stringify({ error: "Too many requests — please slow down and try again shortly." }) };
}

module.exports = { limited, tooMany, clientIp };
