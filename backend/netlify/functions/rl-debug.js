/* TEMP diagnostic — verify Blobs read/write for the rate-limit store. Remove after. */
const { getStore, connectLambda } = require("@netlify/blobs");
exports.handler = async (event) => {
  try { connectLambda(event); } catch (e) { /* */ }
  const out = { step: [] };
  try {
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
    out.hasEnvCreds = !!(siteID && token);
    const s = siteID && token ? getStore({ name: "rate-limit", siteID, token }) : getStore("rate-limit");
    const k = "rl/diag/test";
    let before = "n/a";
    try { before = await s.get(k, { type: "json", consistency: "strong" }); out.step.push("get1 ok"); }
    catch (e) { out.getErr = String(e && e.message); out.step.push("get1 threw"); }
    const n = (before && before.n) || 0;
    try { await s.setJSON(k, { n: n + 1 }); out.step.push("set ok"); }
    catch (e) { out.setErr = String(e && e.message); out.step.push("set threw"); }
    let after = "n/a";
    try { after = await s.get(k, { type: "json", consistency: "strong" }); out.step.push("get2 ok"); }
    catch (e) { out.get2Err = String(e && e.message); out.step.push("get2 threw"); }
    out.before = before; out.after = after;
  } catch (e) { out.fatal = String(e && e.message); }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(out) };
};
