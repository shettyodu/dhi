/* lighting-zonal.js — Zonal-cavity studio: tabbed side controls that live-update
   a dimensioned, orbitable 3D room. Zonal-cavity method (RCR + reflectances ->
   estimated CU) + point-by-point heatmap (toggle). Self-contained canvas 3D
   (no external libs). Estimates only — enter the fixture's photometric CU and
   verify against its IES file for a stamped design. */
(function () {
  "use strict";
  var app = document.getElementById("zonal-app"); if (!app) return;
  var STORE = "dhi_keystone_quote";
  var ALL = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);

  function nums(s) { if (s == null) return []; var m = String(s).replace(/,/g, "").match(/\d+(\.\d+)?/g); return m ? m.map(Number) : []; }
  function rep(s) { var n = nums(s); if (!n.length) return 0; return n.length >= 2 ? Math.round((n[0] + n[1]) / 2) : n[0]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var FIX = ALL.filter(function (p) { return p.cat === "Fixtures" && rep(p.lm) > 0; })
    .map(function (p) { return { id: p.id, group: p.group || "Fixture", lm: rep(p.lm), w: rep(p.w), lmRaw: p.lm, sup: p.supplier || "" }; })
    .sort(function (a, b) { return a.group.localeCompare(b.group) || a.id.localeCompare(b.id); });
  var tro = FIX.filter(function (f) { return /troffer|panel/i.test(f.group); }).sort(function (a, b) { return b.lm - a.lm; })[0];
  var DEF = tro || FIX.filter(function (f) { return /high bay/i.test(f.group); }).sort(function (a, b) { return b.lm - a.lm; })[0] || FIX.slice().sort(function (a, b) { return b.lm - a.lm; })[0] || null;

  var PRESETS = [
    { k: "warehouse", label: "Warehouse — storage", fc: 20 }, { k: "rack", label: "Warehouse — rack/aisle", fc: 30 },
    { k: "highbay", label: "Manufacturing / industrial", fc: 30 }, { k: "office", label: "Office / classroom", fc: 40 },
    { k: "gym", label: "Gymnasium / recreation", fc: 50 }, { k: "sports", label: "Sports — competition", fc: 75 },
    { k: "retail", label: "Retail / sales floor", fc: 50 }, { k: "parking", label: "Parking / garage", fc: 5 }, { k: "custom", label: "Custom target", fc: 40 },
  ];
  var REFL = [
    { k: "80/50/20", c: 80, w: 50, f: 20, label: "80 / 50 / 20 — bright office" },
    { k: "70/50/20", c: 70, w: 50, f: 20, label: "70 / 50 / 20 — light commercial" },
    { k: "50/30/20", c: 50, w: 30, f: 20, label: "50 / 30 / 20 — industrial" },
    { k: "30/30/20", c: 30, w: 30, f: 20, label: "30 / 30 / 20 — dark structure" },
    { k: "custom", c: 0, w: 0, f: 0, label: "Custom" },
  ];
  var LPD_ALLOW = { warehouse: 0.66, rack: 0.66, highbay: 1.11, office: 0.71, gym: 0.72, sports: 0.72, retail: 1.05, parking: 0.18 };
  function isRound(g) { return /high bay|down|canopy|area|road|flood|spot|bollard/i.test(g || ""); }
  function autoDist(g) { return /high bay|area|flood|road|down|canopy|spot/i.test(g) ? 3 : 1.2; }
  var CUT = [0.87, 0.80, 0.72, 0.65, 0.59, 0.53, 0.48, 0.44, 0.40, 0.37, 0.34];
  function baseCU(r) { if (r <= 0) return CUT[0]; if (r >= 10) return CUT[10]; var i = Math.floor(r); return CUT[i] + (CUT[i + 1] - CUT[i]) * (r - i); }
  function estCU(r, pc, pw, pf) { var cu = baseCU(r) * (1 + 0.40 * (pw - 0.50) * (r / 10)) * (1 + 0.15 * (pc - 0.80)) * (1 + 0.05 * (pf - 0.20)); return Math.max(0.20, Math.min(0.95, cu)); }
  var STOPS = [[43, 58, 140], [31, 155, 224], [39, 193, 153], [242, 197, 61], [224, 73, 46]];
  function colorFor(t) { t = Math.max(0, Math.min(1, t)); var s = t * (STOPS.length - 1), i = Math.floor(s); if (i >= STOPS.length - 1) return "rgb(" + STOPS[STOPS.length - 1].join(",") + ")"; var a = STOPS[i], b = STOPS[i + 1], f = s - i; return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," + Math.round(a[1] + (b[1] - a[1]) * f) + "," + Math.round(a[2] + (b[2] - a[2]) * f) + ")"; }

  var st = {
    L: 40, W: 20, ceilH: 10, wp: 2.5, susp: 0, preset: "office", target: 40, refl: "80/50/20", pc: 80, pw: 50, pf: 20,
    fixId: DEF ? DEF.id : "", lm: DEF ? DEF.lm : 0, w: DEF ? DEF.w : 0, dist: DEF ? autoDist(DEF.group) : 1.2, lld: 0.90, ldd: 0.90, cuAuto: true,
  };
  var view = { az: -0.68, el: 0.62, dist: 0 };
  var lastViz = null, projFloor = [], heat = false, showDim = true, showFix = true, spinning = false, drag = false, lx = 0, ly = 0;

  var ICON = {
    lamp: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    cube: '<svg viewBox="0 0 24 24"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg>',
    calc: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h4M8 15h2M12 15h4"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
    cube2: '<svg viewBox="0 0 24 24"><path d="M12 3l7 4v8l-7 4-7-4V7z"/></svg>',
    refl: '<svg viewBox="0 0 24 24"><path d="M4 20L18 6M9 6h9v9"/></svg>',
  };

  function fixOptions() {
    var last = "", out = "";
    FIX.forEach(function (f) {
      if (f.group !== last) { if (last) out += "</optgroup>"; out += '<optgroup label="' + esc(f.group) + '">'; last = f.group; }
      out += '<option value="' + esc(f.id) + '"' + (f.id === st.fixId ? " selected" : "") + ">" + esc(f.id) + " — " + f.lm.toLocaleString() + " lm" + (f.w ? " · " + f.w + "W" : "") + "</option>";
    });
    if (last) out += "</optgroup>";
    return out;
  }
  function row(label, ctrl, unit) { return '<div class="zs-row"><label>' + label + "</label>" + ctrl + (unit ? '<span class="zs-unit">' + unit + "</span>" : "") + "</div>"; }
  function inp(id, val, step) { return '<input class="zs-val" id="' + id + '" type="number"' + (step ? ' step="' + step + '"' : "") + ' value="' + val + '" />'; }

  app.innerHTML =
    '<div class="zs-shell">' +
      '<div class="zs-panel">' +
        '<div class="zs-bar">' +
          '<button class="zs-ic" data-tab="fixture" title="Fixture">' + ICON.lamp + "</button>" +
          '<button class="zs-ic on" data-tab="room" title="Room">' + ICON.cube + "</button>" +
          '<button class="zs-ic" data-tab="calc" title="Design target">' + ICON.calc + "</button>" +
          '<button class="zs-ic" data-tab="set" title="Display">' + ICON.gear + "</button>" +
        "</div>" +
        '<div class="zs-sub" id="zs-roomsub">' +
          '<button class="zs-tab on" data-sub="size">' + ICON.cube2 + " Room Size</button>" +
          '<button class="zs-tab" data-sub="refl">' + ICON.refl + " Reflectance</button>" +
        "</div>" +
        // Fixture
        '<div class="zs-fields" id="zf-fixture">' +
          '<div class="zs-row zs-full"><label>Luminaire</label><select class="zs-val" id="z-fix">' + fixOptions() + "</select></div>" +
          row("Lumens", inp("z-lm", st.lm), "lm") + row("Watts", inp("z-w", st.w), "W") +
          '<div class="zs-row zs-full"><label>Distribution</label><select class="zs-val" id="z-dist"><option value="1.2">Wide</option><option value="3">Medium</option><option value="6">Narrow</option></select></div>' +
        "</div>" +
        // Room size
        '<div class="zs-fields on" id="zf-size">' +
          row("Length", inp("z-L", st.L), "ft") + row("Width", inp("z-W", st.W), "ft") + row("Height", inp("z-ceil", st.ceilH, "0.5"), "ft") +
          row("Workplane Height", inp("z-wp", st.wp, "0.5"), "ft") + row("Suspension Length", inp("z-susp", st.susp, "0.5"), "ft") +
        "</div>" +
        // Reflectance
        '<div class="zs-fields" id="zf-refl">' +
          '<div class="zs-row zs-full"><label>Preset</label><select class="zs-val" id="z-refl">' + REFL.map(function (r) { return '<option value="' + r.k + '"' + (r.k === st.refl ? " selected" : "") + ">" + esc(r.label) + "</option>"; }).join("") + "</select></div>" +
          row("Ceiling", inp("z-pc", st.pc), "%") + row("Walls", inp("z-pw", st.pw), "%") + row("Floor", inp("z-pf", st.pf), "%") +
        "</div>" +
        // Calc
        '<div class="zs-fields" id="zf-calc">' +
          '<div class="zs-row zs-full"><label>Application</label><select class="zs-val" id="z-preset">' + PRESETS.map(function (p) { return '<option value="' + p.k + '"' + (p.k === st.preset ? " selected" : "") + ">" + esc(p.label) + " (" + p.fc + " fc)</option>"; }).join("") + "</select></div>" +
          row("Target", inp("z-target", st.target), "fc") + row("LLD (lamp)", inp("z-lld", st.lld, "0.01"), "") + row("LDD (dirt)", inp("z-ldd", st.ldd, "0.01"), "") +
          row("CU", '<input class="zs-val" id="z-cu" type="number" step="0.01" disabled />', "") +
          '<label class="zs-ck"><input type="checkbox" id="z-cuauto" checked /> Estimate CU (uncheck to enter photometric CU)</label>' +
        "</div>" +
        // Settings
        '<div class="zs-fields" id="zf-set">' +
          '<label class="zs-ck"><input type="checkbox" id="z-showdim" checked /> Show dimensions</label>' +
          '<label class="zs-ck"><input type="checkbox" id="z-showfix" checked /> Show luminaires</label>' +
          '<label class="zs-ck"><input type="checkbox" id="z-heatck" /> Illuminance heatmap on floor</label>' +
        "</div>" +
      "</div>" +

      '<div class="zs-stats">' +
        '<div class="zs-stat"><div class="n"><span id="z-fc">—</span><span class="u">fc</span></div><div class="l">average maintained</div></div>' +
        '<div class="zs-stat"><div class="n"><span id="z-count">—</span><span class="u">luminaires</span></div><div class="l" id="z-cu-l">—</div></div>' +
        '<div class="zs-stat"><div class="n"><span id="z-lpd">—</span><span class="u">W/ft²</span></div><div class="l">connected load</div></div>' +
        '<div class="zs-subline" id="z-sub" style="flex-basis:100%;width:100%">Set the room on the left — the design updates as you type.</div>' +
      "</div>" +

      '<div class="zs-viz">' +
        '<div class="zs-vtop"><span class="cap">3D room <span class="sub">drag to orbit · scroll to zoom · hover for fc</span></span>' +
          '<div class="zs-ctrls"><button class="zs-b" id="z-heat">Heatmap</button><button class="zs-b" id="z-spin">Spin</button><button class="zs-b" id="z-reset3d">Reset</button></div></div>' +
        '<div style="position:relative;flex:1;display:flex"><canvas id="z-canvas"></canvas><div id="z-tip"></div></div>' +
        '<div class="zs-legend" id="z-leg" style="display:none"><span id="r-min2">—</span><div class="zs-legbar"></div><span id="r-max2">—</span></div>' +
        '<div class="zs-flag" id="r-flag"></div>' +
        '<div class="zs-flag" id="r-code" style="margin-top:8px;display:none"></div>' +
        '<div class="zs-actions"><button class="zs-actbtn p" id="r-add">Add to quote</button><button class="zs-actbtn s" id="r-print">Print design sheet</button></div>' +
      "</div>" +
    "</div>";

  var $ = function (id) { return document.getElementById(id); };
  function numv(id, min) { var e = $(id); if (!e) return 0; var v = parseFloat(e.value); if (isNaN(v)) v = 0; if (min != null && v < min) v = min; return v; }

  /* ---- tabs ---- */
  function showTab(tab) {
    ["fixture", "room", "calc", "set"].forEach(function (t) { var b = document.querySelector('.zs-ic[data-tab="' + t + '"]'); if (b) b.classList.toggle("on", t === tab); });
    $("zs-roomsub").style.display = tab === "room" ? "flex" : "none";
    $("zf-fixture").classList.toggle("on", tab === "fixture");
    $("zf-calc").classList.toggle("on", tab === "calc");
    $("zf-set").classList.toggle("on", tab === "set");
    if (tab === "room") showSub(document.querySelector('.zs-tab.on') ? document.querySelector('.zs-tab.on').dataset.sub : "size");
    else { $("zf-size").classList.remove("on"); $("zf-refl").classList.remove("on"); }
  }
  function showSub(sub) {
    document.querySelectorAll(".zs-tab").forEach(function (b) { b.classList.toggle("on", b.dataset.sub === sub); });
    $("zf-size").classList.toggle("on", sub === "size"); $("zf-refl").classList.toggle("on", sub === "refl");
  }
  document.querySelectorAll(".zs-ic").forEach(function (b) { b.addEventListener("click", function () { showTab(this.dataset.tab); }); });
  document.querySelectorAll(".zs-tab").forEach(function (b) { b.addEventListener("click", function () { showSub(this.dataset.sub); }); });

  function syncFixture(id) {
    var f = FIX.filter(function (x) { return x.id === id; })[0];
    if (f) { st.fixId = f.id; $("z-lm").value = f.lm; $("z-w").value = f.w; st.dist = autoDist(f.group); $("z-dist").value = String(st.dist); }
    else st.fixId = "";
  }

  /* ---- calc ---- */
  function pointGrid(L, W, count, hRC, lumensMaint, avgZonal, nDist) {
    var cols = Math.max(1, Math.round(Math.sqrt(count * (L / Math.max(W, 0.1)))));
    var rows = Math.max(1, Math.ceil(count / cols));
    var fx = []; for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) fx.push([(c + 0.5) / cols * L, (r + 0.5) / rows * W]);
    var I0 = lumensMaint * (nDist + 1) / (2 * Math.PI);
    var npx = Math.min(16, Math.max(6, Math.round(L / 3))), npy = Math.min(16, Math.max(6, Math.round(W / 3)));
    var grid = [], sum = 0;
    for (var j = 0; j < npy; j++) { var rv = []; for (var i = 0; i < npx; i++) {
      var px = (i + 0.5) / npx * L, py = (j + 0.5) / npy * W, E = 0;
      for (var k = 0; k < fx.length; k++) { var dx = px - fx[k][0], dy = py - fx[k][1], d2 = dx * dx + dy * dy + hRC * hRC, d = Math.sqrt(d2), cosT = hRC / d; E += I0 * Math.pow(cosT, nDist) * cosT / d2; }
      rv.push(E); sum += E;
    } grid.push(rv); }
    var directAvg = sum / (npx * npy) || 1, scale = avgZonal / directAvg, min = 1e9, max = 0;
    for (var y = 0; y < npy; y++) for (var x = 0; x < npx; x++) { grid[y][x] *= scale; min = Math.min(min, grid[y][x]); max = Math.max(max, grid[y][x]); }
    return { grid: grid, npx: npx, npy: npy, rows: rows, cols: cols, fx: fx, min: min, max: max, uAvgMin: avgZonal / (min || 1), uMaxMin: max / (min || 1) };
  }
  function sampleUV(pg, u, v) {
    var gx = u * pg.npx - 0.5, gy = v * pg.npy - 0.5;
    gx = Math.max(0, Math.min(pg.npx - 1, gx)); gy = Math.max(0, Math.min(pg.npy - 1, gy));
    var x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(pg.npx - 1, x0 + 1), y1 = Math.min(pg.npy - 1, y0 + 1), fx = gx - x0, fy = gy - y0;
    var a = pg.grid[y0][x0], b = pg.grid[y0][x1], c = pg.grid[y1][x0], d = pg.grid[y1][x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  function compute() {
    st.L = numv("z-L", 1); st.W = numv("z-W", 1); st.ceilH = numv("z-ceil", 1); st.wp = numv("z-wp", 0); st.susp = numv("z-susp", 0);
    st.target = numv("z-target", 1); st.lm = numv("z-lm", 0); st.w = numv("z-w", 0);
    st.pc = numv("z-pc", 0); st.pw = numv("z-pw", 0); st.pf = numv("z-pf", 0);
    st.lld = numv("z-lld", 0.1) || 0.9; st.ldd = numv("z-ldd", 0.1) || 0.9; st.dist = parseFloat($("z-dist").value) || 1.2; st.cuAuto = $("z-cuauto").checked;

    var area = st.L * st.W, hRC = Math.max(0.1, st.ceilH - st.wp - st.susp);
    var rcr = 5 * hRC * (st.L + st.W) / (st.L * st.W);
    var pc = st.pc / 100, pw = st.pw / 100, pf = st.pf / 100;
    var cu = st.cuAuto ? estCU(rcr, pc, pw, pf) : (numv("z-cu", 0.1) || estCU(rcr, pc, pw, pf));
    if (st.cuAuto) $("z-cu").value = cu.toFixed(2);
    var llf = st.lld * st.ldd, perFix = st.lm * cu * llf;
    var count = (perFix > 0 && area > 0) ? Math.ceil((st.target * area) / perFix) : 0;
    var avgZonal = area > 0 ? (count * perFix) / area : 0, totalW = count * st.w, lpd = area > 0 ? totalW / area : 0;

    $("z-fc").textContent = count ? Math.round(avgZonal) : "—";
    $("z-count").textContent = count ? count : "—";
    $("z-lpd").textContent = (count && st.w) ? lpd.toFixed(2) : "—";
    $("z-cu-l").textContent = count ? ("RCR " + rcr.toFixed(2) + " · CU " + cu.toFixed(2)) : "—";

    var pg = count ? pointGrid(st.L, st.W, count, hRC, st.lm * llf, avgZonal, st.dist) : null;
    if (pg) {
      var spL = st.L / pg.cols, spW = st.W / pg.rows;
      $("z-sub").innerHTML = "Layout <b>" + pg.rows + " × " + pg.cols + "</b> · spacing <b>" + spL.toFixed(2) + " × " + spW.toFixed(2) + " ft</b> · " + esc(st.fixId || "custom fixture");
      $("r-min2").textContent = Math.round(pg.min) + " fc"; $("r-max2").textContent = Math.round(pg.max) + " fc";
      var fl = $("r-flag");
      if (pg.uAvgMin <= 1.7) { fl.className = "zs-flag ok"; fl.textContent = "Even coverage — avg/min uniformity " + pg.uAvgMin.toFixed(2) + " (≤ 1.7)."; }
      else if (pg.uAvgMin <= 2.5) { fl.className = "zs-flag ok"; fl.textContent = "Acceptable uniformity — avg/min " + pg.uAvgMin.toFixed(2) + "."; }
      else { fl.className = "zs-flag warn"; fl.textContent = "Uneven — avg/min " + pg.uAvgMin.toFixed(2) + " (> 2.5). Add fixtures or widen distribution."; }
    } else { $("z-sub").textContent = "Enter room size, target, and fixture lumens."; $("r-flag").className = "zs-flag warn"; $("r-flag").textContent = "Enter room size, target, and fixture lumens to run the calculation."; }

    var codeEl = $("r-code"), allow = LPD_ALLOW[st.preset];
    if (count && st.w && allow) {
      codeEl.style.display = "block";
      if (lpd <= allow + 1e-9) { codeEl.className = "zs-flag ok"; codeEl.textContent = "Energy code: " + lpd.toFixed(2) + " W/ft² — within the typical ASHRAE 90.1 allowance (~" + allow.toFixed(2) + ") for this space. Verify your code edition."; }
      else { codeEl.className = "zs-flag warn"; codeEl.textContent = "Energy code: " + lpd.toFixed(2) + " W/ft² — about " + Math.round((lpd / allow - 1) * 100) + "% over the typical allowance (~" + allow.toFixed(2) + "). Verify your code edition."; }
    } else codeEl.style.display = "none";

    var selG = (FIX.filter(function (x) { return x.id === st.fixId; })[0] || {}).group || "";
    lastViz = pg ? { L: st.L, W: st.W, H: st.ceilH, wp: st.wp, susp: st.susp, pg: pg, round: isRound(selG) } : null;
    fillPrint(count, rcr, cu, llf, avgZonal, totalW, lpd, area, hRC, pg);
    draw3D();
    return count;
  }

  /* ---- 3D ---- */
  function sizeCanvas(cv) {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 640, h = cv.clientHeight || 460;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx: ctx, w: w, h: h };
  }
  function rot3(px, py, pz, C, az, el) { var x = px - C[0], y = py - C[1], z = pz - C[2], ca = Math.cos(az), sa = Math.sin(az), x1 = x * ca - y * sa, y1 = x * sa + y * ca, ce = Math.cos(el), se = Math.sin(el); return [x1, y1 * se + z * ce, y1 * ce - z * se]; }
  function draw3D() {
    var cv = $("z-canvas"); if (!cv) return;
    var S = sizeCanvas(cv), ctx = S.ctx, cw = S.w, ch = S.h; ctx.clearRect(0, 0, cw, ch);
    if (!lastViz) return;
    var L = lastViz.L, W = lastViz.W, H = lastViz.H, wp = lastViz.wp, pg = lastViz.pg;
    var C = [L / 2, W / 2, H / 2], maxD = Math.max(L, W, H);
    var az = view.az, el = Math.max(0.12, Math.min(1.4, view.el)), dist = maxD * 1.7 + view.dist, focal = maxD * 2.8, scale = Math.min(cw, ch) / maxD * 0.6;
    function P(px, py, pz) { var r = rot3(px, py, pz, C, az, el); var pp = focal / (focal + r[2] + dist); return { x: cw / 2 + r[0] * pp * scale, y: ch / 2 - r[1] * pp * scale, d: r[2], pp: pp }; }
    ctx.lineJoin = "round"; ctx.lineCap = "round";

    // floor
    if (heat) {
      var MX = Math.min(54, pg.npx * 3), MY = Math.min(54, pg.npy * 3), cells = [];
      for (var j = 0; j < MY; j++) for (var i = 0; i < MX; i++) {
        var a = P(i / MX * L, j / MY * W, wp), b = P((i + 1) / MX * L, j / MY * W, wp), c = P((i + 1) / MX * L, (j + 1) / MY * W, wp), d = P(i / MX * L, (j + 1) / MY * W, wp);
        var t = (sampleUV(pg, (i + 0.5) / MX, (j + 0.5) / MY) - pg.min) / ((pg.max - pg.min) || 1);
        cells.push({ p: [a, b, c, d], t: t, depth: (a.d + b.d + c.d + d.d) / 4 });
      }
      cells.sort(function (m, n) { return n.depth - m.depth; });
      cells.forEach(function (cell) { var col = colorFor(cell.t); ctx.beginPath(); ctx.moveTo(cell.p[0].x, cell.p[0].y); for (var k = 1; k < 4; k++) ctx.lineTo(cell.p[k].x, cell.p[k].y); ctx.closePath(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.fill(); ctx.stroke(); });
    } else {
      var f0 = P(0, 0, 0), f1 = P(L, 0, 0), f2 = P(L, W, 0), f3 = P(0, W, 0);
      ctx.beginPath(); ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.lineTo(f3.x, f3.y); ctx.closePath(); ctx.fillStyle = "rgba(214,221,229,0.55)"; ctx.fill();
    }

    // walls + ceiling faint (skip near walls)
    var faces = [
      { q: [[0,0,0],[L,0,0],[L,0,H],[0,0,H]] }, { q: [[L,0,0],[L,W,0],[L,W,H],[L,0,H]] },
      { q: [[L,W,0],[0,W,0],[0,W,H],[L,W,H]] }, { q: [[0,W,0],[0,0,0],[0,0,H],[0,W,H]] },
    ];
    faces.forEach(function (fa) { var pts = fa.q.map(function (p) { return P(p[0], p[1], p[2]); }); if ((pts[0].d + pts[1].d) / 2 <= 0) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (var k = 1; k < 4; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.closePath(); ctx.fillStyle = "rgba(150,166,184,0.10)"; ctx.fill(); });

    // hover points
    projFloor = [];
    for (var jj = 0; jj < pg.npy; jj++) for (var ii = 0; ii < pg.npx; ii++) { var ph = P((ii + 0.5) / pg.npx * L, (jj + 0.5) / pg.npy * W, wp); projFloor.push({ sx: ph.x, sy: ph.y, fc: pg.grid[jj][ii] }); }

    // wireframe
    var cn = [[0,0,0],[L,0,0],[L,W,0],[0,W,0],[0,0,H],[L,0,H],[L,W,H],[0,W,H]].map(function (p) { return P(p[0], p[1], p[2]); });
    var edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    ctx.strokeStyle = "rgba(90,105,122,0.55)"; ctx.lineWidth = 1;
    edges.forEach(function (e) { ctx.beginPath(); ctx.moveTo(cn[e[0]].x, cn[e[0]].y); ctx.lineTo(cn[e[1]].x, cn[e[1]].y); ctx.stroke(); });

    // dimensions
    if (showDim) {
      var o = Math.max(1.2, maxD * 0.05);
      function dim(a3, b3, label) {
        var a = P(a3[0], a3[1], a3[2]), b = P(b3[0], b3[1], b3[2]);
        ctx.strokeStyle = "rgba(110,122,135,0.85)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        [a, b].forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, 7); ctx.fillStyle = "rgba(110,122,135,0.95)"; ctx.fill(); });
        ctx.fillStyle = "#54606c"; ctx.font = "10px Inter,system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3); ctx.textAlign = "start";
      }
      dim([0, -o, 0], [L, -o, 0], "" + st.L);
      dim([L + o, 0, 0], [L + o, W, 0], "" + st.W);
      dim([-o, 0, 0], [-o, 0, H], st.ceilH.toFixed(1));
      dim([-o * 2.4, 0, 0], [-o * 2.4, 0, wp], wp.toFixed(2));
      var cols = pg.cols, rows = pg.rows, cx0 = 0.5 / cols * L, cx1 = 1.5 / cols * L, cy0 = 0.5 / rows * W, cy1 = 1.5 / rows * W;
      dim([0, 0, H], [cx0, 0, H], cx0.toFixed(2)); if (cols > 1) dim([cx0, 0, H], [cx1, 0, H], (L / cols).toFixed(2));
      dim([0, 0, H], [0, cy0, H], cy0.toFixed(2)); if (rows > 1) dim([0, cy0, H], [0, cy1, H], (W / rows).toFixed(2));
    }

    // fixtures
    if (showFix) {
      var fz = H - (lastViz.susp || 0), round = lastViz.round;
      pg.fx.forEach(function (f) {
        var top = P(f[0], f[1], fz);
        if (round) { var rad = Math.max(2.4, 0.9 * top.pp * scale); ctx.beginPath(); ctx.arc(top.x, top.y, rad, 0, 7); ctx.fillStyle = "#242a31"; ctx.fill(); }
        else { var hx = Math.min(3.6, L / Math.max(pg.cols, 1) * 0.36), q = [P(f[0] - hx, f[1] - 0.55, fz), P(f[0] + hx, f[1] - 0.55, fz), P(f[0] + hx, f[1] + 0.55, fz), P(f[0] - hx, f[1] + 0.55, fz)]; ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (var k2 = 1; k2 < 4; k2++) ctx.lineTo(q[k2].x, q[k2].y); ctx.closePath(); ctx.fillStyle = "#242a31"; ctx.fill(); }
      });
    }
  }
  function resetView() { view.az = -0.68; view.el = 0.62; view.dist = 0; draw3D(); }
  function spinLoop() { if (!spinning) return; view.az += 0.0045; draw3D(); requestAnimationFrame(spinLoop); }

  function fillPrint(count, rcr, cu, llf, avgZonal, totalW, lpd, area, hRC, pg) {
    var p = $("z-print"); if (!count) { p.innerHTML = ""; return; }
    function r(k, v) { return "<tr><td style=\"color:#64748b;width:34%\">" + esc(k) + "</td><td style=\"color:#0f172a;font-weight:600\">" + v + "</td></tr>"; }
    p.innerHTML =
      '<div class="pr-h"><b style="font-size:14px;color:#0b2a45">DHI Lighting — Zonal-Cavity Design Estimate</b><span style="font-size:11px;color:#64748b">digitalhealthinternational.com</span></div>' +
      '<div class="pr-title">Lighting design estimate</div>' +
      "<table><tbody>" +
        r("Space", st.L + " × " + st.W + " ft = " + area.toLocaleString() + " ft² · ceiling " + st.ceilH + " ft · work plane " + st.wp + " ft") +
        r("Reflectances (c/w/f)", st.pc + " / " + st.pw + " / " + st.pf + " %") + r("Room Cavity Ratio", rcr.toFixed(2)) +
        r("Fixture", esc(st.fixId || "Custom") + " · " + st.lm.toLocaleString() + " lm" + (st.w ? " · " + st.w + " W" : "")) +
        r("CU / LLF", cu.toFixed(2) + (st.cuAuto ? " (est.)" : " (photometric)") + " · " + llf.toFixed(2)) +
      "</tbody></table>" +
      '<table style="margin-top:8px"><thead><tr><th>Result</th><th>Value</th></tr></thead><tbody>' +
        r("Luminaires", String(count)) + r("Layout", pg.rows + " × " + pg.cols) + r("Average maintained", Math.round(avgZonal) + " fc") +
        r("Point-by-point", "min " + Math.round(pg.min) + " · max " + Math.round(pg.max) + " fc · avg/min " + pg.uAvgMin.toFixed(2)) +
        (st.w ? r("Connected load", totalW.toLocaleString() + " W · " + lpd.toFixed(2) + " W/ft²") : "") +
      "</tbody></table>" +
      '<div class="pr-disc">Zonal-cavity (IESNA) method; CU ' + (st.cuAuto ? "estimated for a generic direct distribution" : "from fixture photometrics") + "; point-by-point is a modeled estimate. Verify against the luminaire IES file for a stamped design. Prepared " + dateStr() + " · DHI Lighting.</div>";
  }
  function dateStr() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ""; } }

  function addToCart() {
    var count = compute(); if (!count) { toast("Enter room size and fixture lumens first."); return; }
    if (!st.fixId) { toast("Pick a catalog fixture to add it to the quote."); return; }
    var cart = []; try { cart = (JSON.parse(localStorage.getItem(STORE)) || []).map(function (x) { return typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }; }); } catch (e) {}
    var ex = cart.filter(function (l) { return l.id === st.fixId; })[0]; if (ex) ex.qty += count; else cart.push({ id: st.fixId, qty: count });
    localStorage.setItem(STORE, JSON.stringify(cart)); try { window.dispatchEvent(new CustomEvent("dhi-cart-changed")); } catch (e) {}
    toast(count + " × " + st.fixId + " added to your quote.");
  }
  var toastT; function toast(m) { var t = $("z-toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600); }

  /* ---- wiring ---- */
  ["z-L", "z-W", "z-ceil", "z-wp", "z-susp", "z-target", "z-lm", "z-w", "z-pc", "z-pw", "z-pf", "z-lld", "z-ldd"].forEach(function (id) { $(id).addEventListener("input", compute); });
  $("z-dist").addEventListener("change", compute);
  $("z-preset").addEventListener("change", function () { st.preset = this.value; var p = PRESETS.filter(function (x) { return x.k === st.preset; })[0]; if (p && st.preset !== "custom") $("z-target").value = p.fc; compute(); });
  $("z-refl").addEventListener("change", function () { st.refl = this.value; var r = REFL.filter(function (x) { return x.k === st.refl; })[0]; if (r && st.refl !== "custom") { $("z-pc").value = r.c; $("z-pw").value = r.w; $("z-pf").value = r.f; } compute(); });
  $("z-fix").addEventListener("change", function () { syncFixture(this.value); compute(); });
  $("z-cuauto").addEventListener("change", function () { $("z-cu").disabled = this.checked; compute(); });
  $("z-cu").addEventListener("input", function () { if (!$("z-cuauto").checked) compute(); });
  $("z-showdim").addEventListener("change", function () { showDim = this.checked; draw3D(); });
  $("z-showfix").addEventListener("change", function () { showFix = this.checked; draw3D(); });
  function setHeat(on) { heat = on; $("z-heat").classList.toggle("on", on); $("z-heatck").checked = on; $("z-leg").style.display = on ? "flex" : "none"; draw3D(); }
  $("z-heat").addEventListener("click", function () { setHeat(!heat); });
  $("z-heatck").addEventListener("change", function () { setHeat(this.checked); });
  $("r-add").addEventListener("click", addToCart);
  $("r-print").addEventListener("click", function () { compute(); window.print(); });

  (function initCanvas() {
    var cv = $("z-canvas"), tip = $("z-tip");
    function stopSpin() { if (spinning) { spinning = false; var sb = $("z-spin"); if (sb) { sb.textContent = "Spin"; sb.classList.remove("on"); } } }
    cv.addEventListener("pointerdown", function (e) { stopSpin(); drag = true; lx = e.clientX; ly = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) {} if (tip) tip.style.display = "none"; });
    cv.addEventListener("pointermove", function (e) {
      if (drag) { view.az += (e.clientX - lx) * 0.01; view.el += (e.clientY - ly) * 0.01; lx = e.clientX; ly = e.clientY; draw3D(); return; }
      if (!tip || !projFloor.length) return;
      var rc = cv.getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top, best = null, bd = 1e9;
      for (var i = 0; i < projFloor.length; i++) { var dx = projFloor[i].sx - mx, dy = projFloor[i].sy - my, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = projFloor[i]; } }
      if (best && bd < 24 * 24) { tip.style.display = "block"; tip.style.left = best.sx + "px"; tip.style.top = best.sy + "px"; tip.textContent = Math.round(best.fc) + " fc"; } else tip.style.display = "none";
    });
    cv.addEventListener("pointerup", function () { drag = false; });
    cv.addEventListener("pointercancel", function () { drag = false; });
    cv.addEventListener("pointerleave", function () { if (tip) tip.style.display = "none"; });
    cv.addEventListener("wheel", function (e) { e.preventDefault(); var m = lastViz ? Math.max(lastViz.L, lastViz.W, lastViz.H) : 30; view.dist += e.deltaY * 0.012 * (m / 30); draw3D(); }, { passive: false });
    cv.addEventListener("dblclick", resetView);
    window.addEventListener("resize", draw3D);
    $("z-reset3d").addEventListener("click", resetView);
    $("z-spin").addEventListener("click", function () { spinning = !spinning; this.textContent = spinning ? "Stop" : "Spin"; this.classList.toggle("on", spinning); if (spinning) spinLoop(); });
  })();

  syncFixture(st.fixId);
  compute();
})();
