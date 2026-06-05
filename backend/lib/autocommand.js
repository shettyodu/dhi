/* Framework-agnostic proxy to the AutoCommand workflow service (the Flask app in
   /autocommand-workflow). Keeps the upstream URL + credentials server-side and
   returns { status, json } like the rest of backend/lib/*.

   Config (Netlify / Vercel env vars):
     AUTOCOMMAND_API_URL    required — e.g. https://autocommand.onrender.com
     AUTOCOMMAND_API_KEY    production auth — sent as `X-API-Key`
     AUTOCOMMAND_APP_USER   dev/local fallback — session login username
     AUTOCOMMAND_APP_PASS   dev/local fallback — session login password
     AUTOCOMMAND_TIMEOUT_MS optional (default 9000)

   Auth strategy: if AUTOCOMMAND_API_KEY is set, send X-API-Key (the production
   path, once the workflow author adds the X-API-Key guard). Otherwise, if app
   credentials are set, log in once and reuse the session cookie — this lets the
   site work against the current build before X-API-Key ships. If neither the URL
   is set, every call returns a friendly 503 so the site degrades gracefully. */

const API_URL = (process.env.AUTOCOMMAND_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.AUTOCOMMAND_API_KEY || "";
const APP_USER = process.env.AUTOCOMMAND_APP_USER || "";
const APP_PASS = process.env.AUTOCOMMAND_APP_PASS || "";
const TIMEOUT_MS = Number(process.env.AUTOCOMMAND_TIMEOUT_MS || 9000);

const COOKIE_TTL = 9 * 60 * 1000;
let _cookie = null;
let _cookieAt = 0;

function notConfigured() {
  return {
    status: 503,
    json: { error: "Inventory search isn't connected yet — your request has been noted and an advisor will follow up.", configured: false },
  };
}

async function login() {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: APP_USER, password: APP_PASS }).toString(),
    redirect: "manual",
  });
  const setc = res.headers.get("set-cookie");
  if (!setc) throw new Error("login returned no session cookie (check APP_USER/APP_PASS)");
  _cookie = setc.split(";")[0]; // e.g. "session=..."
  _cookieAt = Date.now();
  return _cookie;
}

async function authHeaders() {
  if (API_KEY) return { "X-API-Key": API_KEY };
  if (APP_USER && APP_PASS) {
    if (!_cookie || Date.now() - _cookieAt > COOKIE_TTL) await login();
    return { Cookie: _cookie };
  }
  return {};
}

async function call(path, { method = "GET", body } = {}, _retry = false) {
  if (!API_URL) return notConfigured();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = { Accept: "application/json", ...(await authHeaders()) };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: ctrl.signal,
    });
    // Session expired (401) or a redirect to /login (302) → re-login once.
    if (!API_KEY && APP_USER && (res.status === 401 || res.status === 302) && !_retry) {
      _cookie = null;
      clearTimeout(timer);
      return call(path, { method, body }, true);
    }
    let json = null;
    try { json = await res.json(); }
    catch (_) { json = { error: `Upstream returned a non-JSON response (HTTP ${res.status}).` }; }
    return { status: res.status, json };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("autocommand upstream error:", e.message);
    return {
      status: aborted ? 504 : 502,
      json: { error: aborted ? "Inventory search timed out — please try again." : "Inventory search is unreachable right now." },
    };
  } finally {
    clearTimeout(timer);
  }
}

function searchVehicles(body) {
  return call("/search", { method: "POST", body: body || {} });
}

function searchVehiclesNL(body) {
  const q = (body && body.query ? String(body.query) : "").trim();
  if (!q) return Promise.resolve({ status: 400, json: { error: "Type what you're looking for." } });
  return call("/search/nl", { method: "POST", body: { query: q.slice(0, 600) } });
}

function getVehicle(id) {
  const vid = String(id || "").trim();
  if (!vid) return Promise.resolve({ status: 400, json: { error: "A vehicle id is required." } });
  return call(`/vehicle/${encodeURIComponent(vid)}`, { method: "GET" });
}

function compareNarrative(body) {
  const ids = body && Array.isArray(body.ids) ? body.ids.map(String).slice(0, 5) : [];
  if (ids.length < 2) return Promise.resolve({ status: 400, json: { error: "Select 2–5 vehicles to compare." } });
  return call("/compare/narrative", { method: "POST", body: { ids, profile: (body && body.profile) || null } });
}

module.exports = {
  searchVehicles,
  searchVehiclesNL,
  getVehicle,
  compareNarrative,
  isConfigured: () => !!API_URL,
};
