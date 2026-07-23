/* lighting-zonal.js — Zonal-cavity interior lighting calculator.
   Room Cavity Ratio + surface reflectances -> estimated Coefficient of
   Utilization -> average maintained illuminance / fixture count, plus a
   point-by-point foot-candle grid (direct cosine distribution normalized to the
   zonal average) with uniformity ratios. Any catalog fixture (lumens) or manual.
   Add-to-quote (shared cart) + printable design sheet.

   Estimates only: CU is estimated for a generic direct distribution — enter the
   fixture's photometric CU for a stamped design. The grid is a modeled estimate,
   not a point-by-point calc from an IES file. */
(function () {
  "use strict";
  var app = document.getElementById("zonal-app");
  if (!app) return;
  var STORE = "dhi_keystone_quote";
  var ALL = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);

  function nums(s) { if (s == null) return []; var m = String(s).replace(/,/g, "").match(/\d+(\.\d+)?/g); return m ? m.map(Number) : []; }
  function rep(s) { var n = nums(s); if (!n.length) return 0; return n.length >= 2 ? Math.round((n[0] + n[1]) / 2) : n[0]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var FIX = ALL.filter(function (p) { return p.cat === "Fixtures" && rep(p.lm) > 0; })
    .map(function (p) { return { id: p.id, group: p.group || "Fixture", lm: rep(p.lm), w: rep(p.w), lmRaw: p.lm, sup: p.supplier || "" }; })
    .sort(function (a, b) { return a.group.localeCompare(b.group) || a.id.localeCompare(b.id); });
  var DEF = FIX.filter(function (f) { return /high bay/i.test(f.group); }).sort(function (a, b) { return b.lm - a.lm; })[0]
    || FIX.slice().sort(function (a, b) { return b.lm - a.lm; })[0] || null;

  var PRESETS = [
    { k: "warehouse", label: "Warehouse — general storage", fc: 20 }, { k: "rack", label: "Warehouse — rack / aisle", fc: 30 },
    { k: "highbay", label: "Manufacturing / industrial", fc: 30 }, { k: "office", label: "Office / classroom", fc: 40 },
    { k: "gym", label: "Gymnasium / recreation", fc: 50 }, { k: "sports", label: "Sports — competition", fc: 75 },
    { k: "retail", label: "Retail / sales floor", fc: 50 }, { k: "parking", label: "Parking / garage", fc: 5 }, { k: "custom", label: "Custom target", fc: 30 },
  ];
  var REFL = [
    { k: "80/50/20", c: 0.80, w: 0.50, f: 0.20, label: "80 / 50 / 20 — bright office / retail" },
    { k: "70/50/20", c: 0.70, w: 0.50, f: 0.20, label: "70 / 50 / 20 — light commercial" },
    { k: "50/30/20", c: 0.50, w: 0.30, f: 0.20, label: "50 / 30 / 20 — industrial / warehouse" },
    { k: "30/30/20", c: 0.30, w: 0.30, f: 0.20, label: "30 / 30 / 20 — dark / exposed structure" },
    { k: "custom", c: 0, w: 0, f: 0, label: "Custom reflectances" },
  ];
  // distribution exponent (I = I0·cosⁿθ): wide (lensed troffer) → narrow (aisle/spot)
  function autoDist(group) { return /high bay|area|flood|road|down|canopy|spot/i.test(group) ? 3 : 1.2; }

  var CUT = [0.87, 0.80, 0.72, 0.65, 0.59, 0.53, 0.48, 0.44, 0.40, 0.37, 0.34];
  function baseCU(r) { if (r <= 0) return CUT[0]; if (r >= 10) return CUT[10]; var i = Math.floor(r); return CUT[i] + (CUT[i + 1] - CUT[i]) * (r - i); }
  function estCU(r, pc, pw, pf) {
    var cu = baseCU(r) * (1 + 0.40 * (pw - 0.50) * (r / 10)) * (1 + 0.15 * (pc - 0.80)) * (1 + 0.05 * (pf - 0.20));
    return Math.max(0.20, Math.min(0.95, cu));
  }

  var st = {
    project: "", room: "", L: 40, W: 30, ceilH: 10, wp: 2.5, susp: 0,
    preset: "office", fc: 40, refl: "80/50/20", pc: 0.80, pw: 0.50, pf: 0.20,
    fixId: DEF ? DEF.id : "", lm: DEF ? DEF.lm : 0, w: DEF ? DEF.w : 0,
    lld: 0.90, ldd: 0.90, dist: DEF ? autoDist(DEF.group) : 1.2, cuAuto: true, cu: 0,
  };
  // default the office-ish demo to a troffer if available, else keep DEF
  var tro = FIX.filter(function (f) { return /troffer|panel/i.test(f.group); }).sort(function (a, b) { return b.lm - a.lm; })[0];
  if (tro) { st.fixId = tro.id; st.lm = tro.lm; st.w = tro.w; st.dist = autoDist(tro.group); }

  function fixOptions() {
    var last = "", out = "";
    FIX.forEach(function (f) {
      if (f.group !== last) { if (last) out += "</optgroup>"; out += '<optgroup label="' + esc(f.group) + '">'; last = f.group; }
      out += '<option value="' + esc(f.id) + '"' + (f.id === st.fixId ? " selected" : "") + ">" + esc(f.id) + " — " + f.lm.toLocaleString() + " lm" + (f.w ? " · " + f.w + "W" : "") + "</option>";
    });
    if (last) out += "</optgroup>";
    return out;
  }

  app.innerHTML =
    '<div class="z-wrap">' +
      '<div class="z-card">' +
        '<div class="z-h">Room &amp; cavity</div>' +
        '<div class="z-row"><div class="z-f"><label>Project / bid name</label><input class="z-inp" id="z-project" placeholder="e.g. Bldg 4 — office relight" /></div><div class="z-f"><label>Room / area</label><input class="z-inp" id="z-room" placeholder="e.g. 2nd floor" /></div></div>' +
        '<div class="z-row three"><div class="z-f"><label>Length <span class="u">(ft)</span></label><input class="z-inp" id="z-L" type="number" min="1" value="40" /></div><div class="z-f"><label>Width <span class="u">(ft)</span></label><input class="z-inp" id="z-W" type="number" min="1" value="30" /></div><div class="z-f"><label>Ceiling ht <span class="u">(ft)</span></label><input class="z-inp" id="z-ceil" type="number" min="1" value="10" /></div></div>' +
        '<div class="z-row"><div class="z-f"><label>Work-plane ht <span class="u">(ft)</span></label><input class="z-inp" id="z-wp" type="number" step="0.5" min="0" value="2.5" /><div class="z-hint">Desks ≈ 2.5 · floor/aisle ≈ 0</div></div><div class="z-f"><label>Fixture suspension <span class="u">(ft)</span></label><input class="z-inp" id="z-susp" type="number" step="0.5" min="0" value="0" /><div class="z-hint">0 = ceiling / recessed</div></div></div>' +

        '<div class="z-h" style="margin-top:20px">Surface reflectances <span class="sub">ceiling / walls / floor</span></div>' +
        '<div class="z-row one"><div class="z-f"><select class="z-sel" id="z-refl">' + REFL.map(function (r) { return '<option value="' + r.k + '"' + (r.k === st.refl ? " selected" : "") + ">" + esc(r.label) + "</option>"; }).join("") + "</select></div></div>" +
        '<div class="z-row three"><div class="z-f"><label>Ceiling <span class="u">%</span></label><input class="z-inp" id="z-pc" type="number" min="0" max="90" value="80" /></div><div class="z-f"><label>Walls <span class="u">%</span></label><input class="z-inp" id="z-pw" type="number" min="0" max="90" value="50" /></div><div class="z-f"><label>Floor <span class="u">%</span></label><input class="z-inp" id="z-pf" type="number" min="0" max="90" value="20" /></div></div>' +

        '<div class="z-h" style="margin-top:20px">Fixture &amp; target</div>' +
        '<div class="z-row"><div class="z-f"><label>Application</label><select class="z-sel" id="z-preset">' + PRESETS.map(function (p) { return '<option value="' + p.k + '"' + (p.k === st.preset ? " selected" : "") + ">" + esc(p.label) + " (" + p.fc + " fc)</option>"; }).join("") + '</select></div><div class="z-f"><label>Target <span class="u">(fc)</span></label><input class="z-inp" id="z-fc" type="number" min="1" value="40" /></div></div>' +
        '<div class="z-row one"><div class="z-f"><label>Fixture (from catalog)</label><select class="z-sel" id="z-fix">' + fixOptions() + '</select><div class="z-hint" id="z-fixhint"></div></div></div>' +
        '<div class="z-row three"><div class="z-f"><label>Lumens</label><input class="z-inp" id="z-lm" type="number" min="1" value="' + st.lm + '" /></div><div class="z-f"><label>Watts</label><input class="z-inp" id="z-w" type="number" min="0" value="' + st.w + '" /></div><div class="z-f"><label>Distribution</label><select class="z-sel" id="z-dist"><option value="1.2">Wide</option><option value="3">Medium</option><option value="6">Narrow</option></select></div></div>' +
        '<div class="z-row three"><div class="z-f"><label>LLD <span class="u">(lamp)</span></label><input class="z-inp" id="z-lld" type="number" step="0.01" min="0.5" max="1" value="0.90" /></div><div class="z-f"><label>LDD <span class="u">(dirt)</span></label><input class="z-inp" id="z-ldd" type="number" step="0.01" min="0.5" max="1" value="0.90" /></div><div class="z-f"><label>CU <span class="u">(util.)</span></label><input class="z-inp" id="z-cu" type="number" step="0.01" min="0.1" max="0.95" disabled /></div></div>' +
        '<label class="z-ck"><input type="checkbox" id="z-cuauto" checked /> Estimate CU from cavity ratio &amp; reflectances (uncheck to enter the fixture\'s photometric CU)</label>' +
      '</div>' +

      '<div class="z-res">' +
        '<div class="z-card">' +
          '<div class="z-h">Result</div>' +
          '<div class="z-big"><div class="n" id="r-count">—</div><div class="l">fixtures required</div></div>' +
          '<div class="z-metrics">' +
            '<div class="z-m"><div class="n" id="r-rcr">—</div><div class="l">Room Cavity Ratio</div></div>' +
            '<div class="z-m"><div class="n" id="r-cu">—</div><div class="l">CU (est.)</div></div>' +
            '<div class="z-m"><div class="n" id="r-llf">—</div><div class="l">LLF</div></div>' +
            '<div class="z-m"><div class="n" id="r-avg">—</div><div class="l">avg maint. fc</div></div>' +
            '<div class="z-m"><div class="n" id="r-grid">—</div><div class="l">layout (r×c)</div></div>' +
            '<div class="z-m"><div class="n" id="r-lpd">—</div><div class="l">W / ft²</div></div>' +
          '</div>' +
          '<div class="z-flag" id="r-flag"></div>' +
          '<div class="z-heat">' +
            '<div class="cap"><span>Point-by-point (fc)</span><span id="r-unif"></span></div>' +
            '<div id="r-heat"></div>' +
            '<div class="z-legend"><span id="r-min">—</span><div class="z-legbar"></div><span id="r-max">—</span></div>' +
          '</div>' +
          '<div class="z-btns"><button class="z-btn p" id="r-add">Add to quote</button><button class="z-btn s" id="r-print">Print design sheet</button></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var $ = function (id) { return document.getElementById(id); };
  function numv(id, min) { var v = parseFloat($(id).value); if (isNaN(v)) v = 0; if (min != null && v < min) v = min; return v; }

  function syncFixture(id) {
    var f = FIX.filter(function (x) { return x.id === id; })[0];
    if (f) { st.fixId = f.id; $("z-lm").value = f.lm; $("z-w").value = f.w; st.dist = autoDist(f.group); $("z-dist").value = String(st.dist); $("z-fixhint").textContent = f.sup + (f.lmRaw && String(f.lmRaw) !== String(f.lm) ? " · catalog rating " + f.lmRaw + " lm (representative value used)" : ""); }
    else { st.fixId = ""; $("z-fixhint").textContent = "Custom fixture — enter lumens, watts, and distribution."; }
  }

  // color scale for the fc heatmap (low → high)
  var STOPS = [[43, 58, 140], [31, 155, 224], [39, 193, 153], [242, 197, 61], [224, 73, 46]];
  function colorFor(t) {
    t = Math.max(0, Math.min(1, t)); var s = t * (STOPS.length - 1); var i = Math.floor(s); if (i >= STOPS.length - 1) return "rgb(" + STOPS[STOPS.length - 1].join(",") + ")";
    var a = STOPS[i], b = STOPS[i + 1], f = s - i;
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," + Math.round(a[1] + (b[1] - a[1]) * f) + "," + Math.round(a[2] + (b[2] - a[2]) * f) + ")";
  }

  function pointGrid(L, W, count, hRC, lumensMaint, avgZonal, nDist) {
    var cols = Math.max(1, Math.round(Math.sqrt(count * (L / Math.max(W, 0.1)))));
    var rows = Math.max(1, Math.ceil(count / cols));
    var fx = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) fx.push([(c + 0.5) / cols * L, (r + 0.5) / rows * W]);
    var I0 = lumensMaint * (nDist + 1) / (2 * Math.PI);
    var npx = Math.min(16, Math.max(6, Math.round(L / 3))), npy = Math.min(16, Math.max(6, Math.round(W / 3)));
    var grid = [], sum = 0;
    for (var j = 0; j < npy; j++) { var rowv = []; for (var i = 0; i < npx; i++) {
      var px = (i + 0.5) / npx * L, py = (j + 0.5) / npy * W, E = 0;
      for (var k = 0; k < fx.length; k++) { var dx = px - fx[k][0], dy = py - fx[k][1], d2 = dx * dx + dy * dy + hRC * hRC, d = Math.sqrt(d2), cosT = hRC / d; E += I0 * Math.pow(cosT, nDist) * cosT / d2; }
      rowv.push(E); sum += E;
    } grid.push(rowv); }
    var directAvg = sum / (npx * npy) || 1;
    var scale = avgZonal / directAvg; // normalize pattern to the zonal average maintained fc
    var min = 1e9, max = 0;
    for (var y = 0; y < npy; y++) for (var x = 0; x < npx; x++) { grid[y][x] *= scale; min = Math.min(min, grid[y][x]); max = Math.max(max, grid[y][x]); }
    return { grid: grid, npx: npx, npy: npy, rows: rows, cols: cols, fx: fx, min: min, max: max, uAvgMin: avgZonal / (min || 1), uMaxMin: max / (min || 1) };
  }

  function drawHeat(pg, L, W) {
    var box = $("r-heat");
    if (!pg) { box.innerHTML = ""; return; }
    var Wd = 380, ar = W > 0 ? L / W : 1.4, Hd = Math.max(120, Math.min(300, Wd / ar));
    var cw = Wd / pg.npx, ch = Hd / pg.npy, cells = "";
    for (var j = 0; j < pg.npy; j++) for (var i = 0; i < pg.npx; i++) {
      var v = pg.grid[j][i], t = (v - pg.min) / ((pg.max - pg.min) || 1);
      cells += '<rect x="' + (i * cw).toFixed(1) + '" y="' + (j * ch).toFixed(1) + '" width="' + (cw + 0.6).toFixed(1) + '" height="' + (ch + 0.6).toFixed(1) + '" fill="' + colorFor(t) + '"/>';
    }
    var dots = pg.fx.map(function (p) { return '<circle cx="' + (p[0] / L * Wd).toFixed(1) + '" cy="' + (p[1] / W * Hd).toFixed(1) + '" r="3.4" fill="#fff" stroke="#0b2a45" stroke-width="1"/>'; }).join("");
    box.innerHTML = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" width="100%" height="' + Hd + '" style="display:block;border-radius:10px;overflow:hidden">' + cells + dots + '</svg>';
  }

  function compute() {
    st.L = numv("z-L", 1); st.W = numv("z-W", 1); st.ceilH = numv("z-ceil", 1);
    st.wp = numv("z-wp", 0); st.susp = numv("z-susp", 0);
    st.fc = numv("z-fc", 1); st.lm = numv("z-lm", 0); st.w = numv("z-w", 0);
    st.pc = numv("z-pc", 0) / 100; st.pw = numv("z-pw", 0) / 100; st.pf = numv("z-pf", 0) / 100;
    st.lld = numv("z-lld", 0.1) || 0.9; st.ldd = numv("z-ldd", 0.1) || 0.9;
    st.dist = parseFloat($("z-dist").value) || 1.2;
    st.project = $("z-project").value; st.room = $("z-room").value;
    st.cuAuto = $("z-cuauto").checked;

    var area = st.L * st.W;
    var hRC = Math.max(0.1, st.ceilH - st.wp - st.susp);
    var rcr = 5 * hRC * (st.L + st.W) / (st.L * st.W);
    var cu = st.cuAuto ? estCU(rcr, st.pc, st.pw, st.pf) : (numv("z-cu", 0.1) || estCU(rcr, st.pc, st.pw, st.pf));
    if (st.cuAuto) $("z-cu").value = cu.toFixed(2);
    var llf = st.lld * st.ldd;
    var perFix = st.lm * cu * llf;
    var count = (perFix > 0 && area > 0) ? Math.ceil((st.fc * area) / perFix) : 0;
    var avgZonal = area > 0 ? (count * perFix) / area : 0;
    var totalW = count * st.w, lpd = area > 0 ? totalW / area : 0;

    $("r-count").textContent = count ? count.toLocaleString() : "—";
    $("r-rcr").textContent = count ? rcr.toFixed(2) : "—";
    $("r-cu").textContent = count ? cu.toFixed(2) : "—";
    $("r-llf").textContent = count ? llf.toFixed(2) : "—";
    $("r-avg").textContent = count ? Math.round(avgZonal) : "—";
    $("r-lpd").textContent = (count && st.w) ? lpd.toFixed(2) : "—";

    var pg = count ? pointGrid(st.L, st.W, count, hRC, st.lm * llf, avgZonal, st.dist) : null;
    if (pg) {
      $("r-grid").textContent = pg.rows + "×" + pg.cols;
      $("r-min").textContent = Math.round(pg.min) + " fc"; $("r-max").textContent = Math.round(pg.max) + " fc";
      $("r-unif").textContent = "avg/min " + pg.uAvgMin.toFixed(2) + " · max/min " + pg.uMaxMin.toFixed(2);
      var flag = $("r-flag");
      if (pg.uAvgMin <= 1.7) { flag.className = "z-flag ok"; flag.textContent = "Even coverage — avg/min uniformity " + pg.uAvgMin.toFixed(2) + " (≤ 1.7, good for most interiors)."; }
      else if (pg.uAvgMin <= 2.5) { flag.className = "z-flag ok"; flag.textContent = "Acceptable uniformity — avg/min " + pg.uAvgMin.toFixed(2) + ". Tighten spacing for critical tasks."; }
      else { flag.className = "z-flag warn"; flag.textContent = "Uneven — avg/min " + pg.uAvgMin.toFixed(2) + " (> 2.5). Add fixtures, lower the mount, or use a wider distribution."; }
    } else { $("r-grid").textContent = "—"; $("r-min").textContent = "—"; $("r-max").textContent = "—"; $("r-unif").textContent = ""; $("r-flag").className = "z-flag warn"; $("r-flag").textContent = "Enter room size, target, and fixture lumens to run the calculation."; }
    drawHeat(pg, st.L, st.W);
    fillPrint(count, rcr, cu, llf, avgZonal, totalW, lpd, area, hRC, pg);
    return count;
  }

  function fillPrint(count, rcr, cu, llf, avgZonal, totalW, lpd, area, hRC, pg) {
    var p = $("z-print");
    if (!count) { p.innerHTML = ""; return; }
    p.innerHTML =
      '<div class="pr-h"><b style="font-size:14px;color:#0b2a45">DHI Lighting — Zonal-Cavity Design Estimate</b><span style="font-size:11px;color:#64748b">digitalhealthinternational.com</span></div>' +
      '<div class="pr-title">' + esc(st.project || "Lighting design estimate") + (st.room ? " — " + esc(st.room) : "") + "</div>" +
      '<table><tbody>' +
        row("Space", st.L + " × " + st.W + " ft = " + area.toLocaleString() + " ft² · ceiling " + st.ceilH + " ft · work plane " + st.wp + " ft · suspension " + st.susp + " ft") +
        row("Reflectances (c/w/f)", Math.round(st.pc * 100) + " / " + Math.round(st.pw * 100) + " / " + Math.round(st.pf * 100) + " %") +
        row("Room Cavity Ratio", rcr.toFixed(2) + " (cavity ht " + hRC.toFixed(1) + " ft)") +
        row("Fixture", esc(st.fixId || "Custom") + " · " + st.lm.toLocaleString() + " lm" + (st.w ? " · " + st.w + " W" : "")) +
        row("CU / LLF", cu.toFixed(2) + (st.cuAuto ? " (estimated)" : " (photometric)") + " · " + llf.toFixed(2) + " (LLD " + st.lld + " × LDD " + st.ldd + ")") +
      '</tbody></table>' +
      '<table style="margin-top:8px"><thead><tr><th>Result</th><th>Value</th></tr></thead><tbody>' +
        row("Fixtures required", String(count)) +
        row("Layout", pg.rows + " rows × " + pg.cols + " columns") +
        row("Average maintained", Math.round(avgZonal) + " fc") +
        row("Point-by-point", "min " + Math.round(pg.min) + " · max " + Math.round(pg.max) + " fc · avg/min " + pg.uAvgMin.toFixed(2) + " · max/min " + pg.uMaxMin.toFixed(2)) +
        (st.w ? row("Connected load", totalW.toLocaleString() + " W · " + lpd.toFixed(2) + " W/ft² (LPD)") : "") +
      '</tbody></table>' +
      '<div class="pr-disc">Zonal-cavity (IESNA average-illuminance) method. CU is ' + (st.cuAuto ? "estimated for a generic direct distribution from Room Cavity Ratio and reflectances" : "as entered from the fixture photometrics") + '; the point-by-point grid is a modeled estimate (direct cosine component normalized to the zonal average). For a stamped design or final government bid, verify against a point-by-point calculation from the luminaire IES file. Prepared ' + dateStr() + " · DHI Lighting.</div>";
  }
  function row(k, v) { return "<tr><td style=\"color:#64748b;width:34%\">" + esc(k) + "</td><td style=\"color:#0f172a;font-weight:600\">" + v + "</td></tr>"; }
  function dateStr() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ""; } }

  function addToCart() {
    var count = compute();
    if (!count) { toast("Enter room size and fixture lumens first."); return; }
    if (!st.fixId) { toast("Pick a catalog fixture to add it to the quote."); return; }
    var cart = [];
    try { cart = (JSON.parse(localStorage.getItem(STORE)) || []).map(function (x) { return typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }; }); } catch (e) {}
    var ex = cart.filter(function (l) { return l.id === st.fixId; })[0];
    if (ex) ex.qty += count; else cart.push({ id: st.fixId, qty: count });
    localStorage.setItem(STORE, JSON.stringify(cart));
    try { window.dispatchEvent(new CustomEvent("dhi-cart-changed")); } catch (e) {}
    toast(count + " × " + st.fixId + " added to your quote.");
  }
  var toastT;
  function toast(m) { var t = $("z-toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600); }

  ["z-L", "z-W", "z-ceil", "z-wp", "z-susp", "z-fc", "z-lm", "z-w", "z-pc", "z-pw", "z-pf", "z-lld", "z-ldd", "z-project", "z-room"].forEach(function (id) { $(id).addEventListener("input", compute); });
  $("z-dist").addEventListener("change", compute);
  $("z-preset").addEventListener("change", function () { st.preset = this.value; var p = PRESETS.filter(function (x) { return x.k === st.preset; })[0]; if (p && st.preset !== "custom") $("z-fc").value = p.fc; compute(); });
  $("z-refl").addEventListener("change", function () { st.refl = this.value; var r = REFL.filter(function (x) { return x.k === st.refl; })[0]; if (r && st.refl !== "custom") { $("z-pc").value = Math.round(r.c * 100); $("z-pw").value = Math.round(r.w * 100); $("z-pf").value = Math.round(r.f * 100); } compute(); });
  $("z-fix").addEventListener("change", function () { syncFixture(this.value); compute(); });
  $("z-cuauto").addEventListener("change", function () { $("z-cu").disabled = this.checked; compute(); });
  $("z-cu").addEventListener("input", function () { if (!$("z-cuauto").checked) compute(); });
  $("r-add").addEventListener("click", addToCart);
  $("r-print").addEventListener("click", function () { compute(); window.print(); });

  syncFixture(st.fixId);
  compute();
})();
