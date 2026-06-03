/* =====================================================================
   Keystone product catalog — client-side search, filter, and quote cart.
   Depends on catalog-data.js (KEYSTONE_PRODUCTS) and components.js (icon).
   Mounts into #catalog-toolbar, #catalog-grid, and #quote-dock.
   Pricing is quote-based (B2B), so "purchase" = add to a Quote Request.
   ===================================================================== */
(function () {
  // Existing Keystone catalog + any additional suppliers (kept in a separate
  // data file so suppliers' products are never co-mingled in source).
  const PRODUCTS = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);
  const CATS = ["Lamps", "Fixtures", "Power Supplies", "Controls"];
  const DEFAULT_SUPPLIER = "Keystone Technologies";
  const sup = (p) => p.supplier || DEFAULT_SUPPLIER; // products carry their own supplier; legacy = Keystone
  const PAGE = 48; // items rendered per "page"
  const STORE = "dhi_keystone_quote";

  const grid = document.getElementById("catalog-grid");
  const toolbar = document.getElementById("catalog-toolbar");
  const dock = document.getElementById("quote-dock");
  if (!grid || !toolbar) return;

  // ---- state ----
  let state = { q: "", cat: "All", family: "", supplier: "", sort: "rel", shown: PAGE };

  function money(n) {
    return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // Returns {txt, note} for a product's price.
  function priceLabel(p) {
    if (p.p == null) return { txt: "Request quote", note: "pricing on request", quote: true };
    if (p.pr) return { txt: money(p.p) + " – " + money(p.pr), note: "per unit · range" };
    if (p.pf) return { txt: "From " + money(p.p), note: "per unit" };
    return { txt: money(p.p), note: "per unit" };
  }
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE)) || [];
      // migrate legacy string[] -> [{id, qty}]
      return raw.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }));
    } catch (e) { return []; }
  }
  function saveCart() { localStorage.setItem(STORE, JSON.stringify(cart)); }
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  // ---- toolbar UI ----
  const catCounts = CATS.map((c) => ({ c, n: PRODUCTS.filter((p) => p.cat === c).length }));
  toolbar.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <svg class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input id="cat-q" type="search" placeholder="Search 1,497 items — catalog #, type, wattage, CCT, base…"
            class="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none" />
        </div>
        <select id="cat-family" class="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none lg:w-56"></select>
        <select id="cat-supplier" class="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none lg:w-48"></select>
        <select id="cat-sort" class="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none lg:w-48">
          <option value="rel">Sort: Relevance</option>
          <option value="plh">Price: low to high</option>
          <option value="phl">Price: high to low</option>
          <option value="az">Catalog # A–Z</option>
        </select>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${["All", ...CATS].map((c) => {
          const n = c === "All" ? PRODUCTS.length : (catCounts.find((x) => x.c === c) || {}).n;
          return `<button data-cat="${c}" class="cat-pill rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors">${c} <span class="opacity-60">${n}</span></button>`;
        }).join("")}
        <span id="cat-count" class="ml-auto text-sm text-slate-500"></span>
      </div>
    </div>`;

  const qEl = document.getElementById("cat-q");
  const familyEl = document.getElementById("cat-family");
  const supplierEl = document.getElementById("cat-supplier");
  const countEl = document.getElementById("cat-count");

  function refreshPills() {
    toolbar.querySelectorAll(".cat-pill").forEach((b) => {
      const active = b.dataset.cat === state.cat;
      b.className =
        "cat-pill rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "border-cyan-600 bg-cyan-600 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700");
    });
  }

  function refreshFamilies() {
    const pool = state.cat === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === state.cat);
    const fams = [...new Set(pool.map((p) => p.group).filter(Boolean))].sort();
    familyEl.innerHTML =
      `<option value="">All product families (${fams.length})</option>` +
      fams.map((f) => `<option value="${f.replace(/"/g, "&quot;")}">${f}</option>`).join("");
    if (![...familyEl.options].some((o) => o.value === state.family)) state.family = "";
    familyEl.value = state.family;
  }

  function refreshSuppliers() {
    // Suppliers within the current category context; products stay siloed by supplier.
    const pool = state.cat === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === state.cat);
    const sups = [...new Set(pool.map(sup).filter(Boolean))].sort();
    supplierEl.innerHTML =
      `<option value="">All suppliers (${sups.length})</option>` +
      sups.map((s) => `<option value="${s.replace(/"/g, "&quot;")}">${s}</option>`).join("");
    if (![...supplierEl.options].some((o) => o.value === state.supplier)) state.supplier = "";
    supplierEl.value = state.supplier;
  }

  // ---- filtering ----
  function filtered() {
    const q = state.q.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const list = PRODUCTS.filter((p) => {
      if (state.cat !== "All" && p.cat !== state.cat) return false;
      if (state.family && p.group !== state.family) return false;
      if (state.supplier && sup(p) !== state.supplier) return false;
      if (terms.length) {
        const hay = (p.id + " " + p.group + " " + p.specs + " " + p.cct + " " + p.base + " " + p.cat + " " + sup(p)).toLowerCase();
        return terms.every((t) => hay.includes(t));
      }
      return true;
    });
    if (state.sort === "az") {
      list.sort((a, b) => a.id.localeCompare(b.id));
    } else if (state.sort === "plh" || state.sort === "phl") {
      const dir = state.sort === "plh" ? 1 : -1;
      // priced items first (sorted by price), quote-only items last
      list.sort((a, b) => {
        const ap = a.p == null, bp = b.p == null;
        if (ap && bp) return 0;
        if (ap) return 1;
        if (bp) return -1;
        return (a.p - b.p) * dir;
      });
    }
    return list;
  }

  function badge(text, cls) {
    return `<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}">${text}</span>`;
  }

  function card(p) {
    const inCart = cart.some((l) => l.id === p.id);
    const pl = priceLabel(p);
    const badges = [
      p.w && badge(p.w, "bg-amber-100 text-amber-800"),
      p.lm && badge(p.lm + " lm", "bg-cyan-100 text-cyan-800"),
      p.cct && badge(p.cct, "bg-brand-100 text-brand-800"),
      p.base && badge("Base " + p.base, "bg-slate-100 text-slate-700"),
      p.len && badge(p.len, "bg-slate-100 text-slate-700"),
    ].filter(Boolean).join(" ");
    return `
      <div class="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        ${p.img ? `<div class="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-50 p-2"><img src="${p.img}" alt="${p.id}" loading="lazy" class="max-h-28 w-auto object-contain" /></div>` : ""}
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="inline-block rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">${p.cat}</span>
            <h3 class="mt-1.5 font-mono text-sm font-bold text-brand-900 break-all">${p.id}</h3>
          </div>
        </div>
        ${p.group ? `<p class="mt-1 text-xs font-medium text-slate-500">${p.group}</p>` : ""}
        <p class="mt-1 text-[11px] text-slate-400">by <span class="font-medium text-slate-500">${sup(p)}</span></p>
        ${badges ? `<div class="mt-2.5 flex flex-wrap gap-1.5">${badges}</div>` : ""}
        <p class="mt-2.5 flex-1 text-xs leading-relaxed text-slate-500">${p.specs}</p>
        <div class="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
          <span class="font-display text-lg font-bold ${pl.quote ? "text-slate-400" : "text-brand-900"}">${pl.txt}</span>
          <span class="text-[11px] text-slate-400">${pl.note}</span>
        </div>
        <button data-add="${p.id}" class="add-btn mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          inCart
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : "bg-cyan-600 text-white hover:bg-cyan-700"
        }">
          ${inCart
            ? '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg> Added to quote'
            : '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add to quote'}
        </button>
      </div>`;
  }

  function render() {
    const list = filtered();
    countEl.textContent = `${list.length.toLocaleString()} item${list.length === 1 ? "" : "s"}`;
    const slice = list.slice(0, state.shown);
    if (!list.length) {
      grid.innerHTML = `<div class="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No items match your search. Try a different catalog number, wattage, or type.</div>`;
      return;
    }
    grid.innerHTML =
      slice.map(card).join("") +
      (list.length > state.shown
        ? `<div class="col-span-full mt-2 text-center"><button id="load-more" class="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-brand-800 hover:border-cyan-400 hover:text-cyan-700">Load more (${(list.length - state.shown).toLocaleString()} remaining)</button></div>`
        : `<div class="col-span-full mt-2 text-center text-sm text-slate-400">End of results — ${list.length.toLocaleString()} items</div>`);
  }

  // ---- quote dock ----
  function renderDock() {
    if (!dock) return;
    const n = cart.length;
    dock.innerHTML = `
      <button id="quote-toggle" class="flex items-center gap-2 rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/30 hover:bg-brand-800">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.4 12.3a2 2 0 002 1.7h7.7a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
        Quote list <span class="ml-1 rounded-full bg-cyan-500 px-2 py-0.5 text-xs">${n}</span>
      </button>`;
    document.getElementById("quote-toggle").addEventListener("click", openDrawer);
  }

  function openDrawer() {
    let panel = document.getElementById("quote-drawer");
    if (panel) return; // already open
    panel = document.createElement("div");
    panel.id = "quote-drawer";
    panel.className = "fixed inset-0 z-[60]";
    const items = cart.map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);
    const pricedLines = items.filter((l) => l.p.p != null);
    const sub = pricedLines.reduce((s, l) => s + l.p.p * l.qty, 0);
    const quoteOnly = items.length - pricedLines.length;
    const approx = pricedLines.some((l) => l.p.pf || l.p.pr);
    panel.innerHTML = `
      <div id="qd-backdrop" class="absolute inset-0 bg-slate-900/50"></div>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 class="text-lg font-bold text-brand-900">Your cart <span class="text-slate-400">(${items.length})</span></h2>
          <button id="qd-close" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4">
          ${items.length
            ? `<ul class="space-y-2">${items.map((l) => { const pl = priceLabel(l.p); return `
                <li class="rounded-lg border border-slate-200 p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0"><p class="font-mono text-sm font-semibold text-brand-900 break-all">${l.id}</p>
                    <p class="text-xs text-slate-500">${l.p.cat}${l.p.group ? " · " + l.p.group : ""}</p>
                    <p class="mt-0.5 text-sm font-semibold ${pl.quote ? "text-slate-400" : "text-cyan-700"}">${pl.txt}</p></div>
                    <button data-rm="${l.id}" class="rm-btn flex-none rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 001 1h8a1 1 0 001-1V6"/></svg></button>
                  </div>
                  <div class="mt-2 flex items-center justify-between">
                    <div class="inline-flex items-center rounded-md border border-slate-300">
                      <button data-dec="${l.id}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">−</button>
                      <span class="px-3 text-sm font-semibold text-brand-900">${l.qty}</span>
                      <button data-inc="${l.id}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">+</button>
                    </div>
                    ${l.p.p != null ? `<span class="text-sm font-semibold text-brand-900">${money(l.p.p * l.qty)}</span>` : `<span class="text-xs text-slate-400">quote item</span>`}
                  </div>
                </li>`; }).join("")}</ul>`
            : `<p class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Your cart is empty. Browse the catalog and click <strong>Add to quote</strong>.</p>`}
        </div>
        <div class="border-t border-slate-200 px-5 py-4">
          ${items.length ? `<div class="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div class="flex items-center justify-between"><span class="text-slate-600">Subtotal${approx ? "*" : ""}</span><span class="font-display text-lg font-bold text-brand-900">${money(sub)}</span></div>
              <p class="mt-1 text-xs text-slate-400">${pricedLines.length} priced item${pricedLines.length === 1 ? "" : "s"}${quoteOnly ? ` · ${quoteOnly} quote-only` : ""}${approx ? " · *from/range pricing" : ""} · excl. tax &amp; freight</p>
            </div>` : ""}
          ${pricedLines.length ? `<a href="checkout.html" class="mb-2 block rounded-lg bg-cyan-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-cyan-700">Proceed to checkout &rarr;</a>` : ""}
          ${items.length ? `<div class="mb-2 flex gap-2">
            <a id="qd-email" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-brand-800 hover:bg-slate-50">Email list</a>
            <button id="qd-clear" class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Clear</button>
          </div>` : ""}
          <a href="contact.html?interest=${encodeURIComponent("Lighting & Energy Efficiency")}" class="block text-center text-xs text-slate-500 hover:text-cyan-700">or request a formal quote &rarr;</a>
        </div>
      </aside>`;
    document.body.appendChild(panel);
    const reopen = () => { closeDrawer(); openDrawer(); };
    document.getElementById("qd-close").onclick = closeDrawer;
    document.getElementById("qd-backdrop").onclick = closeDrawer;
    panel.querySelectorAll(".rm-btn").forEach((b) =>
      b.addEventListener("click", () => { toggle(b.dataset.rm); render(); reopen(); }));
    panel.querySelectorAll("[data-inc]").forEach((b) =>
      b.addEventListener("click", () => { setQty(b.dataset.inc, 1); reopen(); }));
    panel.querySelectorAll("[data-dec]").forEach((b) =>
      b.addEventListener("click", () => { setQty(b.dataset.dec, -1); reopen(); }));
    const clear = document.getElementById("qd-clear");
    if (clear) clear.onclick = () => { cart = []; saveCart(); renderDock(); render(); reopen(); };
    const email = document.getElementById("qd-email");
    if (email) {
      const body = "Keystone quote request — please confirm pricing and lead times:%0D%0A%0D%0A" +
        items.map((l, i) => `${i + 1}. ${l.qty} x ${l.id}  (${l.p.cat})  ${priceLabel(l.p).txt}`).join("%0D%0A");
      email.href = `mailto:steve@digitalhealthinternational.com?subject=Keystone%20Lighting%20Quote%20Request&body=${body}`;
    }
  }
  function closeDrawer() {
    const p = document.getElementById("quote-drawer");
    if (p) p.remove();
  }

  function toggle(id) {
    const i = cart.findIndex((l) => l.id === id);
    if (i >= 0) cart.splice(i, 1);
    else cart.push({ id, qty: 1 });
    saveCart();
    renderDock();
  }

  function setQty(id, delta) {
    const l = cart.find((x) => x.id === id);
    if (!l) return;
    l.qty = Math.max(1, (l.qty || 1) + delta);
    saveCart();
    renderDock();
  }

  // ---- events ----
  let t;
  qEl.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = qEl.value; state.shown = PAGE; render(); }, 140);
  });
  familyEl.addEventListener("change", () => { state.family = familyEl.value; state.shown = PAGE; render(); });
  supplierEl.addEventListener("change", () => { state.supplier = supplierEl.value; state.shown = PAGE; render(); });
  document.getElementById("cat-sort").addEventListener("change", (e) => { state.sort = e.target.value; state.shown = PAGE; render(); });
  toolbar.addEventListener("click", (e) => {
    const pill = e.target.closest(".cat-pill");
    if (!pill) return;
    state.cat = pill.dataset.cat;
    state.family = "";
    state.supplier = "";
    state.shown = PAGE;
    refreshPills();
    refreshFamilies();
    refreshSuppliers();
    render();
  });
  grid.addEventListener("click", (e) => {
    const add = e.target.closest(".add-btn");
    if (add) { toggle(add.dataset.add); render(); return; }
    if (e.target.id === "load-more") { state.shown += PAGE; render(); }
  });

  // deep link: ?q=... or ?cat=...
  const params = new URLSearchParams(location.search);
  if (params.get("q")) { state.q = params.get("q"); qEl.value = state.q; }
  if (params.get("cat") && ["All", ...CATS].includes(params.get("cat"))) state.cat = params.get("cat");
  // affiliate attribution: capture an influencer referral code and keep it for checkout
  const ref = params.get("ref");
  if (ref) { try { localStorage.setItem("dhi_lighting_ref", ref.slice(0, 64)); } catch (e) {} }

  // ---- init ----
  refreshPills();
  refreshFamilies();
  refreshSuppliers();
  render();
  renderDock();
})();
