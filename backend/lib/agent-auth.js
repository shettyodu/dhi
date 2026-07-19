/* =====================================================================
   Insurance agent authentication + agent-scoped leads.

   Real security, no external deps:
   - Passwords hashed with scrypt (random per-user salt), constant-time verify.
   - Sessions are stateless signed tokens: base64url(payload).base64url(HMAC),
     signed with AGENT_AUTH_SECRET, with an expiry. No secret ever reaches the client.
   - An agent can only ever read leads whose referral_code == their own code.

   Fail-closed: if AGENT_AUTH_SECRET is unset, auth is disabled (503) rather than
   insecurely open. Agents are provisioned by admin (admin-agents fn) into the
   `insurance-agents` Blobs store; passwords are set by admin/agent, never here.
   ===================================================================== */
const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const AGENTS_STORE = "insurance-agents";
const LEADS_STORE = "automotive-leads";      // all site leads land here (see lib/leads.js)
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;    // 12h sessions

function store(name) {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name, siteID, token }) : getStore(name);
}
function secret() { return process.env.AGENT_AUTH_SECRET || ""; }
function isConfigured() { return !!secret(); }

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uToBuf = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const normCode = (c) => String(c || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);

/* ------------------------- passwords ------------------------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  try {
    const [scheme, salt, hash] = String(stored || "").split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const calc = crypto.scryptSync(String(pw), salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex"), b = Buffer.from(calc, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

/* --------------------------- tokens -------------------------- */
function signToken(code, now) {
  const t = now || Date.now();
  const payload = b64u(JSON.stringify({ c: normCode(code), e: t + TOKEN_TTL_MS }));
  const sig = b64u(crypto.createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}
function verifyToken(token, now) {
  if (!isConfigured()) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = b64u(crypto.createHmac("sha256", secret()).update(payload).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data; try { data = JSON.parse(b64uToBuf(payload).toString("utf8")); } catch (e) { return null; }
  if (!data || !data.c || !data.e || (now || Date.now()) > data.e) return null;
  return { code: data.c, exp: data.e };
}

/* -------------------------- agents --------------------------- */
async function provisionAgent({ code, name, brand, email, password, tagline }) {
  const c = normCode(code);
  if (!c) return { status: 400, json: { error: "Valid code required" } };
  if (!password || String(password).length < 8) return { status: 400, json: { error: "Password must be at least 8 characters" } };
  const rec = {
    code: c, name: String(name || c).slice(0, 120), brand: /^#[0-9a-fA-F]{6}$/.test(brand || "") ? brand : "#1c6cb0",
    email: String(email || "").slice(0, 160), tagline: String(tagline || "").slice(0, 160),
    passHash: hashPassword(password), createdAt: new Date().toISOString(),
  };
  await store(AGENTS_STORE).setJSON(c, rec);
  return { status: 200, json: { ok: true, agent: publicAgent(rec) } };
}
async function getAgent(code) {
  try { return await store(AGENTS_STORE).get(normCode(code), { type: "json" }); } catch (e) { return null; }
}
function publicAgent(rec) { return rec ? { code: rec.code, name: rec.name, brand: rec.brand, email: rec.email, tagline: rec.tagline } : null; }
async function listAgents() {
  const s = store(AGENTS_STORE); const out = [];
  try { const { blobs } = await s.list(); for (const b of blobs || []) { const r = await s.get(b.key, { type: "json" }).catch(() => null); if (r) out.push(publicAgent(r)); } } catch (e) {}
  return out;
}

/* --------------------------- login --------------------------- */
async function login({ code, password }) {
  if (!isConfigured()) return { status: 503, json: { error: "Agent sign-in isn't configured yet.", configured: false } };
  const rec = await getAgent(code);
  // constant-ish path: always run a verify to reduce user-enumeration timing signal
  const ok = rec ? verifyPassword(password, rec.passHash) : verifyPassword(password, "scrypt$0$0");
  if (!rec || !ok) return { status: 401, json: { error: "Invalid code or password." } };
  return { status: 200, json: { ok: true, token: signToken(rec.code), agent: publicAgent(rec) } };
}

/* --------------- leads for the authenticated agent ----------- */
async function leadsForAgent(code) {
  const c = normCode(code);
  const s = store(LEADS_STORE);
  const out = [];
  try {
    const { blobs } = await s.list();
    for (const b of blobs || []) {
      const r = await s.get(b.key, { type: "json" }).catch(() => null);
      if (!r || typeof r !== "object") continue;
      if (normCode(r.referral_code) !== c) continue;         // only THIS agent's leads
      out.push({
        id: r.id || b.key, name: r.name || "", email: r.email || "", phone: r.phone || "",
        interest: r.interest || "", message: r.message || "", source: r.source || "",
        status: r.status || "new", submittedAt: r.submittedAt || r.createdAt || "",
      });
    }
  } catch (e) { /* store unavailable */ }
  out.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return out;
}

module.exports = {
  isConfigured, hashPassword, verifyPassword, signToken, verifyToken,
  provisionAgent, getAgent, listAgents, login, leadsForAgent, publicAgent,
};
