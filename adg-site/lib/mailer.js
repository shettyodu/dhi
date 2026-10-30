/* Email sender for Asset Data Group lead notifications. Dormant (no-op) until
   credentials are set, so it ships safely and "flips on" when configured.

   Works two ways:
   - Generic SMTP (recommended for ADG's own mailbox, e.g. StackMail):
       SMTP_HOST=mail.stackmail.com  SMTP_PORT=587  SMTP_USER=contact@assetdatagrp.com  SMTP_PASS=...
   - Gmail App Password (fallback): GMAIL_USER=... GMAIL_APP_PASSWORD=...
   Override the From header with MAIL_FROM. */
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) { /* dep not installed yet */ }

const USER = process.env.SMTP_USER || process.env.GMAIL_USER || "";
const PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";
const HOST = process.env.SMTP_HOST || "";
const PORT = Number(process.env.SMTP_PORT || 587);
const FROM = process.env.MAIL_FROM || (USER ? `Asset Data Group <${USER}>` : "");

function configured() { return !!nodemailer && !!USER && !!PASS; }

let _t = null;
function transport() {
  if (!_t) {
    _t = HOST
      ? nodemailer.createTransport({ host: HOST, port: PORT, secure: PORT === 465, auth: { user: USER, pass: PASS } })
      : nodemailer.createTransport({ service: "gmail", auth: { user: USER, pass: PASS } });
  }
  return _t;
}

async function sendMail({ to, subject, html, text }) {
  if (!configured()) return { ok: false, skipped: true, reason: "mailer not configured" };
  try {
    const info = await transport().sendMail({ from: FROM, to, subject, html, text: text || undefined });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { configured, sendMail };
