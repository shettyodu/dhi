/* =====================================================================
   Supplies, Textiles & Linens — Medline-style 3-level catalog.
   Hash-routed: #/ (category index) → #/c/<cat> (category) →
   #/p/<id> (product detail).  Depends on supplies-data.js
   (SUPPLIES_PRODUCTS). Mounts into #scat-search, #scat-app, #squote-dock.

   Pricing is QUOTE-FIRST, DUAL-MODE: list prices are hidden by default
   (SHOW_PRICES=false) and every item routes to a quote request. Flip
   SHOW_PRICES to true (or set localStorage dhi_supplies_prices="1") to
   reveal list prices on items that carry one — no other change needed.

   No manufacturer names or locations appear anywhere (business rule):
   sourcing is described only as "DHI-managed domestic & international
   facilities, with a wide choice of specifications and quality grades."
   ===================================================================== */
(function () {
  const PRODUCTS = (typeof SUPPLIES_PRODUCTS !== "undefined" ? SUPPLIES_PRODUCTS : []).slice();
  const SHOW_PRICES = (function () { try { return localStorage.getItem("dhi_supplies_prices") === "1"; } catch (e) { return false; } })();
  const STORE = "dhi_supplies_quote";
  const app = document.getElementById("scat-app");
  const searchBar = document.getElementById("scat-search");
  const dock = document.getElementById("squote-dock");
  if (!app) return;

  const SOURCING = "Produced at DHI-managed domestic & international facilities, with a wide choice of specifications and quality grades.";

  // ----- taxonomy (categories grouped into departments) --------------------
  const CAT_META = {
    "Surgical Gowns":      { blurb: "Sterile single-use surgeon, specialty & theatre gowns." },
    "Surgical Drapes":     { blurb: "Procedure-specific sterile drapes for every specialty." },
    "OT Packs":            { blurb: "Sterile single-use procedure packs, by specialty." },
    "Gowns":               { blurb: "Isolation & protective gowns, AAMI Level 1–4." },
    "Scrubs":              { blurb: "Disposable and reusable scrub sets." },
    "Coveralls":           { blurb: "Protective and reinforced coveralls." },
    "Covers & Caps":       { blurb: "Bouffants, head, shoe, boot & sleeve covers." },
    "Masks & Respirators": { blurb: "Type II / IIR masks and N95 / KN95 respirators." },
    "Safety / PPE Packs":  { blurb: "Bundled PPE and safety kits." },
    "Surgical Equipment Drapes": { blurb: "Sterile covers for microscopes, C-arms & instruments." },
    "OR Accessories":      { blurb: "Leggings, stockinette, tapes, table & Mayo covers." },
    "Gloves":              { blurb: "Disposable examination & procedure gloves." },
    "Face Shields & Eye Protection": { blurb: "Visors, goggles & mask-shields." },
    "Patient Kits & Bedding": { blurb: "Admission/visitor kits, blankets & pillows." },
    "Underpads":           { blurb: "Disposable underpads & training pads." },
    "Hand Sanitizer & Hygiene": { blurb: "Alcohol hand gel, wipes & dispensers." },
  };
  const DEPARTMENTS = [
    { name: "Surgical & OR", cats: ["Surgical Gowns", "Surgical Drapes", "OT Packs", "Surgical Equipment Drapes", "OR Accessories"] },
    { name: "Apparel & Protection", cats: ["Gowns", "Scrubs", "Coveralls", "Covers & Caps", "Gloves"] },
    { name: "Face & Respiratory", cats: ["Masks & Respirators", "Face Shields & Eye Protection"] },
    { name: "Patient Care", cats: ["Patient Kits & Bedding", "Underpads"] },
    { name: "Hygiene & Disinfection", cats: ["Hand Sanitizer & Hygiene"] },
    { name: "Safety & PPE Kits", cats: ["Safety / PPE Packs"] },
  ];
  const COMING_SOON = ["Surgical Instruments & Tools", "Wound Care & Dressings", "Textiles & Linens", "Exam Room Supplies", "Sterilization & Infection Prevention"];

  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const catCount = (c) => PRODUCTS.filter((p) => p.cat === c).length;
  const inCat = (c) => PRODUCTS.filter((p) => p.cat === c);
  const money = (n) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // ----- quote cart --------------------------------------------------------
  let cart = load();
  function load() {
    try { const raw = JSON.parse(localStorage.getItem(STORE)) || []; return raw.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 })); } catch (e) { return []; }
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(cart)); }
  const inCart = (id) => cart.some((l) => l.id === id);
  function toggle(id) { const i = cart.findIndex((l) => l.id === id); if (i >= 0) cart.splice(i, 1); else cart.push({ id, qty: 1 }); save(); dockRender(); }
  function setQty(id, d) { const l = cart.find((x) => x.id === id); if (!l) return; l.qty = Math.max(1, (l.qty || 1) + d); save(); dockRender(); }

  // ----- category illustrations (for items / categories without a photo) ---
  function supplyArt(cat, cls) {
    const st = "#0e7490", fl = "#cffafe", ac = "#0891b2", sf = "#e0f2fe";
    let body = "";
    const C = String(cat || "").toLowerCase();
    if (C.indexOf("drape") >= 0) {
      body = `<rect x="38" y="34" width="124" height="92" rx="6" fill="${fl}"/><path d="M72 34V126M128 34V126" stroke="${ac}" opacity=".35"/><ellipse cx="100" cy="82" rx="29" ry="19" fill="none" stroke="${ac}" stroke-dasharray="3 3"/><ellipse cx="100" cy="82" rx="20" ry="12" fill="#fff" stroke="${st}"/>`;
    } else if (C.indexOf("coverall") >= 0) {
      body = `<ellipse cx="100" cy="34" rx="15" ry="14" fill="${sf}"/><path d="M82 46h36l9 13-7 9-7-5v23h-30V63l-7 5-7-9z" fill="${fl}"/><path d="M86 84h28v50h-11l-3-32-3 32H86z" fill="${fl}"/><path d="M100 50V128" stroke="${ac}" stroke-dasharray="3 3"/>`;
    } else if (C.indexOf("shield") >= 0 || C.indexOf("eye protection") >= 0) {
      body = `<rect x="56" y="52" width="88" height="12" rx="6" fill="${sf}"/><path d="M58 64q42 14 84 0l-7 52q-35 15 -70 0z" fill="${fl}" opacity=".75" stroke="${st}"/><path d="M78 78q22 8 44 0" stroke="${ac}" opacity=".5" fill="none"/>`;
    } else if (C.indexOf("mask") >= 0 || C.indexOf("respirator") >= 0 || C.indexOf("face") >= 0) {
      body = `<path d="M58 64q-16 18 0 36" fill="none"/><path d="M142 64q16 18 0 36" fill="none"/><rect x="58" y="58" width="84" height="46" rx="11" fill="${fl}"/><path d="M76 58q24-9 48 0" fill="none"/><path d="M58 72h84M58 81h84M58 90h84" stroke="${ac}" opacity=".5"/>`;
    } else if (C.indexOf("cap") >= 0 || C.indexOf("cover") >= 0) {
      body = `<path d="M50 98a50 42 0 0 1 100 0z" fill="${fl}"/><path d="M50 98q50 20 100 0" fill="${sf}"/><path d="M70 60q5 30 0 38M100 52v46M130 60q-5 30 0 38" fill="none" stroke="${ac}" opacity=".4"/>`;
    } else if (C.indexOf("scrub") >= 0) {
      body = `<path d="M64 56l-19 13 9 19 16-8" fill="${sf}"/><path d="M136 56l19 13-9 19-16-8" fill="${sf}"/><path d="M64 52h72l7 78q-43 11-86 0z" fill="${fl}"/><path d="M85 52l15 23 15-23" fill="#fff"/><rect x="106" y="92" width="22" height="22" rx="2" fill="none" stroke="${ac}"/>`;
    } else if (C.indexOf("pack") >= 0 || C.indexOf("kit") >= 0 || C.indexOf("accessor") >= 0) {
      body = `<rect x="44" y="44" width="112" height="78" rx="7" fill="${fl}"/><path d="M44 50L100 86 156 50" fill="none"/><path d="M44 116L100 84 156 116" fill="none" stroke="${ac}" opacity=".5"/><rect x="88" y="38" width="24" height="13" rx="2" fill="${ac}"/><rect x="86" y="92" width="28" height="22" rx="3" fill="#fff" stroke="${st}"/><path d="M100 97v12M94 103h12" stroke="${st}"/>`;
    } else if (C.indexOf("tool") >= 0 || C.indexOf("instrument") >= 0) {
      body = `<path d="M70 40l18 18-30 64-10-4 22-60-10-10z" fill="${fl}"/><circle cx="132" cy="56" r="14" fill="none" stroke="${st}"/><circle cx="150" cy="74" r="14" fill="none" stroke="${st}"/><path d="M124 64l-44 60-10-4 44-60z" fill="${sf}"/>`;
    } else if (C.indexOf("wound") >= 0 || C.indexOf("dressing") >= 0) {
      body = `<rect x="48" y="60" width="104" height="44" rx="8" fill="${fl}" transform="rotate(-12 100 82)"/><rect x="84" y="74" width="32" height="16" rx="3" fill="#fff" stroke="${st}" transform="rotate(-12 100 82)"/><path d="M70 70l8 6M122 88l8 6" stroke="${ac}"/>`;
    } else if (C.indexOf("textile") >= 0 || C.indexOf("linen") >= 0 || C.indexOf("pad") >= 0 || C.indexOf("bedding") >= 0) {
      body = `<path d="M46 56q14-10 28 0t28 0 28 0 24 0v66q-14 8-26 0t-28 0-28 0-26 0z" fill="${fl}"/><path d="M46 78q27 10 108 0M46 100q27 10 108 0" stroke="${ac}" opacity=".4" fill="none"/>`;
    } else if (C.indexOf("sanitiz") >= 0 || C.indexOf("hygiene") >= 0) {
      body = `<rect x="82" y="62" width="36" height="60" rx="6" fill="${fl}"/><rect x="90" y="50" width="20" height="14" rx="3" fill="${sf}"/><path d="M86 44h22l-5 7h-12z" fill="${ac}"/><rect x="108" y="45" width="14" height="5" rx="2" fill="${ac}"/><rect x="88" y="82" width="24" height="26" rx="2" fill="#fff" stroke="${st}"/><path d="M100 90v10M95 95h10" stroke="${ac}"/>`;
    } else if (C.indexOf("glove") >= 0) {
      body = `<path d="M78 120V74q0-6 6-6t6 6v-8q0-6 6-6t6 6v6q0-6 6-6t6 6v6q0-5 6-5t6 5v34q0 18-16 18z" fill="${fl}"/><path d="M84 70v18M96 64v22M108 64v22M120 70v18" stroke="${ac}" opacity=".4"/>`;
    } else if (C.indexOf("exam") >= 0) {
      body = `<rect x="44" y="74" width="112" height="20" rx="4" fill="${fl}"/><rect x="58" y="58" width="84" height="18" rx="4" fill="${sf}"/><path d="M44 94v26M156 94v26M44 108h112" stroke="${ac}" opacity=".5"/>`;
    } else {
      body = `<path d="M72 52L38 66q-4 2-2 6l6 21q1 4 5 2l26-12" fill="${sf}"/><path d="M128 52l34 14q4 2 2 6l-6 21q-1 4-5 2l-26-12" fill="${sf}"/><path d="M72 48q28-16 56 0l10 92q-38 12-76 0z" fill="${fl}"/><path d="M88 49q12 11 24 0" fill="none"/><path d="M100 60V132" stroke="${ac}" stroke-dasharray="3 4"/>`;
    }
    return `<svg viewBox="0 0 200 160" class="${cls || "w-auto"}" fill="none" stroke="${st}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
  }
  function media(p, boxCls, imgCls, artCls) {
    const inner = p.img ? `<img src="${esc(p.img)}" alt="${esc(p.id)}" loading="lazy" class="${imgCls}" />` : supplyArt(p.cat, artCls);
    return `<div class="${boxCls}">${inner}</div>`;
  }
  function catArt(cat, boxCls, artCls) {
    const withPhoto = inCat(cat).find((p) => p.img);
    const inner = withPhoto ? `<img src="${esc(withPhoto.img)}" alt="${esc(cat)}" loading="lazy" class="${artCls}" />` : supplyArt(cat, artCls);
    return `<div class="${boxCls}">${inner}</div>`;
  }

  // ----- pricing display (dual-mode) ---------------------------------------
  function priceTag(p) {
    if (SHOW_PRICES && p.p != null) return `<span class="text-sm font-bold text-brand-900">${money(p.p)}</span><span class="text-xs text-slate-400"> / ${esc(p.unit || "each")}</span>`;
    return `<span class="inline-flex items-center gap-1 text-sm font-medium text-cyan-700"><svg class="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 7h6m-6 4h4m4 8l-3-3H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v12z"/></svg>Volume pricing on request</span>`;
  }
  function addBtn(p) {
    const a = inCart(p.id);
    return `<button data-add="${encodeURIComponent(p.id)}" class="sadd-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${a ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-cyan-600 text-white hover:bg-cyan-700"}">${a ? '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg> Added to quote' : '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add to quote'}</button>`;
  }

  // ----- search bar (persistent) -------------------------------------------
  function renderSearch() {
    if (!searchBar) return;
    searchBar.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="relative">
          <svg class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input id="scat-q" type="search" placeholder="Search ${PRODUCTS.length}+ products — gowns, drapes, packs, masks, SKU…" class="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none" />
        </div>
      </div>`;
    const q = document.getElementById("scat-q");
    let t;
    q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { const v = q.value.trim(); location.hash = v ? "#/search/" + encodeURIComponent(v) : "#/"; }, 200); });
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = q.value.trim(); location.hash = v ? "#/search/" + encodeURIComponent(v) : "#/"; } });
  }

  // ----- breadcrumb --------------------------------------------------------
  function crumb(parts) {
    return `<nav class="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">${parts.map((p, i) =>
      (i ? '<span class="text-slate-300">/</span>' : "") + (p.href ? `<a href="${p.href}" class="hover:text-cyan-700">${esc(p.label)}</a>` : `<span class="text-slate-700">${esc(p.label)}</span>`)).join("")}</nav>`;
  }

  // ----- VIEW: category index ----------------------------------------------
  function viewIndex() {
    const depts = DEPARTMENTS.map((d) => `
      <section class="mt-8 first:mt-2">
        <h2 class="font-display text-lg font-bold text-brand-900">${esc(d.name)}</h2>
        <div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${d.cats.map((c) => `
            <a href="#/c/${encodeURIComponent(c)}" class="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              ${catArt(c, "flex h-20 w-24 flex-none items-center justify-center rounded-lg bg-slate-50 p-1", "max-h-16 w-auto object-contain")}
              <div class="min-w-0">
                <h3 class="font-semibold text-brand-900 group-hover:text-cyan-700">${esc(c)}</h3>
                <p class="mt-0.5 text-xs leading-snug text-slate-500">${esc((CAT_META[c] || {}).blurb || "")}</p>
                <p class="mt-1 text-xs font-medium text-cyan-700">${catCount(c)} product${catCount(c) === 1 ? "" : "s"} →</p>
              </div>
            </a>`).join("")}
        </div>
      </section>`).join("");
    const soon = `
      <section class="mt-10">
        <h2 class="font-display text-lg font-bold text-slate-500">More categories — coming soon</h2>
        <p class="mt-1 text-sm text-slate-500">We're expanding to 40+ categories. New lines are added as catalogs and photography are finalized.</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${COMING_SOON.map((c) => `
            <div class="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
              ${supplyArt(c, "h-10 w-12 flex-none opacity-50")}
              <div><h3 class="text-sm font-medium text-slate-500">${esc(c)}</h3><p class="text-xs text-slate-400">Coming soon</p></div>
            </div>`).join("")}
        </div>
      </section>`;
    app.innerHTML = `
      <p class="mt-4 flex items-start gap-2 text-sm text-slate-500">
        <svg class="mt-0.5 h-4 w-4 flex-none text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span><strong class="font-semibold text-brand-900">Pick a category</strong> to see every product we offer in that area, then add items to your quote list. ${esc(SOURCING)}</span>
      </p>
      ${depts}${soon}
      <div class="mt-10 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm text-slate-600">
        <p class="font-semibold text-brand-900">Preferred Vendor Program</p>
        <p class="mt-1">Volume &amp; bulk pricing, plus custom-design and private-label options for qualifying orders. Pricing, applicable taxes &amp; freight are provided with your quote.</p>
      </div>`;
  }

  // ----- VIEW: category (products, sub-grouped) ----------------------------
  function viewCategory(cat) {
    if (!CAT_META[cat] && !catCount(cat)) return viewIndex();
    const list = inCat(cat);
    const groups = [...new Set(list.map((p) => p.group || "Products"))];
    const sections = groups.map((g) => {
      const items = list.filter((p) => (p.group || "Products") === g);
      return `
        <div class="mt-6 first:mt-3">
          ${groups.length > 1 ? `<h3 class="text-sm font-semibold uppercase tracking-wide text-slate-400">${esc(g)}</h3>` : ""}
          <div class="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            ${items.map(productCard).join("")}
          </div>
        </div>`;
    }).join("");
    app.innerHTML = `
      ${crumb([{ label: "Catalog", href: "#/" }, { label: cat }])}
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-2xl font-bold text-brand-900">${esc(cat)}</h1>
          <p class="mt-1 text-sm text-slate-500">${esc((CAT_META[cat] || {}).blurb || "")} · ${list.length} product${list.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      ${sections}`;
  }
  function productCard(p) {
    return `<a href="#/p/${encodeURIComponent(p.id)}" class="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      ${media(p, "mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-50 p-2", "max-h-28 w-auto object-contain", "max-h-28 w-auto")}
      <h3 class="text-sm font-semibold text-brand-900 group-hover:text-cyan-700">${esc(p.t)}</h3>
      <p class="font-mono text-xs text-slate-400">${esc(p.id)}</p>
      ${p.specs ? `<p class="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">${esc(p.specs)}</p>` : '<div class="flex-1"></div>'}
      <div class="mt-3 border-t border-slate-100 pt-3">${priceTag(p)}</div>
      <span class="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700">View &amp; add to quote →</span>
    </a>`;
  }

  // ----- VIEW: product detail (with variations placeholder) ----------------
  function viewProduct(id) {
    const p = byId[id];
    if (!p) return viewIndex();
    const related = inCat(p.cat).filter((x) => x.id !== p.id).slice(0, 4);
    const specRows = (p.specs || "").split("·").map((s) => s.trim()).filter(Boolean);
    app.innerHTML = `
      ${crumb([{ label: "Catalog", href: "#/" }, { label: p.cat, href: "#/c/" + encodeURIComponent(p.cat) }, { label: p.t }])}
      <div class="grid gap-8 lg:grid-cols-2">
        ${media(p, "flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6", "max-h-60 w-auto object-contain", "max-h-60 w-auto")}
        <div>
          <span class="inline-block rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">${esc(p.cat)}</span>
          <h1 class="mt-2 font-display text-2xl font-bold text-brand-900">${esc(p.t)}</h1>
          <p class="mt-1 font-mono text-sm text-slate-400">SKU ${esc(p.id)}</p>
          <div class="mt-4">${priceTag(p)}</div>
          ${specRows.length ? `<dl class="mt-5 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            ${specRows.map((s) => `<div class="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2"><svg class="mt-0.5 h-4 w-4 flex-none text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg><span class="text-slate-600">${esc(s)}</span></div>`).join("")}
          </dl>` : ""}
          <div class="mt-5 rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-semibold text-brand-900">Sizes, grades &amp; configurations</p>
            <p class="mt-1 text-sm text-slate-500">Available in multiple sizes, fabrics, and quality grades. Tell us your specification on the quote and we'll match it — custom-design, sterile/non-sterile, and bulk options available.</p>
          </div>
          <div class="mt-5 flex flex-wrap items-center gap-3">
            ${addBtn(p)}
            <button id="sp-quote" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Request a quote →</button>
          </div>
          <p class="mt-4 text-xs leading-relaxed text-slate-400">${esc(SOURCING)} Pricing, applicable taxes &amp; freight are provided with your quote.</p>
        </div>
      </div>
      ${related.length ? `<section class="mt-12">
        <h2 class="font-display text-lg font-bold text-brand-900">More in ${esc(p.cat)}</h2>
        <div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${related.map(productCard).join("")}</div>
      </section>` : ""}`;
    const qb = document.getElementById("sp-quote");
    if (qb) qb.addEventListener("click", () => { if (!inCart(p.id)) toggle(p.id); openDrawer(); });
  }

  // ----- VIEW: search results ----------------------------------------------
  function viewSearch(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = PRODUCTS.filter((p) => { const hay = (p.id + " " + p.t + " " + p.cat + " " + p.group + " " + (p.specs || "")).toLowerCase(); return terms.every((t) => hay.includes(t)); });
    app.innerHTML = `
      ${crumb([{ label: "Catalog", href: "#/" }, { label: "Search" }])}
      <h1 class="font-display text-xl font-bold text-brand-900">${list.length} result${list.length === 1 ? "" : "s"} for "${esc(q)}"</h1>
      ${list.length ? `<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${list.map(productCard).join("")}</div>`
        : `<div class="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No products match. <a href="#/" class="font-semibold text-cyan-700">Browse all categories →</a></div>`}`;
    const q2 = document.getElementById("scat-q"); if (q2 && q2.value !== q) q2.value = q;
  }

  // ----- quote dock + drawer (persistent) ----------------------------------
  function dockRender() {
    if (!dock) return;
    dock.innerHTML = `<button id="squote-toggle" class="flex items-center gap-2 rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/30 hover:bg-brand-800">
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.4 12.3a2 2 0 002 1.7h7.7a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
      Quote list <span class="ml-1 rounded-full bg-cyan-500 px-2 py-0.5 text-xs">${cart.length}</span></button>`;
    document.getElementById("squote-toggle").addEventListener("click", openDrawer);
  }
  function openDrawer() {
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
            <div class="flex items-start justify-between gap-3"><div class="min-w-0"><a href="#/p/${encodeURIComponent(l.id)}" class="text-sm font-semibold text-brand-900 hover:text-cyan-700">${esc(pl.t)}</a>
              <p class="font-mono text-xs text-slate-400">${esc(l.id)}</p></div>
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
    const reopen = () => { closeDrawer(); openDrawer(); };
    document.getElementById("sqd-x").onclick = closeDrawer;
    document.getElementById("sqd-bd").onclick = closeDrawer;
    panel.querySelectorAll(".srm").forEach((b) => b.addEventListener("click", () => { toggle(decodeURIComponent(b.dataset.rm)); rerender(); reopen(); }));
    panel.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => { setQty(decodeURIComponent(b.dataset.inc), 1); reopen(); }));
    panel.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { setQty(decodeURIComponent(b.dataset.dec), -1); reopen(); }));
    panel.querySelectorAll('a[href^="#/"]').forEach((a) => a.addEventListener("click", closeDrawer));
    const c = document.getElementById("sqd-clear");
    if (c) c.onclick = () => { cart = []; save(); dockRender(); rerender(); closeDrawer(); };
  }
  function closeDrawer() { const p = document.getElementById("squote-drawer"); if (p) p.remove(); }

  // ----- router ------------------------------------------------------------
  function rerender() { route(); }
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    if (h.startsWith("c/")) viewCategory(decodeURIComponent(h.slice(2)));
    else if (h.startsWith("p/")) viewProduct(decodeURIComponent(h.slice(2)));
    else if (h.startsWith("search/")) viewSearch(decodeURIComponent(h.slice(7)));
    else viewIndex();
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  }

  // add-to-quote (event delegation across all views)
  app.addEventListener("click", (e) => {
    const a = e.target.closest(".sadd-btn");
    if (a) { e.preventDefault(); toggle(decodeURIComponent(a.dataset.add)); route(); }
  });

  window.addEventListener("hashchange", route);
  renderSearch();
  dockRender();
  route();
})();
