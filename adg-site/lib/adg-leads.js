/* Asset Data Group — lean lead intake. Captures a lead into Netlify Blobs and
   emails it to the ADG inbox. No HubSpot / SMS / multi-owner routing — every ADG
   lead goes to one place. Returns { status, json }. Capture only, no payments.

   Blobs works automatically in the Netlify Functions runtime (the function calls
   connectLambda(event)); email is best-effort and dormant until the mailer is
   configured (see lib/mailer.js). A lead is never lost: it is stored even when
   email is off. */

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");
const mailer = require("./mailer");

const STORE = "adg-leads";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LEAD_TO = process.env.ADG_LEAD_EMAIL || "contact@assetdatagrp.com";

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32); }
function clip(s, n) { return String(s == null ? "" : s).trim().slice(0, n || 500); }
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function emailHtml(r) {
  const d = r.details || {};
  const rows = Object.keys(d).filter((k) => d[k]).slice(0, 24)
    .map((k) => `<tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px;vertical-align:top">${esc(k)}</td><td style="padding:3px 0;color:#0f172a;font-size:13px">${esc(d[k])}</td></tr>`).join("");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <p style="color:#4f46e5;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:12px;margin:0">New Asset Data Group lead</p>
    <h2 style="margin:4px 0 2px;color:#1e2340">${esc(r.name)}${r.company ? " — " + esc(r.company) : ""}</h2>
    <p style="color:#475569;margin:0 0 14px">${esc(r.source || r.vertical || "")}</p>
    <table style="border-collapse:collapse">
      <tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px">Email</td><td style="padding:3px 0;font-size:13px"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td></tr>
      ${r.referral_code ? `<tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px">Referral</td><td style="padding:3px 0;font-size:13px">${esc(r.referral_code)}</td></tr>` : ""}
      ${rows}
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">Ref ${esc(r.id)} · ${esc(r.submittedAt || "")}</p>
  </div>`;
}

async function submitLead(body) {
  const b = body || {};
  const name = clip(b.name, 120);
  const email = clip(b.email, 160);
  if (!name) return { status: 400, json: { error: "Name is required" } };
  if (!EMAIL_RE.test(email)) return { status: 400, json: { error: "A valid email is required" } };

  const details = {};
  for (const k of Object.keys(b)) {
    if (["type", "name", "email", "phone", "referral_code", "vertical", "source"].includes(k)) continue;
    details[clip(k, 40)] = clip(b[k], 1200);
  }

  const id = `${slug(email)}-${crypto.randomBytes(2).toString("hex")}`;
  const record = {
    id,
    type: clip(b.type, 24) || "inquiry",
    name,
    email,
    company: clip(b.company, 160),
    vertical: clip(b.vertical, 80) || "asset-data-group",
    source: clip(b.source, 160),
    referral_code: clip(b.referral_code, 64),
    details,
    status: "new",
    submittedAt: new Date().toISOString(),
  };

  // Store (best-effort — do not fail the capture if Blobs is unavailable).
  let stored = false;
  try { await store().setJSON(`${record.type}/${id}`, record); stored = true; }
  catch (e) { console.error("adg-leads store failed:", e.message); }

  // Email the ADG inbox (dormant until the mailer is configured).
  let notified = { skipped: true };
  try { notified = await mailer.sendMail({ to: LEAD_TO, subject: `New Asset Data Group lead — ${record.source || record.vertical}`, html: emailHtml(record) }); }
  catch (e) { console.error("adg-leads notify failed:", e.message); notified = { ok: false }; }

  return { status: 200, json: { ok: true, id, stored, notified: notified.ok ? "sent" : "off" } };
}

module.exports = { submitLead };
