/* Start Your Deal — AutoCommand search experience.
   Calls the DHI Netlify proxy (automotive-search / -nl / -vehicle / -compare),
   which forwards to the AutoCommand workflow service. Renders every match plus
   the ranked recommendation buckets with the "why" scorecard, supports compare,
   and still captures a lead so an advisor can follow up. Degrades gracefully if
   the search backend isn't connected yet.

   Local testing config (override the defaults):
     ?api=http://localhost:8899         proxy base (or localStorage dhi_api_base)
     ?photobase=http://localhost:5050   vehicle-photo host (or localStorage acm_photo_base)
*/
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "https://courageous-fairy-0b2d3c.netlify.app").replace(/\/+$/, "");
  const PHOTO_BASE = (qs.get("photobase") || localStorage.getItem("acm_photo_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const ref = (qs.get("ref") || "").slice(0, 64);

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtUSD = (n) => (n == null || isNaN(n)) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600); }

  let lastProfile = null;
  let lastBuckets = [];
  const selected = new Map(); // vehicle_id -> vehicle

  // ---------- parse free-text form fields into structured /search params ----------
  function digits(s) { const m = String(s || "").replace(/[, ]/g, "").match(/\d+/); return m ? parseInt(m[0], 10) : null; }
  function moneyRange(s) {
    const out = [];
    const re = /(\d[\d,\.]*)\s*(k)?/gi; let m;
    while ((m = re.exec(String(s || ""))) !== null) {
      let v = parseFloat(m[1].replace(/,/g, ""));
      if (isNaN(v)) continue;
      if (m[2]) v *= 1000; else if (v < 1000) v *= 1000; // "30" or "30k" → 30000
      out.push(v);
    }
    if (!out.length) return {};
    return out.length === 1 ? { max: out[0] } : { min: Math.min(...out), max: Math.max(...out) };
  }
  function years(s) {
    const ys = (String(s || "").match(/(?:19|20)\d{2}/g) || []).map(Number);
    if (!ys.length) return {};
    return ys.length === 1 ? { year_min: ys[0] } : { year_min: Math.min(...ys), year_max: Math.max(...ys) };
  }
  function loc(s) {
    const out = {}; const raw = String(s || "");
    const zip = raw.match(/\b(\d{5})\b/); if (zip) out.location_zip = zip[1];
    const st = raw.match(/,\s*([A-Za-z]{2})\b/) || raw.match(/\b([A-Za-z]{2})\b\s*$/);
    if (st) out.location_state = st[1].toUpperCase();
    return out;
  }
  function val(id) { const el = $(id); return el ? el.value.trim() : ""; }

  function buildProfile() {
    const p = {};
    const notes = [];
    const make = val("fv-make"); if (make && !/^any$/i.test(make)) p.make = make;
    const model = val("fv-model"); if (model) p.model = model;
    const body = val("fv-body"); if (body) p.body_style = body;
    const fuel = val("fv-fuel"); if (fuel) p.fuel_type = fuel;
    const drive = val("fv-drive"); if (drive) p.drivetrain = drive;
    Object.assign(p, years(val("fv-year")));
    const mi = digits(val("fv-mileage")); if (mi) p.mileage_max = mi;
    const price = moneyRange(val("fv-price")); if (price.min) p.budget_min = price.min; if (price.max) p.budget_max = price.max;
    const pay = moneyRange(val("fv-payment")); if (pay.max || pay.min) p.max_monthly_payment = pay.max || pay.min;
    const credit = val("fv-credit"); if (credit) p.credit_tier_hint = credit;
    Object.assign(p, loc(val("fv-location")));
    const ship = val("fv-shipping");
    if (ship) { p.accept_shipping = !/local pickup/i.test(ship); notes.push("Shipping: " + ship); }
    const down = val("fv-down"); if (down) notes.push("Down payment: " + down);
    if (notes.length) p.notes = notes.join(" · ");
    return p;
  }

  function leadFromForm() {
    return {
      type: "customer", referral_code: ref,
      name: val("fv-name"), email: val("fv-email"), phone: val("fv-phone"),
      make: val("fv-make"), model: val("fv-model"), body_style: val("fv-body"),
      year: val("fv-year"), mileage: val("fv-mileage"), price: val("fv-price"),
      payment: val("fv-payment"), down_payment: val("fv-down"), fuel: val("fv-fuel"), drivetrain: val("fv-drive"),
      credit: val("fv-credit"), location: val("fv-location"), shipping: val("fv-shipping"),
    };
  }

  // ---------- lead capture (background; never blocks search) ----------
  async function captureLead(lead) {
    if (!lead || !lead.name || !lead.email) return;
    try {
      await fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
      toast("An advisor will follow up with your matches.");
    } catch (e) { /* non-blocking */ }
  }

  // ---------- search ----------
  async function runSearch(endpoint, payload, lead) {
    const results = $("results");
    results.classList.remove("hidden");
    results.innerHTML = loadingHtml();
    results.scrollIntoView({ behavior: "smooth", block: "start" });
    if (lead) captureLead(lead);
    let d = {}, ok = false, status = 0;
    try {
      const r = await fetch(FN(endpoint), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      status = r.status; try { d = await r.json(); } catch (e) {}
      ok = r.ok;
    } catch (e) { d = { error: "Network error — please try again." }; }
    if (!ok) { results.innerHTML = errorHtml(d, status, !!lead); return; }
    lastProfile = d.profile || (payload.query ? null : payload);
    renderResults(d);
  }

  function loadingHtml() {
    return `<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600"></div>
      <p class="mt-3 text-sm text-slate-500">Searching the marketplace…</p></div>`;
  }
  function errorHtml(d, status, hadLead) {
    const soft = status === 503 || status === 502 || status === 504;
    const msg = (d && d.error) || "Search is unavailable right now.";
    return `<div class="rounded-2xl border ${soft ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"} p-6 shadow-sm">
      <p class="font-semibold ${soft ? "text-amber-800" : "text-red-700"}">${esc(msg)}</p>
      ${hadLead ? `<p class="mt-2 text-sm text-slate-600">Good news — your request was logged, so an advisor can follow up with matches even while live search is being connected.</p>` : `<p class="mt-2 text-sm text-slate-600">Add your name &amp; email above and submit, and an advisor will follow up with matches.</p>`}
    </div>`;
  }

  // ---------- render results ----------
  function chip(label) { return `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">${esc(label)}</span>`; }

  function interpreted(profile) {
    if (!profile) return "";
    const map = { make: "Make", model: "Model", body_style: "Body", fuel_type: "Fuel", drivetrain: "Drive", year_min: "Year ≥", year_max: "Year ≤", mileage_max: "≤ mi", budget_min: "≥ $", budget_max: "≤ $", max_monthly_payment: "$/mo ≤", location_state: "State", location_zip: "ZIP", credit_tier_hint: "Credit" };
    const parts = [];
    Object.keys(map).forEach((k) => { if (profile[k] != null && profile[k] !== "") parts.push(map[k] + " " + (typeof profile[k] === "number" ? profile[k].toLocaleString("en-US") : profile[k])); });
    if (profile.notes) parts.push(profile.notes);
    return parts.length ? `<div class="mt-3 flex flex-wrap gap-2">${parts.map(chip).join("")}</div>` : "";
  }

  function renderResults(d) {
    const results = $("results");
    selected.clear(); updateCmpBar(); // fresh search → reset compare selection
    const r = d.results || {};
    lastBuckets = Array.isArray(r.buckets) ? r.buckets.filter((b) => b.vehicles && b.vehicles.length) : [];
    const total = r.total_count != null ? r.total_count : 0;
    if (!lastBuckets.length) {
      results.innerHTML = `<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p class="font-semibold text-brand-900">No matches yet</p>
        <p class="mt-2 text-sm text-slate-600">Try widening your price, year, mileage, or location. Or add your details above and an advisor will hunt one down.</p></div>`;
      return;
    }
    const tabs = lastBuckets.map((b, i) =>
      `<button class="bucket-tab ${i === 0 ? "active" : ""} whitespace-nowrap rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-600" data-i="${i}">${esc(b.label || b.key)} <span class="opacity-60">${b.vehicles.length}</span></button>`
    ).join("");
    results.innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="font-display text-2xl font-bold text-brand-900">${total.toLocaleString("en-US")} matching ${total === 1 ? "vehicle" : "vehicles"}</h2>
          <p class="text-sm text-slate-500">Ranked into the picks that matter — each shows <strong>why</strong> it made the list.</p>
        </div>
      </div>
      ${interpreted(d.profile)}
      <div class="mt-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">${tabs}</div>
      <div id="bucket-grid" class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"></div>`;
    results.querySelectorAll(".bucket-tab").forEach((btn) => btn.addEventListener("click", () => {
      results.querySelectorAll(".bucket-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showBucket(parseInt(btn.dataset.i, 10));
    }));
    showBucket(0);
  }

  function showBucket(i) {
    const grid = $("bucket-grid"); if (!grid || !lastBuckets[i]) return;
    grid.innerHTML = lastBuckets[i].vehicles.map(vehicleCard).join("");
    grid.querySelectorAll("[data-cmp]").forEach((cb) => cb.addEventListener("change", onCompareToggle));
  }

  function photoHtml(v) {
    const path = (v.photos && v.photos[0]) || "";
    const src = /^https?:\/\//.test(path) ? path : (path && PHOTO_BASE ? PHOTO_BASE + path : "");
    if (src) return `<img src="${esc(src)}" alt="${esc(v.year + " " + v.make + " " + v.model)}" loading="lazy" class="h-44 w-full rounded-t-2xl object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div style="display:none" class="h-44 w-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-brand-800 to-brand-950 text-sm font-semibold text-cyan-200">${esc(v.body_style || "Vehicle")}</div>`;
    return `<div class="flex h-44 w-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-brand-800 to-brand-950 text-sm font-semibold text-cyan-200">${esc(v.body_style || "Vehicle")}</div>`;
  }

  function marketBadge(sc) {
    if (!sc || sc.price_vs_market_pct == null) return "";
    const p = sc.price_vs_market_pct;
    if (p < -0.5) return `<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">${Math.abs(p).toFixed(0)}% below market</span>`;
    if (p > 0.5) return `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">${p.toFixed(0)}% above market</span>`;
    return `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">At market</span>`;
  }

  function vehicleCard(v) {
    const sc = v.score || {};
    const score = sc.overall_score != null ? Number(sc.overall_score).toFixed(0) : null;
    const id = esc(v.vehicle_id);
    const checked = selected.has(v.vehicle_id) ? "checked" : "";
    const why = [];
    if (sc.mileage_class) why.push(esc(String(sc.mileage_class).replace(/_/g, " ")) + " miles");
    if (sc.dealer_reliability != null) why.push("dealer " + Math.round(sc.dealer_reliability * 100) + "%");
    why.push(sc.title_risk ? "title: " + esc(v.title_status || "review") : "clean title");
    if (v.accident_count != null) why.push(v.accident_count === 0 ? "no accidents" : v.accident_count + " accident(s)");
    return `<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="relative">${photoHtml(v)}
        ${score ? `<span class="absolute right-2 top-2 rounded-full bg-brand-900/90 px-2 py-0.5 text-xs font-bold text-white">${score}</span>` : ""}
      </div>
      <div class="p-4">
        <h3 class="font-semibold text-brand-900">${esc(v.year)} ${esc(v.make)} ${esc(v.model)}${v.trim ? " " + esc(v.trim) : ""}</h3>
        <div class="mt-1 flex items-center gap-2">
          <span class="text-lg font-bold text-brand-900">${fmtUSD(v.asking_price)}</span>
          ${marketBadge(sc)}
        </div>
        ${sc.shipping_adjusted_cost != null ? `<p class="text-xs text-slate-400">${fmtUSD(sc.shipping_adjusted_cost)} delivered (est.)</p>` : ""}
        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>${Number(v.mileage || 0).toLocaleString("en-US")} mi</span>
          ${v.drivetrain ? `<span>${esc(v.drivetrain)}</span>` : ""}
          ${v.fuel_type ? `<span>${esc(v.fuel_type)}</span>` : ""}
          <span>${esc(v.location_city || "")}${v.location_city ? ", " : ""}${esc(v.location_state || "")}</span>
        </div>
        <p class="mt-2 text-xs text-slate-500"><span class="font-medium text-slate-600">Why:</span> ${why.join(" · ")}</p>
        <div class="mt-3 flex items-center justify-between">
          <span class="text-xs text-slate-400">${esc(v.source_name || v.source_type || "")}</span>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" data-cmp data-id="${id}" ${checked} class="h-4 w-4 rounded border-slate-300 text-cyan-600" /> Compare
          </label>
        </div>
      </div>
    </div>`;
  }

  // ---------- compare ----------
  function onCompareToggle(e) {
    const id = e.target.dataset.id;
    const v = findVehicle(id);
    if (e.target.checked) {
      if (selected.size >= 5) { e.target.checked = false; toast("Compare up to 5 at a time."); return; }
      if (v) selected.set(id, v);
    } else selected.delete(id);
    updateCmpBar();
  }
  function findVehicle(id) { for (const b of lastBuckets) { const f = b.vehicles.find((x) => x.vehicle_id === id); if (f) return f; } return null; }
  function updateCmpBar() {
    const bar = $("cmp-bar"), cnt = $("cmp-count"), go = $("cmp-go");
    cnt.textContent = selected.size + " selected";
    go.disabled = selected.size < 2;
    bar.classList.toggle("hidden", selected.size === 0);
  }

  async function openCompare() {
    if (selected.size < 2) return;
    const ids = [...selected.keys()];
    const modal = $("cmp-modal"), body = $("cmp-body");
    modal.classList.remove("hidden");
    body.innerHTML = compareTable([...selected.values()]) + `<div id="cmp-narr" class="mt-5 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-center text-sm text-slate-600"><div class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600"></div></div>`;
    try {
      const r = await fetch(FN("automotive-compare"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, profile: lastProfile }) });
      const d = await r.json();
      const narr = $("cmp-narr");
      if (r.ok) {
        const text = d.narrative || "";
        const rec = d.recommendation;
        const head = rec && rec.headline ? rec.headline : (typeof rec === "string" ? rec : "AI recommendation");
        let trade = "";
        if (Array.isArray(d.trade_offs)) {
          trade = `<div class="mt-3 grid gap-3 sm:grid-cols-${Math.min(d.trade_offs.length, 3)}">` + d.trade_offs.map((t) => {
            const v = selected.get(t.vehicle_id);
            const name = v ? `${v.year} ${v.make} ${v.model}` : (t.vehicle_id || "");
            const pros = Array.isArray(t.pros) ? t.pros : [];
            const cons = Array.isArray(t.cons) ? t.cons : [];
            return `<div class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-sm font-semibold text-brand-900">${esc(name)}</p>
              ${pros.map((x) => `<p class="mt-0.5 text-xs text-emerald-700">+ ${esc(x)}</p>`).join("")}
              ${cons.map((x) => `<p class="mt-0.5 text-xs text-amber-700">– ${esc(x)}</p>`).join("")}
            </div>`;
          }).join("") + "</div>";
        } else if (d.trade_offs) { trade = `<p class="mt-2">${esc(String(d.trade_offs))}</p>`; }
        narr.className = "mt-5 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-slate-600";
        narr.innerHTML = `<p class="font-semibold text-brand-900">${esc(head)}</p><p class="mt-1 text-left">${esc(text)}</p>${trade}`;
      } else {
        narr.innerHTML = `<p>${esc(d.error || "AI recommendation unavailable.")}</p>`;
      }
    } catch (e) { const n = $("cmp-narr"); if (n) n.innerHTML = "<p>AI recommendation unavailable right now.</p>"; }
  }

  function compareTable(vs) {
    const rows = [
      ["Price", (v) => fmtUSD(v.asking_price)],
      ["Delivered (est.)", (v) => v.score && v.score.shipping_adjusted_cost != null ? fmtUSD(v.score.shipping_adjusted_cost) : "—"],
      ["Year", (v) => esc(v.year)],
      ["Mileage", (v) => Number(v.mileage || 0).toLocaleString("en-US") + " mi"],
      ["Body", (v) => esc(v.body_style || "—")],
      ["Drive / Fuel", (v) => esc((v.drivetrain || "—") + " / " + (v.fuel_type || "—"))],
      ["Location", (v) => esc((v.location_city || "") + (v.location_city ? ", " : "") + (v.location_state || ""))],
      ["vs market", (v) => v.score && v.score.price_vs_market_pct != null ? (v.score.price_vs_market_pct).toFixed(0) + "%" : "—"],
      ["Dealer", (v) => v.score && v.score.dealer_reliability != null ? Math.round(v.score.dealer_reliability * 100) + "%" : "—"],
      ["Title", (v) => v.score && v.score.title_risk ? esc(v.title_status || "review") : "clean"],
      ["Score", (v) => v.score && v.score.overall_score != null ? Number(v.score.overall_score).toFixed(0) : "—"],
    ];
    const head = `<th class="p-2 text-left text-xs font-semibold text-slate-400"></th>` + vs.map((v) => `<th class="p-2 text-left text-sm font-bold text-brand-900">${esc(v.year)} ${esc(v.make)} ${esc(v.model)}</th>`).join("");
    const trs = rows.map((row) => `<tr class="border-t border-slate-100"><td class="p-2 text-xs font-medium text-slate-500">${row[0]}</td>${vs.map((v) => `<td class="p-2 text-sm text-slate-700">${row[1](v)}</td>`).join("")}</tr>`).join("");
    return `<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table></div>`;
  }

  // ---------- wire up ----------
  const form = $("fv-form");
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const profile = buildProfile();
    const btn = $("fv-submit"); btn.disabled = true; setTimeout(() => (btn.disabled = false), 800);
    runSearch("automotive-search", profile, leadFromForm());
  });
  const nlGo = $("nl-go");
  if (nlGo) nlGo.addEventListener("click", () => {
    const q = val("nl-q"); const note = $("nl-note");
    if (!q) { note.textContent = "Type what you're looking for first."; return; }
    note.textContent = "";
    nlGo.disabled = true; setTimeout(() => (nlGo.disabled = false), 800);
    runSearch("automotive-search-nl", { query: q }, null);
  });
  const nlInput = $("nl-q");
  if (nlInput) nlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nlGo.click(); } });

  // Down payment auto-defaults to 10% of the price, until the user edits it.
  let downDirty = false;
  const priceEl = $("fv-price"), downEl = $("fv-down");
  if (downEl) downEl.addEventListener("input", () => { downDirty = downEl.value.trim() !== ""; });
  if (priceEl && downEl) priceEl.addEventListener("input", () => {
    if (downDirty) return;
    const pr = moneyRange(priceEl.value);
    const base = pr.max || pr.min;
    downEl.value = base ? "$" + Math.round(base * 0.1).toLocaleString("en-US") : "";
  });

  $("cmp-go").addEventListener("click", openCompare);
  $("cmp-clear").addEventListener("click", () => { selected.clear(); document.querySelectorAll("[data-cmp]").forEach((c) => (c.checked = false)); updateCmpBar(); });
  $("cmp-close").addEventListener("click", () => $("cmp-modal").classList.add("hidden"));
  $("cmp-backdrop").addEventListener("click", () => $("cmp-modal").classList.add("hidden"));
})();
