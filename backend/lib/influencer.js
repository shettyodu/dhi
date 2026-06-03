/* Framework-agnostic core logic for the lighting Influencer Program sign-up.
   Mirrors lib/passport.js: returns { status, json }. Persists each signup to
   Netlify Blobs and issues a unique referral code used for affiliate
   attribution at checkout. No emails are sent from here. */

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

const STORE = "influencer-signups";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "https://courageous-fairy-0b2d3c.netlify.app";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function store() { return getStore(STORE); }

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 18);
}

// Referral code: name-slug + 4 hex chars (stable-ish, readable, low-collision).
function makeCode(name) {
  const base = slugify(name) || "creator";
  const rand = crypto.randomBytes(2).toString("hex"); // 4 hex chars
  return (base + "-" + rand).toUpperCase();
}

async function signUpInfluencer(body) {
  const b = body || {};
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim();
  const channel = String(b.channel || "").trim();   // platform / handle / URL
  const audience = String(b.audience || "").trim();  // audience size / niche
  const payoutNote = String(b.payoutNote || "").trim();

  if (!name) return { status: 400, json: { error: "Name is required" } };
  if (!EMAIL_RE.test(email)) return { status: 400, json: { error: "A valid email is required" } };
  if (!channel) return { status: 400, json: { error: "Your channel / handle is required" } };

  const blob = store();

  // Reuse an existing code if this email already signed up (idempotent).
  let code = null;
  try {
    const existingIdx = await blob.get("by-email/" + email.toLowerCase(), { type: "json" });
    if (existingIdx && existingIdx.code) code = existingIdx.code;
  } catch (e) { /* ignore */ }

  if (!code) {
    // Generate a code, retry a couple times on the rare collision.
    for (let i = 0; i < 4; i++) {
      const candidate = makeCode(name);
      let taken = false;
      try { taken = !!(await blob.get(candidate, { type: "json" })); } catch (e) {}
      if (!taken) { code = candidate; break; }
    }
    if (!code) code = makeCode(name + crypto.randomBytes(2).toString("hex"));
  }

  const record = {
    code,
    name,
    email,
    channel,
    audience,
    payoutNote,
    program: "lighting",
    payoutModel: "7% of gross profit on attributed completed sales",
    status: "pending-review",
    signedUpAt: new Date().toISOString(),
  };

  await blob.setJSON(code, record);
  await blob.setJSON("by-email/" + email.toLowerCase(), { code });

  const link = `${PUBLIC_BASE}/lighting-catalog.html?ref=${encodeURIComponent(code)}`;
  return { status: 200, json: { code, link, record } };
}

module.exports = { signUpInfluencer };
