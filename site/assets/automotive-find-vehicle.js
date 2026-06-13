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
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const PHOTO_BASE = (qs.get("photobase") || localStorage.getItem("acm_photo_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const ref = (qs.get("ref") || "").slice(0, 64);

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtUSD = (n) => (n == null || isNaN(n)) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600); }

  let lastProfile = null;
  let lastLead = null;
  let liveInventory = false; // flips true when an inventory provider key is configured
  let lastBuckets = [];
  let curBucket = 0;
  let dealFilter = "all", photosOnly = false, sortBy = "match"; // on-results refine state
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
    const out = {}; const raw = String(s || "").trim();
    const zip = raw.match(/\b(\d{5})\b/); if (zip) out.location_zip = zip[1];
    const cs = raw.match(/^([a-zA-Z][a-zA-Z.'\- ]+?)\s*,\s*([a-zA-Z]{2})\b/); // "Norfolk, VA"
    if (cs) { out.location_text = cs[1].trim(); out.location_state = cs[2].toUpperCase(); return out; }
    if (!out.location_zip) {
      if (/^[A-Za-z]{2}$/.test(raw)) out.location_state = raw.toUpperCase();              // just "VA"
      else if (/^[a-zA-Z][a-zA-Z.'\- ]{2,}$/.test(raw)) out.location_text = raw.trim();    // just "Norfolk"
      else { const st = raw.match(/\b([A-Za-z]{2})\b\s*$/); if (st) out.location_state = st[1].toUpperCase(); }
    }
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

  // Parse a plain-English query ("2022 toyota suv under 35k, below 60k miles, AWD")
  // into a /search profile entirely in-browser — no LLM round-trip. This keeps the
  // NL box as fast and reliable as the structured form when live inventory is on.
  const MAKES = ["mercedes-benz", "land rover", "alfa romeo", "toyota", "honda", "ford", "chevrolet", "chevy", "nissan", "jeep", "subaru", "hyundai", "kia", "mazda", "volkswagen", "vw", "bmw", "mercedes", "audi", "lexus", "acura", "gmc", "ram", "dodge", "chrysler", "buick", "cadillac", "tesla", "volvo", "porsche", "jaguar", "mitsubishi", "mini", "infiniti", "lincoln", "genesis", "fiat"];
  const MAKE_FIX = { chevy: "Chevrolet", vw: "Volkswagen" };
  const BODY = { suv: "SUV", sedan: "Sedan", pickup: "Truck", truck: "Truck", coupe: "Coupe", hatchback: "Hatchback", minivan: "Minivan", van: "Van", wagon: "Wagon", convertible: "Convertible" };
  // Tokens that end a place name (price/keyword words) and words that are never a place.
  const LOC_STOP = new Set(["under", "over", "below", "above", "around", "about", "with", "for", "and", "or", "near", "less", "than", "up", "to", "max", "min", "that", "cost", "costs", "priced", "price", "miles", "mile", "mi", "k", "the", "a", "an"]);
  const BAD_PLACE = new Set(MAKES.concat(["suv", "sedan", "truck", "pickup", "coupe", "hatchback", "minivan", "van", "wagon", "convertible", "hybrid", "electric", "ev", "diesel", "awd", "4wd", "fwd", "rwd", "car", "cars", "vehicle", "vehicles", "sale", "stock", "mileage", "miles", "me", "option", "options"]));
  // Pull a place (city + optional 2-letter state) out of a query, wherever it sits:
  // "near richmond under 30k", "from norfolk", "in dallas tx", "within X mi of raleigh".
  function extractPlace(q) {
    const STRONG = ["from", "near", "around", "outside"], WEAK = ["in", "of"];
    const toks = q.split(/\s+/).filter(Boolean);
    const cands = [];
    for (let i = 0; i < toks.length; i++) {
      const tw = toks[i].replace(/[^a-z]/g, "");
      const strong = STRONG.includes(tw); if (!strong && !WEAK.includes(tw)) continue;
      const place = []; let st = "";
      for (let j = i + 1; j < toks.length; j++) {
        const w = toks[j].replace(/^[.,]+|[.,]+$/g, "");
        if (!w) continue;
        if (/\d/.test(w) || LOC_STOP.has(w)) break;
        if (/^[a-z]{2}$/.test(w) && place.length) { st = w.toUpperCase(); break; } // trailing state
        if (!/^[a-z][a-z.'-]*$/.test(w)) break;
        place.push(w); if (place.length >= 3) break;
      }
      if (!place.length) continue;
      const lw = place.join(" ").replace(/[.'-]/g, " ").trim();
      if (lw.length < 3 || BAD_PLACE.has(lw)) continue;
      cands.push({ text: place.join(" "), state: st, strong });
    }
    return cands.find((c) => c.state) || cands.find((c) => c.strong) || cands[cands.length - 1] || null;
  }
  function titleCase(s) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }
  function parseNL(query) {
    const q = " " + String(query || "").toLowerCase() + " ";
    const p = {};
    // make (longest names first so "land rover" wins over a stray "rover")
    for (const m of MAKES) { if (new RegExp("\\b" + m.replace(/[-]/g, "\\$&") + "\\b").test(q)) { p.make = MAKE_FIX[m] || titleCase(m); break; } }
    // body style / fuel / drivetrain
    for (const k in BODY) { if (new RegExp("\\b" + k + "s?\\b").test(q)) { p.body_style = BODY[k]; break; } }
    if (/\bhybrids?\b/.test(q)) p.fuel_type = "Hybrid";
    else if (/\b(electric|ev|evs)\b/.test(q)) p.fuel_type = "Electric";
    else if (/\bdiesels?\b/.test(q)) p.fuel_type = "Diesel";
    const dt = q.match(/\b(awd|4wd|4x4|fwd|rwd)\b/);
    if (dt) p.drivetrain = dt[1] === "4x4" ? "4WD" : dt[1].toUpperCase();
    // year(s)
    Object.assign(p, years(q));
    // --- distance / radius vs odometer mileage -------------------------------
    // "50 miles from norfolk" / "within 50 miles of raleigh" is a search RADIUS,
    // not odometer mileage — detect it first so the number isn't misread.
    let radius = null, distSpan = "";
    let dm = q.match(/(\d+)\s*(?:mi|miles?)\s+(?:from|of|to|near|around|within|outside)\b/);
    if (!dm) dm = q.match(/\bwithin\s+(\d+)\s*(?:mi|miles?)\b/);
    if (dm) { radius = parseInt(dm[1], 10); distSpan = dm[0]; }
    // --- location: a city/place anywhere in the query (+ optional ", ST") ------
    let locText = "", locState = "";
    const place = extractPlace(q);
    if (place) { locText = place.text; locState = place.state; }
    if (!locText) { const cs = q.match(/\b([a-z][a-z.'\- ]+?),\s*([a-z]{2})\b/); if (cs) { locText = cs[1].trim(); locState = cs[2].toUpperCase(); } }
    const zipM = q.match(/\b(\d{5})\b/); const zip = zipM ? zipM[1] : "";
    if (zip) p.location_zip = zip;
    if (locText) p.location_text = locText;
    if (locState) p.location_state = locState;
    if (radius) p.radius = radius; else if (locText || zip) p.radius = 100; // local default when a place is named
    // --- odometer mileage (after removing any distance span) ------------------
    let rest = distSpan ? q.replace(distSpan, " ") : q;
    const mileM = rest.match(/(\d[\d,\.]*)\s*(k)?\s*(?:mi|mile|miles)\b/);
    if (mileM) {
      let v = parseFloat(mileM[1].replace(/,/g, "")); if (isNaN(v)) v = null;
      if (v != null) { if (mileM[2]) v *= 1000; else if (v < 1000) v *= 1000; p.mileage_max = Math.round(v); }
      rest = rest.replace(mileM[0], " ");
    }
    // strip years, zip, model codes (f-150, q50, cx-5), and the place name from the
    // price text so they aren't misread as dollars. Leave "35k"-style amounts intact.
    rest = rest.replace(/\b(?:19|20)\d{2}\b/g, " ");
    rest = rest.replace(/\b[a-z]{1,3}-?\d+\b/g, " ");
    if (zip) rest = rest.replace(zip, " ");
    if (locText) rest = rest.replace(new RegExp(locText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
    const money = moneyRange(rest);
    if (money.min != null && money.max != null) { p.budget_min = money.min; p.budget_max = money.max; }
    else if (money.max != null || money.min != null) {
      const v = money.max != null ? money.max : money.min;
      if (/\b(over|above|more than|at least|min|starting)\b/.test(q)) p.budget_min = v; else p.budget_max = v;
    }
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
    if (lead) { lastLead = lead; captureLead(lead); }
    let d = {}, ok = false, status = 0;
    async function hit(ep, pl) {
      try { const r = await fetch(FN(ep), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) }); let j = {}; try { j = await r.json(); } catch (e) {} return { ok: r.ok, status: r.status, d: j }; }
      catch (e) { return { ok: false, status: 0, d: { error: "Network error — please try again." } }; }
    }
    try {
      if (liveInventory) {
        // Route to real external inventory. For NL we parse the query into a profile
        // in-browser (instant, no LLM round-trip) and query live inventory directly —
        // this avoids the slow Flask /search/nl hop that was timing out (504) against
        // Netlify's function cap. The AI backend stays as a fallback on provider error.
        let profile = payload;
        if (endpoint === "automotive-search-nl") { profile = parseNL(payload.query || ""); lastProfile = profile; }
        const inv = await hit("automotive-inventory", { action: "search", profile });
        if (inv.ok) { ok = true; status = inv.status; d = inv.d; if (!d.profile) d.profile = profile; }
        else { const fb = await hit(endpoint, payload); ok = fb.ok; status = fb.status; d = fb.d; } // provider hiccup → fall back to AI backend
      } else {
        const r = await hit(endpoint, payload); ok = r.ok; status = r.status; d = r.d;
      }
    } catch (e) { ok = false; d = { error: "Network error — please try again." }; }
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
    dealFilter = "all"; photosOnly = false; sortBy = "match"; curBucket = 0; // fresh search → reset refine
    const r = d.results || {};
    lastBuckets = Array.isArray(r.buckets) ? r.buckets.filter((b) => b.vehicles && b.vehicles.length) : [];
    // Prefer an explicit total from the backend; otherwise derive it from the
    // buckets we actually rendered (the live-inventory response has no total_count).
    const total = r.total_count != null ? r.total_count
      : (d.count != null ? d.count
        : lastBuckets.reduce((n, b) => n + (b.vehicles ? b.vehicles.length : 0), 0));
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
      <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Deal</span>
        <div class="flex gap-1.5">
          <button data-deal="all" class="deal-chip active rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">All</button>
          <button data-deal="great" class="deal-chip rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Great</button>
          <button data-deal="good" class="deal-chip rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Good+</button>
        </div>
        <label class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600"><input id="photos-only" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-cyan-600" /> Has photos</label>
        <div class="ml-auto flex items-center gap-2">
          <span id="refine-count" class="text-xs text-slate-400"></span>
          <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600">Sort
            <select id="sortby" class="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-cyan-500 focus:outline-none">
              <option value="match">Best match</option>
              <option value="deal">Best deal</option>
              <option value="price-asc">Price: low → high</option>
              <option value="price-desc">Price: high → low</option>
              <option value="mileage-asc">Mileage: low → high</option>
              <option value="year-desc">Year: newest</option>
            </select>
          </label>
        </div>
      </div>
      <div id="bucket-grid" class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"></div>`;
    results.querySelectorAll(".bucket-tab").forEach((btn) => btn.addEventListener("click", () => {
      results.querySelectorAll(".bucket-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showBucket(parseInt(btn.dataset.i, 10));
    }));
    results.querySelectorAll(".deal-chip").forEach((btn) => btn.addEventListener("click", () => {
      results.querySelectorAll(".deal-chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      dealFilter = btn.dataset.deal;
      showBucket(curBucket);
    }));
    const po = $("photos-only"); if (po) po.addEventListener("change", () => { photosOnly = po.checked; showBucket(curBucket); });
    const sb = $("sortby"); if (sb) sb.addEventListener("change", () => { sortBy = sb.value; showBucket(curBucket); });
    showBucket(0);
  }

  function showBucket(i) {
    curBucket = i;
    const grid = $("bucket-grid"); if (!grid || !lastBuckets[i]) return;
    const list = applyRefine(lastBuckets[i].vehicles);
    const cnt = $("refine-count"); if (cnt) cnt.textContent = list.length + " shown";
    if (!list.length) {
      grid.innerHTML = `<div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No vehicles in this group match those filters. Try <strong>All</strong> or another tab.</div>`;
      return;
    }
    grid.innerHTML = list.map(vehicleCard).join("");
    grid.querySelectorAll("[data-cmp]").forEach((cb) => cb.addEventListener("change", onCompareToggle));
    grid.querySelectorAll("[data-get]").forEach((b) => b.addEventListener("click", () => getCar(b.dataset.get)));
  }

  // ---------- Model A handoff: choose a car → record interest + go to source ----
  let pendingVehicleId = null; // set when "Request this vehicle" is clicked before contact info is entered
  // Demo toggle: ?dealerDemo=1 previews the "Continue to dealer" hand-off even
  // before real dealer clickoff links exist, so the team can walk the flow.
  const DEALER_DEMO = /[?&](dealerdemo|buydirect)=1/i.test(location.search);
  function vehicleLabel(v) { return `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`.trim(); }
  function contactFromForm() { return { name: val("fv-name"), email: val("fv-email"), phone: val("fv-phone") }; }
  // Deterministic ~50/50 split for demo mode so a preview looks like real
  // production (a natural mix of buy-direct + concierge), and stays stable for a
  // given vehicle across sorts/re-renders.
  function demoBuyDirect(v) {
    const key = String(v.vin || v.vehicle_id || v.title || "");
    let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h % 2 === 0;
  }
  // A listing is "buy direct" when the provider gives a real, openable dealer link
  // (paid tier / direct dealer feed). Until then it's concierge (lead-based). In
  // demo mode, ~half the cards are shown as buy-direct to mimic production.
  function dealerLink(v) {
    if (v.listing_url && /^https?:\/\//.test(v.listing_url)) return { url: v.listing_url, demo: false };
    if (DEALER_DEMO && demoBuyDirect(v)) { const q = encodeURIComponent(`${vehicleLabel(v)} ${v.source_name || ""}`.trim()); return { url: `https://www.google.com/search?q=${q}`, demo: true }; }
    return null;
  }
  function isBuyDirect(v) { return !!dealerLink(v); }
  function fulfillmentBadge(v) {
    return isBuyDirect(v)
      ? `<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200" title="Buy directly from the dealer — completes on the dealer's site">Buy direct</span>`
      : `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500" title="A DHI advisor lines up this vehicle for you">Concierge</span>`;
  }
  function submitVehicleRequest(v, contact) {
    const attr = (window.DHIAttribution ? window.DHIAttribution() : null);
    const r = (attr && attr.ref) || ref || "";
    const lead = {
      type: "customer", source: "AutoCommand · vehicle request", referral_code: r,
      name: contact.name, email: contact.email, phone: contact.phone,
      vehicle: vehicleLabel(v), vehicle_id: v.vehicle_id, vin: v.vin || "", asking_price: v.asking_price,
      listing_source: v.source_name || (v.deal_terms && v.deal_terms.source) || "", listing_url: v.listing_url || "",
      location: (v.location_city || "") + (v.location_state ? ", " + v.location_state : ""),
    };
    return fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }).catch(() => {});
  }
  async function getCar(id) {
    const v = findVehicle(id); if (!v) return;
    // Path A — buy direct: a real dealer link exists (or demo mode) → show the
    // visible hand-off so the buyer completes the purchase on the dealer's site.
    if (isBuyDirect(v)) { openHandoff(v); return; }
    // Otherwise concierge: request this exact VIN; a DHI advisor sources it.
    const c = contactFromForm();
    if (c.email && c.name) {
      submitVehicleRequest(v, c);
      pendingVehicleId = null;
      toast("Request received — a DHI advisor will line up this " + vehicleLabel(v) + " and follow up.");
    } else {
      pendingVehicleId = id;
      const nameEl = $("fv-name");
      if (nameEl) { nameEl.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => nameEl.focus(), 300); }
      toast("Add your name & email below, then submit and we'll line up this " + vehicleLabel(v) + ".");
    }
  }

  // ---- Path A: visible "Continue to dealer" hand-off ----------------------------
  // A clear interstitial so the buyer knows they're completing on the dealer's site
  // with DHI tracking the deal. Activates automatically when a real dealer link
  // exists; ?dealerDemo=1 lets the team preview it before links are connected.
  function closeHandoff() { const m = $("dealer-modal"); if (m) m.remove(); document.removeEventListener("keydown", onHandoffKey); }
  function onHandoffKey(e) { if (e.key === "Escape") closeHandoff(); }
  function openHandoff(v) {
    const d = dealerLink(v); if (!d) return;
    const attr = (window.DHIAttribution ? window.DHIAttribution() : null);
    const r = (attr && attr.ref) || ref || "";
    const sep = d.url.indexOf("?") >= 0 ? "&" : "?";
    const finalUrl = d.url + sep + "utm_source=dhi-autocommand&utm_medium=referral" + (r ? "&ref=" + encodeURIComponent(r) : "");
    const dealer = esc(v.source_name || "the dealer");
    closeHandoff();
    const wrap = document.createElement("div");
    wrap.id = "dealer-modal";
    wrap.className = "fixed inset-0 z-[60] flex items-center justify-center p-4";
    wrap.innerHTML = `
      <div data-close class="absolute inset-0 bg-brand-950/60"></div>
      <div role="dialog" aria-modal="true" class="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div class="bg-brand-900 px-5 py-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-cyan-300">Continue to dealer</p>
          <h3 class="mt-0.5 text-lg font-bold text-white">${esc(vehicleLabel(v))}</h3>
          <p class="text-sm text-cyan-100">${fmtUSD(v.asking_price)} · ${dealer}${v.location_state ? " · " + esc(v.location_state) : ""}</p>
        </div>
        <div class="px-5 py-4">
          <ol class="space-y-2 text-sm text-slate-600">
            <li class="flex gap-2"><span class="font-semibold text-cyan-600">1.</span><span>We'll open <b>${dealer}</b>'s listing in a new tab with DHI tracking.</span></li>
            <li class="flex gap-2"><span class="font-semibold text-cyan-600">2.</span><span>You complete the purchase with the dealer at their listed price.</span></li>
            <li class="flex gap-2"><span class="font-semibold text-cyan-600">3.</span><span>DHI stays with your deal for support — reach us anytime if you need help.</span></li>
          </ol>
          ${d.demo ? `<p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">Preview mode — with a connected dealer, Continue opens their exact listing. (This demo opens a search for the vehicle.)</p>` : ""}
          <div class="mt-4 flex gap-2">
            <button data-close class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <a data-go href="${esc(finalUrl)}" target="_blank" rel="noopener" class="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-cyan-700">Continue to ${dealer} &rarr;</a>
          </div>
          <p class="mt-2 text-center text-[11px] text-slate-400">The sale completes on the dealer's site. DHI does not take payment for vehicles.</p>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeHandoff));
    const go = wrap.querySelector("[data-go]");
    if (go) go.addEventListener("click", () => { submitVehicleRequest(v, contactFromForm()); closeHandoff(); toast("Opening " + (v.source_name || "the dealer") + " — we're tracking your deal."); });
    document.addEventListener("keydown", onHandoffKey);
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

  // CarGurus-style deal rating from the asking price vs. estimated market value.
  // price_vs_market_pct is negative when the car is priced below market (a better deal).
  function dealRating(sc) {
    const p = sc && sc.price_vs_market_pct;
    if (p == null || isNaN(p)) return null;
    if (p <= -8) return { key: "great", label: "Great Deal", badge: "bg-emerald-600 text-white", rank: 5 };
    if (p <= -2) return { key: "good",  label: "Good Deal",  badge: "bg-green-600 text-white",   rank: 4 };
    if (p < 5)   return { key: "fair",  label: "Fair Deal",  badge: "bg-sky-600 text-white",     rank: 3 };
    if (p < 12)  return { key: "high",  label: "High Price", badge: "bg-amber-500 text-white",   rank: 2 };
    return            { key: "over",  label: "Overpriced", badge: "bg-rose-600 text-white",    rank: 1 };
  }

  // Filter + sort the active bucket's vehicles per the on-results refine controls.
  function applyRefine(list) {
    let out = list.slice();
    if (photosOnly) out = out.filter((v) => v.photos && v.photos[0]);
    if (dealFilter === "great") out = out.filter((v) => { const d = dealRating(v.score || {}); return d && d.key === "great"; });
    else if (dealFilter === "good") out = out.filter((v) => { const d = dealRating(v.score || {}); return d && d.rank >= 4; });
    const price = (v) => (v.asking_price == null ? Infinity : Number(v.asking_price));
    const miles = (v) => (v.mileage == null ? Infinity : Number(v.mileage));
    const mkt = (v) => (v.score && v.score.price_vs_market_pct != null ? Number(v.score.price_vs_market_pct) : 0);
    const cmp = {
      "price-asc": (a, b) => price(a) - price(b),
      "price-desc": (a, b) => price(b) - price(a),
      "mileage-asc": (a, b) => miles(a) - miles(b),
      "year-desc": (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0),
      "deal": (a, b) => { const da = dealRating(a.score || {}), db = dealRating(b.score || {}); const r = (db ? db.rank : 0) - (da ? da.rank : 0); return r !== 0 ? r : mkt(a) - mkt(b); },
    }[sortBy];
    if (cmp) out.sort(cmp);
    return out;
  }

  function vehicleCard(v) {
    const sc = v.score || {};
    const score = sc.overall_score != null ? Number(sc.overall_score).toFixed(0) : null;
    const dr = dealRating(sc);
    const id = esc(v.vehicle_id);
    const checked = selected.has(v.vehicle_id) ? "checked" : "";
    const why = [];
    if (sc.mileage_class) why.push(esc(String(sc.mileage_class).replace(/_/g, " ")) + " miles");
    if (sc.dealer_reliability != null) why.push("dealer " + Math.round(sc.dealer_reliability * 100) + "%");
    why.push(sc.title_risk ? "title: " + esc(v.title_status || "review") : "clean title");
    if (v.accident_count != null) why.push(v.accident_count === 0 ? "no accidents" : v.accident_count + " accident(s)");
    return `<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="relative">${photoHtml(v)}
        ${dr ? `<span class="absolute left-2 top-2 rounded-md ${dr.badge} px-2 py-0.5 text-xs font-bold shadow">${dr.label}</span>` : ""}
        ${score ? `<span class="absolute right-2 top-2 rounded-full bg-brand-900/90 px-2 py-0.5 text-xs font-bold text-white" title="Match score">${score}</span>` : ""}
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
        <div class="mt-3 flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="truncate text-xs text-slate-400">${esc(v.source_name || v.source_type || "")}</span>
            ${fulfillmentBadge(v)}
          </div>
          <label class="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" data-cmp data-id="${id}" ${checked} class="h-4 w-4 rounded border-slate-300 text-cyan-600" /> Compare
          </label>
        </div>
        <button data-get="${id}" class="mt-3 w-full rounded-lg bg-cyan-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-cyan-700">${isBuyDirect(v) ? "Continue to dealer &rarr;" : "Request this vehicle &rarr;"}</button>
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
      ["Deal", (v) => { const d = dealRating(v.score || {}); return d ? `<span class="rounded ${d.badge} px-1.5 py-0.5 text-xs font-semibold">${d.label}</span>` : "—"; }],
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
    // If the buyer clicked "Request this vehicle" before entering contact info,
    // attach that specific vehicle to this submission now that we have their details.
    if (pendingVehicleId) {
      const v = findVehicle(pendingVehicleId); const c = contactFromForm();
      if (v && c.email && c.name) { submitVehicleRequest(v, c); toast("Request received — a DHI advisor will line up this " + vehicleLabel(v) + "."); }
      pendingVehicleId = null;
    }
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

  // Live external inventory auto-activates the moment a provider key is configured.
  fetch(FN("automotive-inventory"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) })
    .then((r) => r.json()).then((d) => { liveInventory = !!(d && d.configured); }).catch(() => {});
})();
