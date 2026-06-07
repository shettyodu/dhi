/* =====================================================================
   "Design Your Space" — immersive, guided lighting experience.
   Walks the user: environment -> space-by-space walkthrough -> plan,
   surfacing the right Keystone fixture families per space and funneling
   selections into the shared lighting cart (dhi_keystone_quote) + checkout.
   ===================================================================== */
(function () {
  const PRODUCTS = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []);
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const STORE = "dhi_keystone_quote";
  const IMG = "assets/img/products/";
  const root = document.getElementById("designer");
  if (!root) return;

  const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---- cart ---- */
  function getCart() {
    try { return (JSON.parse(localStorage.getItem(STORE)) || []).map((x) => typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }); }
    catch (e) { return []; }
  }
  function setCart(c) { localStorage.setItem(STORE, JSON.stringify(c)); }
  let cart = getCart();
  const qtyOf = (id) => { const l = cart.find((x) => x.id === id); return l ? l.qty : 0; };
  function addItem(id, d) {
    const l = cart.find((x) => x.id === id);
    if (l) { l.qty = Math.max(0, l.qty + d); if (l.qty === 0) cart = cart.filter((x) => x.id !== id); }
    else if (d > 0) cart.push({ id, qty: d });
    setCart(cart);
  }
  function setQtyAbs(id, n) {
    const l = cart.find((x) => x.id === id);
    if (l) { l.qty = Math.max(0, n); if (l.qty === 0) cart = cart.filter((x) => x.id !== id); }
    else if (n > 0) cart.push({ id, qty: n });
    setCart(cart);
  }
  const cartCount = () => cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = () => cart.reduce((s, l) => s + ((byId[l.id] && byId[l.id].p) || 0) * l.qty, 0);

  /* ---- fixture families (friendly) ---- */
  const FAM = {
    downlight: { label: "Recessed Downlights", blurb: "Clean, even ceiling light", img: "light-downlight-ps.png", m: (i) => /^KT-RDLED/.test(i) || /^KT-LED[\d.]+RD\b/.test(i) || /^KT-WDLED/.test(i) },
    troffer:   { label: "Troffers", blurb: "Bright, uniform ceiling grids", img: "light-troffer.png", m: (i, p) => /^KT-DDPTLED/.test(i) || /troffer/i.test(p.group || "") },
    panel:     { label: "Flat Panels", blurb: "Edge-lit, low-glare panels", img: "light-panel.png", m: (i) => /^KT-BPLED/.test(i) },
    highbay:   { label: "High Bays", blurb: "Powerful light for tall spaces", img: "light-highbay.png", m: (i) => /^KT-(HB|RH)LED/.test(i) },
    wallpack:  { label: "Wall Packs", blurb: "Building-mounted exterior light", img: "light-wallpack.png", m: (i) => /^KT-WPLED/.test(i) },
    flood:     { label: "Flood Lights", blurb: "Wide, directional area light", img: "light-flood.png", m: (i) => /^KT-FLED/.test(i) },
    area:      { label: "Area / Parking Lot", blurb: "Pole-mounted site lighting", img: "light-area.png", m: (i) => /^KT-ALED/.test(i) },
    canopy:    { label: "Canopy Lights", blurb: "Covered drive-through & garage", img: "light-canopy.png", m: (i) => /^KT-CYLED/.test(i) },
    vapor:     { label: "Vapor-Tight", blurb: "Sealed for wet / harsh areas", img: "light-vapor.png", m: (i) => /^KT-VTLED/.test(i) },
    strip:     { label: "Strip Lights", blurb: "Linear utility lighting", img: "light-strip.png", m: (i) => /^KT-SLFLED/.test(i) || /^KT-DDSLED/.test(i) },
    tube:      { label: "LED Tubes", blurb: "Fluorescent tube replacements", img: "light-tube.png", m: (i) => /^KT-LED[\d.]+T[58]/.test(i) },
    exit:      { label: "Exit Signs", blurb: "Code-compliant egress", img: "light-exit.png", m: (i) => /^KT-(EX|EC)/.test(i) },
    emergency: { label: "Emergency Lights", blurb: "Battery-backup safety", img: "light-emergency.png", m: (i) => /^KT-EM(?!RG)/.test(i) },
    par:       { label: "PAR Spots", blurb: "Accent & display lighting", img: "light-par.png", m: (i) => /^KT-LED[\d.]+PAR/.test(i) },
    decorative:{ label: "Decorative Bulbs", blurb: "Filament & ambiance", img: "light-globe.png", m: (i) => /F(A19|B11|ST19|ST64|G25|G16|G30|G40)/.test(i) },
    bollard:   { label: "Bollards", blurb: "Pathway & landscape", img: "light-bollard.png", m: (i) => /^KT-BLED/.test(i) },
  };
  // pick up to n priced products for a family
  function pick(fam, n) {
    const f = FAM[fam]; if (!f) return [];
    const out = [];
    for (const p of PRODUCTS) {
      if (p.p == null) continue;
      if (f.m(p.id, p)) { out.push(p); if (out.length >= n) break; }
    }
    return out;
  }
  function friendly(p, label) {
    const bits = [];
    if (p.w) bits.push(p.w);
    if (p.lm) bits.push(p.lm + " lm");
    else if (p.len) bits.push(p.len);
    if (p.cct) bits.push((String(p.cct).split(",")[0]).trim());
    return label + (bits.length ? " · " + bits.slice(0, 2).join(" · ") : "");
  }

  /* ---- room-size → suggested quantity (general-lighting coverage, sq ft / fixture) ---- */
  const COV = { downlight: 30, troffer: 64, panel: 64, vapor: 80, strip: 80, tube: 64, par: 25, decorative: 45, canopy: 160 };
  function suggestQty(fam, rm) {
    if (!rm || !rm.l || !rm.w) return null;
    const area = Number(rm.l) * Number(rm.w);
    if (!area) return null;
    let cov = COV[fam];
    if (fam === "highbay") { const h = Number(rm.h) || 20; cov = Math.min(600, Math.max(150, Math.round(h * h * 0.7))); }
    if (!cov) return null;
    return { n: Math.max(1, Math.ceil(area / cov)), area };
  }

  /* ---- scene palettes (generated per-space scenes; drop real photos into SCENES) ---- */
  const ENVPAL = {
    healthcare: ["#0e4a6e", "#071a30"], office: ["#143c6c", "#071a30"], warehouse: ["#334155", "#0a2540"],
    retail: ["#3b2a5e", "#0a2540"], exterior: ["#0a2540", "#020a16"], government: ["#0e3a5f", "#071a30"],
  };
  // Optional real photography: SCENES["healthcare:0"] = "assets/img/scenes/healthcare-patient-rooms.jpg"
  const SCENES = {};
  function genBg(c1, c2, angle, accent) {
    return `radial-gradient(circle at 78% 22%, ${accent}40, transparent 46%), linear-gradient(${angle}deg, ${c1}, ${c2})`;
  }

  /* ---- environments & zones ---- */
  const BANNER = ["assets/img/banner.jpg", "assets/img/banner1.jpg", "assets/img/banner2.jpg"];
  const ICON = {
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    building: '<path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M9 7h2m-2 4h2m-2 4h2M2 21h20"/>',
    box: '<path d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7"/>',
    bag: '<path d="M6 7V6a4 4 0 018 0v1m-9 0h10l1 13H5L6 7z"/>',
    car: '<path d="M3 13l2-5.2A2 2 0 016.9 6.5h10.2A2 2 0 0119 7.8L21 13v5h-2v-1H5v1H3v-5z"/><circle cx="7.5" cy="16" r="1.2"/><circle cx="16.5" cy="16" r="1.2"/>',
    landmark: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>',
  };
  const ENVS = [
    { key: "healthcare", label: "Healthcare Facility", sub: "Hospitals, clinics & medical offices", bg: BANNER[0], icon: "cross" },
    { key: "office", label: "Office & Corporate", sub: "Workplaces, education & community", bg: BANNER[1], icon: "building" },
    { key: "warehouse", label: "Warehouse & Industrial", sub: "Manufacturing, logistics & high-bay", bg: BANNER[2], icon: "box" },
    { key: "retail", label: "Retail & Hospitality", sub: "Stores, restaurants & venues", bg: BANNER[1], icon: "bag" },
    { key: "exterior", label: "Parking & Exterior", sub: "Lots, garages, façades & pathways", bg: BANNER[2], icon: "car" },
    { key: "government", label: "Government & Institutional", sub: "Agencies, schools & public facilities", bg: BANNER[0], icon: "landmark" },
  ];
  const ZONES = {
    healthcare: [
      { label: "Patient Rooms", guide: "Soft, even, glare-free light for rest and recovery.", fams: ["downlight", "panel", "troffer"] },
      { label: "Corridors & Lobbies", guide: "Welcoming, continuous light for wayfinding.", fams: ["downlight", "troffer", "tube"] },
      { label: "Exam & Procedure", guide: "Bright, high-CRI light for clinical accuracy.", fams: ["panel", "troffer", "downlight"] },
      { label: "Exterior & Parking", guide: "Safe, well-lit approaches and lots.", fams: ["wallpack", "area", "flood", "bollard"] },
      { label: "Exit & Emergency", guide: "Code-compliant egress and battery backup.", fams: ["exit", "emergency"] },
    ],
    office: [
      { label: "Open Office", guide: "Comfortable, low-glare light for productivity.", fams: ["panel", "troffer"] },
      { label: "Conference & Private", guide: "Refined, dimmable ambiance.", fams: ["downlight", "panel"] },
      { label: "Corridors & Restrooms", guide: "Clean, efficient utility light.", fams: ["downlight", "strip", "tube"] },
      { label: "Exterior & Parking", guide: "Secure building and lot lighting.", fams: ["wallpack", "area", "flood"] },
      { label: "Exit & Emergency", guide: "Egress and safety.", fams: ["exit", "emergency"] },
    ],
    warehouse: [
      { label: "High-Bay Areas", guide: "Powerful, efficient light from up high.", fams: ["highbay"] },
      { label: "Aisles & Racking", guide: "Targeted light down the rows.", fams: ["highbay", "strip"] },
      { label: "Loading Dock & Canopy", guide: "Bright, durable covered-area light.", fams: ["canopy", "wallpack", "vapor"] },
      { label: "Yard & Perimeter", guide: "Wide site and security coverage.", fams: ["area", "flood", "wallpack"] },
      { label: "Exit & Emergency", guide: "Safety and egress.", fams: ["exit", "emergency"] },
    ],
    retail: [
      { label: "Sales Floor", guide: "Crisp, inviting general light.", fams: ["downlight", "panel", "troffer"] },
      { label: "Accent & Display", guide: "Highlight products and features.", fams: ["par", "decorative"] },
      { label: "Back of House", guide: "Practical stockroom lighting.", fams: ["strip", "tube", "vapor"] },
      { label: "Exterior & Signage", guide: "Draw customers after dark.", fams: ["wallpack", "flood", "area"] },
      { label: "Exit & Emergency", guide: "Egress and safety.", fams: ["exit", "emergency"] },
    ],
    exterior: [
      { label: "Parking Lot", guide: "Even, glare-controlled site light.", fams: ["area", "flood"] },
      { label: "Garage & Canopy", guide: "Covered-area and drive-through light.", fams: ["canopy", "vapor"] },
      { label: "Pathways", guide: "Guide foot traffic safely.", fams: ["bollard"] },
      { label: "Building Façade", guide: "Architectural and security light.", fams: ["wallpack", "flood"] },
      { label: "Exit & Emergency", guide: "Egress and safety.", fams: ["exit", "emergency"] },
    ],
    government: [
      { label: "Offices & Admin", guide: "Comfortable workspace lighting.", fams: ["panel", "troffer"] },
      { label: "Corridors & Common", guide: "Durable public-space light.", fams: ["downlight", "troffer", "tube"] },
      { label: "Gym / Hangar / High-Bay", guide: "High-output for large volumes.", fams: ["highbay"] },
      { label: "Exterior & Security", guide: "Site, perimeter, and façade.", fams: ["area", "flood", "wallpack"] },
      { label: "Exit & Emergency", guide: "Egress and safety.", fams: ["exit", "emergency"] },
    ],
  };

  /* ---- state ---- */
  let state = { step: "intro", env: null, zone: 0, rooms: {} };
  const envObj = () => ENVS.find((e) => e.key === state.env);
  const zonesFor = () => ZONES[state.env] || [];
  const roomKey = () => `${state.env}:${state.zone}`;
  function planLink() {
    const payload = { e: state.env, i: cart.map((l) => [l.id, l.qty]) };
    let token = "";
    try { token = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch (e) { token = ""; }
    return location.origin + location.pathname + "?plan=" + token;
  }
  function decodePlan() {
    const m = new URLSearchParams(location.search).get("plan");
    if (!m) return false;
    try {
      const json = decodeURIComponent(escape(atob(m.replace(/-/g, "+").replace(/_/g, "/"))));
      const p = JSON.parse(json);
      if (Array.isArray(p.i)) {
        cart = p.i.map((x) => Array.isArray(x) ? { id: x[0], qty: x[1] || 1 } : { id: x.id, qty: x.qty || 1 }).filter((x) => byId[x.id]);
        setCart(cart);
        if (p.e) state.env = p.e;
        state.step = "summary";
        return true;
      }
    } catch (e) {}
    return false;
  }
  function captureRoom() {
    if (state.step !== "walk") return;
    const l = document.getElementById("rm-l"), w = document.getElementById("rm-w"), h = document.getElementById("rm-h");
    if (!l || !w) return;
    const lv = parseFloat(l.value) || 0, wv = parseFloat(w.value) || 0, hv = parseFloat(h.value) || 0;
    if (lv || wv || hv) state.rooms[roomKey()] = { l: lv || "", w: wv || "", h: hv || "" };
    else delete state.rooms[roomKey()];
  }

  /* ---- scaffold ---- */
  root.innerHTML = `<div id="scene-wrap" class="absolute inset-0"></div>
    <div class="absolute inset-0 bg-gradient-to-b from-brand-950/85 via-brand-950/70 to-brand-950/90"></div>
    <div id="ui" class="relative z-10 flex min-h-screen flex-col"></div>`;
  const sceneWrap = document.getElementById("scene-wrap");
  const ui = document.getElementById("ui");

  // scene = { key, bg (css background value), motif: url|null }
  function setScene(scene) {
    const cur = sceneWrap.querySelector(".scene.on");
    if (cur && cur.dataset.key === scene.key) return;
    const s = document.createElement("div");
    s.className = "scene kb"; s.dataset.key = scene.key;
    s.style.background = scene.bg; s.style.backgroundSize = "cover"; s.style.backgroundPosition = "center";
    if (scene.motif) {
      const m = document.createElement("img");
      m.src = scene.motif; m.alt = "";
      m.style.cssText = "position:absolute;right:-3%;bottom:-8%;width:46%;max-width:640px;opacity:.12;filter:drop-shadow(0 24px 48px rgba(0,0,0,.5));pointer-events:none";
      s.appendChild(m);
    }
    sceneWrap.appendChild(s);
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add("on")));
    const olds = [...sceneWrap.querySelectorAll(".scene")].filter((x) => x !== s);
    setTimeout(() => olds.forEach((o) => o.remove()), 900);
  }
  // build a distinct scene per environment+space (real photo if provided in SCENES)
  function zoneScene(env, zi) {
    const photo = SCENES[`${env}:${zi}`];
    if (photo) return { key: `p-${env}-${zi}`, bg: `url('${photo}')`, motif: null };
    const z = (ZONES[env] || [])[zi] || { fams: [] };
    const pal = ENVPAL[env] || ["#0e3a5f", "#071a30"];
    const accent = z.fams.some((f) => f === "exit" || f === "emergency") ? "#f59e0b" : "#06b6d4";
    const motif = (FAM[z.fams[0]] || {}).img ? IMG + FAM[z.fams[0]].img : null;
    return { key: `g-${env}-${zi}`, bg: genBg(pal[0], pal[1], 120 + zi * 18, accent), motif };
  }
  const brandScene = (key) => ({ key, bg: genBg("#0e3a5f", "#071a30", 135, "#06b6d4"), motif: null });
  function paint(html, scene) {
    if (scene) setScene(scene);
    ui.innerHTML = topbar() + `<div class="pop flex-1">${html}</div>`;
    const pop = ui.querySelector(".pop");
    requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add("in")));
  }
  function toast(msg) {
    const t = document.getElementById("toast");
    t.innerHTML = `<div class="rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl">${msg}</div>`;
    t.style.opacity = "1";
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.opacity = "0"), 1900);
  }

  /* ---- top bar ---- */
  function topbar() {
    const n = cartCount();
    const progress = state.step === "walk"
      ? `<span class="hidden sm:inline text-white/80">${envObj().label}</span><span class="text-white/40">·</span><span class="text-cyan-300">Space ${state.zone + 1} of ${zonesFor().length}</span>`
      : `<span class="text-white/70">Guided lighting designer</span>`;
    return `<header class="flex items-center justify-between px-4 py-4 sm:px-8">
      <a href="lighting.html" class="flex items-center gap-2 text-white">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-bold text-sm">DHI</span>
        <span class="hidden text-sm font-semibold sm:inline">Lighting</span>
      </a>
      <div class="flex items-center gap-3 text-xs font-medium sm:text-sm">${progress}</div>
      <button data-act="summary" class="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.4 12.3a2 2 0 002 1.7h7.7a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
        My plan${n ? ` · ${n}` : ""}
      </button>
    </header>`;
  }

  /* ---- steps ---- */
  function renderIntro() {
    paint(`
      <div class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">DHI · Keystone Lighting</p>
        <h1 class="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">Let's light your space</h1>
        <p class="mt-5 max-w-xl text-lg text-white/80">Answer one question, take a quick walkthrough of your spaces, and we'll help you pick the right fixtures — room by room.</p>
        <button data-act="start" class="glow mt-10 rounded-full bg-cyan-500 px-8 py-4 text-base font-bold text-brand-950 hover:bg-cyan-400">Start designing →</button>
        <a href="lighting-catalog.html" class="mt-4 text-sm font-medium text-white/60 hover:text-white">or browse the full catalog</a>
      </div>`, { key: "intro", bg: `url('${BANNER[0]}')`, motif: null });
  }

  function renderEnv() {
    const cards = ENVS.map((e) => `
      <button data-act="env:${e.key}" class="glow group relative flex h-44 flex-col justify-end overflow-hidden rounded-2xl p-5 text-left ring-1 ring-white/10">
        <div class="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style="background-image:url('${e.bg}')"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/50 to-brand-900/20"></div>
        <div class="relative">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/90 text-brand-950"><svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICON[e.icon]}</svg></span>
          <h3 class="mt-3 font-display text-lg font-bold text-white">${e.label}</h3>
          <p class="text-xs text-white/70">${e.sub}</p>
        </div>
      </button>`).join("");
    paint(`
      <div class="mx-auto w-full max-w-5xl px-6 py-10">
        <h2 class="text-center font-display text-3xl font-extrabold text-white sm:text-4xl">What are you lighting?</h2>
        <p class="mt-2 text-center text-white/70">Pick the environment closest to your project.</p>
        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>
      </div>`, brandScene("env"));
  }

  function optionCard(p, label, fam) {
    const img = p.img ? p.img : null;
    const q = qtyOf(p.id);
    const sug = q ? null : suggestQty(fam, state.rooms[roomKey()]);
    return `<div class="flex flex-col rounded-2xl bg-white/95 p-4 text-slate-800 shadow-xl ring-1 ring-black/5">
      <div class="h-24 overflow-hidden rounded-lg bg-slate-50">${window.SKUPhoto ? SKUPhoto.svg(p) : (img ? `<div class="flex h-full items-center justify-center p-2"><img src="${img}" alt="" class="max-h-20 w-auto object-contain"/></div>` : `<div class="flex h-full items-center justify-center"><span class="text-xs text-slate-400">${label}</span></div>`)}</div>
      <h4 class="mt-3 text-sm font-semibold leading-snug text-brand-900">${friendly(p, label)}</h4>
      <p class="font-mono text-[10px] text-slate-400">${p.id}</p>
      ${sug ? `<p class="mt-1 text-[11px] font-semibold text-cyan-700">≈ ${sug.n} for ${sug.area} sq ft</p>` : ""}
      <div class="mt-2 flex items-center justify-between">
        <span class="font-display text-lg font-bold text-brand-900">${money(p.p)}</span>
        ${q
          ? `<div class="inline-flex items-center rounded-md border border-slate-300"><button data-dec="${p.id}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">−</button><span class="px-3 text-sm font-semibold">${q}</span><button data-inc="${p.id}" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100">+</button></div>`
          : `<button data-add="${p.id}" data-qty="${sug ? sug.n : 1}" class="rounded-lg bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">${sug ? "Add " + sug.n : "Add"}</button>`}
      </div>
    </div>`;
  }

  function renderWalk() {
    const zones = zonesFor();
    const z = zones[state.zone];
    const groups = z.fams.map((fk) => {
      const items = pick(fk, 2);
      if (!items.length) return "";
      const f = FAM[fk];
      return `<div class="mt-6">
        <div class="flex items-baseline gap-2"><h3 class="font-display text-lg font-bold text-white">${f.label}</h3><span class="text-xs text-white/60">${f.blurb}</span></div>
        <div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${items.map((p) => optionCard(p, f.label, fk)).join("")}</div>
      </div>`;
    }).join("");
    const dots = zones.map((_, i) => `<span class="h-1.5 rounded-full transition-all ${i === state.zone ? "w-7 bg-cyan-400" : "w-1.5 bg-white/30"}"></span>`).join("");
    const last = state.zone === zones.length - 1;
    const rm = state.rooms[roomKey()] || {};
    const hasArea = rm.l && rm.w;
    const roomPanel = `
      <div class="mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
        <div class="flex flex-wrap items-end gap-3">
          <div><label class="block text-[11px] font-medium text-white/70">Length (ft)</label><input id="rm-l" value="${rm.l || ""}" inputmode="decimal" class="mt-1 w-24 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm text-slate-800 focus:outline-none"/></div>
          <div><label class="block text-[11px] font-medium text-white/70">Width (ft)</label><input id="rm-w" value="${rm.w || ""}" inputmode="decimal" class="mt-1 w-24 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm text-slate-800 focus:outline-none"/></div>
          <div><label class="block text-[11px] font-medium text-white/70">Ceiling ht (ft)</label><input id="rm-h" value="${rm.h || ""}" placeholder="opt" inputmode="decimal" class="mt-1 w-24 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm text-slate-800 focus:outline-none"/></div>
          <button data-act="recommend" class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-white/90">Recommend quantities</button>
          ${hasArea ? `<button data-act="applyall" class="glow rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-brand-950 hover:bg-cyan-400">Apply suggested</button><span class="text-xs text-white/70">${Number(rm.l) * Number(rm.w)} sq ft</span>` : ""}
        </div>
        <p class="mt-2 text-[11px] text-white/50">Enter room size for suggested fixture counts (general-lighting estimate; adjust for layout &amp; tasks).</p>
      </div>`;
    paint(`
      <div class="mx-auto w-full max-w-5xl px-6 pb-28 pt-4">
        <div class="flex items-center gap-2">${dots}</div>
        <h2 class="mt-5 font-display text-3xl font-extrabold text-white sm:text-4xl">${z.label}</h2>
        <p class="mt-2 max-w-2xl text-white/80">${z.guide}</p>
        ${roomPanel}
        ${groups || '<p class="mt-8 text-white/60">No catalog matches for this space yet — skip ahead or browse the full catalog.</p>'}
      </div>
      <div class="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-brand-950/80 backdrop-blur">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
          <button data-act="back" class="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Back</button>
          <span class="text-sm text-white/70">${cartCount() ? cartCount() + " items · " + money(cartTotal()) : "Add the fixtures you need"}</span>
          <button data-act="next" class="glow rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-bold text-brand-950 hover:bg-cyan-400">${last ? "Review plan →" : "Next space →"}</button>
        </div>
      </div>`, zoneScene(state.env, state.zone));
  }

  function renderSummary() {
    const lines = cart.map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);
    const priced = lines.filter((l) => l.p.p != null);
    const sub = priced.reduce((s, l) => s + l.p.p * l.qty, 0);
    // group by category
    const groups = {};
    lines.forEach((l) => { (groups[l.p.cat] = groups[l.p.cat] || []).push(l); });
    const body = lines.length ? Object.keys(groups).map((cat) => `
      <div class="mt-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-cyan-300">${cat}</h3>
        <ul class="mt-2 divide-y divide-white/10">
          ${groups[cat].map((l) => `<li class="flex items-center justify-between gap-3 py-2.5">
            <div class="flex items-center gap-3 min-w-0"><span class="h-10 w-10 flex-none overflow-hidden rounded bg-white/90">${window.SKUPhoto ? SKUPhoto.svg(l.p, { variant: "thumb" }) : (l.p.img ? `<img src="${l.p.img}" class="h-full w-full object-contain p-1"/>` : "")}</span>
              <div class="min-w-0"><p class="truncate text-sm font-medium text-white">${l.p.id}</p>${l.p.group ? `<p class="truncate text-xs text-white/50">${l.p.group}</p>` : ""}</div></div>
            <div class="flex items-center gap-3">
              <div class="inline-flex items-center rounded-md border border-white/25"><button data-dec="${l.id}" class="px-2 py-0.5 text-white/80 hover:bg-white/10">−</button><span class="px-2.5 text-sm font-semibold text-white">${l.qty}</span><button data-inc="${l.id}" class="px-2 py-0.5 text-white/80 hover:bg-white/10">+</button></div>
              <span class="w-20 text-right text-sm font-semibold text-white">${l.p.p != null ? money(l.p.p * l.qty) : "quote"}</span>
            </div></li>`).join("")}
        </ul>
      </div>`).join("") : `<p class="mt-10 text-center text-white/70">Your plan is empty. Walk through your spaces and add the fixtures you need.</p>`;
    paint(`
      <div class="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
       <div class="rounded-3xl bg-brand-950/90 p-6 ring-1 ring-white/10 sm:p-8">
        <h2 class="font-display text-3xl font-extrabold text-white sm:text-4xl">Your lighting plan</h2>
        <p class="mt-2 text-white/70">Review your selections, then check out or keep building.</p>
        ${body}
        ${lines.length ? `<div class="mt-8 flex items-center justify-between rounded-2xl bg-white/10 px-5 py-4">
          <span class="text-white/80">Estimated subtotal <span class="text-xs text-white/50">(excl. tax &amp; freight)</span></span>
          <span class="font-display text-2xl font-extrabold text-white">${money(sub)}</span></div>
          <div class="mt-6 flex flex-wrap gap-3">
            <a href="checkout.html" class="glow flex-1 rounded-lg bg-cyan-500 px-6 py-3.5 text-center text-base font-bold text-brand-950 hover:bg-cyan-400">Proceed to checkout →</a>
            <button data-act="back-walk" class="rounded-lg border border-white/25 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10">Add more spaces</button>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <span class="text-sm font-medium text-white/70">Save &amp; share this plan:</span>
            <button data-act="copylink" class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copy link</button>
            <button data-act="emaillink" class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Email plan</button>
          </div>` : `<div class="mt-8"><button data-act="start" class="rounded-lg bg-cyan-500 px-6 py-3 font-bold text-brand-950 hover:bg-cyan-400">Choose an environment</button></div>`}
        <div class="mt-6 text-center"><a href="lighting-catalog.html" class="text-sm text-white/60 hover:text-white">Browse the full catalog instead</a></div>
       </div>
      </div>`, { key: "summary", bg: genBg((ENVPAL[state.env] || ["#0e3a5f", "#071a30"])[0], "#071a30", 135, "#06b6d4"), motif: null });
  }

  function render() {
    if (state.step === "intro") return renderIntro();
    if (state.step === "env") return renderEnv();
    if (state.step === "walk") return renderWalk();
    if (state.step === "summary") return renderSummary();
  }

  /* ---- single delegated handler ---- */
  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]");
    const add = e.target.closest("[data-add]");
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (add) { const n = parseInt(add.dataset.qty, 10) || 1; captureRoom(); setQtyAbs(add.dataset.add, n); toast(n > 1 ? `Added ${n} to your plan` : `Added to your plan`); return render(); }
    if (inc) { addItem(inc.dataset.inc, 1); return render(); }
    if (dec) { addItem(dec.dataset.dec, -1); return render(); }
    if (!act) return;
    const a = act.dataset.act;
    if (a === "start") { state.step = "env"; return render(); }
    if (a.startsWith("env:")) { state.env = a.slice(4); state.zone = 0; state.step = "walk"; return render(); }
    if (a === "next") { captureRoom(); state.zone < zonesFor().length - 1 ? state.zone++ : (state.step = "summary"); return render(); }
    if (a === "back") { captureRoom(); state.step === "walk" && state.zone > 0 ? state.zone-- : (state.step = "env"); return render(); }
    if (a === "back-walk") { state.step = "walk"; return render(); }
    if (a === "summary") { captureRoom(); state.step = "summary"; return render(); }
    if (a === "recommend") { captureRoom(); toast(state.rooms[roomKey()] ? "Suggested counts updated" : "Enter length & width first"); return render(); }
    if (a === "applyall") {
      captureRoom();
      const rm = state.rooms[roomKey()];
      let added = 0;
      if (rm) zonesFor()[state.zone].fams.forEach((fk) => {
        const s = suggestQty(fk, rm); const it = pick(fk, 1)[0];
        if (s && it) { setQtyAbs(it.id, s.n); added += s.n; }
      });
      toast(added ? `Added ${added} fixtures for this space` : "Enter room size first");
      return render();
    }
    if (a === "copylink") {
      const url = planLink();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => toast("Share link copied to clipboard")).catch(() => prompt("Copy your plan link:", url));
      } else { prompt("Copy your plan link:", url); }
      return;
    }
    if (a === "emaillink") {
      const url = planLink();
      const body = `Here's our lighting plan from Digital Health International — ${cartCount()} fixtures, est. ${money(cartTotal())} (excl. tax & freight):%0D%0A%0D%0A${encodeURIComponent(url)}%0D%0A%0D%0AOpen the link to review, adjust, or check out.`;
      location.href = `mailto:?subject=${encodeURIComponent("Our DHI lighting plan")}&body=${body}`;
      return;
    }
  });

  if (!decodePlan()) { /* default intro */ }
  render();
})();
