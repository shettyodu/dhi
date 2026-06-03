/* =====================================================================
   Nutrition & Supplements — search, filter, quote cart + checkout hand-off.
   Depends on nutrition-data.js (NUTRITION_PRODUCTS). Mounts into
   #ncat-toolbar, #ncat-grid, #nquote-dock. Cart key: dhi_nutrition_quote.
   Proceeds to the shared checkout via checkout.html?cart=nutrition.
   ===================================================================== */
(function () {
  const PRODUCTS = (typeof NUTRITION_PRODUCTS !== "undefined" ? NUTRITION_PRODUCTS : []).slice();
  const STORE = "dhi_nutrition_quote";
  const grid = document.getElementById("ncat-grid");
  const toolbar = document.getElementById("ncat-toolbar");
  const dock = document.getElementById("nquote-dock");
  if (!grid || !toolbar) return;

  const CATS = [...new Set(PRODUCTS.map((p) => p.cat))].sort();
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const byTitle = Object.fromEntries(PRODUCTS.map((p) => [p.t, p]));
  let state = { q: "", cat: "All" };
  let cart = load();
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE)) || [];
      // migrate legacy [title] or [id] strings -> [{id, qty}]
      return raw.map((x) => {
        if (typeof x === "string") {
          if (byId[x]) return { id: x, qty: 1 };
          if (byTitle[x]) return { id: byTitle[x].id, qty: 1 };
          return null;
        }
        return { id: x.id, qty: x.qty || 1 };
      }).filter((l) => l && byId[l.id]);
    } catch (e) { return []; }
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(cart)); }
  const money = (n) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inCart = (id) => cart.some((l) => l.id === id);

  toolbar.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="relative">
        <svg class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input id="ncat-q" type="search" placeholder="Search ${PRODUCTS.length} products — name, type, kit…" class="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none" />
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${["All", ...CATS].map((c) => {
          const n = c === "All" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c).length;
          return `<button data-cat="${c}" class="ncat-pill rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors">${c} <span class="opacity-60">${n}</span></button>`;
        }).join("")}
        <span id="ncat-count" class="ml-auto text-sm text-slate-500"></span>
      </div>
    </div>`;
  const qEl = document.getElementById("ncat-q");
  const countEl = document.getElementById("ncat-count");

  function pills() {
    toolbar.querySelectorAll(".ncat-pill").forEach((b) => {
      const a = b.dataset.cat === state.cat;
      b.className = "ncat-pill rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (a ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700");
    });
  }
  function filtered() {
    const terms = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return PRODUCTS.filter((p) => {
      if (state.cat !== "All" && p.cat !== state.cat) return false;
      if (terms.length) {
        const hay = (p.t + " " + p.cat + " " + (p.d || "")).toLowerCase();
        return terms.every((t) => hay.includes(t));
      }
      return true;
    });
  }
  function card(p) {
    const added = inCart(p.id);
    return `<div class="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <span class="inline-block w-max rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">${p.cat}</span>
      <h3 class="mt-2 font-semibold text-brand-900">${p.t}</h3>
      ${p.d ? `<p class="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">${p.d}</p>` : '<div class="flex-1"></div>'}
      <div class="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
        <span class="font-bold ${p.p == null ? "text-slate-400" : "text-brand-900"} text-lg">${p.p == null ? "Request quote" : money(p.p)}</span>
        <span class="text-[11px] text-slate-400">${p.p == null ? "pricing on request" : "list price"}</span>
      </div>
      <button data-add="${encodeURIComponent(p.id)}" class="nadd-btn mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${added ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-emerald-600 text-white hover:bg-emerald-700"}">
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
    dock.innerHTML = `<button id="nquote-toggle" class="flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-600">
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.4 12.3a2 2 0 002 1.7h7.7a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
      Quote list <span class="ml-1 rounded-full bg-emerald-400 px-2 py-0.5 text-xs">${cart.length}</span></button>`;
    document.getElementById("nquote-toggle").addEventListener("click", drawer);
  }
  function drawer() {
    if (document.getElementById("nquote-drawer")) return;
    const items = cart.map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);
    const pricedLines = items.filter((l) => l.p.p != null);
    const sub = pricedLines.reduce((s, l) => s + l.p.p * l.qty, 0);
    const quoteOnly = items.length - pricedLines.length;
    const panel = document.createElement("div");
    panel.id = "nquote-drawer";
    panel.className = "fixed inset-0 z-[60]";
    panel.innerHTML = `<div id="nqd-bd" class="absolute inset-0 bg-slate-900/50"></div>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 class="text-lg font-bold text-brand-900">Your cart <span class="text-slate-400">(${items.length})</span></h2>
          <button id="nqd-x" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="flex-1 overflow-y-auto px-5 py-4">${items.length ? `<ul class="space-y-2">${items.map((l) => { const pl = l.p; return `
          <li class="rounded-lg border border-slate-200 p-3">
            <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-sm font-semibold text-brand-900">${pl.t}</p>
              <p class="text-xs text-slate-500">${pl.cat}</p>
              <p class="mt-0.5 text-sm font-semibold ${pl.p == null ? "text-slate-400" : "text-emerald-700"}">${pl.p == null ? "Request quote" : money(pl.p)}</p></div>
              <button data-rm="${encodeURIComponent(l.id)}" class="nrm flex-none rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 001 1h8a1 1 0 001-1V6"/></svg></button></div>
            <div class="mt-2 flex items-center justify-between">
              <div class="inline-flex items-center rounded-md border border-slate-300">
                <button data-dec="${encodeURIComponent(l.id)}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">−</button>
                <span class="px-3 text-sm font-semibold text-brand-900">${l.qty}</span>
                <button data-inc="${encodeURIComponent(l.id)}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">+</button>
              </div>
              ${pl.p != null ? `<span class="text-sm font-semibold text-brand-900">${money(pl.p * l.qty)}</span>` : `<span class="text-xs text-slate-400">quote item</span>`}
            </div>
          </li>`; }).join("")}</ul>` : `<p class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Your cart is empty.</p>`}</div>
        <div class="border-t border-slate-200 px-5 py-4">
          ${items.length ? `<div class="mb-3 rounded-lg bg-slate-50 p-3 text-sm"><div class="flex items-center justify-between"><span class="text-slate-600">Subtotal</span><span class="text-lg font-bold text-brand-900">${money(sub)}</span></div>
            <p class="mt-1 text-xs text-slate-400">${pricedLines.length} priced${quoteOnly ? ` · ${quoteOnly} on request` : ""} · excl. tax &amp; shipping</p></div>` : ""}
          ${pricedLines.length ? `<a href="checkout.html?cart=nutrition" class="mb-2 block rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700">Proceed to checkout &rarr;</a>` : ""}
          ${items.length ? `<button id="nqd-clear" class="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Clear list</button>` : ""}
          <a href="contact.html?interest=${encodeURIComponent("Nutrition & Supplements")}" class="block text-center text-xs text-slate-500 hover:text-emerald-700">or request a formal quote &rarr;</a>
        </div></aside>`;
    document.body.appendChild(panel);
    const reopen = () => { close(); drawer(); };
    document.getElementById("nqd-x").onclick = close;
    document.getElementById("nqd-bd").onclick = close;
    panel.querySelectorAll(".nrm").forEach((b) => b.addEventListener("click", () => { toggle(decodeURIComponent(b.dataset.rm)); render(); reopen(); }));
    panel.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => { setQty(decodeURIComponent(b.dataset.inc), 1); reopen(); }));
    panel.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { setQty(decodeURIComponent(b.dataset.dec), -1); reopen(); }));
    const c = document.getElementById("nqd-clear");
    if (c) c.onclick = () => { cart = []; save(); dockRender(); render(); close(); };
  }
  function close() { const p = document.getElementById("nquote-drawer"); if (p) p.remove(); }
  function toggle(id) { const i = cart.findIndex((l) => l.id === id); if (i >= 0) cart.splice(i, 1); else cart.push({ id, qty: 1 }); save(); dockRender(); }
  function setQty(id, d) { const l = cart.find((x) => x.id === id); if (!l) return; l.qty = Math.max(1, (l.qty || 1) + d); save(); dockRender(); }

  let t;
  qEl.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = qEl.value; render(); }, 140); });
  toolbar.addEventListener("click", (e) => { const p = e.target.closest(".ncat-pill"); if (!p) return; state.cat = p.dataset.cat; pills(); render(); });
  grid.addEventListener("click", (e) => { const a = e.target.closest(".nadd-btn"); if (a) { toggle(decodeURIComponent(a.dataset.add)); render(); } });

  pills(); render(); dockRender();
})();
