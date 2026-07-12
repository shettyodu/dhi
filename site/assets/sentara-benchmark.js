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
      const r = await fetch(FN("supply-spend-check"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, consent: false, references: true }) });
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

  // Labeled external references (peer / GSA-public); DHI is already its own column.
  const REF_STYLE = { peer: "text-cyan-700", public: "text-violet-700" };
  function refsBadges(references) {
    const ext = (references || []).filter((x) => x.source !== "dhi");
    if (!ext.length) return "";
    return `<div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">${ext.map((x) =>
      `<span class="${REF_STYLE[x.source] || "text-slate-500"}">${esc(x.label)}: <b>${usd(x.price)}</b></span>`).join("")}</div>`;
  }

  function renderReport(d) {
    const s = d.summary;
    const matched = d.rows.filter((r) => r.matched);
    const rowsHtml = matched.map((r) => `
      <tr class="border-b border-slate-100">
        <td class="py-2.5 pr-3 text-sm text-slate-700">${esc(r.desc)}<div class="text-xs text-emerald-600">DHI can supply · ${esc(r.benchmark_name)}</div>${refsBadges(r.references)}</td>
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
  // Context-aware: cross-reference the buyer's OWN uploaded spend for the query —
  // the thing a generic web search structurally cannot do.
  const tokens = (s) => normKey(s).split(" ").filter((t) => t.length > 2);
  function yourSpendFor(query) {
    if (!lastLines || !lastLines.length) return null;
    const qt = new Set(tokens(query)); if (!qt.size) return null;
    const matches = [];
    lastLines.forEach((l) => {
      const lt = tokens(l.desc); if (!lt.length) return;
      const overlap = lt.filter((t) => qt.has(t)).length;
      if (overlap >= 2 || (qt.size <= 2 && overlap === qt.size)) {
        const p = l.unit_price == null ? null : Number(l.unit_price);
        matches.push({ desc: l.desc, dept: (l.dept && l.dept.trim()) || "Unspecified", price: (p != null && !isNaN(p)) ? p : null, qty: Number(l.qty) || 1 });
      }
    });
    if (!matches.length) return null;
    const priced = matches.filter((m) => m.price != null);
    const prices = priced.map((m) => m.price);
    const min = prices.length ? Math.min.apply(null, prices) : null;
    const max = prices.length ? Math.max.apply(null, prices) : null;
    const variance = (prices.length >= 2 && new Set(prices.map((p) => p.toFixed(4))).size >= 2) ? priced.reduce((s, m) => s + m.qty * (m.price - min), 0) : 0;
    return { priced, min, max, variance, count: matches.length };
  }
  function contextHtml(ctx) {
    if (!ctx) return "";
    const byDept = {};
    ctx.priced.forEach((m) => { if (!byDept[m.dept] || m.price < byDept[m.dept]) byDept[m.dept] = m.price; });
    const chips = Object.keys(byDept).map((d) => `<span class="inline-flex items-baseline gap-1"><span class="font-semibold text-brand-900">${usd(byDept[d])}</span><span class="text-xs text-slate-500">${esc(d)}</span></span>`).join('<span class="px-1 text-slate-300">·</span>');
    const rangeLine = (ctx.min != null && ctx.max != null && ctx.min !== ctx.max) ? `Range ${usd(ctx.min)}–${usd(ctx.max)} across your departments.` : "";
    const varLine = ctx.variance > 0 ? ` Standardizing to your own lowest saves <b>${usd0(ctx.variance)}</b>.` : "";
    return `<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div class="flex flex-wrap items-center gap-2"><span class="rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Your purchasing</span><span class="text-xs text-amber-700">from your own uploaded spend</span></div>
      <p class="mt-2 text-sm text-slate-700">You currently pay: ${chips || '<span class="text-slate-400">matched, no price on file</span>'}</p>
      ${(rangeLine || varLine) ? `<p class="mt-1 text-sm text-slate-600">${rangeLine}${varLine}</p>` : ""}
      <p class="mt-2 text-xs text-amber-700">A web search can't see this — only your portal knows what you already pay.</p>
    </div>`;
  }

  function renderFinder(d, ctx) {
    const parts = [];
    if (d.dhi) {
      parts.push(`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">DHI can supply this</p>
        <p class="mt-1 font-semibold text-brand-900">${esc(d.dhi.name)}</p>
        <p class="mt-0.5 font-display text-xl font-extrabold text-emerald-700">${usd(d.dhi.price)}<span class="text-xs font-normal text-emerald-700/70"> · DHI price</span></p>
        ${refsBadges(d.dhi.references)}
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
      ${contextHtml(ctx)}
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
      st.textContent = ""; renderFinder(d, yourSpendFor(q));
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Network error — try again."; }
    finally { $("pf-run").disabled = false; }
  }

  // --- Phase 3: full procurement list → Supply Proposal ----------------------
  const lineSpend = (l) => { const p = l.unit_price == null ? null : Number(l.unit_price); const q = Number(l.qty) || 1; return (p != null && !isNaN(p)) ? p * q : 0; };

  async function benchmarkRows(lines) {
    if (last && last.rows && last.rows.length === lines.length) return last.rows; // reuse the quick run
    const rows = [];
    for (let i = 0; i < lines.length; i += 200) { // analyze() caps at 250/call
      const chunk = lines.slice(i, i + 200);
      try {
        const r = await fetch(FN("supply-spend-check"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: chunk, consent: false }) });
        const d = await r.json().catch(() => ({}));
        if (d && Array.isArray(d.rows)) rows.push(...d.rows); else chunk.forEach(() => rows.push({ matched: false }));
      } catch (e) { chunk.forEach(() => rows.push({ matched: false })); }
    }
    return rows;
  }

  async function categorizeLines(lines, onProgress) {
    const cats = new Array(lines.length).fill(null);
    const B = 50;
    for (let i = 0; i < lines.length; i += B) {
      const batch = lines.slice(i, i + B).map((l, j) => ({ i: i + j, desc: l.desc }));
      try {
        const r = await fetch(FN("categorize"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: batch }) });
        const d = await r.json().catch(() => ({}));
        (d.results || []).forEach((x) => { if (typeof x.i === "number") cats[x.i] = { department: x.department, category: x.category }; });
      } catch (e) { /* leave nulls -> Other */ }
      if (onProgress) onProgress(Math.min(i + B, lines.length), lines.length);
    }
    return cats;
  }

  async function buildProposal() {
    const lines = lastLines || [];
    const st = $("proposal-status");
    if (!lines.length) { st.className = "text-sm text-red-600"; st.textContent = "Run a benchmark first."; return; }
    $("build-proposal").disabled = true; st.className = "text-sm text-slate-500"; st.textContent = "Analyzing full list…";
    try {
      const rows = await benchmarkRows(lines);
      const cats = await categorizeLines(lines, (done, total) => { st.textContent = `Categorizing ${done}/${total}…`; });
      st.textContent = ""; renderProposal(lines, rows, cats);
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Couldn't build the proposal — try again."; }
    finally { $("build-proposal").disabled = false; }
  }

  function renderProposal(lines, rows, cats) {
    const varc = computeVariance(lines);
    const varTotal = varc.reduce((s, x) => s + x.savings, 0);
    const deptAgg = {}; const scope = [];
    let totalSpend = 0, addressable = 0, dhiSavings = 0;
    lines.forEach((l, k) => {
      const row = rows[k] || {};
      const dept = (l.dept && l.dept.trim()) || (cats[k] && cats[k].department) || "Other";
      const spend = lineSpend(l); totalSpend += spend;
      const d = deptAgg[dept] = deptAgg[dept] || { dept, lines: 0, spend: 0, addr: 0, sav: 0, sku: 0 };
      d.lines++; d.spend += spend;
      if (row.matched) {
        addressable += spend; d.addr += spend; d.sku++;
        const sv = Number(row.line_savings) || 0; dhiSavings += sv; d.sav += sv;
        scope.push({ desc: l.desc, dept, dhi: row.benchmark_price, name: row.benchmark_name, savings: sv, spend });
      }
    });
    const projected = dhiSavings + varTotal;
    const pct = totalSpend > 0 ? Math.round((projected / totalSpend) * 1000) / 10 : 0;
    const depts = Object.values(deptAgg).sort((a, b) => b.spend - a.spend);
    scope.sort((a, b) => (b.savings - a.savings) || (b.spend - a.spend));

    const deptRows = depts.map((d) => `<tr class="border-b border-slate-100">
      <td class="py-2 pr-3 text-sm text-slate-700">${esc(d.dept)}</td>
      <td class="px-2 py-2 text-right text-sm text-slate-500">${d.lines}</td>
      <td class="px-2 py-2 text-right text-sm">${usd0(d.spend)}</td>
      <td class="px-2 py-2 text-right text-sm">${d.addr > 0 ? usd0(d.addr) : "—"}</td>
      <td class="px-2 py-2 pr-2 text-right text-sm font-semibold ${d.sav > 0 ? "text-emerald-700" : "text-slate-400"}">${d.sav > 0 ? usd0(d.sav) : "—"}</td>
    </tr>`).join("");

    const scopeRows = scope.slice(0, 14).map((r) => `<tr class="border-b border-slate-100">
      <td class="py-2 pr-3 text-sm text-slate-700">${esc(r.desc)}<div class="text-xs text-emerald-600">${esc(r.name)} · ${esc(r.dept)}</div></td>
      <td class="px-2 py-2 text-right text-sm">${usd(r.dhi)}</td>
      <td class="px-2 py-2 pr-2 text-right text-sm font-bold ${r.savings > 0 ? "text-emerald-700" : "text-slate-400"}">${r.savings > 0 ? usd(r.savings) : "—"}</td>
    </tr>`).join("");

    $("proposal-body").innerHTML = `
      <p class="text-sm text-slate-600">Across <b>${lines.length}</b> line items in <b>${depts.length}</b> departments, DHI can supply <b>${scope.length}</b> items directly. Projected savings combine DHI pricing on those items with standardizing your own internal price variance.</p>
      <div class="mt-5 grid gap-4 sm:grid-cols-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Spend analyzed</p><p class="mt-1 font-display text-xl font-extrabold text-brand-900">${usd0(totalSpend)}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">DHI-addressable</p><p class="mt-1 font-display text-xl font-extrabold text-brand-900">${usd0(addressable)}</p></div>
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Projected savings</p><p class="mt-1 font-display text-xl font-extrabold text-emerald-700">${usd0(projected)}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Savings rate</p><p class="mt-1 font-display text-xl font-extrabold text-brand-900">${pct}%</p></div>
      </div>
      <p class="mt-2 text-xs text-slate-400">Projected savings = DHI pricing on suppliable items (${usd0(dhiSavings)}) + standardizing internal price variance (${usd0(varTotal)}).</p>

      <h3 class="mt-6 font-display text-base font-bold text-brand-900">By department</h3>
      <div class="mt-2 overflow-x-auto rounded-2xl border border-slate-200"><table class="w-full border-collapse">
        <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
          <th class="py-2.5 pl-4 pr-3 text-left font-semibold">Department</th>
          <th class="px-2 py-2.5 text-right font-semibold">Lines</th>
          <th class="px-2 py-2.5 text-right font-semibold">Spend</th>
          <th class="px-2 py-2.5 text-right font-semibold">DHI-addressable</th>
          <th class="px-2 py-2.5 pr-2 text-right font-semibold">DHI savings</th>
        </tr></thead><tbody>${deptRows}</tbody></table></div>

      ${scope.length ? `<h3 class="mt-6 font-display text-base font-bold text-brand-900">DHI supply scope — proposed items</h3>
      <div class="mt-2 overflow-x-auto rounded-2xl border border-slate-200"><table class="w-full border-collapse">
        <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
          <th class="py-2.5 pl-4 pr-3 text-left font-semibold">Item · DHI equivalent · dept</th>
          <th class="px-2 py-2.5 text-right font-semibold">DHI price</th>
          <th class="px-2 py-2.5 pr-2 text-right font-semibold">Est. savings</th>
        </tr></thead><tbody>${scopeRows}</tbody></table></div>
      ${scope.length > 14 ? `<p class="mt-2 text-xs text-slate-400">+ ${scope.length - 14} more suppliable items in the full analysis.</p>` : ""}` : ""}

      <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <b>Proposed next step:</b> DHI confirms exact equivalents and firm pricing on the ${scope.length} suppliable items and delivers under a supply agreement — capturing the DHI savings, while your team standardizes the internal-variance items. Figures are indicative, on covered categories; nothing here is stored or shared.
      </div>`;

    try { $("proposal-date").textContent = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { /* ignore */ }
    $("proposal").classList.remove("hidden");
    $("proposal").scrollIntoView({ behavior: "smooth", block: "start" });
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

    $("build-proposal").addEventListener("click", buildProposal);
    $("print-proposal").addEventListener("click", () => window.print());
    $("book2").addEventListener("click", () => { $("book-form").classList.remove("hidden"); $("book-form").scrollIntoView({ behavior: "smooth" }); });
  });
})();
