/* Lead routing, notification & ownership.
   Every inquiry already lands in Netlify Blobs + HubSpot. This adds: (1) an
   owner per vertical, (2) an instant email to that owner + a shared catch-all
   alias when a lead comes in, and (3) an auto-assignment stamped on the lead for
   accountability. Email goes out via the Gmail sender — DORMANT until GMAIL is
   configured, so this ships safely.

   Confirm the owner email addresses below (assumed firstname@…). Override the
   shared alias / default / admin link via env if desired. */

const mailer = require("./mailer");

const SHARED = process.env.LEADS_SHARED_EMAIL || "leads@digitalhealthinternational.com";
const DEFAULT_OWNER = { name: "Steve", email: process.env.LEADS_DEFAULT_EMAIL || "steve@digitalhealthinternational.com" };
const ADMIN_URL = process.env.LEADS_ADMIN_URL || ""; // optional link to the admin leads page

// vertical/type keyword → owner. Matched against the lead's vertical + source + type.
const ROUTES = [
  { re: /auto|vehicle|fleet/i, name: "Bill", email: process.env.LEAD_OWNER_AUTO || "bill@digitalhealthinternational.com" },
  { re: /light|energy|keystone/i, name: "Steve", email: process.env.LEAD_OWNER_LIGHTING || "steve@digitalhealthinternational.com" },
  { re: /suppl|textile|linen|ppe|glove|gown|drape|mask|coverall|sourcing/i, name: "Karthik", email: process.env.LEAD_OWNER_SUPPLIES || "karthik@digitalhealthinternational.com" },
];

function ownerFor(lead) {
  const hay = ((lead && lead.vertical) || "") + " " + ((lead && lead.source) || "") + " " + ((lead && lead.type) || "");
  for (const r of ROUTES) { if (r.re.test(hay)) return { name: r.name, email: r.email }; }
  return DEFAULT_OWNER;
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

// Best-effort: never throws to the caller (lead capture must not fail on email).
async function notify(lead) {
  const owner = ownerFor(lead);
  if (!mailer.configured()) return { ok: false, skipped: true, owner };
  try {
    const to = [owner.email, SHARED].filter(Boolean).join(",");
    const subject = `New ${lead.type} lead — ${lead.vertical || "DHI"} → ${owner.name}`;
    const res = await mailer.sendMail({ to, subject, html: leadEmailHtml(lead, owner) });
    return { ok: !!res.ok, owner };
  } catch (e) { return { ok: false, error: e.message, owner }; }
}

module.exports = { ownerFor, notify, SHARED, DEFAULT_OWNER };
