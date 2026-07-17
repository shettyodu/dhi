/* Netlify Function: POST /.netlify/functions/po-export
   DHI → Wesco Purchase-Order export. Turns a storefront cart into a
   server-authoritative PO in canonical JSON + cXML + EDI 850.

   Body: {
     items: [{ id, qty }],                       // required
     poNumber?, poDate?(ISO), terms?, currency?,
     buyer?, shipTo?, billTo?, routing?, note?,
     format?: "json" | "cxml" | "edi850" | "all" // default "all"
   }
   Response: { ok, po, cxml?, edi850?, validation, unknownSkus }
   See backend/docs/wesco-po-export-schema.md. */
const { buildPO, toCXML, toEDI850, validate, SCHEMA_VERSION } = require("../../lib/po-export");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: "Invalid JSON body" }) }; }

  const format = String(body.format || "all").toLowerCase();
  try {
    const po = buildPO(body);
    const v = validate(po);
    const unknownSkus = po._unknownSkus || [];
    delete po._unknownSkus; // keep the schema clean in the response payload
    const out = { ok: v.ok, schemaVersion: SCHEMA_VERSION, validation: v, unknownSkus };
    if (format === "json" || format === "all") out.po = po;
    if (format === "cxml" || format === "all") out.cxml = toCXML(po);
    if (format === "edi850" || format === "all") out.edi850 = toEDI850(po, { senderId: "DHI", receiverId: "WESCO", control: body.control });
    if (format === "cxml") out.po = undefined;
    return { statusCode: v.ok ? 200 : 422, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(out) };
  } catch (e) {
    console.error("po-export error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: "PO export failed" }) };
  }
};
