/* Bid Match-Maker (internal) — drives the gated /.netlify/functions/gov-bids
   endpoint. Rep enters the admin passcode once (shared dhi_admin_secret); then
   searches SAM.gov opportunities matched to DHI verticals, sees fit scores, and
   generates a starter proposal outline + submission checklist per opportunity. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/gov-bids";
  const FN_REFRESH = API_BASE + "/.netlify/functions/gov-bids-refresh";
  const FN_PROPOSAL = API_BASE + "/.netlify/functions/gov-proposal";
  const FN_PIPELINE = API_BASE + "/.netlify/functions/gov-pipeline";
  const FN_INTEL = API_BASE + "/.netlify/functions/gov-award-intel";
  const FN_ALERTS = API_BASE + "/.netlify/functions/gov-bid-alerts";
  const SKEY = "dhi_admin_secret";
  const $ = (id) => document.getElementById(id);
  const usd = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let secret = localStorage.getItem(SKEY) || "";
  let lastResults = [];
  let lastSearch = { query: "", vertical: "" }; // for "alert me" subscriptions
  let saFilter = new Set(); // active set-aside category filters

  // Bucket a SAM.gov set-aside string into a filterable eligibility category.
  function saBucket(sa) {
    const s = String(sa || "").toLowerCase();
    if (!s) return "Full & open";
    if (/8\(a\)|\b8a\b/.test(s)) return "8(a)";
    if (/hubzone/.test(s)) return "HUBZone";
    if (/wosb|women|edwosb/.test(s)) return "WOSB / EDWOSB";
    if (/sdvosb|service-disabled|veteran|\bvosb\b/.test(s)) return "SDVOSB / VOSB";
    if (/small business|total small|partial small|\bsba\b/.test(s)) return "Small Business";
    return "Other";
  }
  const SA_ORDER = ["Small Business", "SDVOSB / VOSB", "8(a)", "WOSB / EDWOSB", "HUBZone", "Full & open", "Other"];

  // Equipment/supply-only filter: hide opportunities that require installation,
  // construction, or labor — DHI lighting bids supply equipment only. Heuristic
  // over title + (when available) description text. Defaults ON for lighting.
  let equipOnly = false;
  function isInstall(o) {
    const t = ((o.title || "") + " " + (o.descriptionText || "") + " " + (o.type || "")).toLowerCase();
    if (/supply only|furnish only|no install|without install|equipment only|materials only|product only|brand name/.test(t)) return false; // explicit supply-only
    return /\binstall|installation|and install|& install|construction|demolition|electrician|remove and replace|rip and replace|turn-?key|design[- ]build|\blabor\b|repair service|maintenance service|retrofit and install/.test(t);
  }

  // Keystone-eligibility screen (lighting only): DHI only bids lighting it can
  // fill with Keystone product. No-bid anything brand-locked to a competitor with
  // no "or equal", or any DLA/NSN part-number buy. Heuristic over title + desc.
  // Returns { cls: "eligible" | "review" | "nobid", reason }. Defaults ON for lighting.
  let keystoneOnly = false;
  const KS_COMPETITORS = /\b(lithonia|acuity|lutron|cree|signify|philips|cooper lighting|eaton|ge lighting|hubbell|juno|halo|holophane|gotham|day-?brite|metalux|columbia lighting|kenall|williams|tcp|maxlite|rab\b)\b/;
  const KS_OREQUAL = /\bor equal\b|or approved equal|brand name or equal|equivalent acceptable|equal acceptable|may substitut|substitution(s)? (are |is )?(allowed|acceptable|permitted)/;
  const KS_BRANDLOCK = /no substitut|brand name only|no equal|sole source|only acceptable|exact match required|approved source only/;
  const KS_CATEGORY = /\bled\b|lighting|luminaire|fixture|troffer|panel|high ?bay|wall ?pack|retrofit kit|lamp|bulb|down ?light|wrap|vapor ?tight|exit sign|emergency light|area light|flood ?light|shoebox|tube/;
  function keystoneScreen(o) {
    const title = (o.title || "");
    const t = (title + " " + (o.descriptionText || "") + " " + (o.type || "") + " " + (o.agency || "")).toLowerCase();
    // DLA / NSN part-number micro-buys — locked to a specific stock number, not commercial product.
    if (/^\s*\d{2}--/.test(title) || /\bnsn\b|national stock number|\bdibbs\b|dla\b|defense logistics/.test(t)) {
      return { cls: "nobid", reason: "DLA/NSN part-number buy — not commercial Keystone product" };
    }
    const brand = (t.match(KS_COMPETITORS) || [])[0];
    if (brand) {
      if (KS_OREQUAL.test(t) && !KS_BRANDLOCK.test(t)) return { cls: "eligible", reason: `"Brand-name or equal" — Keystone can be offered as the equal (vs. ${brand})` };
      return { cls: "nobid", reason: `Brand-locked to ${brand} — no "or equal" provision` };
    }
    if (KS_OREQUAL.test(t)) return { cls: "eligible", reason: 'Open "or equal" — Keystone quotable' };
    if (KS_CATEGORY.test(t)) return { cls: "eligible", reason: "Generic spec, no competitor brand lock — Keystone quotable" };
    return { cls: "review", reason: "No brand lock detected — confirm specs against Keystone catalog" };
  }
  function keystoneBadge(o) {
    const k = keystoneScreen(o);
    if (k.cls === "eligible") return `<span title="${esc(k.reason)}" class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Keystone-eligible</span>`;
    if (k.cls === "nobid") return `<span title="${esc(k.reason)}" class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">No-bid</span>`;
    return `<span title="${esc(k.reason)}" class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Review specs</span>`;
  }

  async function api(payload) {
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, d };
  }
  async function pipe(payload) {
    const r = await fetch(FN_PIPELINE, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, d };
  }
  let boardEntries = [], boardStages = ["Identified", "Qualifying", "Drafting", "Submitted", "Won", "Lost", "No-bid"];
  function daysTo(iso) { if (!iso) return null; const d = new Date(iso); if (isNaN(d)) return null; return Math.round((d.getTime() - Date.now()) / 86400000); }

  // ---------- gate ----------
  async function unlock(s) {
    secret = s;
    const { ok, status } = await api({ action: "verticals" });
    if (ok) { localStorage.setItem(SKEY, secret); showTool(); return true; }
    secret = "";
    $("gate-note").textContent = status === 401 ? "Incorrect passcode." : status === 503 ? "Tool not configured yet (ADMIN_SECRET missing)." : "Couldn't verify — try again.";
    return false;
  }

  async function showTool() {
    $("gate").classList.add("hidden");
    $("tool").classList.remove("hidden");
    const { ok, d } = await api({ action: "verticals" });
    if (ok && d.verticals) {
      $("vchips").innerHTML = d.verticals.map((v) =>
        `<button type="button" data-v="${esc(v.key)}" class="v-chip rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-cyan-400">${esc(v.label)}</button>`).join("");
      $("vchips").querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
        $("vchips").querySelectorAll(".v-chip").forEach((c) => c.classList.remove("active"));
        b.classList.add("active");
        runSearch({ vertical: b.dataset.v });
      }));
    }
    refreshBoardCount();
  }

  // ---------- search ----------
  function loading() { $("results").innerHTML = `<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600"></div><p class="mt-3 text-sm text-slate-500">Searching opportunities…</p></div>`; }

  async function runSearch(payload) {
    loading();
    const { ok, status, d } = await api(Object.assign({ action: "search" }, payload));
    if (!ok) {
      $("results").innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">${status === 401 ? "Session expired — reload and re-enter the passcode." : esc((d && d.error) || "Search failed.")}</div>`;
      return;
    }
    lastResults = d.opportunities || [];
    lastSearch = { query: (payload.query || "").trim(), vertical: (payload.vertical || "").trim() };
    saFilter.clear(); // fresh result set → reset set-aside filter
    equipOnly = lastSearch.vertical === "lighting"; // lighting = supply equipment only by default
    keystoneOnly = lastSearch.vertical === "lighting"; // lighting = Keystone-eligible only by default
    // note + interpretation
    const note = $("note"); if (d.note) { note.textContent = d.note; note.classList.remove("hidden"); } else note.classList.add("hidden");
    const interp = $("interp"); const iv = d.interpreted || {};
    if ((iv.verticals && iv.verticals.length) || iv.title) {
      interp.classList.remove("hidden");
      interp.innerHTML = `Matched: ${(iv.verticals || []).map((v) => `<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">${esc(v)}</span>`).join(" ") || "—"}${iv.naics && iv.naics.length ? ` · NAICS ${esc(iv.naics.join(", "))}` : ""}`;
    } else interp.classList.add("hidden");
    renderResults(lastResults);
  }

  function fitBadge(score) {
    if (score >= 75) return `<span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Strong fit · ${score}</span>`;
    if (score >= 55) return `<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Good fit · ${score}</span>`;
    return `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Review · ${score}</span>`;
  }
  function dueLabel(iso) {
    if (!iso) return "—";
    const d = new Date(iso); if (isNaN(d)) return esc(iso);
    const days = Math.round((d.getTime() - Date.now()) / 86400000);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (days < 0) return `<span class="text-red-600">Closed (${date})</span>`;
    if (days === 0) return `<span class="text-red-600 font-semibold">Due today (${date})</span>`;
    return `<span class="${days <= 5 ? "text-amber-700 font-semibold" : "text-slate-600"}">Due in ${days} day${days === 1 ? "" : "s"} · ${date}</span>`;
  }

  function renderResults(full) {
    if (!full.length) { $("results").innerHTML = `<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">No matching opportunities. Try another vertical or broaden the search.</div>`; return; }
    // Equipment/supply-only filter first (hide installation/labor/construction).
    const installCount = full.filter(isInstall).length;
    const afterEquip = equipOnly ? full.filter((o) => !isInstall(o)) : full;
    // Keystone-eligibility screen (hide brand-locked / NSN no-bids when on).
    const nobidCount = afterEquip.filter((o) => keystoneScreen(o).cls === "nobid").length;
    const base = keystoneOnly ? afterEquip.filter((o) => keystoneScreen(o).cls !== "nobid") : afterEquip;
    // Set-aside eligibility filter bar (counts from the equipment-filtered set).
    const counts = {}; base.forEach((o) => { const b = saBucket(o.setAside); counts[b] = (counts[b] || 0) + 1; });
    const chips = SA_ORDER.filter((b) => counts[b]).map((b) => { const on = saFilter.has(b); return `<button data-sa="${esc(b)}" class="rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700"}">${esc(b)} <span class="opacity-60">${counts[b]}</span></button>`; }).join(" ");
    const list = saFilter.size ? base.filter((o) => saFilter.has(saBucket(o.setAside))) : base;
    const isLighting = lastSearch.vertical === "lighting";
    const equipToggle = `<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${equipOnly ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-cyan-400"}"><input id="equip-only" type="checkbox" ${equipOnly ? "checked" : ""} class="h-3.5 w-3.5 accent-white" /> Equipment/supply only${installCount ? ` <span class="opacity-70">(${installCount} install hidden)</span>` : ""}</label>`;
    const keystoneToggle = isLighting ? `<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${keystoneOnly ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-emerald-400"}"><input id="keystone-only" type="checkbox" ${keystoneOnly ? "checked" : ""} class="h-3.5 w-3.5 accent-white" /> Keystone-eligible only${nobidCount ? ` <span class="opacity-70">(${nobidCount} no-bid hidden)</span>` : ""}</label>` : "";
    const bar = `<div class="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      ${equipToggle}${keystoneToggle}
      <span class="mx-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Set-aside</span>${chips}
      ${saFilter.size ? `<button id="sa-clear" class="text-xs font-semibold text-cyan-700 hover:underline">Clear</button>` : ""}
      <span id="alert-host" class="ml-auto">${(lastSearch.query || lastSearch.vertical) ? `<button id="alert-sub" class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:border-cyan-400 hover:text-cyan-700">&#128276; Email me new matches</button>` : ""}</span>
      <span class="text-xs text-slate-400">${list.length} of ${full.length}</span></div>`;
    if (!list.length) { $("results").innerHTML = bar + `<div class="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">No opportunities with the selected set-aside.</div>`; wireSaChips(full); return; }
    $("results").innerHTML = bar + list.map((o, i) => `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold text-brand-900">${esc(o.title)}</h3>
            <p class="mt-0.5 text-sm text-slate-500">${esc(o.agency || "")}${o.solicitation ? " · " + esc(o.solicitation) : ""}</p>
          </div>
          <div class="flex flex-none flex-wrap items-center justify-end gap-1.5">${isLighting ? keystoneBadge(o) : ""}${fitBadge(o.score || 0)}</div>
        </div>
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          ${o.naics ? `<span>NAICS ${esc(o.naics)}</span>` : ""}
          ${o.type ? `<span>${esc(o.type)}</span>` : ""}
          ${o.setAside ? `<span class="font-medium text-cyan-700">${esc(o.setAside)}</span>` : ""}
          ${o.place ? `<span>${esc(o.place)}</span>` : ""}
          <span>${dueLabel(o.deadline)}</span>
        </div>
        ${o.why && o.why.length ? `<p class="mt-2 text-xs text-slate-500"><span class="font-medium text-slate-600">Why:</span> ${esc(o.why.join(" · "))}</p>` : ""}
        <div class="mt-4 flex flex-wrap gap-2">
          <a href="${esc(o.link)}" target="_blank" rel="noopener" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">View on ${esc(o.source || "SAM.gov")} ↗</a>
          <button data-prop="${i}" class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">Start a proposal</button>
          <button data-wf="${i}" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">Submission checklist</button>
          <button data-save="${i}" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">&#9733; Save to board</button>
          ${o.naics ? `<button data-intel="${i}" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">&#128202; Who's winning?</button>` : ""}
        </div>
        <div id="wf-${i}" class="mt-3 hidden rounded-xl bg-slate-50 p-4 text-sm text-slate-700"></div>
        <div id="intel-${i}" class="mt-3 hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"></div>
      </div>`).join("");
    $("results").querySelectorAll("[data-prop]").forEach((b) => b.addEventListener("click", () => openProposal(list[+b.dataset.prop])));
    $("results").querySelectorAll("[data-wf]").forEach((b) => b.addEventListener("click", () => toggleWorkflow(+b.dataset.wf, list[+b.dataset.wf])));
    $("results").querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", () => saveToBoard(list[+b.dataset.save], b)));
    $("results").querySelectorAll("[data-intel]").forEach((b) => b.addEventListener("click", () => toggleIntel(+b.dataset.intel, list[+b.dataset.intel])));
    wireSaChips(full);
  }

  function wireSaChips(full) {
    $("results").querySelectorAll("[data-sa]").forEach((b) => b.addEventListener("click", () => {
      const v = b.dataset.sa; if (saFilter.has(v)) saFilter.delete(v); else saFilter.add(v);
      renderResults(full);
    }));
    const clr = $("sa-clear"); if (clr) clr.addEventListener("click", () => { saFilter.clear(); renderResults(full); });
    const sub = $("alert-sub"); if (sub) sub.addEventListener("click", showAlertForm);
    const eq = $("equip-only"); if (eq) eq.addEventListener("change", () => { equipOnly = eq.checked; renderResults(full); });
    const ks = $("keystone-only"); if (ks) ks.addEventListener("change", () => { keystoneOnly = ks.checked; renderResults(full); });
  }

  // ---------- saved-search email alerts ----------
  function showAlertForm() {
    const host = $("alert-host"); if (!host) return;
    const term = lastSearch.query || lastSearch.vertical;
    host.innerHTML = `<span class="inline-flex items-center gap-1.5">
      <input id="alert-email" type="email" placeholder="you@org.com" class="w-44 rounded-lg border border-slate-300 px-2.5 py-1 text-xs focus:border-cyan-500 focus:outline-none" />
      <button id="alert-go" class="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-700">Notify me</button>
      <button id="alert-cancel" class="text-xs text-slate-400 hover:text-slate-600">✕</button></span>`;
    const email = $("alert-email"); if (email) email.focus();
    $("alert-cancel").addEventListener("click", () => { host.innerHTML = `<button id="alert-sub" class="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:border-cyan-400 hover:text-cyan-700">&#128276; Email me new matches</button>`; $("alert-sub").addEventListener("click", showAlertForm); });
    $("alert-go").addEventListener("click", async () => {
      const e = ($("alert-email").value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { $("alert-email").classList.add("border-red-400"); return; }
      $("alert-go").disabled = true; $("alert-go").textContent = "…";
      let d = {};
      try {
        const r = await fetch(FN_ALERTS, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify({ action: "subscribe", email: e, query: lastSearch.query, vertical: lastSearch.vertical }) });
        d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.error || "failed");
      } catch (err) { host.innerHTML = `<span class="text-xs text-red-600">Couldn't subscribe (${esc(err.message)})</span>`; return; }
      host.innerHTML = `<span class="text-xs font-medium text-emerald-700">&#10003; You'll get daily emails for "${esc(term)}"${d.configured === false ? " (email sending activates once Gmail is connected)" : ""}.</span>`;
    });
  }

  // ---------- bid board (pipeline) ----------
  function updateBoardCount() { const el = $("board-count"); if (el) el.textContent = boardEntries.length ? String(boardEntries.length) : ""; }
  async function refreshBoardCount() { const { ok, d } = await pipe({ action: "list" }); if (ok) { boardEntries = d.entries || []; if (d.stages) boardStages = d.stages; updateBoardCount(); } }
  async function loadBoard() { const { ok, d } = await pipe({ action: "list" }); if (ok) { boardEntries = d.entries || []; if (d.stages) boardStages = d.stages; } updateBoardCount(); renderBoard(); }
  async function saveToBoard(o, btn) {
    if (!o) return; const id = o.id || o.solicitation || o.title; if (!id) return;
    const orig = btn ? btn.innerHTML : ""; if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    const { ok } = await pipe({ action: "save", entry: { id: id, stage: "Identified", opportunity: o } });
    if (btn) { btn.disabled = false; btn.innerHTML = ok ? "✓ On board" : orig; }
    await refreshBoardCount();
  }
  function boardCard(e) {
    const o = e.opportunity || {};
    return `<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p class="text-sm font-semibold text-brand-900">${esc(o.title || e.id)}</p>
      <p class="mt-0.5 text-xs text-slate-500">${esc(o.agency || "")}${o.solicitation ? " · " + esc(o.solicitation) : ""}</p>
      <p class="mt-1 text-xs">${dueLabel(o.deadline)}</p>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <select data-stage="${esc(e.id)}" class="rounded border border-slate-300 px-1.5 py-1 text-xs">${boardStages.map((s) => `<option ${s === e.stage ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
        <button data-bprop="${esc(e.id)}" class="rounded bg-cyan-600 px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-700">Proposal</button>
        ${o.link ? `<a href="${esc(o.link)}" target="_blank" rel="noopener" class="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-slate-50">View</a>` : ""}
        <button data-brm="${esc(e.id)}" class="ml-auto rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove from board"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <textarea data-bnote="${esc(e.id)}" rows="1" placeholder="Notes…" class="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs">${esc(e.notes || "")}</textarea>
    </div>`;
  }
  function renderBoard() {
    const el = $("board-pane"); if (!el) return;
    const active = boardEntries.filter((e) => ["Identified", "Qualifying", "Drafting", "Submitted"].includes(e.stage));
    const soon = active.filter((e) => { const d = daysTo(e.opportunity && e.opportunity.deadline); return d != null && d >= 0 && d <= 7; }).length;
    const overdue = active.filter((e) => { const d = daysTo(e.opportunity && e.opportunity.deadline); return d != null && d < 0; }).length;
    const summary = `<div class="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <span class="font-semibold text-brand-900">${boardEntries.length} on the board</span>
      ${soon ? `<span class="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">${soon} closing in ≤ 7 days</span>` : ""}
      ${overdue ? `<span class="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">${overdue} past deadline</span>` : ""}
      <button id="board-refresh" class="ml-auto font-semibold text-cyan-700 hover:underline">↻ Refresh</button></div>`;
    if (!boardEntries.length) {
      el.innerHTML = summary + `<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No saved bids yet. On the <span class="font-semibold">Find &amp; bid</span> tab, search and click <span class="font-semibold">★ Save to board</span>.</div>`;
      wireBoard(); return;
    }
    const cols = boardStages.map((st) => {
      const items = boardEntries.filter((e) => e.stage === st);
      return `<div class="w-72 flex-none">
        <h3 class="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">${esc(st)} <span class="rounded-full bg-slate-100 px-2 text-xs">${items.length}</span></h3>
        <div class="space-y-2">${items.map(boardCard).join("") || `<div class="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">—</div>`}</div>
      </div>`;
    }).join("");
    el.innerHTML = summary + `<div class="flex gap-3 overflow-x-auto pb-2">${cols}</div>`;
    wireBoard();
  }
  function wireBoard() {
    const el = $("board-pane"); if (!el) return;
    const rf = $("board-refresh"); if (rf) rf.onclick = loadBoard;
    el.querySelectorAll("[data-stage]").forEach((s) => s.addEventListener("change", async () => { await pipe({ action: "update", id: s.dataset.stage, fields: { stage: s.value } }); await loadBoard(); }));
    el.querySelectorAll("[data-bprop]").forEach((b) => b.addEventListener("click", () => { const e = boardEntries.find((x) => x.id === b.dataset.bprop); if (e && e.opportunity) openProposal(e.opportunity); }));
    el.querySelectorAll("[data-brm]").forEach((b) => b.addEventListener("click", async () => { await pipe({ action: "remove", id: b.dataset.brm }); await loadBoard(); }));
    el.querySelectorAll("[data-bnote]").forEach((t) => t.addEventListener("blur", async () => { await pipe({ action: "update", id: t.dataset.bnote, fields: { notes: t.value } }); }));
  }
  function showTab(which) {
    const sp = $("search-pane"), bp = $("board-pane"), ts = $("tab-search"), tb = $("tab-board");
    const on = "govtab -mb-px border-b-2 border-cyan-600 px-4 py-2.5 text-sm font-semibold text-cyan-700";
    const off = "govtab -mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-cyan-700";
    if (which === "board") { sp.classList.add("hidden"); bp.classList.remove("hidden"); tb.className = on; ts.className = off; loadBoard(); }
    else { bp.classList.add("hidden"); sp.classList.remove("hidden"); ts.className = on; tb.className = off; }
  }

  function toggleWorkflow(i, o) {
    const el = $("wf-" + i);
    if (!el.classList.contains("hidden")) { el.classList.add("hidden"); return; }
    const steps = [
      "Confirm eligibility — NAICS, active SAM.gov registration, and set-aside status" + (o.setAside ? ` (${esc(o.setAside)})` : ""),
      "Download the solicitation & attachments from the opportunity link",
      "Capability statement + relevant past performance",
      "Pricing / cost proposal (with quotes from vertical partners)",
      "Reps &amp; certs and required compliance forms",
      `Submit via ${esc(o.source || "SAM.gov")} before the response deadline`,
    ];
    el.classList.remove("hidden");
    el.innerHTML = `<p class="font-semibold text-brand-900">Submission checklist</p><ol class="mt-2 list-decimal space-y-1.5 pl-5">${steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
  }

  // ---------- award intelligence (who's winning this NAICS) ----------
  async function toggleIntel(i, o) {
    const el = $("intel-" + i);
    if (!el.classList.contains("hidden")) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    el.innerHTML = `<div class="flex items-center gap-2 text-slate-500"><div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600"></div> Pulling recent awards for NAICS ${esc(o.naics)}…</div>`;
    let d = {};
    try {
      const r = await fetch(FN_INTEL, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify({ naics: o.naics, years: 3 }) });
      d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "unavailable");
    } catch (e) {
      el.innerHTML = `<p class="text-slate-500">Award data unavailable right now (${esc(e.message)}).</p>`;
      return;
    }
    if (!d.count) {
      el.innerHTML = `<p class="font-semibold text-brand-900">Award intelligence — NAICS ${esc(d.naics)}</p><p class="mt-1 text-slate-500">No federal contract awards found under this NAICS in the last ${d.window_years} years.</p>`;
      return;
    }
    const recips = (d.topRecipients || []).map((t) => `<li class="flex items-baseline justify-between gap-3"><span class="truncate">${esc(t.name)}</span><span class="flex-none font-semibold text-brand-900">${usd(t.total)}<span class="font-normal text-slate-400"> · ${t.count}</span></span></li>`).join("");
    const recent = (d.recent || []).slice(0, 5).map((a) => `<li class="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1"><span class="min-w-0 truncate">${esc(a.recipient)} <span class="text-slate-400">· ${esc(a.agency)}</span></span><span class="flex-none font-medium">${usd(a.amount)}</span></li>`).join("");
    el.innerHTML = `
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="font-semibold text-brand-900">Award intelligence — NAICS ${esc(d.naics)}</p>
        <p class="text-xs text-slate-400">Last ${d.window_years} yrs · source: ${esc(d.source)}</p>
      </div>
      <div class="mt-2 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg bg-white p-2.5 text-center ring-1 ring-slate-200"><div class="text-lg font-bold text-brand-900">${d.count}</div><div class="text-xs text-slate-500">recent awards</div></div>
        <div class="rounded-lg bg-white p-2.5 text-center ring-1 ring-slate-200"><div class="text-lg font-bold text-brand-900">${usd(d.median_award)}</div><div class="text-xs text-slate-500">median award</div></div>
        <div class="rounded-lg bg-white p-2.5 text-center ring-1 ring-slate-200"><div class="text-lg font-bold text-brand-900">${usd(d.total)}</div><div class="text-xs text-slate-500">total (top ${d.count})</div></div>
      </div>
      <div class="mt-3 grid gap-4 md:grid-cols-2">
        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Top recipients (incumbents)</p><ul class="mt-1.5 space-y-1">${recips}</ul></div>
        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent awards</p><ul class="mt-1.5 space-y-1">${recent}</ul></div>
      </div>
      <p class="mt-3 text-xs text-slate-400">Use this to size your bid, spot the incumbent, and decide bid/no-bid. Figures are federal contract awards under this NAICS.</p>`;
  }

  // ---------- proposal outline ----------
  // Volume sections (must match SECTIONS in backend/lib/proposal.js)
  const PROP_SECTIONS = [
    { key: "exec", title: "Cover Letter, Executive Summary & Understanding" },
    { key: "technical", title: "Technical Approach" },
    { key: "management", title: "Management, Schedule & Transition" },
    { key: "riskqa", title: "Risk Management & Quality Assurance" },
    { key: "pastperf", title: "Past Performance & Key Personnel" },
  ];
  let propOpp = null;
  let lastPackage = null; // { opp, parts, full, pageLimit, scopeUsed, matrix, scopeText, answers }
  let propAnswers = "";   // contractor-provided answers woven into the volumes

  function fillPartSelect(parts, full, matrixText) {
    const sel = $("prop-part");
    const opts = [{ name: "Full package", content: full }].concat(parts || []);
    if (matrixText) opts.push({ name: "Compliance Matrix", content: matrixText });
    sel.innerHTML = opts.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
    sel.onchange = () => { $("prop-text").value = opts[+sel.value].content; };
    sel.value = "0"; $("prop-text").value = opts[0].content;
  }
  async function propCall(payload) {
    const r = await fetch(FN_PROPOSAL, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify(Object.assign({ opportunity: propOpp }, payload)) });
    return r.json().catch(() => ({}));
  }
  async function generatePackage() {
    if (!propOpp) return;
    const regen = $("prop-regen"), prog = $("prop-progress");
    const pageLimit = parseInt($("prop-pages").value, 10) || 13;
    regen.disabled = true; $("prop-part").innerHTML = "";
    prog.textContent = "Reading the solicitation…";
    $("prop-text").value = "Generating a tailored proposal package — writing each volume to your page limit…";
    let scopeText = "", scopeUsed = false;
    try { const s = await propCall({ action: "scope" }); scopeText = (s && s.scopeText) || ""; scopeUsed = !!(s && s.scopeUsed); } catch (e) {}
    prog.textContent = "Writing all volume sections + compliance matrix…";
    // sections + compliance matrix in parallel (each call stays within the function timeout)
    const [secResults, matrixRows] = await Promise.all([
      Promise.all(PROP_SECTIONS.map((sec) =>
        propCall({ action: "section", section: sec.key, scopeText: scopeText, pageLimit: pageLimit, answers: propAnswers })
          .then((d) => ({ name: sec.title, content: (d && d.ok && d.content) ? d.content : `[${sec.title} unavailable — click Generate to retry.${d && d.error ? " " + d.error : ""}]` }))
          .catch(() => ({ name: sec.title, content: `[${sec.title} failed — retry.]` }))
      )),
      propCall({ action: "matrix", scopeText: scopeText }).then((d) => (d && d.ok && Array.isArray(d.rows)) ? d.rows : []).catch(() => []),
    ]);
    prog.textContent = "Adding Price volume & forms checklist…";
    let staticParts = [];
    try { const st = await propCall({ action: "static" }); if (st && st.ok) staticParts = [{ name: "Price (Vol III)", content: st.price }, { name: "Forms & Compliance Checklist", content: st.forms }]; } catch (e) {}

    const parts = secResults.map((p, i) => ({ name: `${i + 1}. ${p.name}`, content: p.content })).concat(staticParts);
    const header = `PROPOSAL PACKAGE — Digital Health International Inc.\nRE: ${propOpp.title || ""} — ${propOpp.agency || ""} (Sol. ${propOpp.solicitation || "—"})\nTarget length: ${pageLimit} pages. ${scopeUsed ? "Tailored to the live SAM.gov solicitation scope." : "Based on opportunity metadata (full solicitation text unavailable)."}\n` + "=".repeat(72);
    const full = [header, ""].concat(parts.map((p) => `\n========== ${p.name.toUpperCase()} ==========\n\n${p.content}`)).join("\n");
    fillPartSelect(parts, full, matrixRows && matrixRows.length ? matrixToText(matrixRows) : "");
    lastPackage = { opp: propOpp, parts: parts, full: full, pageLimit: pageLimit, scopeUsed: scopeUsed, matrix: matrixRows, scopeText: scopeText, answers: propAnswers };
    const zb = $("prop-zip"); if (zb) zb.disabled = false;
    renderMatrix();
    renderCompliance();
    prog.textContent = `Done · ${parts.length} documents` + (scopeUsed ? " · tailored to solicitation" : "");
    regen.disabled = false;
  }
  function openProposal(o) {
    propOpp = o;
    lastPackage = null;
    $("prop-copied").textContent = "";
    const zb = $("prop-zip"); if (zb) zb.disabled = true;
    const cp = $("prop-compliance"); if (cp) { cp.classList.add("hidden"); cp.innerHTML = ""; }
    const mx = $("prop-matrix"); if (mx) { mx.classList.add("hidden"); mx.innerHTML = ""; }
    propAnswers = "";
    const nd = $("prop-needs"); if (nd) { nd.classList.add("hidden"); nd.innerHTML = ""; }
    const nst = $("prop-needs-status"); if (nst) nst.textContent = "";
    $("prop-modal").classList.remove("hidden");
    generatePackage();
  }

  // ================= Submission package: compliance check + cataloged ZIP =====

  // --- compliance analysis (client-side; no fabrication, only flags gaps) ----
  function analyzeCompliance(pkg) {
    const F = [], opp = pkg.opp || {};
    const add = (level, doc, msg, fix) => F.push({ level, doc, msg, fix });
    const PH = /\[[^\]\n]*(TBD|PLACEHOLDER|INSERT|BRACKET|QTY|QUOTE|SUBTOTAL|TOTAL|client name|contract value|period of perform|reference|résumé|resume|name)[^\]\n]*\]/gi;
    let words = 0;
    pkg.parts.forEach((p) => {
      const c = p.content || "", isStatic = /^(Price|Forms)/i.test(p.name) || /Price \(Vol|Forms & Compliance/i.test(p.name);
      if (c.trim().startsWith("[") && /(unavailable|failed|retry|Generate to retry)/i.test(c)) {
        add("blocker", p.name, "This volume did not generate.", "Click Generate to retry, then re-check.");
        return;
      }
      if (!isStatic) {
        const phs = c.match(PH) || [];
        if (phs.length) {
          const uniq = [...new Set(phs.map((x) => x.trim()))].slice(0, 5);
          add(phs.length > 3 ? "blocker" : "warn", p.name,
            `${phs.length} placeholder${phs.length > 1 ? "s" : ""} to complete (e.g. ${uniq.map(esc).join(", ")}).`,
            "Replace every bracketed placeholder with real, verified content.");
        }
        words += c.trim().split(/\s+/).filter(Boolean).length;
      }
    });
    const estPages = Math.max(1, Math.ceil(words / 500));
    if (pkg.pageLimit && estPages > pkg.pageLimit) {
      add("warn", "Whole proposal", `Narrative is ~${estPages} pages vs the ${pkg.pageLimit}-page limit.`, "Trim content (or raise the limit) so the volume fits.");
    }
    const price = pkg.parts.find((p) => /^Price|Price \(Vol/i.test(p.name));
    if (price && /\[(QUOTE|SUBTOTAL|TOTAL|QTY)\]/.test(price.content)) {
      add("blocker", "Price (Vol III)", "Pricing still contains placeholder amounts.", "Insert partner quotes, quantities and totals mapped to the CLIN structure.");
    }
    const forms = pkg.parts.find((p) => /Forms/i.test(p.name));
    if (forms) { const un = (forms.content.match(/\[ \]/g) || []).length; if (un) add("warn", "Forms checklist", `${un} checklist item${un > 1 ? "s" : ""} not yet completed.`, "Work through each item before submitting."); }
    if (!opp.deadline) add("warn", "Submission", "No response deadline captured.", "Confirm the due date/time & method on the opportunity page.");
    if (!opp.solicitation) add("warn", "Submission", "No solicitation/notice ID captured.", "Confirm the solicitation number before submitting.");
    if (opp.setAside) add("info", "Eligibility", `Set-aside: ${esc(opp.setAside)}.`, "Attach proof of set-aside eligibility (SBA / VetCert / 8(a) / HUBZone).");
    add("info", "Registrations", "Active SAM.gov registration + Reps & Certs required.", "Verify UEI/CAGE active and Reps & Certs current in SAM.gov.");
    add("info", "Human review", "AI-assisted draft — must be reviewed by a person.", "A capture/contracts lead reviews every volume before submission.");
    const mx = (pkg.matrix || []).length;
    if (mx) add("info", "Compliance matrix", `${mx} requirements extracted (Section L / M / SOW).`, "Confirm each requirement is addressed in its mapped volume; matrix is in the package.");
    else add("warn", "Compliance matrix", "No requirements matrix generated.", "Click Generate to build the Section L/M compliance matrix.");
    if ((pkg.answers || "").trim()) add("info", "Bidder input", "Contractor-provided information was woven into the volumes.", "Verify the inserted specifics are accurate before submission.");
    return F;
  }

  function renderCompliance() {
    const el = $("prop-compliance"); if (!el || !lastPackage) return;
    const F = analyzeCompliance(lastPackage);
    lastPackage.findings = F;
    const nb = F.filter((f) => f.level === "blocker").length, nw = F.filter((f) => f.level === "warn").length;
    const banner = nb
      ? `<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Not ready to submit — ${nb} blocker${nb > 1 ? "s" : ""}${nw ? ` · ${nw} warning${nw > 1 ? "s" : ""}` : ""} to resolve.</div>`
      : nw
      ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">No blockers · ${nw} item${nw > 1 ? "s" : ""} to review before final human sign-off.</div>`
      : `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">No automated issues found — proceed to final human review.</div>`;
    const chip = (lv) => lv === "blocker" ? '<span class="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold uppercase text-red-700">Fix</span>'
      : lv === "warn" ? '<span class="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold uppercase text-amber-700">Review</span>'
      : '<span class="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold uppercase text-slate-600">Note</span>';
    const order = { blocker: 0, warn: 1, info: 2 };
    const rows = F.slice().sort((a, b) => order[a.level] - order[b.level]).map((f) =>
      `<li class="flex gap-2 py-1.5"><span class="mt-0.5 flex-none">${chip(f.level)}</span><span><span class="font-medium text-slate-700">${esc(f.doc)}:</span> ${f.msg} <span class="text-slate-400">— ${esc(f.fix)}</span></span></li>`).join("");
    el.innerHTML = `${banner}<ul class="mt-2 divide-y divide-slate-100 text-sm text-slate-600">${rows}</ul>`;
    el.classList.remove("hidden");
  }

  // --- requirements compliance matrix (Section L / M / SOW) ------------------
  function matrixToText(rows) {
    if (!rows || !rows.length) return "Compliance matrix unavailable — click Generate to retry.";
    return "REQUIREMENTS COMPLIANCE MATRIX\n" + "=".repeat(64) + "\n\n" +
      rows.map((r, i) => `${String(r.ref || ("R-" + (i + 1))).padEnd(8)} [${r.source || "SOW"}]  ${r.requirement}\n${" ".repeat(10)}→ ${r.volume}   |   ${r.compliance}`).join("\n\n");
  }
  function matrixToHtmlTable(rows) {
    return `<h2>Requirements Compliance Matrix</h2><table border="1" cellspacing="0" cellpadding="4"><tr><th>Ref</th><th>Source</th><th>Requirement</th><th>Addressed in</th><th>Compliance</th></tr>${rows.map((r) => `<tr><td>${esc(r.ref)}</td><td>${esc(r.source)}</td><td>${esc(r.requirement)}</td><td>${esc(r.volume)}</td><td>${esc(r.compliance)}</td></tr>`).join("")}</table>`;
  }
  function matrixToCsv(rows) {
    const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    return ["Ref,Source,Requirement,Addressed In,Compliance"].concat(rows.map((r) => [r.ref, r.source, r.requirement, r.volume, r.compliance].map(q).join(","))).join("\r\n");
  }
  function renderMatrix() {
    const el = $("prop-matrix"); if (!el) return;
    const rows = (lastPackage && lastPackage.matrix) || [];
    if (!rows.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
    el.innerHTML = `<details class="rounded-lg border border-slate-200 bg-white">
      <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-brand-900">Requirements compliance matrix — ${rows.length} requirements</summary>
      <div class="max-h-72 overflow-auto px-3 pb-3"><table class="w-full text-xs"><thead><tr class="text-left text-slate-400"><th class="py-1 pr-2">Ref</th><th class="pr-2">Src</th><th class="pr-2">Requirement</th><th class="pr-2">Volume</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr class="border-t border-slate-100 align-top"><td class="py-1 pr-2 font-mono">${esc(r.ref)}</td><td class="pr-2">${esc(r.source)}</td><td class="pr-2 text-slate-600">${esc(r.requirement)}</td><td class="pr-2 text-slate-500">${esc(r.volume)}</td><td class="text-slate-500">${esc(r.compliance)}</td></tr>`).join("")}</tbody></table></div></details>`;
    el.classList.remove("hidden");
  }

  // --- text/markdown → Word-openable HTML (.doc) -----------------------------
  function mdInline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+?)`/g, "<code>$1</code>"); }
  function mdToHtml(md) {
    const L = String(md).replace(/\r/g, "").split("\n"); const out = []; let i = 0;
    const isTbl = (s) => /^\s*\|.*\|\s*$/.test(s), isH = (s) => /^#{1,4}\s/.test(s), isUl = (s) => /^\s*[-*]\s+/.test(s), isOl = (s) => /^\s*\d+\.\s+/.test(s);
    while (i < L.length) {
      const ln = L[i];
      if (isTbl(ln)) {
        const t = []; while (i < L.length && isTbl(L[i])) { t.push(L[i]); i++; }
        const rows = t.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
        if (rows.length) out.push(`<table border="1" cellspacing="0" cellpadding="4"><tr>${rows[0].map((c) => `<th>${mdInline(c)}</th>`).join("")}</tr>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join("")}</tr>`).join("")}</table>`);
        continue;
      }
      if (isH(ln)) { const m = ln.match(/^(#{1,4})\s+(.*)$/); out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`); i++; continue; }
      if (isUl(ln)) { const it = []; while (i < L.length && isUl(L[i])) { it.push(L[i].replace(/^\s*[-*]\s+/, "")); i++; } out.push(`<ul>${it.map((x) => `<li>${mdInline(x)}</li>`).join("")}</ul>`); continue; }
      if (isOl(ln)) { const it = []; while (i < L.length && isOl(L[i])) { it.push(L[i].replace(/^\s*\d+\.\s+/, "")); i++; } out.push(`<ol>${it.map((x) => `<li>${mdInline(x)}</li>`).join("")}</ol>`); continue; }
      if (ln.trim() === "") { i++; continue; }
      const para = []; while (i < L.length && L[i].trim() !== "" && !isH(L[i]) && !isUl(L[i]) && !isOl(L[i]) && !isTbl(L[i])) { para.push(L[i]); i++; }
      out.push(`<p>${mdInline(para.join(" "))}</p>`);
    }
    return out.join("\n");
  }
  function wordDoc(title, bodyHtml) {
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.45;color:#111} h1{font-size:16pt} h2{font-size:13pt} h3{font-size:11.5pt} table{border-collapse:collapse;width:100%} td,th{border:1px solid #444;padding:4px 6px;font-size:10pt;text-align:left} pre{font-family:Consolas,'Courier New',monospace;font-size:10pt;white-space:pre-wrap}</style></head><body>${bodyHtml}</body></html>`;
  }
  const slug = (s) => String(s || "").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "opportunity";

  function buildFiles(pkg) {
    const opp = pkg.opp || {}, base = "DHI_Proposal_" + slug(opp.solicitation || opp.title);
    const enc = new TextEncoder(), files = [];
    const put = (name, str) => files.push({ name: base + "/" + name, data: enc.encode(str) });
    // numbering map for the narrative + static parts
    const names = [
      "01_Volume-I_Cover-Letter-Exec-Summary-Understanding.doc",
      "02_Volume-II_Technical-Approach.doc",
      "03_Volume-II_Management-Schedule-Transition.doc",
      "04_Volume-II_Risk-Management-and-QA.doc",
      "05_Volume-II_Past-Performance-Key-Personnel.doc",
    ];
    const findings = pkg.findings || analyzeCompliance(pkg);
    const hasMatrix = pkg.matrix && pkg.matrix.length;
    const hasAnswers = pkg.answers && pkg.answers.trim();
    // README / manifest
    const today = new Date().toLocaleString();
    const fileList = ["00_COMPLIANCE-REPORT.txt"].concat(hasMatrix ? ["00_Compliance-Matrix.doc"] : []).concat(hasAnswers ? ["00_Information-Provided.txt"] : []).concat(names).concat(["06_Volume-III_Price-Cost-Proposal.doc", "07_Forms-and-Compliance-Checklist.doc"]);
    put("00_README.txt", [
      "DHI PROPOSAL — SUBMISSION PACKAGE (DRAFT)",
      "=".repeat(56), "",
      `RE: ${opp.title || ""}`,
      `Agency:        ${opp.agency || "—"}`,
      `Solicitation:  ${opp.solicitation || "—"}`,
      `NAICS / Type:  ${opp.naics || "—"} / ${opp.type || "—"}`,
      `Set-aside:     ${opp.setAside || "Full & open"}`,
      `Deadline:      ${opp.deadline || "— (confirm on the opportunity page)"}`,
      `Generated:     ${today}`,
      `Tailored:      ${pkg.scopeUsed ? "Yes — to the live SAM.gov solicitation scope." : "From opportunity metadata (full text unavailable)."}`,
      "", "CONTENTS", "-".repeat(56),
      ...fileList.map((f) => "  " + f),
      "", "HOW TO SUBMIT", "-".repeat(56),
      "  1. Open 00_COMPLIANCE-REPORT.txt and resolve every [FIX] blocker;",
      "     review each [REVIEW] item.",
      "  2. Open each .doc in Microsoft Word; fill ALL [bracketed placeholders]",
      "     with real, verified content; finalize formatting & page limits.",
      "  3. Complete Vol III pricing with partner quotes and the CLIN structure.",
      "  4. Work the Forms & Compliance Checklist; attach required forms.",
      "  5. Submit via SAM.gov before the response deadline.",
      "", "DISCLAIMER", "-".repeat(56),
      "  AI-assisted draft grounded in DHI capability facts. It invents no",
      "  certifications, past performance, customers, or prices. A capture /",
      "  contracts lead must review and finalize every volume before submission.",
    ].join("\n"));
    // compliance report
    const sev = { blocker: "[FIX]   ", warn: "[REVIEW]", info: "[NOTE]  " };
    const nb = findings.filter((f) => f.level === "blocker").length, nw = findings.filter((f) => f.level === "warn").length;
    put("00_COMPLIANCE-REPORT.txt", [
      "PRE-SUBMISSION COMPLIANCE CHECK",
      "=".repeat(56), "",
      `Opportunity: ${opp.title || ""} (Sol. ${opp.solicitation || "—"})`,
      `Status: ${nb ? "NOT READY — " + nb + " blocker(s), " + nw + " warning(s)." : nw ? "No blockers — " + nw + " item(s) to review." : "No automated issues found."}`,
      `Checked: ${today}`, "",
      "FINDINGS (resolve [FIX] before submitting):", "-".repeat(56),
      ...["blocker", "warn", "info"].flatMap((lv) => findings.filter((f) => f.level === lv).map((f) => `${sev[lv]} ${f.doc}: ${f.msg}\n          ↳ ${f.fix}`)),
      "", "This automated check is a safety net, not a substitute for human review.",
    ].join("\n"));
    // compliance matrix → .doc table + .csv
    if (hasMatrix) {
      put("00_Compliance-Matrix.doc", wordDoc("Requirements Compliance Matrix", matrixToHtmlTable(pkg.matrix)));
      put("00_Compliance-Matrix.csv", matrixToCsv(pkg.matrix));
    }
    if (hasAnswers) put("00_Information-Provided.txt", "CONTRACTOR-PROVIDED INFORMATION\n" + "=".repeat(56) + "\n\n" + pkg.answers + "\n\n(These answers were woven into the volumes above — verify before submission.)");
    // narrative volumes → .doc
    pkg.parts.forEach((p, idx) => {
      if (idx < names.length) put(names[idx], wordDoc(p.name, mdToHtml(p.content)));
    });
    // static volumes (alignment-sensitive) → <pre> .doc
    const price = pkg.parts.find((p) => /Price/i.test(p.name));
    const forms = pkg.parts.find((p) => /Forms/i.test(p.name));
    if (price) put("06_Volume-III_Price-Cost-Proposal.doc", wordDoc("Price / Cost Proposal", `<pre>${esc(price.content)}</pre>`));
    if (forms) put("07_Forms-and-Compliance-Checklist.doc", wordDoc("Forms & Compliance Checklist", `<pre>${esc(forms.content)}</pre>`));
    return { files, base };
  }

  // --- minimal STORE-method ZIP writer (no deps) -----------------------------
  function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
  function zipStore(files) {
    const u16 = (n) => [n & 255, (n >> 8) & 255], u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    const chunks = [], central = []; let offset = 0; const DT = 0, DD = 0x21; // 1980-01-01
    files.forEach((f) => {
      const nameB = new TextEncoder().encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const local = u32(0x04034b50).concat(u16(20), u16(0), u16(0), u16(DT), u16(DD), u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0));
      chunks.push(new Uint8Array(local), nameB, f.data);
      central.push(new Uint8Array(u32(0x02014b50).concat(u16(20), u16(20), u16(0), u16(0), u16(DT), u16(DD), u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nameB);
      offset += local.length + nameB.length + sz;
    });
    const cStart = offset; let cSize = 0;
    central.forEach((c) => { chunks.push(c); cSize += c.length; });
    chunks.push(new Uint8Array(u32(0x06054b50).concat(u16(0), u16(0), u16(files.length), u16(files.length), u32(cSize), u32(cStart), u16(0))));
    let total = 0; chunks.forEach((c) => (total += c.length));
    const out = new Uint8Array(total); let p = 0; chunks.forEach((c) => { out.set(c, p); p += c.length; });
    return out;
  }
  function downloadPackage() {
    if (!lastPackage) return;
    if (!lastPackage.findings) renderCompliance();
    const { files, base } = buildFiles(lastPackage);
    const blob = new Blob([zipStore(files)], { type: "application/zip" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = base + ".zip"; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ---------- "what do you need from me?" — info-request gap-fill loop --------
  async function loadInfoRequests() {
    if (!propOpp) return;
    const btn = $("prop-needs-btn"), st = $("prop-needs-status");
    if (btn) btn.disabled = true; if (st) st.textContent = "Preparing your information request…";
    const scopeText = (lastPackage && lastPackage.scopeText) || "";
    let groups = [];
    try { const d = await propCall({ action: "questions", scopeText: scopeText }); if (d && d.ok && Array.isArray(d.groups)) groups = d.groups; } catch (e) {}
    renderNeeds(groups);
    if (btn) btn.disabled = false; if (st) st.textContent = "";
  }
  function renderNeeds(groups) {
    const el = $("prop-needs"); if (!el) return;
    if (!groups || !groups.length) { el.innerHTML = `<p class="text-sm text-slate-500">No additional information needed right now — generate the package first, or the AI already has what it needs.</p>`; el.classList.remove("hidden"); return; }
    el.innerHTML = `<div class="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
      <p class="text-sm font-semibold text-brand-900">To complete your bid, please provide:</p>
      <p class="mt-0.5 text-xs text-slate-500">The AI fills the rest. Leave blank anything you don't have yet — those stay as [placeholders] for later.</p>
      ${groups.map((g) => `<div class="mt-3"><p class="text-xs font-semibold uppercase tracking-wide text-cyan-700">${esc(g.category)}</p>
        <div class="mt-1.5 space-y-2">${g.items.map((it) => `<label class="block"><span class="text-sm text-slate-700">${esc(it.question)}</span>${it.hint ? `<span class="block text-xs text-slate-400">${esc(it.hint)}</span>` : ""}<textarea data-need="${esc(it.id)}" data-q="${esc(it.question)}" rows="1" class="g-in mt-1"></textarea></label>`).join("")}</div></div>`).join("")}
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button id="prop-needs-go" class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Complete my bid with these answers</button>
        <span id="prop-needs-go-status" class="text-sm text-slate-500"></span>
      </div></div>`;
    el.classList.remove("hidden");
    if (propAnswers) el.querySelectorAll("[data-need]").forEach((f) => { const blk = propAnswers.split("\n\n").find((b) => b.indexOf(f.dataset.q + "\n") === 0); if (blk) f.value = blk.split("\n→ ").slice(1).join("\n→ "); });
    const go = $("prop-needs-go"); if (go) go.addEventListener("click", completeBid);
  }
  async function completeBid() {
    const el = $("prop-needs"); if (!el) return;
    const answered = [...el.querySelectorAll("[data-need]")].filter((f) => f.value.trim());
    const gs = $("prop-needs-go-status");
    if (!answered.length) { if (gs) gs.textContent = "Enter at least one answer first."; return; }
    propAnswers = answered.map((f) => `${f.dataset.q}\n→ ${f.value.trim()}`).join("\n\n");
    if (gs) gs.textContent = "Completing your bid with your answers…";
    await generatePackage();
    if (gs) gs.textContent = `Done — ${answered.length} answer${answered.length > 1 ? "s" : ""} woven in. Review the updated volumes.`;
  }

  // ---------- wire up ----------
  function init() {
    if (secret) { showTool(); } // re-validates via verticals call; if 401, user can re-enter below
    $("gate-go").addEventListener("click", () => unlock($("gate-secret").value.trim()));
    $("gate-secret").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock($("gate-secret").value.trim()); });
    $("go").addEventListener("click", () => { const q = $("q").value.trim(); if (q) runSearch({ query: q }); });
    $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const q = $("q").value.trim(); if (q) runSearch({ query: q }); } });
    $("prop-close").addEventListener("click", () => $("prop-modal").classList.add("hidden"));
    $("prop-backdrop").addEventListener("click", () => $("prop-modal").classList.add("hidden"));
    $("prop-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("prop-text").value); $("prop-copied").textContent = "Copied"; } catch (e) { $("prop-copied").textContent = "Select & copy manually"; } });
    $("prop-regen").addEventListener("click", generatePackage);
    const pz = $("prop-zip"); if (pz) pz.addEventListener("click", downloadPackage);
    const pc = $("prop-check"); if (pc) pc.addEventListener("click", renderCompliance);
    const pbd = $("prop-board"); if (pbd) pbd.addEventListener("click", () => saveToBoard(propOpp, pbd));
    const pnb = $("prop-needs-btn"); if (pnb) pnb.addEventListener("click", loadInfoRequests);
    const ts = $("tab-search"); if (ts) ts.addEventListener("click", () => showTab("search"));
    const tbb = $("tab-board"); if (tbb) tbb.addEventListener("click", () => showTab("board"));
    const rb = $("refresh");
    if (rb) rb.addEventListener("click", async () => {
      const st = $("refresh-status"); st.textContent = "Refreshing from SAM.gov…"; rb.disabled = true;
      try {
        const r = await fetch(FN_REFRESH, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: "{}" });
        const d = await r.json().catch(() => ({}));
        st.textContent = r.ok && d.ok ? `Updated — ${d.count} opportunities cached.` : (d.error || "Refresh failed.");
      } catch (e) { st.textContent = "Refresh failed — try again."; }
      finally { rb.disabled = false; }
    });
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
