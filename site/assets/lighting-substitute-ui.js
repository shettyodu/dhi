/* =====================================================================
   Substitution UI — wires LightingSub into the catalog. Click "Out of stock?
   Find alternatives" on any fixture/lamp card to see ranked compliant
   substitutes in a modal, with spec-match chips + add-to-quote.
   Depends on lighting-substitute.js, catalog-data.js, catalog-suppliers-data.js.
   ===================================================================== */
(function () {
  const grid = document.getElementById("catalog-grid");
  if (!grid || !window.LightingSub) return;

  const PRODUCTS = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  LightingSub.configure(PRODUCTS);
  const STORE = "dhi_keystone_quote";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const priceTxt = (p) => (p.p == null ? "Request quote" : money(p.p));

  function addToQuote(id, qty) {
    let cart = [];
    try { cart = (JSON.parse(localStorage.getItem(STORE)) || []).map((x) => (typeof x === "string" ? { id: x, qty: 1 } : x)); } catch (e) {}
    const l = cart.find((x) => x.id === id);
    if (l) l.qty = (l.qty || 1) + (qty || 1); else cart.push({ id, qty: qty || 1 });
    localStorage.setItem(STORE, JSON.stringify(cart));
    window.dispatchEvent(new Event("dhi-cart-changed"));   // catalog re-syncs dock + cards
  }

  const TIER = {
    compliant: { label: "Compliant", cls: "bg-emerald-100 text-emerald-800" },
    candidate: { label: "Candidate", cls: "bg-amber-100 text-amber-800" },
    differs: { label: "Check specs", cls: "bg-slate-100 text-slate-600" },
  };
  const STOCK = {
    in: { label: "In stock", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    check: { label: "Check availability", cls: "bg-slate-50 text-slate-600 ring-slate-200" },
    out: { label: "Out of stock", cls: "bg-red-50 text-red-700 ring-red-200" },
  };

  function chip(c) {
    return `<span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${c.ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}">${c.ok ? "✓" : "✗"} ${esc(c.k)}: ${esc(c.v)}</span>`;
  }

  function rowHtml(r) {
    const t = TIER[r.tier] || TIER.differs;
    const st = STOCK[r.stock] || STOCK.check;
    const chips = r.chips && r.chips.length
      ? `<div class="mt-1.5 flex flex-wrap gap-1">${r.chips.map(chip).join("")}</div>`
      : `<p class="mt-1.5 text-[11px] italic text-slate-400">Type match — verify lumen output &amp; CCT on the spec sheet.</p>`;
    return `
      <div class="rounded-xl border border-slate-200 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${t.cls}">${t.label}</span>
              <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${st.cls}">${st.label}</span>
            </div>
            <h4 class="mt-1 font-mono text-sm font-bold text-brand-900 break-all">${esc(r.id)}</h4>
            <p class="text-[11px] text-slate-500">${esc(r.supplier)}${r.group ? " · " + esc(r.group) : ""}</p>
          </div>
          <div class="flex-none text-right">
            <div class="font-display text-sm font-bold ${r.price == null ? "text-slate-400" : "text-brand-900"}">${priceTxt({ p: r.price })}</div>
          </div>
        </div>
        ${chips}
        <div class="mt-2 flex justify-end">
          <button data-subadd="${esc(r.id)}" class="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">Add alternative to quote</button>
        </div>
      </div>`;
  }

  function openModal(id) {
    const base = byId[id];
    if (!base) return;
    LightingSub.setStock(id, "out");                       // demo: the picked SKU is flagged out of stock
    const res = LightingSub.find(id, { n: 6 });
    LightingSub.clearStock();
    const modal = document.createElement("div");
    modal.id = "sub-modal";
    modal.className = "fixed inset-0 z-[80] flex items-center justify-center p-4";
    const chipsBase = [base.w && `${esc(base.w)}`, base.lm && `${esc(base.lm)} lm`, base.cct && `${esc(base.cct)}`].filter(Boolean).join(" · ");
    modal.innerHTML = `
      <div data-close class="absolute inset-0 bg-slate-900/50"></div>
      <div role="dialog" aria-modal="true" class="relative flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wide text-red-600">Flagged out of stock</p>
            <h3 class="mt-0.5 font-mono text-sm font-bold text-brand-900 break-all">${esc(base.id)}</h3>
            <p class="text-xs text-slate-500">${esc((base.supplier) || "Keystone Technologies")}${base.group ? " · " + esc(base.group) : ""}${chipsBase ? " · " + chipsBase : ""}</p>
          </div>
          <button data-close class="flex-none rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-500">Compliant alternatives — matched on <strong class="text-slate-700">fixture type, lumens, CCT &amp; voltage</strong>, in-stock preferred.</div>
        <div class="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          ${res.results.length ? res.results.map(rowHtml).join("") : `<p class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No same-type alternatives found in the catalog.</p>`}
        </div>
        <div class="border-t border-slate-200 px-5 py-3 text-[11px] leading-relaxed text-slate-400">
          <strong class="text-slate-500">How to read this:</strong> “Compliant” = published-spec compatibility (type, lumens, CCT, voltage) — a sourcing aid, confirm against the project spec sheet, not a photometric certification. <strong class="text-slate-500">Stock status is illustrative</strong> until Wesco's live inventory feed is connected.
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    modal.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    modal.querySelectorAll("[data-subadd]").forEach((b) => b.addEventListener("click", () => {
      addToQuote(b.getAttribute("data-subadd"), 1);
      b.textContent = "Added ✓";
      b.className = "rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200";
    }));
  }

  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".sub-btn");
    if (!b) return;
    e.preventDefault();
    openModal(b.getAttribute("data-sub"));
  });
})();
