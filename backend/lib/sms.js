/* SMS sender via Twilio REST (no SDK dependency — raw HTTPS).
   DORMANT until TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM are set, so
   it ships safely and "flips on" the moment the credentials are configured.
   Best-effort: never throws to the caller (lead capture must not fail on SMS). */

const SID = process.env.TWILIO_ACCOUNT_SID || "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const FROM = process.env.TWILIO_FROM || ""; // e.g. +19195551234 (your Twilio number)

function configured() { return !!(SID && TOKEN && FROM); }

// Normalize a US-ish number to E.164 (+1XXXXXXXXXX). Passes through anything
// already starting with '+'. Returns "" if it can't make a plausible number.
function normalize(num) {
  const s = String(num || "").trim();
  if (!s) return "";
  if (s[0] === "+") return s.replace(/[^\d+]/g, "");
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}

async function send({ to, body } = {}) {
  if (!configured()) return { ok: false, skipped: true, reason: "sms not configured" };
  const dest = normalize(to);
  if (!dest) return { ok: false, skipped: true, reason: "no valid recipient" };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(SID)}/Messages.json`;
  const params = new URLSearchParams({ To: dest, From: FROM, Body: String(body == null ? "" : body).slice(0, 600) });
  const auth = Buffer.from(`${SID}:${TOKEN}`).toString("base64");
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!r.ok) { const t = await r.text().catch(() => ""); console.error("sms send:", r.status, t.slice(0, 160)); }
    return { ok: r.ok, status: r.status };
  } catch (e) { console.error("sms error:", e.message); return { ok: false, error: e.message }; }
}

module.exports = { configured, send, normalize };
