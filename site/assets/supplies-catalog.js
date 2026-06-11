/* =====================================================================
   Supplies, Textiles & Linens — client-side search, filter, and quote cart.
   Depends on supplies-data.js (SUPPLIES_PRODUCTS). Mounts into
   #scat-toolbar, #scat-grid, #squote-dock. Cart key: dhi_supplies_quote.
   Prices are intentionally hidden on the front end (quote-request model);
   the quote list routes to contact.html. Backend prices.json is unchanged.
   ===================================================================== */
(function () {
  const PRODUCTS = (typeof SUPPLIES_PRODUCTS !== "undefined" ? SUPPLIES_PRODUCTS : []).slice();
  const STORE = "dhi_supplies_quote";
  const grid = document.getElementById("scat-grid");
  const toolbar = document.getElementById("scat-toolbar");
  const dock = document.getElementById("squote-dock");
  if (!grid || !toolbar) return;

  const CATS = [...new Set(PRODUCTS.map((p) => p.cat))];
  let state = { q: "", cat: "All" };
  let cart = load();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE)) || [];
      return raw.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }));
    } catch (e) { return []; }
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(cart)); }
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const money = (n) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inCart = (id) => cart.some((l) => l.id === id);

  // Clean category illustrations for items without a product photo.
  // Drawn in a medical cyan palette; recognizable silhouette per category.
  function supplyArt(cat) {
    const st = "#0e7490", fl = "#cffafe", ac = "#0891b2", sf = "#e0f2fe";
    let body = "";
    const C = String(cat || "").toLowerCase();
    if (C.indexOf("drape") >= 0) {
      body = `<rect x="38" y="34" width="124" height="92" rx="6" fill="${fl}"/>
        <path d="M72 34V126M128 34V126" stroke="${ac}" opacity=".35"/>
        <ellipse cx="100" cy="82" rx="29" ry="19" fill="none" stroke="${ac}" stroke-dasharray="3 3"/>
        <ellipse cx="100" cy="82" rx="20" ry="12" fill="#fff" stroke="${st}"/>`;
    } else if (C.indexOf("coverall") >= 0) {
      body = `<ellipse cx="100" cy="34" rx="15" ry="14" fill="${sf}"/>
        <path d="M82 46h36l9 13-7 9-7-5v23h-30V63l-7 5-7-9z" fill="${fl}"/>
        <path d="M86 84h28v50h-11l-3-32-3 32H86z" fill="${fl}"/>
        <path d="M100 50V128" stroke="${ac}" stroke-dasharray="3 3"/>`;
    } else if (C.indexOf("mask") >= 0 || C.indexOf("respirator") >= 0) {
      body = `<path d="M58 64q-16 18 0 36" fill="none"/><path d="M142 64q16 18 0 36" fill="none"/>
        <rect x="58" y="58" width="84" height="46" rx="11" fill="${fl}"/>
        <path d="M76 58q24-9 48 0" fill="none"/>
        <path d="M58 72h84M58 81h84M58 90h84" stroke="${ac}" opacity=".5"/>`;
    } else if (C.indexOf("cap") >= 0 || C.indexOf("cover") >= 0) {
      body = `<path d="M50 98a50 42 0 0 1 100 0z" fill="${fl}"/>
        <path d="M50 98q50 20 100 0" fill="${sf}"/>
        <path d="M70 60q5 30 0 38M100 52v46M130 60q-5 30 0 38" fill="none" stroke="${ac}" opacity=".4"/>`;
    } else if (C.indexOf("scrub") >= 0) {
      body = `<path d="M64 56l-19 13 9 19 16-8" fill="${sf}"/><path d="M136 56l19 13-9 19-16-8" fill="${sf}"/>
        <path d="M64 52h72l7 78q-43 11-86 0z" fill="${fl}"/>
        <path d="M85 52l15 23 15-23" fill="#fff"/>
        <rect x="106" y="92" width="22" height="22" rx="2" fill="none" stroke="${ac}"/>`;
    } else if (C.indexOf("pack") >= 0) {
      body = `<rect x="44" y="44" width="112" height="78" rx="7" fill="${fl}"/>
        <path d="M44 50L100 86 156 50" fill="none"/>
        <path d="M44 116L100 84 156 116" fill="none" stroke="${ac}" opacity=".5"/>
        <rect x="88" y="38" width="24" height="13" rx="2" fill="${ac}"/>
        <rect x="86" y="92" width="28" height="22" rx="3" fill="#fff" stroke="${st}"/>
        <path d="M100 97v12M94 103h12" stroke="${st}"/>`;
    } else {
      // gowns / surgical gowns / default garment
      body = `<path d="M72 52L38 66q-4 2-2 6l6 21q1 4 5 2l26-12" fill="${sf}"/>
        <path d="M128 52l34 14q4 2 2 6l-6 21q-1 4-5 2l-26-12" fill="${sf}"/>
        <path d="M72 48q28-16 56 0l10 92q-38 12-76 0z" fill="${fl}"/>
        <path d="M88 49q12 11 24 0" fill="none"/>
        <path d="M100 60V132" stroke="${ac}" stroke-dasharray="3 4"/>`;
    }
    return `<svg viewBox="0 0 200 160" class="max-h-28 w-auto" style="height:7rem" fill="none" stroke="${st}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
  }

  toolbar.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="relative">
        <svg class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input id="scat-q" type="search" placeholder="Search ${PRODUCTS.length} products — gowns, masks, coveralls, SKU…" class="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none" />
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${["All", ...CATS].map((c) => {
          const n = c === "All" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c).length;
          return `<button data-cat="${c}" class="scat-pill rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors">${c} <span class="opacity-60">${n}</span></button>`;
        }).join("")}
        <span id="scat-count" class="ml-auto text-sm text-slate-500"></span>
      </div>
    </div>`;
  const qEl = document.getElementById("scat-q");
  const countEl = document.getElementById("scat-count");

  function pills() {
    toolbar.querySelectorAll(".scat-pill").forEach((b) => {
      const a = b.dataset.cat === state.cat;
      b.className = "scat-pill rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (a ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700");
    });
  }
  function filtered() {
    const terms = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return PRODUCTS.filter((p) => {
      if (state.cat !== "All" && p.cat !== state.cat) return false;
      if (terms.length) {
        const hay = (p.id + " " + p.t + " " + p.cat + " " + p.group + " " + (p.specs || "")).toLowerCase();
        return terms.every((t) => hay.includes(t));
      }
      return true;
    });
  }
  function card(p) {
    const added = inCart(p.id);
    return `<div class="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div class="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-50 p-2">${p.img ? `<img src="${p.img}" alt="${p.id}" loading="lazy" class="max-h-28 w-auto object-contain" />` : supplyArt(p.cat)}</div>
      <span class="inline-block w-max rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">${p.cat}</span>
      <h3 class="mt-1.5 text-sm font-semibold text-brand-900">${p.t}</h3>
      <p class="font-mono text-xs text-slate-400">${p.id}</p>
      ${p.specs ? `<p class="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">${p.specs}</p>` : '<div class="flex-1"></div>'}
      <div class="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-sm font-medium text-cyan-700">
        <svg class="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 7h6m-6 4h4m4 8l-3-3H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v12z"/></svg>
        Volume pricing on request
      </div>
      <button data-add="${encodeURIComponent(p.id)}" class="sadd-btn mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${added ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-cyan-600 text-white hover:bg-cyan-700"}">
        ${added ? '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg> Added to quote' : '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add to quote'}
      </button>
    </div>`;
  }
  function render() {
    const list = filtered();
    countEl.textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;
    grid.innerHTML = list.length ? list.map(card).join("") :
      `<div class="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No products match your search.</div>`;
  }
  function dockRender() {
    if (!dock) return;
    dock.innerHTML = `<button id="squote-toggle" class="flex items-center gap-2 rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/30 hover:bg-brand-800">
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.4 12.3a2 2 0 002 1.7h7.7a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
      Quote list <span class="ml-1 rounded-full bg-cyan-500 px-2 py-0.5 text-xs">${cart.length}</span></button>`;
    document.getElementById("squote-toggle").addEventListener("click", drawer);
  }
  function drawer() {
    if (document.getElementById("squote-drawer")) return;
    const items = cart.map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);
    const panel = document.createElement("div");
    panel.id = "squote-drawer";
    panel.className = "fixed inset-0 z-[60]";
    panel.innerHTML = `<div id="sqd-bd" class="absolute inset-0 bg-slate-900/50"></div>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 class="text-lg font-bold text-brand-900">Your quote list <span class="text-slate-400">(${items.length})</span></h2>
          <button id="sqd-x" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="flex-1 overflow-y-auto px-5 py-4">${items.length ? `<ul class="space-y-2">${items.map((l) => { const pl = l.p; return `
          <li class="rounded-lg border border-slate-200 p-3">
            <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-sm font-semibold text-brand-900">${pl.t}</p>
              <p class="font-mono text-xs text-slate-400">${l.id}</p></div>
              <button data-rm="${encodeURIComponent(l.id)}" class="srm flex-none rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 001 1h8a1 1 0 001-1V6"/></svg></button></div>
            <div class="mt-2 flex items-center justify-between">
              <div class="inline-flex items-center rounded-md border border-slate-300">
                <button data-dec="${encodeURIComponent(l.id)}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">−</button>
                <span class="px-3 text-sm font-semibold text-brand-900">${l.qty}</span>
                <button data-inc="${encodeURIComponent(l.id)}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">+</button>
              </div>
            </div>
          </li>`; }).join("")}</ul>` : `<p class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Your cart is empty.</p>`}</div>
        <div class="border-t border-slate-200 px-5 py-4">
          ${items.length ? `<p class="mb-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">${items.length} item${items.length === 1 ? "" : "s"} ready. We'll prepare a quote with volume pricing, taxes &amp; freight and send it to you.</p>` : ""}
          ${items.length ? `<a href="contact.html?interest=${encodeURIComponent("Supplies, Textiles & Linens")}" class="mb-2 block rounded-lg bg-cyan-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-cyan-700">Request a quote &rarr;</a>` : ""}
          ${items.length ? `<button id="sqd-clear" class="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Clear list</button>` : ""}
        </div></aside>`;
    document.body.appendChild(panel);
    const reopen = () => { close(); drawer(); };
    document.getElementById("sqd-x").onclick = close;
    document.getElementById("sqd-bd").onclick = close;
    panel.querySelectorAll(".srm").forEach((b) => b.addEventListener("click", () => { toggle(decodeURIComponent(b.dataset.rm)); render(); reopen(); }));
    panel.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => { setQty(decodeURIComponent(b.dataset.inc), 1); reopen(); }));
    panel.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { setQty(decodeURIComponent(b.dataset.dec), -1); reopen(); }));
    const c = document.getElementById("sqd-clear");
    if (c) c.onclick = () => { cart = []; save(); dockRender(); render(); close(); };
  }
  function close() { const p = document.getElementById("squote-drawer"); if (p) p.remove(); }
  function toggle(id) { const i = cart.findIndex((l) => l.id === id); if (i >= 0) cart.splice(i, 1); else cart.push({ id, qty: 1 }); save(); dockRender(); }
  function setQty(id, d) { const l = cart.find((x) => x.id === id); if (!l) return; l.qty = Math.max(1, (l.qty || 1) + d); save(); dockRender(); }

  let t;
  qEl.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = qEl.value; render(); }, 140); });
  toolbar.addEventListener("click", (e) => { const p = e.target.closest(".scat-pill"); if (!p) return; state.cat = p.dataset.cat; pills(); render(); });
  grid.addEventListener("click", (e) => { const a = e.target.closest(".sadd-btn"); if (a) { toggle(decodeURIComponent(a.dataset.add)); render(); } });

  pills(); render(); dockRender();
})();
