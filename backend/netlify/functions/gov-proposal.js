/* Netlify Function: POST /.netlify/functions/gov-proposal
   Generate an evaluation-ready proposal package for a matched bid, GROUNDED in
   DHI capabilities + partner catalog. The front-end orchestrates a few calls so
   each stays within the function timeout while the total volume meets the page
   limit:
     { action: "scope",   opportunity }                       → { scopeText }
     { action: "section", opportunity, section, scopeText, pageLimit } → one volume section
     { action: "static",  opportunity }                       → { price, forms }
   Auth: header x-dhi-admin: <ADMIN_SECRET> (fail-closed). */
const { fetchScope, generateSection, staticVolumes, generateComplianceMatrix } = require("../../lib/proposal");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const o = body.opportunity || {};
  const json = (status, obj) => ({ statusCode: status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(obj) });

  try {
    if (body.action === "scope") {
      const scopeText = await fetchScope(o.descriptionLink);
      return json(200, { ok: true, scopeText, scopeUsed: !!scopeText });
    }
    if (body.action === "static") {
      const r = staticVolumes(o);
      return json(r.status, r.json);
    }
    if (body.action === "section") {
      const r = await generateSection(o, body.section, body.scopeText || "", body.pageLimit);
      return json(r.status, r.json);
    }
    if (body.action === "matrix") {
      const r = await generateComplianceMatrix(o, body.scopeText || "");
      return json(r.status, r.json);
    }
    return json(400, { error: "Unknown action (use scope | section | static | matrix)" });
  } catch (e) {
    console.error("gov-proposal error:", e.message);
    return json(500, { error: "Proposal generation failed" });
  }
};
