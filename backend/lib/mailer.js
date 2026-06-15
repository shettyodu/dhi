/* Email sender — Gmail SMTP via nodemailer. Dormant (no-op) until GMAIL_USER +
   GMAIL_APP_PASSWORD are set, so it ships safely and "flips on" when configured.
   Use a Gmail App Password (not the account password):
   https://support.google.com/accounts/answer/185833 */
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) { /* dep not installed yet */ }

const USER = process.env.GMAIL_USER || "";
const PASS = process.env.GMAIL_APP_PASSWORD || "";
const FROM = process.env.GMAIL_FROM || (USER ? `DHI Government Bids <${USER}>` : "");

function configured() { return !!nodemailer && !!USER && !!PASS; }

let _t = null;
function transport() {
  if (!_t) _t = nodemailer.createTransport({ service: "gmail", auth: { user: USER, pass: PASS } });
  return _t;
}

async function sendMail({ to, subject, html, text }) {
  if (!configured()) return { ok: false, skipped: true, reason: "GMAIL not configured" };
  try {
    const info = await transport().sendMail({ from: FROM, to, subject, html, text: text || undefined });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { configured, sendMail };
