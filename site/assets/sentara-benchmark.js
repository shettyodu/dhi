/* Sentara Supply Price Benchmark — private pilot. Ingests a CSV/paste spend
   export, benchmarks via /supply-spend-check (consent OFF — the pilot's data is
   NOT added to the shared index), renders a printable Opportunity Report, and
   lets procurement request a full review. Buy-side, indicative. */
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
  function tryUnlock(code) {
    if (String(code || "").trim().toUpperCase() === ACCESS) { localStorage.setItem("dhi_sentara_ok", "1"); unlock(); return true; }
    return false;
  }

  // --- CSV / paste parsing ----------------------------------------------------
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

  // Turn raw rows into benchmark line items {desc, qty, unit_price, vendor}.
  function toLines(text) {
    const rows = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!rows.length) return [];
    let col = { desc: 0, qty: 1, price: 2, vendor: 3 }, start = 0;
    const head = splitRow(rows[0]).map((s) => s.trim().toLowerCase());
    const looksHeader = head.some((h) => has(h, ["desc", "item", "product", "material", "name"]));
    if (looksHeader) {
      const find = (keys) => { for (let i = 0; i < head.length; i++) if (has(head[i], keys)) return i; return -1; };
      col = {
        desc: find(["description", "item", "product", "material", "name"]),
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
      out.push({ desc, qty: qty || 1, unit_price: price === "" ? null : price, vendor: vendor || null });
    }
    return out;
  }

  let pending = ""; // raw text loaded from a file
  function loadFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { pending = String(rd.result || ""); $("file-name").textContent = `${file.name} — ${toLines(pending).length} line(s) detected`; };
    rd.onerror = () => { $("file-name").textContent = "Couldn't read that file."; };
    rd.readAsText(file);
  }

  const SAMPLE = [
    "description,quantity,unit price,vendor",
    "Isolation gown AAMI level 2,4800,3.55,Medline",
    "Surgical isolation gown level 3,2600,6.90,Cardinal Health",
    "Coverall type 5/6 protective,1500,6.30,Uline",
    "Reinforced coverall type 3/4,600,11.80,O&M",
    "Disposable scrub set,1800,15.40,Medline",
    "Surgical drape reinforced,3200,4.20,Cardinal Health",
    "Bouffant cap,20000,0.045,Uline",
    "Nitrile exam glove (box),9000,7.80,Medline",
    "N95 respirator,12000,1.05,3M",
    "General surgery major OT pack,900,,Cardinal Health",
  ].join("\n");

  // --- Run benchmark ----------------------------------------------------------
  let last = null;
  async function run() {
    const status = $("status");
    const paste = ($("paste").value || "").trim();
    const lines = toLines(paste || pending);
    if (!lines.length) { status.className = "text-sm text-red-600"; status.textContent = "Upload a CSV or paste rows first."; return; }
    status.className = "text-sm text-slate-500"; status.textContent = `Analyzing ${lines.length} line(s)…`; $("run").disabled = true;
    try {
      // consent:false — the pilot's data stays theirs, never enters the shared index.
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
      </div>` : `<p class="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">None of these items matched our current catalog categories (PPE, gowns, coveralls, drapes, scrubs, OT packs). We're expanding coverage — send the full list and we'll benchmark it.</p>`}
      ${s.unmatched ? `<p class="mt-3 text-xs text-slate-400">${s.unmatched} item${s.unmatched > 1 ? "s" : ""} not benchmarked (outside current catalog coverage or unclear units).</p>` : ""}`;

    try { $("report-date").textContent = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { /* ignore */ }
    $("report").classList.remove("hidden");
    $("report").scrollIntoView({ behavior: "smooth", block: "start" });
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
    // Gate: remember unlock; allow ?key= for a shared demo link.
    if (localStorage.getItem("dhi_sentara_ok") === "1" || tryUnlock(qs.get("key"))) unlock();
    $("gate-form").addEventListener("submit", (e) => { e.preventDefault(); if (!tryUnlock($("gate-code").value)) $("gate-msg").textContent = "That code isn't right — check with your DHI contact."; });

    // File upload + drag/drop
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
  });
})();
