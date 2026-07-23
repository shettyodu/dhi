/* lighting-layout.js — Layout & foot-candle calculator (lumen method).
   Sizes fixture count / spacing / uniformity / watts-per-ft² from room
   dimensions + a target illuminance, using any fixture in the catalog
   (KEYSTONE_PRODUCTS + EXTRA_LIGHTING_PRODUCTS). Printable proposal table +
   add-to-quote into the shared cart (dhi_keystone_quote). Estimates only —
   verify against a photometric report for stamped / final-bid designs. */
(function () {
  "use strict";
  var app = document.getElementById("layout-app");
  if (!app) return;

  var STORE = "dhi_keystone_quote";
  var ALL = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);

  function nums(s) { if (s == null) return []; var m = String(s).replace(/,/g, "").match(/\d+(\.\d+)?/g); return m ? m.map(Number) : []; }
  function rep(s) { var n = nums(s); if (!n.length) return 0; return n.length >= 2 ? Math.round((n[0] + n[1]) / 2) : n[0]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // fixtures with a usable lumen figure, sorted by group then id
  var FIX = ALL.filter(function (p) { return p.cat === "Fixtures" && rep(p.lm) > 0; })
    .map(function (p) { return { id: p.id, group: p.group || "Fixture", lm: rep(p.lm), w: rep(p.w), lmRaw: p.lm, sup: p.supplier || "" }; })
    .sort(function (a, b) { return a.group.localeCompare(b.group) || a.id.localeCompare(b.id); });

  var PRESETS = [
    { k: "warehouse", label: "Warehouse — general storage", fc: 20 },
    { k: "rack", label: "Warehouse — rack / aisle", fc: 30 },
    { k: "highbay", label: "Manufacturing / industrial", fc: 30 },
    { k: "office", label: "Office / classroom", fc: 40 },
    { k: "gym", label: "Gymnasium / recreation", fc: 50 },
    { k: "sports", label: "Sports — competition", fc: 75 },
    { k: "retail", label: "Retail / sales floor", fc: 50 },
    { k: "parking", label: "Parking / garage", fc: 5 },
    { k: "custom", label: "Custom target", fc: 30 },
  ];

  // sensible default: the brightest high-bay (matches the warehouse preset),
  // else the brightest fixture overall — so the initial view isn't 800 tiny lamps.
  var DEF = FIX.filter(function (f) { return /high bay/i.test(f.group); }).sort(function (a, b) { return b.lm - a.lm; })[0]
    || FIX.slice().sort(function (a, b) { return b.lm - a.lm; })[0] || null;
  var st = { project: "", room: "", L: 100, W: 50, H: 24, fc: 20, preset: "warehouse", fixId: DEF ? DEF.id : "", lm: DEF ? DEF.lm : 0, w: DEF ? DEF.w : 0, cu: 0.8, llf: 0.8 };

  function fixOptions() {
    var last = "", out = "";
    FIX.forEach(function (f) {
      if (f.group !== last) { if (last) out += "</optgroup>"; out += '<optgroup label="' + esc(f.group) + '">'; last = f.group; }
      out += '<option value="' + esc(f.id) + '"' + (f.id === st.fixId ? " selected" : "") + ">" + esc(f.id) + " — " + f.lm.toLocaleString() + " lm" + (f.w ? " · " + f.w + "W" : "") + "</option>";
    });
    if (last) out += "</optgroup>";
    return '<option value="">Custom fixture (enter lumens)</option>' + out;
  }

  app.innerHTML =
    '<div class="lc-wrap">' +
      '<div class="lc-card">' +
        '<div class="lc-h">The space</div>' +
        '<div class="lc-row">' +
          '<div class="lc-f"><label>Project / bid name</label><input class="lc-inp" id="lc-project" placeholder="e.g. Bldg 4 Warehouse Relight" /></div>' +
          '<div class="lc-f"><label>Room / area label</label><input class="lc-inp" id="lc-room" placeholder="e.g. Main floor" /></div>' +
        '</div>' +
        '<div class="lc-row">' +
          '<div class="lc-f"><label>Length <span class="u">(ft)</span></label><input class="lc-inp" id="lc-L" type="number" min="1" value="100" /></div>' +
          '<div class="lc-f"><label>Width <span class="u">(ft)</span></label><input class="lc-inp" id="lc-W" type="number" min="1" value="50" /></div>' +
        '</div>' +
        '<div class="lc-row">' +
          '<div class="lc-f"><label>Mounting height <span class="u">(ft)</span></label><input class="lc-inp" id="lc-H" type="number" min="1" value="24" /></div>' +
          '<div class="lc-f"><label>Application</label><select class="lc-sel" id="lc-preset">' + PRESETS.map(function (p) { return '<option value="' + p.k + '"' + (p.k === st.preset ? " selected" : "") + ">" + esc(p.label) + " (" + p.fc + " fc)</option>"; }).join("") + "</select></div>" +
        '</div>' +
        '<div class="lc-row">' +
          '<div class="lc-f"><label>Target illuminance <span class="u">(foot-candles)</span></label><input class="lc-inp" id="lc-fc" type="number" min="1" value="20" /></div>' +
          '<div class="lc-f"><label>Area <span class="u">(ft²)</span></label><input class="lc-inp" id="lc-area" value="5,000" disabled style="background:#f8fafc" /></div>' +
        '</div>' +

        '<div class="lc-h" style="margin-top:20px">The fixture</div>' +
        '<div class="lc-row one">' +
          '<div class="lc-f"><label>Fixture (from catalog — 7 brands)</label><select class="lc-sel" id="lc-fix">' + fixOptions() + "</select><div class=\"lc-hint\" id=\"lc-fixhint\"></div></div>" +
        '</div>' +
        '<div class="lc-row">' +
          '<div class="lc-f"><label>Fixture lumens <span class="u">(delivered)</span></label><input class="lc-inp" id="lc-lm" type="number" min="1" value="' + st.lm + '" /></div>' +
          '<div class="lc-f"><label>Fixture watts <span class="u">(optional)</span></label><input class="lc-inp" id="lc-w" type="number" min="0" value="' + st.w + '" /></div>' +
        '</div>' +

        '<div class="lc-adv">' +
          '<div class="lc-row">' +
            '<div class="lc-f"><label>Coefficient of Utilization <span class="u">(CU)</span></label><input class="lc-inp" id="lc-cu" type="number" step="0.05" min="0.1" max="1" value="0.8" /><div class="lc-hint">Open high-bay ≈ 0.85 · office ≈ 0.7 · obstructed ≈ 0.5</div></div>' +
            '<div class="lc-f"><label>Light Loss Factor <span class="u">(LLF)</span></label><input class="lc-inp" id="lc-llf" type="number" step="0.05" min="0.5" max="1" value="0.8" /><div class="lc-hint">Clean ≈ 0.85 · typical ≈ 0.8 · dirty ≈ 0.7</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="lc-res">' +
        '<div class="lc-card">' +
          '<div class="lc-h">Result</div>' +
          '<div class="lc-big"><div class="n" id="r-count">—</div><div class="l">fixtures required</div></div>' +
          '<div class="lc-metrics">' +
            '<div class="lc-m"><div class="n" id="r-grid">—</div><div class="l">layout grid (rows × cols)</div></div>' +
            '<div class="lc-m"><div class="n" id="r-spacing">—</div><div class="l">spacing (ft)</div></div>' +
            '<div class="lc-m"><div class="n" id="r-fc">—</div><div class="l">achieved avg fc</div></div>' +
            '<div class="lc-m"><div class="n" id="r-lpd">—</div><div class="l">watts / ft² (LPD)</div></div>' +
          '</div>' +
          '<div class="lc-flag" id="r-flag"></div>' +
          '<div class="lc-viz"><div class="cap">Layout preview</div><div id="r-viz"></div></div>' +
          '<div class="lc-btns">' +
            '<button class="lc-btn p" id="r-add">Add to quote</button>' +
            '<button class="lc-btn s" id="r-print">Print proposal</button>' +
          '</div>' +
          '<div class="lc-note" id="r-note">Total connected load: <span id="r-watts">—</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var $ = function (id) { return document.getElementById(id); };

  function syncFixture(id) {
    var f = FIX.filter(function (x) { return x.id === id; })[0];
    if (f) { st.fixId = f.id; st.lm = f.lm; st.w = f.w; $("lc-lm").value = f.lm; $("lc-w").value = f.w; $("lc-fixhint").textContent = f.sup + (f.lmRaw && String(f.lmRaw) !== String(f.lm) ? " · catalog rating: " + f.lmRaw + " lm (using representative value)" : ""); }
    else { st.fixId = ""; $("lc-fixhint").textContent = "Custom fixture — enter delivered lumens (and watts for the load estimate)."; }
  }

  function num(id, min) { var v = parseFloat($(id).value); if (isNaN(v)) v = 0; if (min != null && v < min) v = min; return v; }

  function compute() {
    st.L = num("lc-L", 0); st.W = num("lc-W", 0); st.H = num("lc-H", 0.1);
    st.fc = num("lc-fc", 0); st.lm = num("lc-lm", 0); st.w = num("lc-w", 0);
    st.cu = num("lc-cu", 0.05) || 0.8; st.llf = num("lc-llf", 0.05) || 0.8;
    st.project = $("lc-project").value; st.room = $("lc-room").value;
    var area = st.L * st.W;
    $("lc-area").value = area ? area.toLocaleString() : "0";

    var perFix = st.lm * st.cu * st.llf;
    var count = (perFix > 0 && area > 0) ? Math.ceil((st.fc * area) / perFix) : 0;
    // proportional grid
    var cols = count > 0 ? Math.max(1, Math.round(Math.sqrt(count * (st.L / Math.max(st.W, 0.1))))) : 0;
    var rows = count > 0 ? Math.max(1, Math.ceil(count / cols)) : 0;
    var spL = cols ? st.L / cols : 0, spW = rows ? st.W / rows : 0;
    var maxSp = Math.max(spL, spW);
    var smh = st.H > 0 ? maxSp / st.H : 0;
    var achieved = area > 0 ? (count * perFix) / area : 0;
    var totalW = count * st.w;
    var lpd = area > 0 ? totalW / area : 0;

    $("r-count").textContent = count ? count.toLocaleString() : "—";
    $("r-grid").textContent = count ? rows + " × " + cols : "—";
    $("r-spacing").textContent = count ? (spL.toFixed(1) + " × " + spW.toFixed(1)) : "—";
    $("r-fc").textContent = count ? Math.round(achieved) : "—";
    $("r-lpd").textContent = (count && st.w) ? lpd.toFixed(2) : "—";
    $("r-watts").textContent = (count && st.w) ? totalW.toLocaleString() + " W" : "enter fixture watts";

    var flag = $("r-flag");
    if (!count) { flag.className = "lc-flag warn"; flag.textContent = "Enter room size, a target level, and fixture lumens to size the layout."; }
    else if (smh <= 1.0) { flag.className = "lc-flag ok"; flag.textContent = "Good uniformity — spacing-to-mounting-height ratio " + smh.toFixed(2) + " (≤ 1.0)."; }
    else if (smh <= 1.5) { flag.className = "lc-flag ok"; flag.textContent = "Acceptable uniformity — S/MH ratio " + smh.toFixed(2) + ". Confirm the fixture's beam spread suits this spacing."; }
    else { flag.className = "lc-flag warn"; flag.textContent = "Spacing may be uneven — S/MH ratio " + smh.toFixed(2) + " (> 1.5). Add fixtures, lower the mount, or choose a wider-distribution optic."; }

    drawViz(rows, cols);
    fillPrint(count, rows, cols, spL, spW, achieved, totalW, lpd, area);
    return count;
  }

  function drawViz(rows, cols) {
    var box = $("r-viz");
    if (!rows || !cols) { box.innerHTML = '<div style="color:#7fd4e6;font-size:12px;padding:10px 0">—</div>'; return; }
    var W = 336, ar = st.W > 0 ? st.L / st.W : 2, H = Math.max(70, Math.min(220, W / ar));
    var padX = W / (cols + 1), padY = H / (rows + 1), dots = "";
    for (var r = 1; r <= rows; r++) for (var c = 1; c <= cols; c++) {
      dots += '<circle cx="' + (padX * c).toFixed(1) + '" cy="' + (padY * r).toFixed(1) + '" r="4.5" fill="#f5c542" stroke="#fff8e1" stroke-width="1"/>';
    }
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" style="display:block">' +
      '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="6" fill="#0f2036" stroke="#25476b"/>' + dots + '</svg>' +
      '<div style="color:#9fb6cc;font-size:10.5px;margin-top:6px">' + st.L + ' ft × ' + st.W + ' ft · ' + (rows * cols) + ' positions</div>';
  }

  function fillPrint(count, rows, cols, spL, spW, achieved, totalW, lpd, area) {
    var p = $("lc-print");
    if (!count) { p.innerHTML = ""; return; }
    var fixLabel = st.fixId || "Custom fixture";
    p.innerHTML =
      '<div class="pr-h"><b>DHI Lighting — Layout &amp; Foot-Candle Estimate</b><span>digitalhealthinternational.com</span></div>' +
      '<div class="pr-title">' + esc(st.project || "Lighting layout estimate") + (st.room ? " — " + esc(st.room) : "") + "</div>" +
      '<table><tbody>' +
        row("Space", st.L + " ft × " + st.W + " ft = " + area.toLocaleString() + " ft²  ·  mounting height " + st.H + " ft") +
        row("Target illuminance", st.fc + " foot-candles (" + presetLabel() + ")") +
        row("Fixture", esc(fixLabel) + "  ·  " + st.lm.toLocaleString() + " lm" + (st.w ? "  ·  " + st.w + " W" : "")) +
        row("Planning factors", "CU " + st.cu + "  ·  LLF " + st.llf) +
      '</tbody></table>' +
      '<table style="margin-top:10px"><thead><tr><th>Result</th><th>Value</th></tr></thead><tbody>' +
        row("Fixtures required", String(count)) +
        row("Layout grid", rows + " rows × " + cols + " columns") +
        row("Spacing", spL.toFixed(1) + " ft × " + spW.toFixed(1) + " ft") +
        row("Achieved average", Math.round(achieved) + " fc (maintained)") +
        (st.w ? row("Connected load", totalW.toLocaleString() + " W  ·  " + lpd.toFixed(2) + " W/ft² (LPD)") : "") +
      '</tbody></table>' +
      '<div class="pr-disc">Estimate by the lumen (average-illuminance) method: fixtures = (target fc × area) ÷ (fixture lumens × CU × LLF). Coefficient of Utilization and Light Loss Factor are planning assumptions; actual results depend on room reflectances, fixture photometrics, obstructions, and mounting. For a stamped design or a final government bid, verify against a point-by-point photometric report. Prepared ' + dateStr() + " · DHI Lighting.</div>";
  }
  function row(k, v) { return "<tr><td style=\"color:#64748b;width:38%\">" + esc(k) + "</td><td style=\"color:#0f172a;font-weight:600\">" + v + "</td></tr>"; }
  function presetLabel() { var p = PRESETS.filter(function (x) { return x.k === st.preset; })[0]; return p ? p.label : "custom"; }
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
  function toast(msg) { var t = $("lc-toast") || document.getElementById("lc-toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600); }

  // wire
  ["lc-L", "lc-W", "lc-H", "lc-fc", "lc-lm", "lc-w", "lc-cu", "lc-llf", "lc-project", "lc-room"].forEach(function (id) {
    $(id).addEventListener("input", compute);
  });
  $("lc-preset").addEventListener("change", function () {
    st.preset = this.value; var p = PRESETS.filter(function (x) { return x.k === st.preset; })[0];
    if (p && st.preset !== "custom") { $("lc-fc").value = p.fc; }
    compute();
  });
  $("lc-fix").addEventListener("change", function () { syncFixture(this.value); compute(); });
  $("lc-lm").addEventListener("input", function () { st.fixId = $("lc-fix").value; });
  $("r-add").addEventListener("click", addToCart);
  $("r-print").addEventListener("click", function () { compute(); window.print(); });

  syncFixture(st.fixId);
  compute();
})();
