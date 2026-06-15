/* Government bid alerts — saved searches that email new matching opportunities.
   Subscriptions live in Netlify Blobs (store "gov-bid-alerts"); a scheduled
   function calls runAlerts() daily to find new matches and email them via Gmail.
   Returns { status, json }. */

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");
const { searchBids } = require("./govbids");
const mailer = require("./mailer");

const STORE = "gov-bid-alerts";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SEEN_CAP = 600; // keep the most recent N seen ids per subscription

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}
const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n || 200);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function subscribe(body) {
  const b = body || {};
  const email = clip(b.email, 160).toLowerCase();
  const query = clip(b.query, 200);
  const vertical = clip(b.vertical, 60);
  if (!EMAIL_RE.test(email)) return { status: 400, json: { ok: false, error: "A valid email is required." } };
  if (!query && !vertical) return { status: 400, json: { ok: false, error: "Run a search first, then subscribe to it." } };

  const id = crypto.randomBytes(8).toString("hex");
  const sub = { id, email, query, vertical, frequency: "daily", active: true, createdAt: new Date().toISOString(), lastRunAt: null, seen: [] };
  let blob;
  try { blob = store(); } catch (e) { return { status: 503, json: { ok: false, error: "Alerts storage isn't available right now." } }; }
  try { await blob.setJSON(`sub/${id}`, sub); }
  catch (e) { return { status: 503, json: { ok: false, error: "Couldn't save your alert — please try again." } }; }

  return { status: 200, json: { ok: true, id, email, configured: mailer.configured() } };
}

async function listSubs() {
  let blob; try { blob = store(); } catch (e) { return { status: 503, json: { ok: false, error: "unavailable" } }; }
  const out = [];
  try {
    const { blobs } = await blob.list({ prefix: "sub/" });
    for (const b of blobs || []) { const s = await blob.getJSON(b.key).catch(() => null); if (s) out.push({ id: s.id, email: s.email, query: s.query, vertical: s.vertical, createdAt: s.createdAt, lastRunAt: s.lastRunAt }); }
  } catch (e) { /* empty */ }
  return { status: 200, json: { ok: true, count: out.length, subscriptions: out } };
}

async function removeSub(id) {
  const key = "sub/" + String(id || "").replace(/[^a-f0-9]/g, "");
  let blob; try { blob = store(); } catch (e) { return { status: 503, json: { ok: false, error: "unavailable" } }; }
  try { await blob.delete(key); } catch (e) { /* ignore */ }
  return { status: 200, json: { ok: true } };
}

function emailHtml(sub, opps) {
  const label = sub.query ? `"${esc(sub.query)}"` : esc(sub.vertical);
  const rows = opps.slice(0, 25).map((o) => `
    <tr><td style="padding:10px 0;border-top:1px solid #e2e8f0">
      <a href="${esc(o.link)}" style="color:#0e7490;font-weight:600;text-decoration:none">${esc(o.title)}</a><br>
      <span style="color:#64748b;font-size:13px">${esc(o.agency || "")}${o.naics ? " · NAICS " + esc(o.naics) : ""}${o.setAside ? " · " + esc(o.setAside) : ""}${o.deadline ? " · due " + esc(String(o.deadline).slice(0, 10)) : ""}</span>
    </td></tr>`).join("");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <h2 style="color:#0b2a45">New government opportunities — ${label}</h2>
    <p style="color:#475569">${opps.length} new matching opportunit${opps.length === 1 ? "y" : "ies"} on SAM.gov since your last alert.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">You're receiving this because you subscribed to DHI bid alerts for ${label}.</p>
  </div>`;
}

// Called by the scheduled function. Iterates subscriptions, finds opportunities
// not previously seen, emails them, and records what was sent.
async function runAlerts() {
  if (!mailer.configured()) return { ok: false, skipped: true, reason: "GMAIL not configured", checked: 0 };
  let blob; try { blob = store(); } catch (e) { return { ok: false, error: "blobs unavailable", checked: 0 }; }
  let checked = 0, emailed = 0, errors = 0;
  let blobs = [];
  try { ({ blobs } = await blob.list({ prefix: "sub/" })); } catch (e) { return { ok: false, error: "list failed", checked: 0 }; }
  for (const b of blobs || []) {
    const sub = await blob.getJSON(b.key).catch(() => null);
    if (!sub || sub.active === false) continue;
    checked++;
    try {
      const res = await searchBids({ query: sub.query, vertical: sub.vertical });
      const opps = (res.json && res.json.opportunities) || [];
      const seen = new Set(sub.seen || []);
      const fresh = opps.filter((o) => o.id && !seen.has(o.id));
      // first run only seeds the baseline (avoid emailing the entire backlog)
      if (sub.lastRunAt && fresh.length) {
        const mail = await mailer.sendMail({ to: sub.email, subject: `${fresh.length} new gov opportunit${fresh.length === 1 ? "y" : "ies"} — ${sub.query || sub.vertical}`, html: emailHtml(sub, fresh) });
        if (mail.ok) emailed++; else errors++;
      }
      const merged = [...(sub.seen || []), ...opps.map((o) => o.id).filter(Boolean)];
      sub.seen = Array.from(new Set(merged)).slice(-SEEN_CAP);
      sub.lastRunAt = new Date().toISOString();
      await blob.setJSON(b.key, sub);
    } catch (e) { errors++; }
  }
  return { ok: true, checked, emailed, errors };
}

module.exports = { subscribe, listSubs, removeSub, runAlerts };
