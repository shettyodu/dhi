/* Framework-agnostic core logic for the lighting Influencer Program sign-up.
   Mirrors lib/passport.js: returns { status, json }. Persists each signup to
   Netlify Blobs and issues a unique referral code used for affiliate
   attribution at checkout. No emails are sent from here. */

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");
const hubspot = require("./hubspot");

const STORE = "influencer-signups";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "https://courageous-fairy-0b2d3c.netlify.app";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Prefer explicit config (works under manual CLI deploys); fall back to the
// automatic runtime context when available (git-built deploys).
function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

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
  const program = b.program === "automotive" ? "automotive" : "lighting";

  if (!name) return { status: 400, json: { error: "Name is required" } };
  if (!EMAIL_RE.test(email)) return { status: 400, json: { error: "A valid email is required" } };
  if (!channel) return { status: 400, json: { error: "Your channel / handle is required" } };

  let blob;
  try { blob = store(); }
  catch (e) {
    console.error("influencer blobs not configured:", e.message);
    return { status: 503, json: { error: "Sign-up is temporarily unavailable. Please email us to join the program." } };
  }

  // Reuse an existing code if this email already signed up (idempotent).
  let code = null;
  try {
    const existingIdx = await blob.get("by-email/" + program + "/" + email.toLowerCase(), { type: "json" });
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
    program,
    payoutModel: "7% of gross profit on attributed completed sales",
    status: "pending-review",
    signedUpAt: new Date().toISOString(),
  };

  try {
    await blob.setJSON(code, record);
    await blob.setJSON("by-email/" + program + "/" + email.toLowerCase(), { code });
  } catch (e) {
    console.error("influencer blobs write failed:", e.message);
    return { status: 503, json: { error: "Sign-up is temporarily unavailable. Please email us to join the program." } };
  }

  // Best-effort sync to HubSpot CRM — never blocks sign-up.
  try { await hubspot.upsertInfluencer(record); }
  catch (e) { console.error("hubspot influencer sync error:", e.message); }

  const landing = program === "automotive" ? "automotive.html" : "lighting-catalog.html";
  const link = `${PUBLIC_BASE}/${landing}?ref=${encodeURIComponent(code)}`;
  return { status: 200, json: { code, link, record } };
}

module.exports = { signUpInfluencer };
