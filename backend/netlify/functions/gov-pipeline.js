/* Netlify Function: POST /.netlify/functions/gov-pipeline
   Bid Board for the Government Bid Match-Maker — a shared, persisted pipeline.
   Auth: header x-dhi-admin: <ADMIN_SECRET> (fail-closed, same as gov-bids).
   Actions:
     { action: "list" }                                  → { stages, entries }
     { action: "save", entry: {id, opportunity, stage?} }→ { count }
     { action: "update", id, fields:{stage?,notes?,owner?}} → { entry }
     { action: "remove", id }                            → { count } */
const { listBoard, upsert, patch, remove } = require("../../lib/pipeline");
const { connectLambda } = require("@netlify/blobs");

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-dhi-admin",
};

exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* auto-context fallback */ }
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  if (!process.env.ADMIN_SECRET) return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "Tool not configured (set ADMIN_SECRET)" }) };
  if ((event.headers["x-dhi-admin"] || "") !== process.env.ADMIN_SECRET) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { /* ignore */ }
  const json = (status, obj) => ({ statusCode: status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(obj) });

  try {
    if (body.action === "list") return json(200, await listBoard());
    if (body.action === "save") {
      const e = body.entry || {};
      if (!e.id) return json(400, { ok: false, error: "entry.id required" });
      return json(200, await upsert(e));
    }
    if (body.action === "update") {
      if (!body.id) return json(400, { ok: false, error: "id required" });
      const r = await patch(body.id, body.fields || {});
      return json(r.ok ? 200 : 404, r);
    }
    if (body.action === "remove") {
      if (!body.id) return json(400, { ok: false, error: "id required" });
      return json(200, await remove(body.id));
    }
    return json(400, { ok: false, error: "Unknown action (use list | save | update | remove)" });
  } catch (e) {
    console.error("gov-pipeline error:", e.message);
    return json(503, { ok: false, error: "Bid board temporarily unavailable" });
  }
};
