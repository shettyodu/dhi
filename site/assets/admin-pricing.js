/* DHI vs. Market — internal pricing view. Calls /market-report with the admin
   key and renders where DHI is priced above the market so Karthik can act. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function load() {
    const secret = $("secret").value.trim();
    if (!secret) { $("status").textContent = "Enter the admin key."; return; }
    localStorage.setItem("dhi_admin_key", secret);
    $("status").className = "mt-3 text-sm text-slate-500"; $("status").textContent = "Loading…";
    try {
      const r = await fetch(FN("market-report"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: "{}" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { $("status").className = "mt-3 text-sm text-red-600"; $("status").textContent = d.error || `Failed (HTTP ${r.status}).`; return; }
      $("status").textContent = "";
      render(d);
    } catch (e) { $("status").className = "mt-3 text-sm text-red-600"; $("status").textContent = "Network error."; }
  }

  function stat(label, val, cls) {
    return `<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">${label}</p><p class="mt-1 font-display text-2xl font-extrabold ${cls || "text-brand-900"}">${val}</p></div>`;
  }

  function render(d) {
    $("summary").innerHTML =
      stat("Observations", d.observations.toLocaleString()) +
      stat("Tracked SKUs", d.tracked_skus.toLocaleString()) +
      stat("DHI above market", d.dhi_high_count.toLocaleString(), d.dhi_high_count ? "text-rose-600" : "text-emerald-600") +
      stat("Generated", new Date(d.generated).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
    $("summary").className = "mt-4 grid gap-4 sm:grid-cols-4";

    const rows = d.items.map((i) => `
      <tr class="border-b border-slate-100 ${i.dhi_high ? "bg-rose-50" : ""}">
        <td class="py-2.5 pl-4 pr-3 text-sm text-slate-700">${esc(i.name)}${i.dhi_high ? ' <span class="ml-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle">DHI HIGH</span>' : ""}<div class="text-xs text-slate-400">${esc(i.vendors.join(" · ") || "—")}</div></td>
        <td class="px-2 py-2.5 text-right text-sm font-semibold ${i.dhi_high ? "text-rose-600" : "text-slate-700"}">${usd(i.dhi_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm text-slate-500">${usd(i.market_min)}</td>
        <td class="px-2 py-2.5 text-right text-sm text-slate-500">${usd(i.market_median)}</td>
        <td class="px-2 py-2.5 text-right text-sm text-slate-500">${usd(i.market_avg)}</td>
        <td class="px-2 py-2.5 text-center text-sm text-slate-500">${i.obs}</td>
        <td class="px-2 py-2.5 pr-4 text-right text-sm font-bold ${i.delta_vs_median > 0 ? "text-rose-600" : "text-emerald-600"}">${i.delta_vs_median == null ? "—" : (i.delta_vs_median > 0 ? "+" : "") + i.delta_vs_median + "%"}</td>
      </tr>`).join("");

    const itemsHtml = d.items.length ? `
      <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full border-collapse">
          <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="py-3 pl-4 pr-3 text-left font-semibold">DHI item · vendors seen</th>
            <th class="px-2 py-3 text-right font-semibold">DHI</th>
            <th class="px-2 py-3 text-right font-semibold">Mkt min</th>
            <th class="px-2 py-3 text-right font-semibold">Mkt median</th>
            <th class="px-2 py-3 text-right font-semibold">Mkt avg</th>
            <th class="px-2 py-3 text-center font-semibold">Obs</th>
            <th class="px-2 py-3 pr-4 text-right font-semibold">Δ vs mkt</th>
          </tr></thead><tbody>${rows}</tbody>
        </table>
      </div>` : `<p class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No priced observations captured yet — the index fills as clinics run Supply Spend Check with their current prices.</p>`;

    const unm = d.unmatched.length ? `<h2 class="mb-2 font-display text-lg font-bold text-brand-900">Demand we don't carry yet <span class="text-sm font-normal text-slate-400">(products entered that didn't match)</span></h2>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">${d.unmatched.map((u) => `${esc(u.product)} <span class="text-slate-400">×${u.n}</span>`).join(" &nbsp;·&nbsp; ")}</div>` : "";
    const vend = d.vendors.length ? `<h2 class="mb-2 font-display text-lg font-bold text-brand-900">Vendors seen</h2>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">${d.vendors.map((v) => `${esc(v.vendor)} <span class="text-slate-400">×${v.n}</span>`).join(" &nbsp;·&nbsp; ")}</div>` : "";

    $("report").innerHTML = `<div><h2 class="mb-2 font-display text-lg font-bold text-brand-900">Pricing vs. market <span class="text-sm font-normal text-slate-400">(rows flagged DHI HIGH → renegotiate)</span></h2>${itemsHtml}</div>${unm ? `<div>${unm}</div>` : ""}${vend ? `<div>${vend}</div>` : ""}`;
  }

  async function clearDemo() {
    const secret = $("secret").value.trim();
    if (!secret) { $("status").textContent = "Enter the admin key first."; return; }
    if (!confirm("Delete all demo/seed pricing (vendors labeled \"Demo —\")? Real captured data is not touched.")) return;
    $("status").className = "mt-3 text-sm text-slate-500"; $("status").textContent = "Clearing demo data…";
    try {
      const r = await fetch(FN("market-report"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify({ action: "clear-demo" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { $("status").className = "mt-3 text-sm text-red-600"; $("status").textContent = d.error || `Failed (HTTP ${r.status}).`; return; }
      $("status").className = "mt-3 text-sm text-emerald-700"; $("status").textContent = `Removed ${d.removed} demo batch(es); kept ${d.kept} real.`;
      load();
    } catch (e) { $("status").className = "mt-3 text-sm text-red-600"; $("status").textContent = "Network error."; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("dhi_admin_key"); if (saved) $("secret").value = saved;
    $("load").addEventListener("click", load);
    $("clear").addEventListener("click", clearDemo);
    $("secret").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  });
})();
