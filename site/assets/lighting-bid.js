/* lighting-bid.js — Bid Builder. Paste solicitation lighting line items -> parse
   qty + type + specs -> match each to a catalog SKU (KEYSTONE_PRODUCTS +
   EXTRA_LIGHTING_PRODUCTS) with a confidence flag, editable qty/SKU, priced
   totals, printable bid worksheet, CSV export, and add-all to the shared quote
   cart (dhi_keystone_quote).

   Matching is ASSISTIVE — a human must verify every line against the
   solicitation. Pricing is Keystone list where loaded; other brands are
   quote-on-request. This is not a substitute for reading the solicitation. */
(function () {
  "use strict";
  var app = document.getElementById("bid-app");
  if (!app) return;
  var STORE = "dhi_keystone_quote";
  var ALL = (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []).slice()
    .concat(typeof EXTRA_LIGHTING_PRODUCTS !== "undefined" ? EXTRA_LIGHTING_PRODUCTS : []);

  function nums(s) { if (s == null) return []; var m = String(s).replace(/,/g, "").match(/\d+(\.\d+)?/g); return m ? m.map(Number) : []; }
  function rep(s) { var n = nums(s); if (!n.length) return 0; return n.length >= 2 ? Math.round((n[0] + n[1]) / 2) : n[0]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  var TYPE_DEF = [
    { t: "high-bay", kw: ["high bay", "highbay", "hibay", "ufo", "high-bay"] },
    { t: "troffer", kw: ["troffer"] },
    { t: "panel", kw: ["flat panel", "panel", "backlit", "edge-lit", "edge lit"] },
    { t: "wrap", kw: ["wraparound", "wrap "] },
    { t: "vapor", kw: ["vapor", "vaportight", "vaportite", "washdown"] },
    { t: "strip", kw: ["strip", "stairwell"] },
    { t: "wallpack", kw: ["wall pack", "wallpack", "wall-pack"] },
    { t: "flood", kw: ["flood"] },
    { t: "canopy", kw: ["canopy", "soffit", "garage", "parking structure"] },
    { t: "area", kw: ["area light", "area luminaire", "shoebox", "site light", "parking lot", "pole mount", "roadway", "cobrahead"] },
    { t: "downlight", kw: ["downlight", "wafer", "recessed", "can light"] },
    { t: "exit", kw: ["exit sign", "exit"] },
    { t: "emergency", kw: ["emergency", "egress"] },
    { t: "tube", kw: ["t8", "t5", "led tube", "linear tube", "lamp"] },
  ];
  function detectType(s) { s = String(s).toLowerCase(); for (var i = 0; i < TYPE_DEF.length; i++) for (var j = 0; j < TYPE_DEF[i].kw.length; j++) if (s.indexOf(TYPE_DEF[i].kw[j]) !== -1) return TYPE_DEF[i].t; return ""; }
  var FAM = { panel: "troffer", troffer: "panel" };
  var TYLABEL = { "high-bay": "High Bay", troffer: "Troffer", panel: "Panel", wrap: "Wraparound", vapor: "Vapor Tight", strip: "Strip", wallpack: "Wall Pack", flood: "Flood", canopy: "Canopy", area: "Area", downlight: "Downlight", exit: "Exit", emergency: "Emergency", tube: "Tube/Lamp" };

  var P = ALL.filter(function (p) { return p.cat === "Fixtures" || p.cat === "Lamps"; }).map(function (p) {
    return { id: p.id, cat: p.cat, group: p.group || "", cct: p.cct || "", price: (p.p != null ? p.p : null), W: rep(p.w), LM: rep(p.lm), type: detectType((p.group || "") + " " + (p.specs || "") + " " + (p.id || "")) };
  });

  function parseLine(line) {
    var s = line.toLowerCase();
    var W = (s.match(/(\d+(?:\.\d+)?)\s*w(?:att)?s?\b/) || [])[1];
    var K = (s.match(/(\d{3,4})\s*k\b/) || [])[1];
    var LM = (s.match(/(\d[\d,]{2,})\s*(?:lm|lumen)/) || [])[1];
    var qty = 1, toks = s.match(/(\d[\d,]*)\s*([a-z"']*)/g) || [];
    for (var i = 0; i < toks.length; i++) { var mm = toks[i].match(/(\d[\d,]*)\s*([a-z"']*)/); var n = parseInt(mm[1].replace(/,/g, ""), 10); var u = mm[2]; if (!/^(w|k|v|lm|kv|ka|ft|in|hr|cri|x)/.test(u) && n >= 1 && n <= 100000) { qty = n; break; } }
    return { qty: qty, W: W ? +W : 0, K: K || "", LM: LM ? +String(LM).replace(/,/g, "") : 0, type: detectType(s), raw: line };
  }
  function score(line, prod) {
    var sc = 0;
    if (line.type && prod.type === line.type) sc += 60;
    else if (line.type && prod.type && FAM[line.type] === prod.type) sc += 32;
    else if (line.type && prod.type && line.type !== prod.type) sc -= 20;
    if (line.W && prod.W) sc += Math.max(0, 22 * (1 - Math.abs(prod.W - line.W) / line.W));
    if (line.LM && prod.LM) sc += Math.max(0, 22 * (1 - Math.abs(prod.LM - line.LM) / line.LM));
    if (line.K && prod.cct && prod.cct.indexOf(line.K) !== -1) sc += 12;
    return sc;
  }
  function match(line) {
    if (!line.type && !line.W && !line.LM) return [];
    return P.map(function (pr) { return { pr: pr, s: score(line, pr) }; }).filter(function (x) { return x.s > 20; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 4);
  }
  function conf(s) { return s >= 90 ? { k: "hi", l: "High" } : s >= 55 ? { k: "md", l: "Med" } : { k: "lo", l: "Low" }; }

  var SAMPLE = "48 EA — LED High Bay, 150W, 4000K, ~22,000 lumens\nQty 120: 2x4 LED Troffer, 40W, 5000K, 5000 lm\n36 each LED Wall Pack, 80W, 5000K, dusk-to-dawn\n(24) LED Vapor Tight, 4ft, 4000K\n200 - LED T8 tube, 4000K, 1800 lumens\n12 ea Area Light, 300W, 5000K, Type III, pole mount\n60 LED flat panel 2x2 3500K";

  var rows = [];

  app.innerHTML =
    '<div class="bd-card"><div class="bd-h">Solicitation</div>' +
      '<div class="bd-meta">' +
        '<div class="bd-f"><label>Solicitation #</label><input class="bd-inp" id="b-sol" placeholder="e.g. W912DR-26-B-0000" /></div>' +
        '<div class="bd-f"><label>Agency / buyer</label><input class="bd-inp" id="b-agency" placeholder="e.g. USACE Baltimore" /></div>' +
        '<div class="bd-f"><label>Due date</label><input class="bd-inp" id="b-due" placeholder="YYYY-MM-DD" /></div>' +
        '<div class="bd-f"><label>Location</label><input class="bd-inp" id="b-loc" placeholder="e.g. Norfolk, VA" /></div>' +
      '</div>' +
    '</div>' +
    '<div class="bd-card" style="margin-top:16px"><div class="bd-h">Line items</div>' +
      '<p style="font-size:12.5px;color:#64748b;margin:6px 0 10px">Paste the solicitation’s lighting line items — one per line. Include qty and any specs (type, wattage, CCT, lumens) for the best match.</p>' +
      '<textarea class="bd-inp" id="b-lines" placeholder="48 EA — LED High Bay, 150W, 4000K, 22,000 lm&#10;120 — 2x4 LED Troffer, 40W, 5000K…"></textarea>' +
      '<div class="bd-actions">' +
        '<button class="bd-btn p" id="b-match">Match line items</button>' +
        '<button class="bd-btn s" id="b-sample">Load sample</button>' +
        '<button class="bd-btn s" id="b-clear">Clear</button>' +
      '</div>' +
    '</div>' +
    '<div class="bd-card" id="b-results" style="margin-top:16px;display:none">' +
      '<div class="bd-h">Matched bid worksheet</div>' +
      '<div class="bd-cov" id="b-cov"></div>' +
      '<div class="bd-tablewrap"><table class="bd-t"><thead><tr><th>#</th><th>Solicitation line</th><th>Detected</th><th>Matched catalog SKU</th><th>Qty</th><th>Unit</th><th>Extended</th><th>Conf.</th></tr></thead><tbody id="b-tbody"></tbody></table></div>' +
      '<div class="bd-actions">' +
        '<button class="bd-btn p" id="b-add">Add matched to quote</button>' +
        '<button class="bd-btn s" id="b-print">Print bid worksheet</button>' +
        '<button class="bd-btn s" id="b-csv">Export CSV</button>' +
      '</div>' +
      '<div class="bd-honest"><b>Assistive matching — verify every line.</b> Suggestions are ranked by fixture type, wattage, lumens, and CCT; a human bidder must confirm each SKU meets the solicitation (incl. “brand-name-or-equal,” Buy American / TAA, and photometric requirements). Prices shown are <b>Keystone list</b>; other brands are <b>quote-on-request</b>. Not a substitute for reading the solicitation.</div>' +
    '</div>';

  var $ = function (id) { return document.getElementById(id); };

  function doMatch() {
    var text = $("b-lines").value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    rows = text.map(function (raw) {
      var parsed = parseLine(raw);
      var cands = match(parsed);
      return { raw: raw, parsed: parsed, cands: cands, chosen: cands.length ? cands[0].pr.id : "", qty: parsed.qty };
    });
    $("b-results").style.display = rows.length ? "block" : "none";
    renderRows();
  }

  function prodById(id) { for (var i = 0; i < P.length; i++) if (P[i].id === id) return P[i]; return null; }

  function renderRows() {
    var tb = $("b-tbody"); tb.innerHTML = "";
    rows.forEach(function (r, i) {
      var pd = r.parsed, chosenScore = 0;
      var optHtml = r.cands.map(function (c) { return '<option value="' + esc(c.pr.id) + '"' + (c.pr.id === r.chosen ? " selected" : "") + ">" + esc(c.pr.id) + " · " + (c.pr.W ? c.pr.W + "W " : "") + (c.pr.LM ? c.pr.LM.toLocaleString() + "lm" : "") + "</option>"; }).join("");
      optHtml += '<option value=""' + (r.chosen ? "" : " selected") + ">— no match —</option>";
      r.cands.forEach(function (c) { if (c.pr.id === r.chosen) chosenScore = c.s; });
      var pr = prodById(r.chosen);
      var ext = (pr && pr.price != null) ? money(pr.price * r.qty) : "<span class=\"bd-quote\">quote</span>";
      var unit = (pr && pr.price != null) ? money(pr.price) : "<span class=\"bd-quote\">quote</span>";
      var c = conf(chosenScore);
      var det = [];
      if (pd.type) det.push('<span class="bd-chip ty">' + esc(TYLABEL[pd.type] || pd.type) + "</span>");
      if (pd.W) det.push(pd.W + "W");
      if (pd.LM) det.push(pd.LM.toLocaleString() + "lm");
      if (pd.K) det.push(pd.K + "K");
      tb.insertAdjacentHTML("beforeend",
        "<tr><td>" + (i + 1) + "</td>" +
        '<td class="bd-raw">' + esc(r.raw) + "</td>" +
        "<td>" + (det.join(" ") || '<span class="bd-quote">—</span>') + "</td>" +
        '<td><select class="bd-sel" data-row="' + i + '">' + optHtml + "</select></td>" +
        '<td><input class="bd-qty" type="number" min="1" value="' + r.qty + '" data-qrow="' + i + '" /></td>' +
        "<td>" + unit + "</td>" +
        '<td class="bd-ext">' + ext + "</td>" +
        '<td>' + (r.chosen ? '<span class="bd-conf ' + c.k + '">' + c.l + "</span>" : '<span class="bd-conf lo">none</span>') + "</td></tr>");
    });
    tb.querySelectorAll("select[data-row]").forEach(function (s) { s.addEventListener("change", function () { rows[+this.dataset.row].chosen = this.value; renderRows(); updateCov(); }); });
    tb.querySelectorAll("input[data-qrow]").forEach(function (inp) { inp.addEventListener("input", function () { var q = parseInt(this.value, 10); rows[+this.dataset.qrow].qty = (q > 0 ? q : 1); renderRows(); updateCov(); }); });
    updateCov();
  }

  function updateCov() {
    var matched = rows.filter(function (r) { return r.chosen; });
    var priced = 0, sub = 0, qEa = 0;
    matched.forEach(function (r) { var pr = prodById(r.chosen); if (pr && pr.price != null) { priced++; sub += pr.price * r.qty; } else qEa++; });
    $("b-cov").innerHTML =
      '<div class="bd-m"><div class="n">' + matched.length + "/" + rows.length + '</div><div class="l">lines matched</div></div>' +
      '<div class="bd-m"><div class="n">' + priced + '</div><div class="l">priced (list)</div></div>' +
      '<div class="bd-m"><div class="n">' + qEa + '</div><div class="l">quote-on-request</div></div>' +
      '<div class="bd-m"><div class="n">' + money(sub) + '</div><div class="l">priced subtotal</div></div>';
    fillPrint(matched, priced, sub);
  }

  function fillPrint(matched, priced, sub) {
    var rowsHtml = rows.map(function (r, i) {
      var pr = prodById(r.chosen);
      var unit = (pr && pr.price != null) ? money(pr.price) : "quote";
      var ext = (pr && pr.price != null) ? money(pr.price * r.qty) : "quote";
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.raw) + "</td><td>" + esc(r.chosen || "— no match —") + "</td><td>" + r.qty + "</td><td>" + unit + "</td><td>" + ext + "</td></tr>";
    }).join("");
    $("bid-print").innerHTML =
      '<div class="pr-h"><b style="font-size:14px;color:#0b2a45">DHI Lighting — Bid Worksheet</b><span style="font-size:11px;color:#64748b">digitalhealthinternational.com</span></div>' +
      '<div class="pr-title">' + esc($("b-sol").value || "Solicitation bid worksheet") + "</div>" +
      '<div class="pr-meta">' + [esc($("b-agency").value), esc($("b-loc").value), $("b-due").value ? "Due " + esc($("b-due").value) : ""].filter(Boolean).join(" · ") + "</div>" +
      '<table class="pr-t"><thead><tr><th>#</th><th>Solicitation line</th><th>Matched SKU</th><th>Qty</th><th>Unit</th><th>Extended</th></tr></thead><tbody>' + rowsHtml + "</tbody></table>" +
      '<div style="margin-top:10px;font-size:11px;color:#0b2a45"><b>' + matched.length + " of " + rows.length + " lines matched · " + priced + " priced · priced subtotal " + money(sub) + "</b> (excl. tax, freight, and quote-on-request items)</div>" +
      '<div class="pr-disc">Assistive matching — every line must be verified against the solicitation (brand-name-or-equal, Buy American / TAA, photometric and warranty requirements). Prices are Keystone list; other brands are quote-on-request. Prepared ' + dateStr() + " · DHI Lighting. Not a certified bid submission.</div>";
  }
  function dateStr() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ""; } }

  function addAll() {
    var matched = rows.filter(function (r) { return r.chosen; });
    if (!matched.length) { toast("No matched lines to add."); return; }
    var cart = [];
    try { cart = (JSON.parse(localStorage.getItem(STORE)) || []).map(function (x) { return typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }; }); } catch (e) {}
    matched.forEach(function (r) { var ex = null; for (var i = 0; i < cart.length; i++) if (cart[i].id === r.chosen) ex = cart[i]; if (ex) ex.qty += r.qty; else cart.push({ id: r.chosen, qty: r.qty }); });
    localStorage.setItem(STORE, JSON.stringify(cart));
    try { window.dispatchEvent(new CustomEvent("dhi-cart-changed")); } catch (e) {}
    toast(matched.length + " matched line(s) added to your quote.");
  }
  function exportCsv() {
    var head = ["line", "solicitation_text", "matched_sku", "qty", "unit_price", "extended", "confidence"];
    var out = [head.join(",")];
    rows.forEach(function (r, i) {
      var pr = prodById(r.chosen), chosenScore = 0; r.cands.forEach(function (c) { if (c.pr.id === r.chosen) chosenScore = c.s; });
      var unit = (pr && pr.price != null) ? pr.price : "", ext = (pr && pr.price != null) ? (pr.price * r.qty).toFixed(2) : "";
      var cell = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
      out.push([i + 1, cell(r.raw), cell(r.chosen || ""), r.qty, unit, ext, r.chosen ? conf(chosenScore).l : "none"].join(","));
    });
    var a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(out.join("\n"));
    a.download = ($("b-sol").value || "bid-worksheet").replace(/[^\w.-]+/g, "_") + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    toast("CSV exported.");
  }

  var toastT;
  function toast(m) { var t = $("bd-toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600); }

  $("b-match").addEventListener("click", doMatch);
  $("b-sample").addEventListener("click", function () { $("b-lines").value = SAMPLE; doMatch(); });
  $("b-clear").addEventListener("click", function () { $("b-lines").value = ""; rows = []; $("b-results").style.display = "none"; });
  $("b-add").addEventListener("click", addAll);
  $("b-print").addEventListener("click", function () { updateCov(); window.print(); });
  $("b-csv").addEventListener("click", exportCsv);
})();
