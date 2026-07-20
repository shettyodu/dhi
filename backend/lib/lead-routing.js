/* Lead routing, notification & ownership.
   Every inquiry already lands in Netlify Blobs + HubSpot. This adds: (1) an
   owner per vertical, (2) an instant email to that owner + a shared catch-all
   alias when a lead comes in, and (3) an auto-assignment stamped on the lead for
   accountability. Email goes out via the Gmail sender — DORMANT until GMAIL is
   configured, so this ships safely.

   Confirm the owner email addresses below (assumed firstname@…). Override the
   shared alias / default / admin link via env if desired. */

const mailer = require("./mailer");
const sms = require("./sms");

const SHARED = process.env.LEADS_SHARED_EMAIL || "leads@digitalhealthinternational.com";
const DEFAULT_OWNER = { name: "Steve", email: process.env.LEADS_DEFAULT_EMAIL || "steve@digitalhealthinternational.com", sms: process.env.LEAD_SMS_DEFAULT || "" };
const ADMIN_URL = process.env.LEADS_ADMIN_URL || ""; // optional link to the admin leads page

// vertical/type keyword → owner. Matched against the lead's vertical + source + type.
// `sms` = a mobile number (env) that gets an instant text when a lead comes in;
// blank = email only. Set LEAD_SMS_SMARTCARE to Todd's mobile to text group leads.
const ROUTES = [
  // SmartCare / group medical (ITH — InsurTechHub) leads go to Todd Hall.
  { re: /smartcare|insurtechhub|myinsurtechhub|\bith\b/i, name: "Todd Hall", email: process.env.LEAD_OWNER_SMARTCARE || "Todd@myinsurtechhub.com", sms: process.env.LEAD_SMS_SMARTCARE || "" },
  { re: /auto|vehicle|fleet/i, name: "Bill", email: process.env.LEAD_OWNER_AUTO || "bill@digitalhealthinternational.com", sms: process.env.LEAD_SMS_AUTO || "" },
  { re: /light|energy|keystone/i, name: "Steve", email: process.env.LEAD_OWNER_LIGHTING || "steve@digitalhealthinternational.com", sms: process.env.LEAD_SMS_LIGHTING || "" },
  { re: /suppl|textile|linen|ppe|glove|gown|drape|mask|coverall|sourcing/i, name: "Karthik", email: process.env.LEAD_OWNER_SUPPLIES || "karthik@digitalhealthinternational.com", sms: process.env.LEAD_SMS_SUPPLIES || "" },
];

function ownerFor(lead) {
  const hay = ((lead && lead.vertical) || "") + " " + ((lead && lead.source) || "") + " " + ((lead && lead.type) || "");
  for (const r of ROUTES) { if (r.re.test(hay)) return { name: r.name, email: r.email, sms: r.sms || "" }; }
  return DEFAULT_OWNER;
}

// Short SMS summary for the owner's phone.
function leadSmsText(lead, owner) {
  const d = lead.details || {};
  const bits = [d.company, d.employees ? d.employees + " EE" : "", d.location || d.state].filter(Boolean).join(" · ");
  return `New ${lead.type} lead → ${owner.name}: ${lead.name}${bits ? " (" + bits + ")" : ""}. ${lead.phone ? lead.phone + " " : ""}${lead.email}. Ref ${lead.id}`.trim();
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function leadEmailHtml(lead, owner) {
  const d = lead.details || {};
  const rows = Object.keys(d).filter((k) => d[k]).slice(0, 24)
    .map((k) => `<tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px;vertical-align:top">${esc(k)}</td><td style="padding:3px 0;color:#0f172a;font-size:13px">${esc(d[k])}</td></tr>`).join("");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <p style="color:#0e7490;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:12px;margin:0">New ${esc(lead.type)} lead</p>
    <h2 style="margin:4px 0 2px;color:#0b2a45">${esc(lead.name)}${lead.details && lead.details.company ? " — " + esc(lead.details.company) : ""}</h2>
    <p style="color:#475569;margin:0 0 14px">${esc(lead.vertical || "")} · assigned to <b>${esc(owner.name)}</b></p>
    <table style="border-collapse:collapse">
      <tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px">Email</td><td style="padding:3px 0;font-size:13px"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td></tr>
      ${lead.phone ? `<tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px">Phone</td><td style="padding:3px 0;font-size:13px">${esc(lead.phone)}</td></tr>` : ""}
      ${rows}
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">Ref ${esc(lead.id)} · ${esc(lead.submittedAt || "")}${ADMIN_URL ? ` · <a href="${esc(ADMIN_URL)}">open in admin</a>` : ""}</p>
    <p style="color:#94a3b8;font-size:12px">${esc(owner.name)} owns the first response. CC: ${esc(SHARED)}.</p>
  </div>`;
}

// Best-effort: never throws to the caller (lead capture must not fail on notify).
// Emails the owner (Gmail, dormant until configured) AND texts the owner's mobile
// (Twilio, dormant until configured) — each fires independently.
async function notify(lead) {
  const owner = ownerFor(lead);
  const out = { owner, email: "off", sms: "off" };
  if (mailer.configured()) {
    try {
      const to = [owner.email, SHARED].filter(Boolean).join(",");
      const res = await mailer.sendMail({ to, subject: `New ${lead.type} lead — ${lead.vertical || "DHI"} → ${owner.name}`, html: leadEmailHtml(lead, owner) });
      out.email = res.ok ? "sent" : "failed";
    } catch (e) { out.email = "failed"; }
  }
  if (sms.configured() && owner.sms) {
    try { const r = await sms.send({ to: owner.sms, body: leadSmsText(lead, owner) }); out.sms = r.ok ? "sent" : "failed"; }
    catch (e) { out.sms = "failed"; }
  }
  out.ok = out.email === "sent" || out.sms === "sent";
  return out;
}

module.exports = { ownerFor, notify, SHARED, DEFAULT_OWNER };
