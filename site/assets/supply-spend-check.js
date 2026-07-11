/* Supply Spend Check — structured entry (Description / Quantity / Current price,
   price optional) or paste; benchmark against DHI's catalog via /supply-spend-check,
   render savings (or a DHI quote when no current price), capture a lead. Buy-side. */
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
    ["Isolation gown AAMI level 2", "1200", "3.60", "Medline"],
    ["Surgical isolation gown level 3", "800", "6.75", "Cardinal Health"],
    ["Coverall type 5/6 protective", "500", "6.20", "Uline"],
    ["Reinforced coverall type 3/4", "200", "11.50", ""],
    ["Disposable scrub set", "300", "16.00", "Medline"],
    ["Surgical drape reinforced", "600", "", ""],
  ];
  const INP = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-600 focus:outline-none';

  function addRow(vals) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="py-1 pr-2"><input class="ssc-d ${INP}" placeholder="e.g. Isolation gown level 2" /></td>
      <td class="py-1 px-2"><input class="ssc-q ${INP}" inputmode="numeric" placeholder="Qty" /></td>
      <td class="py-1 px-2"><input class="ssc-p ${INP}" inputmode="decimal" placeholder="$ (opt.)" /></td>
      <td class="py-1 pl-2"><input class="ssc-v ${INP}" placeholder="Vendor (opt.)" /></td>`;
    $("ssc-rows").appendChild(tr);
    if (vals) { tr.querySelector(".ssc-d").value = vals[0] || ""; tr.querySelector(".ssc-q").value = vals[1] || ""; tr.querySelector(".ssc-p").value = vals[2] || ""; tr.querySelector(".ssc-v").value = vals[3] || ""; }
    return tr;
  }
  function seedRows(n) { $("ssc-rows").innerHTML = ""; for (let i = 0; i < n; i++) addRow(); }

  function readTable() {
    const out = [];
    $("ssc-rows").querySelectorAll("tr").forEach((tr) => {
      const desc = tr.querySelector(".ssc-d").value.trim();
      if (!desc) return;
      const qty = tr.querySelector(".ssc-q").value.trim();
      const price = tr.querySelector(".ssc-p").value.trim();
      const vendor = tr.querySelector(".ssc-v").value.trim();
      out.push({ desc, qty: qty || 1, unit_price: price === "" ? null : price, vendor: vendor || null });
    });
    return out;
  }
  // paste order matches the headings: Description, Quantity, Current price, Current vendor (last two optional)
  function readPaste() {
    const out = [];
    for (const raw of String($("ssc-input").value || "").split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const parts = line.split(/\t|,/).map((p) => p.trim());
      const desc = parts[0]; if (!desc) continue;
      const qty = parts[1] || 1;
      const price = parts.length >= 3 && parts[2] !== "" ? parts[2] : null;
      const vendor = parts.length >= 4 && parts[3] !== "" ? parts[3] : null;
      out.push({ desc, qty, unit_price: price, vendor });
    }
    return out;
  }
  function gatherLines() {
    const pasteOpen = !$("ssc-paste-wrap").classList.contains("hidden");
    if (pasteOpen && $("ssc-input").value.trim()) return readPaste();
    return readTable();
  }

  let lastSummary = null;

  async function run() {
    const status = $("ssc-status");
    const lines = gatherLines();
    if (!lines.length) { status.className = "text-sm text-red-600"; status.textContent = "Add at least one item (a description)."; return; }
    status.className = "text-sm text-slate-500"; status.textContent = "Analyzing…"; $("ssc-run").disabled = true;
    try {
      const consent = !$("ssc-consent") || $("ssc-consent").checked;
      const r = await fetch(FN("supply-spend-check"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, consent }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { status.className = "text-sm text-red-600"; status.textContent = d.error || "Couldn't analyze — try again."; return; }
      status.textContent = ""; lastSummary = d.summary; render(d);
    } catch (e) { status.className = "text-sm text-red-600"; status.textContent = "Network error — try again."; }
    finally { $("ssc-run").disabled = false; }
  }

  const TONE = {
    win: { bd: "border-emerald-200", bg: "bg-emerald-50", dot: "text-emerald-600", ico: "M20 6L9 17l-5-5" },
    risk: { bd: "border-rose-200", bg: "bg-rose-50", dot: "text-rose-600", ico: "M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" },
    action: { bd: "border-cyan-200", bg: "bg-cyan-50", dot: "text-cyan-600", ico: "M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" },
    info: { bd: "border-slate-200", bg: "bg-white", dot: "text-slate-400", ico: "M12 8h.01M11 12h1v4h1" },
  };
  function assessmentHtml(a) {
    if (!a || !a.findings) return "";
    const items = a.findings.map((f) => {
      const t = TONE[f.tone] || TONE.info;
      return `<div class="flex gap-3 rounded-xl border ${t.bd} ${t.bg} p-3">
        <svg class="mt-0.5 h-5 w-5 flex-none ${t.dot}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${t.ico}"/></svg>
        <div><p class="text-sm font-semibold text-brand-900">${esc(f.title)}</p><p class="text-sm text-slate-600">${esc(f.detail)}</p></div>
      </div>`;
    }).join("");
    return `<div class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-center gap-2"><span class="rounded-md bg-brand-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">SupplyScope Advisor</span></div>
      <p class="mt-3 font-display text-lg font-bold text-brand-900">${esc(a.headline)}</p>
      <div class="mt-3 grid gap-2.5 sm:grid-cols-2">${items}</div>
    </div>`;
  }

  function render(d) {
    const s = d.summary;
    const matched = d.rows.filter((r) => r.matched);
    const rowsHtml = matched.map((r) => `
      <tr class="border-b border-slate-100">
        <td class="py-2.5 pr-3 text-sm text-slate-700">${esc(r.desc)}<div class="text-xs text-emerald-600">Available from DHI · ${esc(r.benchmark_name)}</div></td>
        <td class="px-2 py-2.5 text-right text-sm">${r.quote_only ? '<span class="text-slate-300">—</span>' : usd(r.unit_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm font-medium text-slate-600">${usd(r.benchmark_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm font-semibold ${r.over_pct > 0 ? "text-rose-600" : "text-slate-400"}">${r.over_pct > 0 ? "+" + r.over_pct + "%" : "—"}</td>
        <td class="px-2 py-2.5 pr-4 text-right text-sm font-bold ${r.line_savings > 0 ? "text-emerald-600" : "text-slate-400"}">${r.line_savings > 0 ? usd(r.line_savings) : (r.quote_only ? '<span class="text-xs font-normal text-slate-400">add price</span>' : "—")}</td>
      </tr>`).join("");

    $("ssc-results").innerHTML = `
      ${assessmentHtml(d.assessment)}
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Spend analyzed</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-brand-900">${usd0(s.total_spend)}</p>
          <p class="text-xs text-slate-400">${s.matched} of ${s.lines} items matched</p>
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
            <th class="py-3 pl-4 pr-3 text-left font-semibold">Item · where to buy</th>
            <th class="px-2 py-3 text-right font-semibold">You pay</th>
            <th class="px-2 py-3 text-right font-semibold">DHI</th>
            <th class="px-2 py-3 text-right font-semibold">Over</th>
            <th class="px-2 py-3 pr-4 text-right font-semibold">Est. savings</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>` : `<p class="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">None of those items matched our current catalog categories (PPE, gowns, coveralls, drapes, scrubs, linens). We're adding categories continuously — send them over and we'll benchmark them.</p>`}
      ${s.unmatched ? `<p class="mt-3 text-xs text-slate-400">${s.unmatched} item${s.unmatched > 1 ? "s" : ""} not benchmarked (outside our current catalog or unclear units) — added as our data grows.</p>` : ""}`;

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
      items_matched: lastSummary ? lastSummary.matched : null,
    };
    try {
      const r = await fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        $("ssc-lead").innerHTML = `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-slate-700"><p class="font-semibold text-emerald-700">Got it — thank you.</p><p class="mt-1">We'll confirm exact equivalents and send firm DHI pricing on the flagged items shortly. Reference: <span class="font-mono text-xs">${esc(d.id)}</span></p></div>`;
        toast("Received — we'll follow up.");
      } else { st.className = "text-sm text-red-600"; st.textContent = d.error || "Couldn't send — try again."; }
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Network error — try again."; }
    finally { $("ssc-send").disabled = false; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    seedRows(4);
    $("ssc-add").addEventListener("click", () => addRow());
    $("ssc-run").addEventListener("click", run);
    $("ssc-sample").addEventListener("click", () => { $("ssc-input").value = ""; $("ssc-rows").innerHTML = ""; SAMPLE.forEach((v) => addRow(v)); });
    $("ssc-paste-toggle").addEventListener("click", () => $("ssc-paste-wrap").classList.toggle("hidden"));
    $("ssc-form").addEventListener("submit", sendLead);
  });
})();
