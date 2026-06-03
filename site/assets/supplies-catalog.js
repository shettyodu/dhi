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
      ${p.img ? `<div class="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-50 p-2"><img src="${p.img}" alt="${p.id}" loading="lazy" class="max-h-28 w-auto object-contain" /></div>` : ""}
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
