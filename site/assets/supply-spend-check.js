/* Supply Spend Check — parse pasted supply lines, benchmark against DHI's catalog
   via /supply-spend-check, render savings, and capture a lead via submit-lead.
   Buy-side, lead-gen wedge for the Supplies vertical. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usd0 = (n) => "$" + Math.round(Number(n || 0)).toLocaleString("en-US");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let toastT;
  function toast(m) { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600); }

  const SAMPLE = [
    "Isolation gown AAMI level 2, 3.60, 1200",
    "Surgical isolation gown level 3, 6.75, 800",
    "Coverall type 5/6 protective, 6.20, 500",
    "Reinforced coverall type 3/4, 11.50, 200",
    "Disposable scrub set, 16.00, 300",
    "Nitrile exam gloves, 0.14, 5000",
  ].join("\n");

  // "desc, price, qty" (comma or tab). desc = all but last two numeric fields.
  function parseLines(text) {
    const out = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const qty = parts.length >= 3 ? parts[parts.length - 1] : "1";
      const price = parts[parts.length - 2 >= 0 ? parts.length - (parts.length >= 3 ? 2 : 1) : 0];
      const desc = parts.slice(0, parts.length - (parts.length >= 3 ? 2 : 1)).join(" ").replace(/^"|"$/g, "");
      const priceNum = Number(String(price).replace(/[^0-9.]/g, ""));
      if (!desc || isNaN(priceNum)) continue; // skip headers / bad rows
      out.push({ desc, unit_price: priceNum, qty: Number(String(qty).replace(/[^0-9.]/g, "")) || 1 });
    }
    return out;
  }

  let lastSummary = null;

  async function run() {
    const status = $("ssc-status");
    const lines = parseLines($("ssc-input").value);
    if (!lines.length) { status.className = "text-sm text-red-600"; status.textContent = "Add at least one line: item, price, qty."; return; }
    status.className = "text-sm text-slate-500"; status.textContent = "Analyzing…";
    $("ssc-run").disabled = true;
    try {
      const r = await fetch(FN("supply-spend-check"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { status.className = "text-sm text-red-600"; status.textContent = d.error || "Couldn't analyze — try again."; return; }
      status.textContent = "";
      lastSummary = d.summary;
      render(d);
    } catch (e) {
      status.className = "text-sm text-red-600"; status.textContent = "Network error — try again.";
    } finally { $("ssc-run").disabled = false; }
  }

  function render(d) {
    const s = d.summary;
    const matched = d.rows.filter((r) => r.matched);
    const rowsHtml = matched.map((r) => `
      <tr class="border-b border-slate-100">
        <td class="py-2.5 pr-3 text-sm text-slate-700">${esc(r.desc)}<div class="text-xs text-slate-400">≈ ${esc(r.benchmark_name)}</div></td>
        <td class="px-2 py-2.5 text-right text-sm">${usd(r.unit_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm text-slate-500">${usd(r.benchmark_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm font-semibold ${r.over_pct > 0 ? "text-rose-600" : "text-slate-400"}">${r.over_pct > 0 ? "+" + r.over_pct + "%" : "—"}</td>
        <td class="px-2 py-2.5 text-right text-sm font-bold ${r.line_savings > 0 ? "text-emerald-600" : "text-slate-400"}">${r.line_savings > 0 ? usd(r.line_savings) : "—"}</td>
      </tr>`).join("");

    $("ssc-results").innerHTML = `
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Spend analyzed</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-brand-900">${usd0(s.total_spend)}</p>
          <p class="text-xs text-slate-400">${s.matched} of ${s.lines} lines benchmarked</p>
        </div>
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Potential savings</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-emerald-700">${usd0(s.total_savings)}</p>
          <p class="text-xs text-emerald-700/70">if sourced through DHI</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Overspend rate</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-brand-900">${s.savings_pct}%</p>
          <p class="text-xs text-slate-400">of benchmarked spend</p>
        </div>
      </div>
      ${matched.length ? `
      <div class="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full border-collapse">
          <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="py-3 pl-4 pr-3 text-left font-semibold">Item</th>
            <th class="px-2 py-3 text-right font-semibold">You pay</th>
            <th class="px-2 py-3 text-right font-semibold">DHI</th>
            <th class="px-2 py-3 text-right font-semibold">Over</th>
            <th class="px-2 py-3 pr-4 text-right font-semibold">Est. savings</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>` : `<p class="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">None of those lines matched our current catalog categories (PPE, gowns, coveralls, drapes, scrubs, linens). We're adding categories continuously — send them over and we'll benchmark them.</p>`}
      ${s.unmatched ? `<p class="mt-3 text-xs text-slate-400">${s.unmatched} line${s.unmatched > 1 ? "s" : ""} not benchmarked (outside our current catalog or unclear units) — we add these as our data grows.</p>` : ""}`;

    $("ssc-results").classList.remove("hidden");
    $("ssc-lead").classList.remove("hidden");
    $("ssc-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function sendLead(e) {
    e.preventDefault();
    const st = $("ssc-lead-status");
    const name = $("ssc-name").value.trim(), email = $("ssc-email").value.trim(), org = $("ssc-org").value.trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { st.className = "text-sm text-red-600"; st.textContent = "Name and a valid email, please."; return; }
    st.className = "text-sm text-slate-500"; st.textContent = "Sending…"; $("ssc-send").disabled = true;
    const payload = {
      type: "sourcing", vertical: "supplies", source: "spend-check",
      name, email, company: org,
      analyzed_spend: lastSummary ? lastSummary.total_spend : null,
      potential_savings: lastSummary ? lastSummary.total_savings : null,
      lines_benchmarked: lastSummary ? lastSummary.matched : null,
    };
    try {
      const r = await fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        $("ssc-lead").innerHTML = `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-slate-700"><p class="font-semibold text-emerald-700">Got it — thank you.</p><p class="mt-1">We'll confirm exact equivalents and send firm pricing on the flagged items shortly. Reference: <span class="font-mono text-xs">${esc(d.id)}</span></p></div>`;
        toast("Received — we'll follow up.");
      } else { st.className = "text-sm text-red-600"; st.textContent = d.error || "Couldn't send — try again."; }
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Network error — try again."; }
    finally { $("ssc-send").disabled = false; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("ssc-run").addEventListener("click", run);
    $("ssc-sample").addEventListener("click", () => { $("ssc-input").value = SAMPLE; });
    $("ssc-form").addEventListener("submit", sendLead);
  });
})();
