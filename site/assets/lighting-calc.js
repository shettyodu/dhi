/* lighting-calc.js — shared lighting math (lumen / average-illuminance method)
   used by the AI Advisor to turn "light a 30,000 sq ft warehouse" into an
   actual fixture count, and available to any page as window.LightingCalc.

   layout({area, fc, lumens, cu, llf, L, W}) -> { count, rows, cols }
   parseSpace(text) -> { area, L, W, H, fc, appl }   (fc/appl inferred from
   the described application when not stated; returns fc:0 if it can't tell). */
(function () {
  "use strict";

  function nums(s) { if (s == null) return []; var m = String(s).replace(/,/g, "").match(/\d+(\.\d+)?/g); return m ? m.map(Number) : []; }
  function rep(s) { var n = nums(s); if (!n.length) return 0; return n.length >= 2 ? Math.round((n[0] + n[1]) / 2) : n[0]; }

  // application keyword -> target foot-candles (order: most specific first)
  var APPS = [
    { re: /parking|garage/, fc: 5, appl: "parking" },
    { re: /rack|aisle/, fc: 30, appl: "warehouse rack" },
    { re: /warehouse|storage|distribution|fulfillment/, fc: 20, appl: "warehouse" },
    { re: /manufactur|industrial|assembly|plant|shop floor|production/, fc: 30, appl: "industrial" },
    { re: /gym|gymnasium|recreation|rec center|fitness/, fc: 50, appl: "gymnasium" },
    { re: /sport|competition|court|field house|arena/, fc: 75, appl: "sports" },
    { re: /office|classroom|school|admin|conference/, fc: 40, appl: "office" },
    { re: /retail|sales floor|store|showroom|grocery/, fc: 50, appl: "retail" },
    { re: /hangar|aircraft/, fc: 30, appl: "hangar" },
  ];

  function parseSpace(text) {
    var s = String(text || "").toLowerCase();
    var area = 0, L = 0, W = 0, H = 0, fc = 0, appl = "";

    var am = s.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|square\s*f(?:ee|oo)t|sq\.?\s*feet|sf\b|ft\s*2|ft²)/);
    if (am) area = parseFloat(am[1].replace(/,/g, ""));

    // room dimensions L x W — require both >= 8 ft so we don't catch "2x4" fixtures
    var dm = s.match(/(\d{1,4})\s*(?:ft|foot|feet|')?\s*(?:x|by|×)\s*(\d{1,4})\s*(?:ft|foot|feet|')?/);
    if (dm) { var a = +dm[1], b = +dm[2]; if (a >= 8 && b >= 8) { L = a; W = b; if (!area) area = a * b; } }

    var hm = s.match(/(\d{1,3})\s*(?:ft|foot|feet|')\s*(?:high|tall|ceilings?|mounting|mount)/)
      || s.match(/ceilings?\s*(?:height\s*)?(?:of\s*)?(\d{1,3})\s*(?:ft|foot|feet|')?/)
      || s.match(/(\d{1,3})\s*(?:ft|')\s*ceilings?/);
    if (hm) H = +hm[1];

    var fm = s.match(/(\d{1,3})\s*(?:fc\b|foot[-\s]?candles?)/);
    if (fm) fc = +fm[1];

    for (var i = 0; i < APPS.length; i++) { if (APPS[i].re.test(s)) { if (!fc) fc = APPS[i].fc; if (!appl) appl = APPS[i].appl; break; } }

    return { area: area, L: L, W: W, H: H, fc: fc, appl: appl };
  }

  function layout(o) {
    o = o || {};
    var area = +o.area || 0, fc = +o.fc || 0, lm = +o.lumens || 0;
    var cu = +o.cu || 0.8, llf = +o.llf || 0.8;
    if (!area || !fc || !lm) return { count: 0, rows: 0, cols: 0 };
    var perFix = lm * cu * llf;
    var count = Math.ceil((fc * area) / perFix);
    var L = +o.L || 0, W = +o.W || 0;
    if (!L || !W) { L = Math.sqrt(area); W = L; }
    var cols = Math.max(1, Math.round(Math.sqrt(count * (L / Math.max(W, 0.1)))));
    var rows = Math.max(1, Math.ceil(count / cols));
    return { count: count, rows: rows, cols: cols };
  }

  window.LightingCalc = { rep: rep, parseSpace: parseSpace, layout: layout };
})();
