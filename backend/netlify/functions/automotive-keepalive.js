/* Netlify scheduled function — keeps the AutoCommand backend (Render free tier
   spins down after ~15 min idle) warm, so the first real buyer search has no
   cold-start lag. Pings the backend root on a schedule (set in netlify.toml).
   No-op if AUTOCOMMAND_API_URL isn't configured. Always returns 200 so the
   scheduled run isn't flagged as failed. */
exports.handler = async () => {
  const url = (process.env.AUTOCOMMAND_API_URL || "").replace(/\/+$/, "");
  if (!url) return { statusCode: 200, body: "no AUTOCOMMAND_API_URL configured" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url + "/", { signal: ctrl.signal, headers: { "User-Agent": "DHI-AutoCommand-keepalive" } });
    return { statusCode: 200, body: JSON.stringify({ ok: true, pinged: url, status: r.status }) };
  } catch (e) {
    // A wake-from-sleep request can abort/slow on the first hit — that's fine,
    // it still nudges Render to spin the instance back up.
    return { statusCode: 200, body: JSON.stringify({ ok: true, pinged: url, note: "wake ping sent", error: e.message }) };
  } finally { clearTimeout(timer); }
};
