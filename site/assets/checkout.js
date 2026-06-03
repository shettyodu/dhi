/* =====================================================================
   DHI Lighting — checkout: ZIP-based tax & shipping ESTIMATES, card &
   PO/net-terms paths. Reads the cart from localStorage ('dhi_keystone_quote')
   and KEYSTONE_PRODUCTS from catalog-data.js. Mounts into #checkout-root.

   IMPORTANT (demo vs live):
   - Tax & shipping here are ESTIMATES from built-in tables (state-average
     sales-tax rates + distance zones). Live deployment should swap in
     Stripe Tax / Avalara (tax) and EasyPost (parcel/LTL) via a backend.
   - Card payment runs in DEMO mode (no real charge, no card data leaves the
     browser). To go live, set CFG.stripeKey + a backend that creates a
     Stripe PaymentIntent and captures on WESCO ship-confirmation.
   ===================================================================== */
(function () {
  // Which catalog is checking out? ?cart=supplies|nutrition switches the
  // source/cart; default is the lighting (Keystone) catalog.
  const SRC_MAP = {
    supplies:  { store: "dhi_supplies_quote",  products: (typeof SUPPLIES_PRODUCTS  !== "undefined" ? SUPPLIES_PRODUCTS  : []), catalog: "supplies-catalog.html", interest: "Supplies, Textiles & Linens" },
    nutrition: { store: "dhi_nutrition_quote", products: (typeof NUTRITION_PRODUCTS !== "undefined" ? NUTRITION_PRODUCTS : []), catalog: "nutrition.html",         interest: "Nutrition & Supplements" },
  };
  const SRC = SRC_MAP[new URLSearchParams(location.search).get("cart")]
    || { store: "dhi_keystone_quote", products: (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []), catalog: "lighting-catalog.html", interest: "Lighting & Energy Efficiency" };
  const PRODUCTS = SRC.products;
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const STORE = SRC.store;
  // Affiliate attribution: referral code from ?ref= or captured on the catalog page.
  const refParam = new URLSearchParams(location.search).get("ref");
  const REFERRAL = (refParam || (function () { try { return localStorage.getItem("dhi_lighting_ref") || ""; } catch (e) { return ""; } })() || "").slice(0, 64);
  const root = document.getElementById("checkout-root");
  if (!root) return;

  const CFG = {
    // Paste your Stripe TEST publishable key here (pk_test_...) to enable the
    // real Stripe card field. You can also set it without editing this file:
    //   localStorage.setItem('dhi_stripe_pk','pk_test_xxx') in the browser console.
    stripeKey: "pk_test_51TduLKBy2BVvq0OoHKCKkcJdSzf47qdXQ1bLBBlosqAOBJAJ0RiuWUsCbOANDdRMClmZqVXshvVyDLsHvfnpdmkq00E3CjBDAi",
    // OPTIONAL: when you deploy a serverless function that creates a Stripe
    // PaymentIntent and returns { clientSecret }, set its URL here to upgrade
    // from "validate/tokenize card" to a full real charge — no other changes.
    paymentIntentEndpoint: "https://courageous-fairy-0b2d3c.netlify.app/.netlify/functions/create-payment-intent",
    poThreshold: 2500,        // orders >= this can pay by PO / net terms
    freeShipThreshold: 2500,  // free parcel freight at/above this subtotal
    originState: "NC",
  };

  /* ---- Stripe (test) ---- */
  function getPK() {
    try { return localStorage.getItem("dhi_stripe_pk") || CFG.stripeKey; } catch (e) { return CFG.stripeKey; }
  }
  function stripeReady() {
    const pk = getPK();
    return !!(window.Stripe && pk && pk.indexOf("pk_") === 0 && pk.indexOf("REPLACE") < 0);
  }
  let stripe = null, cardElement = null;
  function initStripe() { if (!stripe && stripeReady()) { try { stripe = window.Stripe(getPK()); } catch (e) { stripe = null; } } return stripe; }
  function mountCard() {
    if (state.method !== "card" || !stripeReady()) return;
    if (!initStripe()) return;
    const mountEl = document.getElementById("card-element");
    if (!mountEl) return;
    const elements = stripe.elements();
    cardElement = elements.create("card", {
      style: { base: { fontSize: "16px", color: "#0a2540", fontFamily: "Inter, system-ui, sans-serif", "::placeholder": { color: "#94a3b8" } } },
    });
    cardElement.mount("#card-element");
    cardElement.on("change", (ev) => { const er = document.getElementById("card-errors"); if (er) er.textContent = ev.error ? ev.error.message : ""; });
  }

  const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---- estimated combined (state+avg local) sales-tax rates, % ---- */
  const TAX = { AL:9.29,AK:1.81,AZ:8.37,AR:9.45,CA:8.85,CO:7.81,CT:6.35,DE:0,DC:6.0,FL:7.0,GA:7.4,HI:4.44,ID:6.02,IL:8.85,IN:7.0,IA:6.94,KS:8.75,KY:6.0,LA:9.56,ME:5.5,MD:6.0,MA:6.25,MI:6.0,MN:8.04,MS:7.07,MO:8.39,MT:0,NE:6.97,NV:8.24,NH:0,NJ:6.6,NM:7.72,NY:8.53,NC:6.98,ND:7.04,OH:7.24,OK:8.99,OR:0,PA:6.34,RI:7.0,SC:7.5,SD:6.4,TN:9.55,TX:8.2,UT:7.25,VT:6.36,VA:5.77,WA:9.38,WV:6.55,WI:5.43,WY:5.44 };
  const STATES = Object.keys(TAX).sort();

  /* ---- shipping zones from NC origin ---- */
  const ZONE = { NC:1,SC:1,VA:1,GA:1,TN:1, MD:2,DC:2,WV:2,KY:2,AL:2,FL:2,DE:2,PA:2,NJ:2,
    NY:3,OH:3,IN:3,MS:3,AR:3,LA:3,CT:3,RI:3,MA:3,NH:3,VT:3,ME:3,MI:3,IL:3,MO:3,WI:3,IA:3,MN:3,
    ND:4,SD:4,NE:4,KS:4,OK:4,TX:4,CO:4,WY:4,MT:4,NM:4,AZ:4,UT:4,ID:4,NV:4,CA:4,OR:4,WA:4, AK:5,HI:5 };
  const ZONE_BASE = { 1:19, 2:29, 3:45, 4:69, 5:129 };

  /* ---- ZIP (first 3 digits) -> state ranges ---- */
  const ZR = [[5,5,"NY"],[10,27,"MA"],[28,29,"RI"],[30,38,"NH"],[39,49,"ME"],[50,59,"VT"],[60,69,"CT"],
    [70,89,"NJ"],[100,149,"NY"],[150,196,"PA"],[197,199,"DE"],[200,205,"DC"],[206,219,"MD"],[220,246,"VA"],
    [247,268,"WV"],[270,289,"NC"],[290,299,"SC"],[300,319,"GA"],[320,349,"FL"],[350,369,"AL"],[370,385,"TN"],
    [386,397,"MS"],[398,399,"GA"],[400,427,"KY"],[430,459,"OH"],[460,479,"IN"],[480,499,"MI"],[500,528,"IA"],
    [530,549,"WI"],[550,567,"MN"],[570,577,"SD"],[580,588,"ND"],[590,599,"MT"],[600,629,"IL"],[630,658,"MO"],
    [660,679,"KS"],[680,693,"NE"],[700,714,"LA"],[716,729,"AR"],[730,749,"OK"],[750,799,"TX"],[800,816,"CO"],
    [820,831,"WY"],[832,838,"ID"],[840,847,"UT"],[850,865,"AZ"],[870,884,"NM"],[889,898,"NV"],[900,961,"CA"],
    [967,968,"HI"],[970,979,"OR"],[980,994,"WA"],[995,999,"AK"]];
  function zipToState(zip) {
    const z = parseInt(String(zip).slice(0, 3), 10);
    if (isNaN(z)) return "";
    for (const [lo, hi, st] of ZR) if (z >= lo && z <= hi) return st;
    return "";
  }

  /* ---- cart ---- */
  function loadCart() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { raw = []; }
    // migrate legacy string[] -> [{id, qty}]
    return raw.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }))
              .filter((l) => byId[l.id]);
  }
  function saveCart(cart) { localStorage.setItem(STORE, JSON.stringify(cart)); }
  let cart = loadCart();
  const lines = () => cart.map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);
  const priced = () => lines().filter((l) => l.p.p != null);
  const quoteOnlyCount = () => lines().length - priced().length;

  /* ---- totals ---- */
  const state = { ship: { state: "", zip: "" }, exempt: false, exemptType: "", method: "card" };
  function calc() {
    const sub = priced().reduce((s, l) => s + l.p.p * l.qty, 0);
    const rate = state.exempt ? 0 : (TAX[state.ship.state] || 0);
    const tax = sub * rate / 100;
    let ship = 0, shipNote = "";
    if (sub > 0) {
      if (sub >= CFG.freeShipThreshold) { ship = 0; shipNote = "Free freight (orders ≥ " + money(CFG.freeShipThreshold) + ")"; }
      else if (state.ship.state) {
        const z = ZONE[state.ship.state] || 4;
        ship = Math.min(350, ZONE_BASE[z] + 0.025 * sub);
        shipNote = "Zone " + z + " estimate";
      } else { shipNote = "Enter ZIP for estimate"; }
    }
    ship = Math.round(ship * 100) / 100;
    return { sub, rate, tax, ship, shipNote, total: sub + tax + ship };
  }

  /* ---- summary (right column) ---- */
  function summaryHTML() {
    const t = calc();
    const li = priced().map((l) => `
      <li class="flex items-start justify-between gap-3 py-3">
        <div class="min-w-0">
          ${l.p.img ? `<img src="${l.p.img}" alt="" class="mb-1 h-10 w-auto object-contain"/>` : ""}
          ${l.p.t ? `<p class="text-sm font-semibold text-brand-900">${l.p.t}</p><p class="font-mono text-[11px] text-slate-400">${l.id}</p>` : `<p class="font-mono text-xs font-semibold text-brand-900 break-all">${l.id}</p>`}
          <p class="text-xs text-slate-500">${money(l.p.p)} ea</p>
          <div class="mt-1 inline-flex items-center rounded-md border border-slate-300">
            <button data-qty="dec" data-id="${l.id}" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100">−</button>
            <span class="px-2 text-sm font-semibold text-brand-900">${l.qty}</span>
            <button data-qty="inc" data-id="${l.id}" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100">+</button>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-brand-900">${money(l.p.p * l.qty)}</p>
          <button data-qty="rm" data-id="${l.id}" class="mt-1 text-xs text-slate-400 hover:text-red-600">remove</button>
        </div>
      </li>`).join("");
    return `
      <h2 class="text-lg font-bold text-brand-900">Order summary</h2>
      <ul class="mt-3 divide-y divide-slate-100">${li || '<li class="py-6 text-center text-sm text-slate-500">No purchasable items in cart.</li>'}</ul>
      <dl class="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
        <div class="flex justify-between"><dt class="text-slate-600">Subtotal</dt><dd class="font-semibold text-brand-900">${money(t.sub)}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-600">Estimated tax ${state.exempt ? "(exempt)" : (state.ship.state ? "(" + state.ship.state + " ~" + t.rate + "%)" : "")}</dt><dd class="font-semibold text-brand-900">${money(t.tax)}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-600">Estimated shipping</dt><dd class="font-semibold text-brand-900">${t.ship === 0 ? (t.sub >= CFG.freeShipThreshold ? "FREE" : money(0)) : money(t.ship)}</dd></div>
        <div class="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base"><dt class="font-bold text-brand-900">Estimated total</dt><dd class="font-display font-extrabold text-brand-900">${money(t.total)}</dd></div>
      </dl>
      <p class="mt-2 text-[11px] leading-relaxed text-slate-400">${t.shipNote ? t.shipNote + ". " : ""}Tax &amp; freight are <strong>estimates</strong>; final amounts are confirmed at order processing (large/fixture orders may ship LTL freight).</p>
      ${quoteOnlyCount() ? `<p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">${quoteOnlyCount()} quote-only item(s) in your list are not part of checkout — <a class="underline" href="contact.html?interest=${encodeURIComponent(SRC.interest)}">request a quote</a> for those.</p>` : ""}`;
  }

  /* ---- payment panel ---- */
  function paymentHTML() {
    const t = calc();
    const poOk = t.total >= CFG.poThreshold;
    const tab = (id, label, sub) => `<button data-pm="${id}" class="pm-tab flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${state.method === id ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white hover:border-cyan-400"}">
        <span class="block font-semibold text-brand-900">${label}</span><span class="block text-xs text-slate-500">${sub}</span></button>`;
    let panel;
    if (state.method === "po") {
      panel = `
        <div class="mt-4 space-y-3">
          <p class="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">Large order — pay by purchase order on net terms. On submit, your order is routed for <strong>WESCO order &amp; credit approval</strong> before it ships (see status after submit). DHI does not need to contact WESCO manually.</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block"><span class="text-sm font-medium text-slate-700">PO number</span><input id="po-num" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" placeholder="e.g. PO-10482"/></label>
            <label class="block"><span class="text-sm font-medium text-slate-700">Requested terms</span><select id="po-terms" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"><option>Net 30</option><option>Net 45</option><option>Net 60</option></select></label>
            <label class="block"><span class="text-sm font-medium text-slate-700">AP / billing contact</span><input id="po-ap" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" placeholder="Name"/></label>
            <label class="block"><span class="text-sm font-medium text-slate-700">AP email</span><input id="po-apemail" type="email" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" placeholder="ap@company.com"/></label>
          </div>
          <label class="flex items-start gap-2 text-xs text-slate-600"><input id="po-credit" type="checkbox" class="mt-0.5"/> Apply for / use a net-terms credit line for this order (credit decision returned before shipment).</label>
        </div>`;
    } else if (stripeReady()) {
      // Real Stripe Elements card field (test mode)
      panel = `
        <div class="mt-4 space-y-3">
          <p class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><strong>Stripe test mode connected.</strong> Enter test card <span class="font-mono">4242 4242 4242 4242</span>, any future expiry, any CVC, any ZIP. The card is validated by Stripe; no real money moves in test mode.</p>
          <label class="block"><span class="text-sm font-medium text-slate-700">Card details</span>
            <div id="card-element" class="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-3"></div></label>
          <p id="card-errors" class="text-sm text-red-600"></p>
        </div>`;
    } else {
      // Demo fallback (no Stripe key configured)
      panel = `
        <div class="mt-4 space-y-3">
          <p class="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"><strong>Demo mode</strong> — no Stripe key set, so this is a non-processing placeholder. Add a Stripe test key (CFG.stripeKey or <span class="font-mono">localStorage.dhi_stripe_pk</span>) to enable the real card field. Test number <span class="font-mono">4242 4242 4242 4242</span>.</p>
          <label class="block"><span class="text-sm font-medium text-slate-700">Card number</span><input id="cc-num" inputmode="numeric" autocomplete="off" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-500 focus:outline-none" placeholder="4242 4242 4242 4242"/></label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="text-sm font-medium text-slate-700">Expiry (MM/YY)</span><input id="cc-exp" inputmode="numeric" autocomplete="off" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-500 focus:outline-none" placeholder="12/28"/></label>
            <label class="block"><span class="text-sm font-medium text-slate-700">CVC</span><input id="cc-cvc" inputmode="numeric" autocomplete="off" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-500 focus:outline-none" placeholder="123"/></label>
          </div>
        </div>`;
    }
    return `
      <h2 class="text-lg font-bold text-brand-900">2. Payment</h2>
      <div class="mt-3 flex gap-3">
        ${tab("card", "Credit / debit card", "Pay now")}
        ${poOk ? tab("po", "Purchase order", "Net terms · WESCO approval") : `<div class="flex-1 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-left text-sm text-slate-400"><span class="block font-semibold">Purchase order</span><span class="block text-xs">Available on orders ≥ ${money(CFG.poThreshold)}</span></div>`}
      </div>
      ${panel}`;
  }

  /* ---- skeleton (rendered once; inputs keep focus) ---- */
  function renderShell() {
    root.innerHTML = `
      <div class="grid gap-8 lg:grid-cols-3">
        <div class="space-y-8 lg:col-span-2">
          <section>
            <h2 class="text-lg font-bold text-brand-900">1. Contact &amp; ship-to</h2>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label class="block sm:col-span-1"><span class="text-sm font-medium text-slate-700">Full name</span><input id="f-name" class="ck-in"/></label>
              <label class="block sm:col-span-1"><span class="text-sm font-medium text-slate-700">Company</span><input id="f-co" class="ck-in"/></label>
              <label class="block"><span class="text-sm font-medium text-slate-700">Email</span><input id="f-email" type="email" class="ck-in"/></label>
              <label class="block"><span class="text-sm font-medium text-slate-700">Phone</span><input id="f-phone" class="ck-in"/></label>
              <label class="block sm:col-span-2"><span class="text-sm font-medium text-slate-700">Street address</span><input id="f-addr" class="ck-in"/></label>
              <label class="block"><span class="text-sm font-medium text-slate-700">City</span><input id="f-city" class="ck-in"/></label>
              <div class="grid grid-cols-2 gap-3">
                <label class="block"><span class="text-sm font-medium text-slate-700">State</span>
                  <select id="f-state" class="ck-in"><option value="">—</option>${STATES.map((s) => `<option>${s}</option>`).join("")}</select></label>
                <label class="block"><span class="text-sm font-medium text-slate-700">ZIP code</span><input id="f-zip" inputmode="numeric" class="ck-in" placeholder="27504"/></label>
              </div>
              <label class="block sm:col-span-2"><span class="text-sm font-medium text-slate-700">Referral / promo code <span class="text-slate-400">(optional)</span></span><input id="f-ref" class="ck-in" placeholder="e.g., CREATOR-AB12" value="${REFERRAL}"/></label>
            </div>
            <label class="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <input id="f-exempt" type="checkbox" class="mt-0.5"/> <span>Tax-exempt order (resale / government / hospital) — a valid exemption certificate will be required.</span>
            </label>
            <select id="f-exempt-type" class="ck-in mt-2 hidden max-w-xs"><option value="">Select exemption type…</option><option>Resale (contractor)</option><option>Government</option><option>Hospital / non-profit</option></select>
          </section>

          <section id="pay-section"></section>

          <div id="ck-error" class="hidden rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"></div>
          <button id="place-order" class="w-full rounded-lg bg-cyan-600 px-5 py-3.5 text-base font-bold text-white hover:bg-cyan-700">Place order</button>
          <p class="text-center text-xs text-slate-400">By placing this order you agree to DHI's terms. Card payments are processed securely; DHI never stores full card numbers.</p>
        </div>

        <aside class="lg:col-span-1">
          <div id="ck-summary" class="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"></div>
        </aside>
      </div>`;
    // shared input styling
    const st = document.createElement("style");
    st.textContent = ".ck-in{margin-top:.25rem;width:100%;border-radius:.5rem;border:1px solid #cbd5e1;padding:.5rem .75rem;font-size:.875rem}.ck-in:focus{outline:none;border-color:#06b6d4;box-shadow:0 0 0 2px rgba(6,182,212,.25)}";
    document.head.appendChild(st);
    document.getElementById("pay-section").innerHTML = paymentHTML();
    refreshSummary();
    wire();
    mountCard();
  }

  function refreshSummary() { document.getElementById("ck-summary").innerHTML = summaryHTML(); bindSummary(); }
  function refreshPayment() { document.getElementById("pay-section").innerHTML = paymentHTML(); mountCard(); }

  function bindSummary() {
    document.querySelectorAll("#ck-summary [data-qty]").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.id, op = b.dataset.qty;
        const line = cart.find((l) => (l.id || l) === id);
        if (!line) return;
        if (op === "inc") line.qty++;
        else if (op === "dec") line.qty = Math.max(1, line.qty - 1);
        else if (op === "rm") cart = cart.filter((l) => l.id !== id);
        saveCart(cart);
        refreshSummary(); refreshPayment();
      };
    });
  }

  function wire() {
    const g = (id) => document.getElementById(id);
    g("f-state").addEventListener("change", (e) => { state.ship.state = e.target.value; refreshSummary(); refreshPayment(); });
    g("f-zip").addEventListener("input", (e) => {
      const st = zipToState(e.target.value);
      if (st) { state.ship.state = st; g("f-state").value = st; }
      refreshSummary(); refreshPayment();
    });
    g("f-exempt").addEventListener("change", (e) => {
      state.exempt = e.target.checked;
      g("f-exempt-type").classList.toggle("hidden", !e.target.checked);
      refreshSummary();
    });
    g("f-exempt-type").addEventListener("change", (e) => { state.exemptType = e.target.value; });
    document.getElementById("pay-section").addEventListener("click", (e) => {
      const tab = e.target.closest(".pm-tab");
      if (tab) { state.method = tab.dataset.pm; refreshPayment(); }
    });
    g("place-order").addEventListener("click", placeOrder);
  }

  /* ---- validation + place order ---- */
  function luhn(num) {
    const s = num.replace(/\D/g, ""); if (s.length < 13) return false;
    let sum = 0, alt = false;
    for (let i = s.length - 1; i >= 0; i--) { let d = +s[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
    return sum % 10 === 0;
  }
  function showErr(msg) { const e = document.getElementById("ck-error"); e.textContent = msg; e.classList.remove("hidden"); e.scrollIntoView({ behavior: "smooth", block: "center" }); }

  function placeOrder() {
    document.getElementById("ck-error").classList.add("hidden");
    const v = (id) => (document.getElementById(id).value || "").trim();
    if (!priced().length) return showErr("Your cart has no purchasable items.");
    if (!v("f-name") || !v("f-email") || !v("f-addr") || !v("f-city") || !state.ship.state || !v("f-zip"))
      return showErr("Please complete your name, email, and full shipping address (including state and ZIP).");

    const t = calc();
    if (state.method === "po") {
      if (t.total < CFG.poThreshold) return showErr("Purchase orders are available on orders ≥ " + money(CFG.poThreshold) + ".");
      if (!v("po-num")) return showErr("Please enter your PO number.");
      if (!v("po-ap") || !v("po-apemail")) return showErr("Please enter an AP / billing contact and email.");
      return confirmation("po", t);
    }
    // card — real Stripe path when a publishable key is configured
    if (stripeReady() && cardElement) {
      const btn = document.getElementById("place-order");
      btn.disabled = true; btn.textContent = "Processing…";
      const billing = { name: v("f-name"), email: v("f-email"),
        address: { line1: v("f-addr"), city: v("f-city"), state: state.ship.state, postal_code: v("f-zip") } };
      const done = () => { btn.disabled = false; btn.textContent = "Place order"; };

      if (CFG.paymentIntentEndpoint) {
        // Full charge: backend RE-PRICES from the cart (never trusts client totals)
        // and computes filing-grade tax (Stripe Tax), creates a PaymentIntent, we confirm it.
        let server = null;
        fetch(CFG.paymentIntentEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: priced().map((l) => ({ id: l.id, qty: l.qty })),
            ship: { line1: v("f-addr"), city: v("f-city"), state: state.ship.state, zip: v("f-zip") },
            exempt: state.exempt,
            email: billing.email,
            referral_code: (v("f-ref") || "").trim().slice(0, 64),
          }),
        })
          .then((r) => r.json())
          .then((data) => { if (data.error) throw new Error(data.error); server = data.breakdown; return stripe.confirmCardPayment(data.clientSecret, { payment_method: { card: cardElement, billing_details: billing } }); })
          .then((res) => {
            done();
            if (res.error) return showErr(res.error.message);
            const tt = server ? { sub: server.subtotal, tax: server.tax, ship: server.shipping, total: server.total } : t;
            confirmation("card", tt, res.paymentIntent && res.paymentIntent.id, true);
          })
          .catch((e) => { done(); showErr("Payment error: " + e.message); });
      } else {
        // No backend yet: validate + tokenize the card against your Stripe test account.
        stripe.createPaymentMethod({ type: "card", card: cardElement, billing_details: billing })
          .then((res) => { done(); if (res.error) return showErr(res.error.message); confirmation("card", t, res.paymentMethod.id, false); });
      }
      return;
    }
    // demo fallback (no Stripe key)
    if (!luhn(v("cc-num"))) return showErr("Please enter a valid card number (test mode: 4242 4242 4242 4242).");
    if (!/^\d{2}\/\d{2}$/.test(v("cc-exp"))) return showErr("Please enter card expiry as MM/YY.");
    if (!/^\d{3,4}$/.test(v("cc-cvc"))) return showErr("Please enter a valid CVC.");
    return confirmation("card", t);
  }

  function ref() {
    const n = Math.floor(100000 + Math.random() * 900000);
    return "DHI-LT-" + n;
  }

  function confirmation(method, t, payInfo, charged) {
    const orderRef = ref();
    const name = (document.getElementById("f-name").value || "").trim();
    saveCart([]); // clear cart on successful order
    const shared = `
      <div class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full ${method === "po" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${method === "po" ? '<path d="M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z"/>' : '<path d="M5 13l4 4L19 7"/>'}</svg>
        </div>
        <h2 class="mt-4 font-display text-2xl font-extrabold text-brand-900">${method === "po" ? "Order submitted — pending WESCO approval" : "Order placed"}</h2>
        <p class="mt-1 text-sm text-slate-500">Reference <span class="font-mono font-semibold text-brand-900">${orderRef}</span></p>
        <dl class="mx-auto mt-6 max-w-xs space-y-1.5 text-left text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd class="font-semibold text-brand-900">${money(t.sub)}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Estimated tax</dt><dd class="font-semibold text-brand-900">${money(t.tax)}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">Estimated shipping</dt><dd class="font-semibold text-brand-900">${t.ship === 0 ? "FREE" : money(t.ship)}</dd></div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5"><dt class="font-bold text-brand-900">Estimated total</dt><dd class="font-extrabold text-brand-900">${money(t.total)}</dd></div>
        </dl>`;
    let body;
    if (method === "po") {
      body = `
        <div class="mt-6 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p class="font-semibold text-brand-900">What happens next (automated):</p>
          <ol class="mt-2 list-decimal space-y-1 pl-5">
            <li>Your PO is sent to WESCO electronically (no manual step by DHI).</li>
            <li>WESCO confirms the order and the line of credit.</li>
            <li>On approval, WESCO ships directly to you and tracking is emailed.</li>
            <li>You're invoiced on your net terms; final tax &amp; freight are confirmed at this step.</li>
          </ol>
          <p class="mt-3 text-xs text-slate-400">Demo: this prototype records the order locally. Live deployment routes the PO to WESCO via EDI and returns approval automatically.</p>
        </div>`;
    } else {
      const stripeLine = payInfo
        ? `<p class="mt-2 font-mono text-xs text-slate-500">${charged ? "Stripe payment" : "Stripe payment method"}: ${payInfo}</p>`
        : "";
      const note = !payInfo
        ? `<p class="mt-2 text-xs text-slate-400">Demo mode: no Stripe key set, so no card was processed. Add a Stripe test key to process real test transactions.</p>`
        : charged
          ? `<p class="mt-2 text-xs text-slate-400">Test mode: a real Stripe test PaymentIntent was confirmed (no real money). Live keys process real payments.</p>`
          : `<p class="mt-2 text-xs text-slate-400">Test mode: your card was validated &amp; tokenized by Stripe (no charge). Deploy the PaymentIntent endpoint to capture on shipment.</p>`;
      body = `
        <div class="mt-6 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p>Thank you${name ? ", " + name : ""}! A confirmation will be emailed. Your card is authorized and <strong>charged when WESCO ships</strong>; final tax &amp; freight are confirmed at that point.</p>
          ${stripeLine}${note}
        </div>`;
    }
    root.innerHTML = shared + body + `
        <div class="mt-6 flex justify-center gap-3">
          <a href="${SRC.catalog}" class="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">Back to catalog</a>
          <a href="index.html" class="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">Home</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---- empty cart ---- */
  if (!priced().length) {
    root.innerHTML = `<div class="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 class="text-xl font-bold text-brand-900">Your cart is empty</h2>
      <p class="mt-2 text-slate-600">Add lighting products to your cart to check out.</p>
      <a href="${SRC.catalog}" class="mt-5 inline-block rounded-lg bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-700">Browse the catalog</a>
    </div>`;
    return;
  }
  renderShell();
})();
