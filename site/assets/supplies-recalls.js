/* Supplies catalog — FDA recall checker (openFDA via /supplies-recalls).
   A collapsible "Product safety" panel: type a category, see recent FDA recalls.
   Mounts into #recall-check. */
(function () {
  const host = document.getElementById("recall-check");
  if (!host) return;
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/supplies-recalls";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cls = (c) => /class i\b/i.test(c) ? "bg-red-100 text-red-700" : /class ii/i.test(c) ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";

  host.innerHTML = `
    <details class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary class="flex cursor-pointer list-none items-center gap-2 font-semibold text-brand-900">
        <svg class="h-5 w-5 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        Product safety — check FDA recalls
        <span class="ml-2 text-xs font-normal text-slate-400">openFDA · free</span>
      </summary>
      <div class="mt-3">
        <p class="text-sm text-slate-500">Check recent U.S. FDA device recalls for a product category before you buy or stock it.</p>
        <form id="rc-form" class="mt-2 flex gap-2">
          <input id="rc-q" placeholder="e.g. gloves, surgical gown, mask" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
          <button class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Check</button>
        </form>
        <div id="rc-results" class="mt-3"></div>
      </div>
    </details>`;

  const out = document.getElementById("rc-results");
  document.getElementById("rc-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = document.getElementById("rc-q").value.trim();
    if (!q) return;
    out.innerHTML = `<div class="flex items-center gap-2 text-sm text-slate-500"><div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600"></div> Checking FDA recalls…</div>`;
    let d = {};
    try {
      const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, limit: 8 }) });
      d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "unavailable");
    } catch (err) { out.innerHTML = `<p class="text-sm text-slate-500">Couldn't check recalls right now (${esc(err.message)}).</p>`; return; }
    if (!d.count) { out.innerHTML = `<p class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">No FDA recalls found for “${esc(d.query)}”.</p>`; return; }
    out.innerHTML = `<p class="mb-2 text-sm text-slate-600"><b>${d.count}</b> recall record${d.count === 1 ? "" : "s"} for “${esc(d.query)}” (showing ${d.recalls.length}, newest first):</p>` +
      d.recalls.map((x) => `
        <div class="mb-2 rounded-lg border border-slate-200 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded px-2 py-0.5 text-xs font-semibold ${cls(x.classification)}">${esc(x.classification || "Recall")}</span>
            <span class="text-sm font-semibold text-brand-900">${esc(x.firm)}</span>
            <span class="text-xs text-slate-400">${esc(x.date)}${x.status ? " · " + esc(x.status) : ""}</span>
          </div>
          <p class="mt-1 text-xs text-slate-600">${esc(x.reason)}</p>
          ${x.product ? `<p class="mt-1 text-xs text-slate-400">${esc(x.product)}</p>` : ""}
        </div>`).join("") +
      `<p class="mt-1 text-xs text-slate-400">Source: ${esc(d.source)}. Informational — verify against the official FDA recall database.</p>`;
  });
})();
