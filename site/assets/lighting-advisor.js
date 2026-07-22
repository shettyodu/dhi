/* =====================================================================
   AI Lighting Advisor — front-end.
   Talks to /.netlify/functions/lighting-advisor, renders recommendations as
   add-to-quote cards (looked up in the client catalog for trusted specs/price),
   and shares the same quote cart as the catalog (dhi_keystone_quote).
   Depends on catalog-data.js (KEYSTONE_PRODUCTS), catalog-suppliers-data.js
   (EXTRA_LIGHTING_PRODUCTS), sku-photo.js (optional), components.js.
   ===================================================================== */
(function () {
  const PRODUCTS = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const byIdLower = Object.fromEntries(PRODUCTS.map((p) => [p.id.toLowerCase(), p]));
  const STORE = "dhi_keystone_quote";
  const DEFAULT_SUPPLIER = "Keystone Technologies";
  const sup = (p) => (p && p.supplier) || DEFAULT_SUPPLIER;

  const log = document.getElementById("adv-log");
  const form = document.getElementById("adv-form");
  const input = document.getElementById("adv-input");
  const sendBtn = document.getElementById("adv-send");
  const chipsEl = document.getElementById("adv-chips");
  const resetBtn = document.getElementById("adv-reset");
  const cartEl = document.getElementById("adv-cart");
  const cartCountEl = document.getElementById("adv-cart-count");
  const cartActions = document.getElementById("adv-cart-actions");
  const brandsEl = document.getElementById("adv-brands");
  if (!log || !form) return;

  // API base: ?api=… or a saved base, else same-origin (production).
  const API_BASE = (new URLSearchParams(location.search).get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const ENDPOINT = API_BASE + "/.netlify/functions/lighting-advisor";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function priceLabel(p) {
    if (!p || p.p == null) return { txt: "Request quote", quote: true };
    if (p.pr) return { txt: money(p.p) + " – " + money(p.pr), quote: false };
    if (p.pf) return { txt: "From " + money(p.p), quote: false };
    return { txt: money(p.p), quote: false };
  }

  /* ---------- cart (shared with catalog) ---------- */
  function loadCart() {
    try { return (JSON.parse(localStorage.getItem(STORE)) || []).map((x) => typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }); }
    catch (e) { return []; }
  }
  let cart = loadCart();
  const saveCart = () => localStorage.setItem(STORE, JSON.stringify(cart));
  const qtyOf = (id) => { const l = cart.find((x) => x.id === id); return l ? l.qty : 0; };
  function addToCart(id, qty) {
    if (!byId[id]) return;
    const l = cart.find((x) => x.id === id);
    if (l) l.qty += qty; else cart.push({ id, qty: Math.max(1, qty) });
    saveCart(); renderCart(); syncCardButtons();
  }
  function removeFromCart(id) { cart = cart.filter((x) => x.id !== id); saveCart(); renderCart(); syncCardButtons(); }

  function renderCart() {
    const n = cart.reduce((s, l) => s + l.qty, 0);
    cartCountEl.textContent = n;
    if (!cart.length) {
      cartEl.innerHTML = `<p class="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Recommended items you add appear here.</p>`;
      cartActions.classList.add("hidden");
      return;
    }
    cartActions.classList.remove("hidden");
    const items = cart.map((l) => ({ l, p: byId[l.id] })).filter((x) => x.p);
    const priced = items.filter((x) => x.p.p != null);
    const sub = priced.reduce((s, x) => s + x.p.p * x.l.qty, 0);
    const quoteOnly = items.length - priced.length;
    cartEl.innerHTML =
      `<ul class="space-y-2">${items.map(({ l, p }) => `
        <li class="rounded-lg border border-slate-200 p-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-mono text-xs font-bold text-brand-900 break-all">${esc(l.id)}</p>
              <p class="text-[11px] text-slate-500">${esc(sup(p))} · ${esc(p.group || p.cat)}</p>
            </div>
            <button data-cart-rm="${esc(l.id)}" class="flex-none rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 001 1h8a1 1 0 001-1V6"/></svg></button>
          </div>
          <div class="mt-1.5 flex items-center justify-between">
            <div class="inline-flex items-center rounded-md border border-slate-300 text-xs">
              <button data-cart-dec="${esc(l.id)}" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100">−</button>
              <span class="px-2 font-semibold text-brand-900">${l.qty}</span>
              <button data-cart-inc="${esc(l.id)}" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100">+</button>
            </div>
            <span class="text-xs font-semibold ${p.p != null ? "text-brand-900" : "text-slate-400"}">${p.p != null ? money(p.p * l.qty) : "quote"}</span>
          </div>
        </li>`).join("")}</ul>
      <div class="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs">
        <div class="flex items-center justify-between"><span class="text-slate-600">Subtotal</span><span class="font-display text-sm font-bold text-brand-900">${money(sub)}</span></div>
        <p class="mt-0.5 text-[11px] text-slate-400">${priced.length} priced${quoteOnly ? ` · ${quoteOnly} quote-only` : ""} · excl. tax &amp; freight</p>
      </div>`;
  }

  /* ---------- brand chips ---------- */
  (function renderBrands() {
    if (!brandsEl) return;
    const brands = [...new Set(PRODUCTS.map(sup))];
    // Keystone first, then the rest alphabetically.
    brands.sort((a, b) => (a === DEFAULT_SUPPLIER ? -1 : b === DEFAULT_SUPPLIER ? 1 : a.localeCompare(b)));
    brandsEl.innerHTML = brands.map((b) => `<span class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">${esc(b)}</span>`).join("");
  })();

  /* ---------- markdown-lite (safe) ---------- */
  function mdLite(s) {
    const lines = esc(s).split(/\n/);
    let html = "", inList = false;
    for (let ln of lines) {
      const bullet = ln.match(/^\s*[-*]\s+(.*)$/);
      if (bullet) { if (!inList) { html += "<ul class='my-1 ml-4 list-disc space-y-0.5'>"; inList = true; } html += "<li>" + inline(bullet[1]) + "</li>"; continue; }
      if (inList) { html += "</ul>"; inList = false; }
      if (ln.trim()) html += "<p class='mt-1.5 first:mt-0'>" + inline(ln) + "</p>";
    }
    if (inList) html += "</ul>";
    return html;
    function inline(t) { return t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code class='rounded bg-slate-100 px-1 text-[.85em]'>$1</code>"); }
  }

  /* ---------- bubbles ---------- */
  function addUser(text) {
    const row = document.createElement("div");
    row.className = "flex justify-end";
    row.innerHTML = `<div class="max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-600 px-3.5 py-2 text-sm text-white">${esc(text).replace(/\n/g, "<br>")}</div>`;
    log.appendChild(row); scroll();
  }
  function addAssistant(reply, items) {
    const row = document.createElement("div");
    row.className = "flex justify-start";
    const cards = (items && items.length) ? `<div class="mt-3 space-y-2">${items.map(recCard).join("")}</div>` : "";
    row.innerHTML = `<div class="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">${mdLite(reply)}${cards}</div>`;
    log.appendChild(row);
    wireCards(row);
    scroll();
  }
  function badge(text, cls) { return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}">${esc(text)}</span>`; }
  // Product thumbnail: real manufacturer photo if we have one, else the
  // generated illustration (shared with the catalog via SKURealPhoto/SKUPhoto).
  function thumbHtml(p) {
    const rp = window.SKURealPhoto ? window.SKURealPhoto(p) : "";
    if (rp) return `<img src="${rp}" alt="${esc(p.id)}" loading="lazy" class="h-full w-full object-contain p-1" />`;
    return window.SKUPhoto ? SKUPhoto.svg(p, { variant: "thumb" }) : "";
  }
  function recCard(it) {
    const p = byId[it.id]; if (!p) return "";
    const pl = priceLabel(p);
    const badges = [
      p.w && badge(p.w, "bg-amber-100 text-amber-800"),
      p.lm && badge(p.lm + " lm", "bg-cyan-100 text-cyan-800"),
      p.cct && badge(p.cct, "bg-brand-100 text-brand-800"),
    ].filter(Boolean).join(" ");
    const inCart = qtyOf(p.id) > 0;
    return `
      <div class="rounded-xl border border-slate-200 bg-white p-3">
        <div class="flex items-start gap-2.5">
          <div class="h-14 w-14 flex-none overflow-hidden rounded-lg bg-white ring-1 ring-slate-100">${thumbHtml(p)}</div>
          <div class="min-w-0 flex-1">
            <span class="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">${esc(p.cat)}</span>
            <h4 class="mt-1 font-mono text-sm font-bold text-brand-900 break-all">${esc(p.id)}</h4>
            <p class="text-[11px] text-slate-500">${esc(sup(p))}${p.group ? " · " + esc(p.group) : ""}</p>
          </div>
          <div class="flex-none text-right"><span class="font-display text-sm font-bold ${pl.quote ? "text-slate-400" : "text-brand-900"}">${pl.txt}</span></div>
        </div>
        ${badges ? `<div class="mt-2 flex flex-wrap gap-1">${badges}</div>` : ""}
        ${it.reason ? `<p class="mt-2 text-xs text-slate-500"><span class="font-semibold text-slate-600">Why:</span> ${esc(it.reason)}</p>` : ""}
        <div class="mt-2.5 flex items-center gap-2">
          <div class="inline-flex items-center rounded-md border border-slate-300 text-sm">
            <button type="button" data-rec-dec="${esc(p.id)}" class="px-2 py-1 text-slate-600 hover:bg-slate-100">−</button>
            <input data-rec-qty="${esc(p.id)}" value="${it.qty || 1}" inputmode="numeric" class="w-10 border-x border-slate-300 py-1 text-center text-sm focus:outline-none" />
            <button type="button" data-rec-inc="${esc(p.id)}" class="px-2 py-1 text-slate-600 hover:bg-slate-100">+</button>
          </div>
          <button type="button" data-rec-add="${esc(p.id)}" class="flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${inCart ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-cyan-600 text-white hover:bg-cyan-700"}">${inCart ? "In quote · add more" : "Add to quote"}</button>
        </div>
      </div>`;
  }
  function wireCards(root) {
    root.querySelectorAll("[data-rec-add]").forEach((b) => b.addEventListener("click", () => {
      const id = b.getAttribute("data-rec-add");
      const qi = root.querySelector(`[data-rec-qty="${cssEsc(id)}"]`);
      const qty = Math.max(1, parseInt(qi && qi.value, 10) || 1);
      addToCart(id, qty);
    }));
    root.querySelectorAll("[data-rec-inc]").forEach((b) => b.addEventListener("click", () => stepQty(root, b.getAttribute("data-rec-inc"), 1)));
    root.querySelectorAll("[data-rec-dec]").forEach((b) => b.addEventListener("click", () => stepQty(root, b.getAttribute("data-rec-dec"), -1)));
  }
  function stepQty(root, id, d) {
    const qi = root.querySelector(`[data-rec-qty="${cssEsc(id)}"]`);
    if (!qi) return; qi.value = Math.max(1, (parseInt(qi.value, 10) || 1) + d);
  }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"); }
  // Reflect cart membership on every visible rec card.
  function syncCardButtons() {
    log.querySelectorAll("[data-rec-add]").forEach((b) => {
      const inCart = qtyOf(b.getAttribute("data-rec-add")) > 0;
      b.className = "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors " + (inCart ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-cyan-600 text-white hover:bg-cyan-700");
      b.textContent = inCart ? "In quote · add more" : "Add to quote";
    });
  }

  let typingRow = null;
  function showTyping() {
    typingRow = document.createElement("div");
    typingRow.className = "flex justify-start";
    typingRow.innerHTML = `<div class="adv-typing rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-slate-500"><span></span><span></span><span></span></div>`;
    log.appendChild(typingRow); scroll();
  }
  function hideTyping() { if (typingRow) { typingRow.remove(); typingRow = null; } }
  function scroll() { log.scrollTop = log.scrollHeight; }

  /* ---------- send ---------- */
  const convo = []; // {role, content}
  let busy = false;
  async function send(text) {
    if (busy || !text.trim()) return;
    busy = true; sendBtn.disabled = true;
    addUser(text);
    convo.push({ role: "user", content: text });
    input.value = ""; autosize();
    showTyping();
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: convo }) });
      const d = await r.json().catch(() => ({}));
      hideTyping();
      if (r.ok && d.reply) {
        addAssistant(d.reply, d.items);
        convo.push({ role: "assistant", content: d.reply });
      } else {
        addAssistant(d.error || "Sorry — I had trouble with that. You can browse the [full catalog](lighting-catalog.html) or request a quote and our team will help directly.", null);
      }
    } catch (e) {
      hideTyping();
      addAssistant("Network hiccup — please try again. Meanwhile, the full **[product catalog](lighting-catalog.html)** has every model, or use **Request a Quote** and we'll help directly.", null);
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  /* ---------- quick-start chips (novice on-ramps) ---------- */
  const CHIPS = [
    ["🏭 Light a warehouse", "I need to light a 30,000 sq ft warehouse with 24 ft ceilings. What high bays do you recommend and roughly how many?"],
    ["🏢 Office troffers", "I'm relighting an office floor with a drop-tile ceiling — about 40 2x4 fixtures, 4000K, dimmable. What are my options?"],
    ["🅿️ Parking lot", "I need area lights for a parking lot on 25 ft poles, Type III, dusk-to-dawn. What do you suggest?"],
    ["🧱 Building exterior", "Recommend LED wall packs for a building exterior with a built-in photocell."],
    ["🏀 Gym / high ceiling", "Lighting for a gymnasium with ~28 ft ceilings — what fixtures and mounting?"],
    ["💡 Retail downlights", "I want recessed downlights for a retail space, warm 3000K, high CRI."],
  ];
  if (chipsEl) {
    chipsEl.innerHTML = CHIPS.map(([label], i) => `<button type="button" data-chip="${i}" class="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-700">${label}</button>`).join("");
    chipsEl.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => send(CHIPS[+b.getAttribute("data-chip")][1])));
  }

  /* ---------- input behaviors ---------- */
  function autosize() { input.style.height = "auto"; input.style.height = Math.min(128, input.scrollHeight) + "px"; }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
  if (resetBtn) resetBtn.addEventListener("click", () => { convo.length = 0; log.innerHTML = ""; greet(); input.focus(); });

  // cart rail controls
  if (cartEl) cartEl.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-cart-rm]"); if (rm) return removeFromCart(rm.getAttribute("data-cart-rm"));
    const inc = e.target.closest("[data-cart-inc]"); if (inc) { const l = cart.find((x) => x.id === inc.getAttribute("data-cart-inc")); if (l) { l.qty++; saveCart(); renderCart(); } return; }
    const dec = e.target.closest("[data-cart-dec]"); if (dec) { const l = cart.find((x) => x.id === dec.getAttribute("data-cart-dec")); if (l) { l.qty = Math.max(1, l.qty - 1); saveCart(); renderCart(); } return; }
  });

  /* ---------- greeting ---------- */
  function greet() {
    addAssistant("Hi — I'm the **DHI Lighting Advisor**. Tell me about the space you're lighting and I'll recommend the right fixtures and quantities across **Keystone, Acuity, Signify, Cree, Eaton, Orion, and Alcon** — then build your quote.\n\nNew to this? Just describe the room. Know exactly what you need? Give me the specs (CCT, voltage, dimming, distribution) and I'll match precisely. Try a starter below 👇", null);
  }

  // init
  renderCart();
  greet();
  // deep link: ?ask=…
  const preset = new URLSearchParams(location.search).get("ask");
  if (preset) send(preset);
})();
