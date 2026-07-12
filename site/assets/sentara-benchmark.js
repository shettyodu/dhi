/* Sentara Supply Price Benchmark — private pilot.
   1) Benchmark: ingest a CSV/paste spend export (department-aware) → catalog
      benchmark + internal price-variance ("savings in your own purchasing").
   2) Product Finder: search ANY item across departments → DHI price when we carry
      it + AI identification + one-click links to shop the major sources.
   consent OFF — the pilot's data is analyzed in-session, never added to any
   shared index. Buy-side, indicative. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usd0 = (n) => "$" + Math.round(Number(n || 0)).toLocaleString("en-US");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let toastT; const toast = (m) => { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600); };

  // --- Access gate (lightweight pilot gate, not hardened auth) ---------------
  const ACCESS = "SENTARA-2026";
  function unlock() { $("gate").classList.add("hidden"); $("app").classList.remove("hidden"); }
  function tryUnlock(code) { if (String(code || "").trim().toUpperCase() === ACCESS) { localStorage.setItem("dhi_sentara_ok", "1"); unlock(); return true; } return false; }

  // --- CSV / paste parsing (department-aware) ---------------------------------
  function splitRow(line) {
    if (line.indexOf("\t") >= 0) return line.split("\t");
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur); return out;
  }
  const num = (s) => { const v = String(s == null ? "" : s).replace(/[$,\s]/g, ""); return v !== "" && !isNaN(Number(v)) ? v : ""; };
  const has = (hay, list) => list.some((k) => hay.indexOf(k) >= 0);

  function toLines(text) {
    const rows = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!rows.length) return [];
    let col = { desc: 0, dept: -1, qty: 1, price: 2, vendor: 3 }, start = 0;
    const head = splitRow(rows[0]).map((s) => s.trim().toLowerCase());
    const looksHeader = head.some((h) => has(h, ["desc", "item", "product", "material", "name"]));
    if (looksHeader) {
      const find = (keys) => { for (let i = 0; i < head.length; i++) if (has(head[i], keys)) return i; return -1; };
      col = {
        desc: find(["description", "item", "product", "material", "name"]),
        dept: find(["department", "dept", "cost center", "costcenter", "location", "facility", "site"]),
        qty: find(["qty", "quantity", "units", "count", "eaches"]),
        price: find(["unit price", "unitprice", "price", "unit cost", "cost", "each"]),
        vendor: find(["vendor", "supplier", "manufacturer", "mfr", "distributor"]),
      };
      if (col.desc < 0) col.desc = 0;
      start = 1;
    }
    const out = [];
    for (let i = start; i < rows.length; i++) {
      const f = splitRow(rows[i]);
      const desc = (f[col.desc] || "").trim(); if (!desc) continue;
      const qty = col.qty >= 0 ? num(f[col.qty]) : "";
      const price = col.price >= 0 ? num(f[col.price]) : "";
      const vendor = col.vendor >= 0 ? (f[col.vendor] || "").trim() : "";
      const dept = col.dept >= 0 ? (f[col.dept] || "").trim() : "";
      out.push({ desc, qty: qty || 1, unit_price: price === "" ? null : price, vendor: vendor || null, dept: dept || null });
    }
    return out;
  }

  let pending = "";
  function loadFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { pending = String(rd.result || ""); $("file-name").textContent = `${file.name} — ${toLines(pending).length} line(s) detected`; };
    rd.onerror = () => { $("file-name").textContent = "Couldn't read that file."; };
    rd.readAsText(file);
  }

  const SAMPLE = [
    "description,department,quantity,unit price,vendor",
    "Nitrile exam glove (box),Lab,3000,7.80,Medline",
    "Nitrile exam glove box,Central Sterile,2500,9.20,McKesson",
    "Nitrile exam glove (box),Patient Care,3500,8.50,Cardinal Health",
    "Isolation gown AAMI level 2,Surgery / OR,2600,3.55,Medline",
    "Isolation gown AAMI level 2,Patient Care,2200,4.10,Cardinal Health",
    "Enzymatic instrument cleaner (gallon),Central Sterile,400,18.00,Ruhof",
    "Coverall type 5/6 protective,Engineering / Facilities,1500,6.30,Uline",
    "Disposable scrub set,Surgery / OR,1800,15.40,Medline",
    "Surgical drape reinforced,Surgery / OR,3200,4.20,Cardinal Health",
    "General surgery major OT pack,Surgery / OR,900,,Cardinal Health",
  ].join("\n");

  // --- Internal price variance (their own data — no external pricing) ---------
  const normKey = (s) => String(s || "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(each|ea|box|case|pack|ct|count|pkg|bx|cs|kit|set|gallon|gal|pair)\b/g, " ")
    .replace(/\s+/g, " ").trim();

  function computeVariance(lines) {
    const groups = {};
    (lines || []).forEach((l) => {
      const p = l.unit_price == null ? null : Number(l.unit_price);
      if (p == null || isNaN(p) || p <= 0) return;
      const k = normKey(l.desc); if (!k) return;
      (groups[k] = groups[k] || { label: l.desc, rows: [] }).rows.push({ price: p, qty: Number(l.qty) || 1, dept: l.dept || null });
    });
    const out = [];
    Object.values(groups).forEach((g) => {
      const prices = g.rows.map((r) => r.price);
      const min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
      const distinct = new Set(prices.map((p) => p.toFixed(4))).size;
      if (g.rows.length >= 2 && distinct >= 2) {
        const savings = g.rows.reduce((s, r) => s + r.qty * (r.price - min), 0);
        const depts = Array.from(new Set(g.rows.map((r) => r.dept).filter(Boolean)));
        if (savings > 0) out.push({ label: g.label, min, max, savings, depts, count: g.rows.length });
      }
    });
    return out.sort((a, b) => b.savings - a.savings);
  }

  // --- Run benchmark ----------------------------------------------------------
  let last = null, lastLines = [];
  async function run() {
    const status = $("status");
    const paste = ($("paste").value || "").trim();
    const lines = toLines(paste || pending);
    if (!lines.length) { status.className = "text-sm text-red-600"; status.textContent = "Upload a CSV or paste rows first."; return; }
    lastLines = lines;
    status.className = "text-sm text-slate-500"; status.textContent = `Analyzing ${lines.length} line(s)…`; $("run").disabled = true;
    try {
      const r = await fetch(FN("supply-spend-check"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, consent: false }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { status.className = "text-sm text-red-600"; status.textContent = d.error || "Couldn't analyze — try again."; return; }
      status.textContent = ""; last = d; renderReport(d);
    } catch (e) { status.className = "text-sm text-red-600"; status.textContent = "Network error — try again."; }
    finally { $("run").disabled = false; }
  }

  const TONE = {
    win: { bd: "border-emerald-200", bg: "bg-emerald-50", dot: "text-emerald-600", ico: "M20 6L9 17l-5-5" },
    risk: { bd: "border-rose-200", bg: "bg-rose-50", dot: "text-rose-600", ico: "M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" },
    action: { bd: "border-cyan-200", bg: "bg-cyan-50", dot: "text-cyan-600", ico: "M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" },
    info: { bd: "border-slate-200", bg: "bg-white", dot: "text-slate-400", ico: "M12 8h.01M11 12h1v4h1" },
  };
  function advisorHtml(a) {
    if (!a || !a.findings) return "";
    const items = a.findings.map((f) => {
      const t = TONE[f.tone] || TONE.info;
      return `<div class="flex gap-3 rounded-xl border ${t.bd} ${t.bg} p-3">
        <svg class="mt-0.5 h-5 w-5 flex-none ${t.dot}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${t.ico}"/></svg>
        <div><p class="text-sm font-semibold text-brand-900">${esc(f.title)}</p><p class="text-sm text-slate-600">${esc(f.detail)}</p></div>
      </div>`;
    }).join("");
    return `<div class="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div class="flex items-center gap-2"><span class="rounded-md bg-brand-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">DHI Advisor</span></div>
      <p class="mt-3 font-display text-lg font-bold text-brand-900">${esc(a.headline)}</p>
      ${a.narrative ? `<p class="mt-2 border-l-2 border-cyan-300 pl-3 text-sm italic leading-relaxed text-slate-600">${esc(a.narrative)}</p>` : ""}
      <div class="mt-4 grid gap-2.5 sm:grid-cols-2">${items}</div>
    </div>`;
  }

  function varianceHtml() {
    const v = computeVariance(lastLines);
    if (!v.length) return "";
    const total = v.reduce((s, x) => s + x.savings, 0);
    const rows = v.slice(0, 8).map((x) => `<tr class="border-b border-amber-100">
      <td class="py-2 pr-3 text-sm text-slate-700">${esc(x.label)}</td>
      <td class="px-2 py-2 text-xs text-slate-500">${x.depts.length ? esc(x.depts.join(", ")) : x.count + " lines"}</td>
      <td class="px-2 py-2 text-right text-sm">${usd(x.min)}–${usd(x.max)}</td>
      <td class="px-2 py-2 pr-2 text-right text-sm font-bold text-emerald-700">${usd(x.savings)}</td>
    </tr>`).join("");
    return `<div class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p class="font-display text-lg font-bold text-brand-900">Savings hiding in your own purchasing</p>
      <p class="mt-1 text-sm text-slate-600">The same item is being bought at different prices across departments. Standardizing each to <b>your own lowest price paid</b> would save about <b>${usd0(total)}</b> — before changing a single supplier.</p>
      <div class="mt-3 overflow-x-auto"><table class="w-full border-collapse">
        <thead><tr class="border-b border-amber-200 text-[11px] uppercase tracking-wide text-amber-700">
          <th class="py-2 pr-3 text-left font-semibold">Item</th>
          <th class="px-2 py-2 text-left font-semibold">Departments</th>
          <th class="px-2 py-2 text-right font-semibold">Price range</th>
          <th class="px-2 py-2 pr-2 text-right font-semibold">Standardize saving</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  }

  function renderReport(d) {
    const s = d.summary;
    const matched = d.rows.filter((r) => r.matched);
    const rowsHtml = matched.map((r) => `
      <tr class="border-b border-slate-100">
        <td class="py-2.5 pr-3 text-sm text-slate-700">${esc(r.desc)}<div class="text-xs text-emerald-600">DHI can supply · ${esc(r.benchmark_name)}</div></td>
        <td class="px-2 py-2.5 text-right text-sm">${r.quote_only ? '<span class="text-slate-300">—</span>' : usd(r.unit_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm font-medium text-slate-600">${usd(r.benchmark_price)}</td>
        <td class="px-2 py-2.5 text-right text-sm font-semibold ${r.over_pct > 0 ? "text-rose-600" : "text-slate-400"}">${r.over_pct > 0 ? "+" + r.over_pct + "%" : "—"}</td>
        <td class="px-2 py-2.5 pr-2 text-right text-sm font-bold ${r.line_savings > 0 ? "text-emerald-600" : "text-slate-400"}">${r.line_savings > 0 ? usd(r.line_savings) : (r.quote_only ? '<span class="text-xs font-normal text-slate-400">add price</span>' : "—")}</td>
      </tr>`).join("");

    $("report-body").innerHTML = `
      ${advisorHtml(d.assessment)}
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Spend analyzed</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-brand-900">${usd0(s.total_spend)}</p>
          <p class="text-xs text-slate-400">${s.matched} of ${s.lines} items matched</p>
        </div>
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Potential savings</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-emerald-700">${usd0(s.total_savings)}</p>
          <p class="text-xs text-emerald-700/70">if sourced through DHI</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Overspend rate</p>
          <p class="mt-1 font-display text-2xl font-extrabold text-brand-900">${s.savings_pct}%</p>
          <p class="text-xs text-slate-400">of benchmarked spend</p>
        </div>
      </div>
      ${varianceHtml()}
      ${matched.length ? `
      <div class="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table class="w-full border-collapse">
          <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th class="py-3 pl-4 pr-3 text-left font-semibold">Item · DHI equivalent</th>
            <th class="px-2 py-3 text-right font-semibold">You pay</th>
            <th class="px-2 py-3 text-right font-semibold">DHI</th>
            <th class="px-2 py-3 text-right font-semibold">Over</th>
            <th class="px-2 py-3 pr-2 text-right font-semibold">Est. savings</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>` : `<p class="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">None of these items matched our current catalog categories yet — but the internal-variance analysis above works on any item. Use Product Finder to price the rest.</p>`}
      ${s.unmatched ? `<p class="mt-3 text-xs text-slate-400">${s.unmatched} item${s.unmatched > 1 ? "s" : ""} not benchmarked against our catalog (outside current coverage) — still counted in the variance analysis where priced.</p>` : ""}`;

    try { $("report-date").textContent = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { /* ignore */ }
    $("report").classList.remove("hidden");
    $("report").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // --- Product Finder ---------------------------------------------------------
  function renderFinder(d) {
    const parts = [];
    if (d.dhi) {
      parts.push(`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">DHI can supply this</p>
        <p class="mt-1 font-semibold text-brand-900">${esc(d.dhi.name)}</p>
        <p class="mt-0.5 font-display text-xl font-extrabold text-emerald-700">${usd(d.dhi.price)}<span class="text-xs font-normal text-emerald-700/70"> · DHI price</span></p>
        <button id="pf-add" class="mt-2 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">Request a quote &rarr;</button>
      </div>`);
    }
    if (d.ai) {
      const a = d.ai;
      const range = (a.indicative_low != null && a.indicative_high != null) ? `${usd(a.indicative_low)}–${usd(a.indicative_high)}` : null;
      parts.push(`<div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-center gap-2"><span class="rounded-md bg-brand-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">AI identified</span>${a.category ? `<span class="text-xs text-slate-400">${esc(a.category)}${a.department ? ` · ${esc(a.department)}` : ""}</span>` : ""}</div>
        <p class="mt-2 font-semibold text-brand-900">${esc(a.normalized_name)}</p>
        ${a.note ? `<p class="mt-1 text-sm text-slate-600">${esc(a.note)}</p>` : ""}
        ${a.considerations && a.considerations.length ? `<ul class="mt-2 space-y-1">${a.considerations.map((c) => `<li class="flex gap-2 text-xs text-slate-500"><span class="text-cyan-600">▹</span><span>${esc(c)}</span></li>`).join("")}</ul>` : ""}
        ${range ? `<p class="mt-3 text-sm"><span class="font-semibold text-brand-900">${range}</span> <span class="text-xs text-amber-600">est. ${esc(a.price_basis)} — verify, not contract pricing</span></p>` : ""}
      </div>`);
    }
    const links = (d.sources || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-slate-50">${esc(x.label)} &rarr;</a>`).join("");
    $("pf-results").innerHTML = `
      ${parts.length ? `<div class="grid gap-3 sm:grid-cols-2">${parts.join("")}</div>` : `<p class="text-sm text-slate-500">We couldn't identify that automatically${d.ai_enabled ? "" : " (AI layer is offline)"} — use the source links below to compare.</p>`}
      <div class="mt-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Shop &amp; compare from one place</p><div class="mt-2 flex flex-wrap gap-2">${links}</div></div>`;
    $("pf-results").classList.remove("hidden");
    const add = $("pf-add");
    if (add) add.addEventListener("click", () => { $("book-form").classList.remove("hidden"); $("book-form").scrollIntoView({ behavior: "smooth" }); toast("Add your details and we'll quote it"); });
  }

  async function findProduct() {
    const q = ($("pf-q").value || "").trim(); const dept = $("pf-dept").value;
    const st = $("pf-status");
    if (q.length < 2) { st.className = "text-sm text-red-600"; st.textContent = "Enter a product to search."; return; }
    st.className = "text-sm text-slate-500"; st.textContent = "Searching…"; $("pf-run").disabled = true;
    try {
      const r = await fetch(FN("product-finder"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, department: dept }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { st.className = "text-sm text-red-600"; st.textContent = d.error || "Search failed — try again."; return; }
      st.textContent = ""; renderFinder(d);
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Network error — try again."; }
    finally { $("pf-run").disabled = false; }
  }

  // --- Request a full review (lead) ------------------------------------------
  async function sendBook(e) {
    e.preventDefault();
    const st = $("b-status");
    const name = $("b-name").value.trim(), email = $("b-email").value.trim(), org = $("b-org").value.trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { st.className = "text-sm text-red-600"; st.textContent = "Name and a valid email, please."; return; }
    st.className = "text-sm text-slate-500"; st.textContent = "Sending…"; $("b-send").disabled = true;
    const payload = {
      type: "sourcing", vertical: "supplies", source: "sentara-pilot",
      name, email, company: org || "Sentara Health",
      analyzed_spend: last ? last.summary.total_spend : null,
      potential_savings: last ? last.summary.total_savings : null,
      items_matched: last ? last.summary.matched : null,
    };
    try {
      const r = await fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        $("book-form").innerHTML = `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-slate-700"><p class="font-semibold text-emerald-700">Request received — thank you.</p><p class="mt-1">Our team will confirm exact equivalents and send firm DHI pricing on the flagged items. Reference: <span class="font-mono text-xs">${esc(d.id)}</span></p></div>`;
        toast("Sent — we'll follow up.");
      } else { st.className = "text-sm text-red-600"; st.textContent = d.error || "Couldn't send — try again."; }
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Network error — try again."; }
    finally { $("b-send").disabled = false; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("dhi_sentara_ok") === "1" || tryUnlock(qs.get("key"))) unlock();
    $("gate-form").addEventListener("submit", (e) => { e.preventDefault(); if (!tryUnlock($("gate-code").value)) $("gate-msg").textContent = "That code isn't right — check with your DHI contact."; });

    const drop = $("drop");
    $("file").addEventListener("change", (e) => loadFile(e.target.files && e.target.files[0]));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });

    $("sample").addEventListener("click", () => { pending = ""; $("paste").value = SAMPLE; $("file-name").textContent = `Sample loaded — ${toLines(SAMPLE).length} lines`; toast("Sample spend file loaded"); });
    $("run").addEventListener("click", run);
    $("print").addEventListener("click", () => window.print());
    $("book").addEventListener("click", () => { $("book-form").classList.remove("hidden"); $("book-form").scrollIntoView({ behavior: "smooth" }); });
    $("book-fields").addEventListener("submit", sendBook);

    $("pf-run").addEventListener("click", findProduct);
    $("pf-q").addEventListener("keydown", (e) => { if (e.key === "Enter") findProduct(); });
  });
})();
