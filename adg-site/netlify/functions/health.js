/* Netlify Function: GET /.netlify/functions/health
   Lightweight readiness check for external uptime monitoring (e.g. UptimeRobot).
   Reports which dependencies are configured and returns 503 if a critical one is not.
   Add ?deep=1 to also make a minimal OpenAI call that confirms the AI path is actually
   live — this catches a lapsed OpenAI balance, at roughly one token per hit, so point
   it at a modest interval (for example every 15-30 minutes). */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };

  const checks = {
    openai_configured: !!process.env.OPENAI_API_KEY,
    mailer_configured: !!((process.env.SMTP_USER || process.env.GMAIL_USER) && (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD)),
    ratelimit_configured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    crm_passcode_set: !!(process.env.ADG_PASSCODE || process.env.ADG_ADMIN_SECRET),
  };

  let ok = checks.openai_configured;
  const deep = event.queryStringParameters && event.queryStringParameters.deep === "1";
  if (deep && checks.openai_configured) {
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
        signal: ctrl.signal,
      });
      checks.openai_live = res.ok;
      checks.openai_status = res.status;
      ok = res.ok;
    } catch (e) {
      checks.openai_live = false;
      checks.openai_error = e.name === "AbortError" ? "timeout" : e.message;
      ok = false;
    } finally {
      clearTimeout(t);
    }
  }

  const body = { ok, service: "asset-data-group", time: new Date().toISOString(), checks };
  return { statusCode: ok ? 200 : 503, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
};
