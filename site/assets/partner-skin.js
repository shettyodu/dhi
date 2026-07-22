/* partner-skin.js — co-branded demo overlay for the lighting vertical.
   Activate with ?partner=<code> (e.g. lighting-catalog.html?partner=wesco).
   Adds a co-brand ribbon (partner colors + "Powered by DHI"), recolors the
   accent to the partner's brand color, and carries the ?partner param across
   the lighting sub-nav so the whole demo stays skinned as you click around.

   No-op when the param is absent, so it ships safely on every page. Uses the
   partner's real BRAND COLORS + a wordmark lockup (not their trademarked icon).
*/
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  var code = (params.get("partner") || "").toLowerCase().trim();

  var PARTNERS = {
    wesco: {
      name: "Wesco", wordmark: "wesco", mark: "W",
      green: "#00AA13", greenDark: "#008a10", charcoal: "#1D252D",
      tagline: "Lighting Platform",
    },
  };
  var b = PARTNERS[code];
  if (!b) return;

  function init() {
    if (document.getElementById("dhi-coribbon")) return;

    // --- accent recolor + ribbon styles ---
    var style = document.createElement("style");
    style.textContent =
      ".bg-cyan-600{background-color:" + b.green + "!important}" +
      ".hover\\:bg-cyan-700:hover{background-color:" + b.greenDark + "!important}" +
      ".text-cyan-700,.text-cyan-800{color:" + b.greenDark + "!important}" +
      ".border-cyan-600{border-color:" + b.green + "!important}" +
      ".ring-cyan-200{--tw-ring-color:" + b.green + "40!important}" +
      "#dhi-coribbon{background:" + b.charcoal + ";border-bottom:3px solid " + b.green + ";font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
      "#dhi-coribbon .cr-in{max-width:1240px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:8px 20px}" +
      "#dhi-coribbon .cr-mark{width:26px;height:26px;border-radius:6px;background:" + b.green + ";display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;line-height:1;flex:none}" +
      "#dhi-coribbon .cr-wm{color:#fff;font-weight:800;font-size:19px;letter-spacing:-.01em}" +
      "#dhi-coribbon .cr-div{width:1px;height:20px;background:rgba(255,255,255,.22)}" +
      "#dhi-coribbon .cr-tag{color:#cfd6db;font-size:13px;font-weight:600}" +
      "#dhi-coribbon .cr-spacer{flex:1}" +
      "#dhi-coribbon .cr-dhi{color:#9aa6ad;font-size:11px;letter-spacing:.02em;white-space:nowrap}" +
      "#dhi-coribbon .cr-dhi b{color:#fff;font-weight:700}" +
      "@media(max-width:640px){#dhi-coribbon .cr-tag,#dhi-coribbon .cr-div{display:none}}";
    document.head.appendChild(style);

    // --- ribbon ---
    var r = document.createElement("div");
    r.id = "dhi-coribbon";
    r.innerHTML =
      '<div class="cr-in">' +
      '<span class="cr-mark" aria-hidden="true">' + b.mark + "</span>" +
      '<span class="cr-wm">' + b.wordmark + "</span>" +
      '<span class="cr-div"></span>' +
      '<span class="cr-tag">' + b.tagline + "</span>" +
      '<span class="cr-spacer"></span>' +
      '<span class="cr-dhi">Powered by <b>Digital Health International</b></span>' +
      "</div>";
    document.body.insertBefore(r, document.body.firstChild);

    linkify();
    setTimeout(linkify, 300);
    setTimeout(linkify, 1000);
  }

  // Carry ?partner across internal lighting links so the skin persists on click.
  function linkify() {
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i], h = a.getAttribute("href") || "";
      if (/^https?:|^mailto:|^tel:|^#/i.test(h)) continue;
      if (h.indexOf("partner=") !== -1) continue;
      if (!/(^|\/)lighting(\/|-|\.|$)/.test(h)) continue;
      var hash = "", base = h, hi = h.indexOf("#");
      if (hi !== -1) { hash = h.slice(hi); base = h.slice(0, hi); }
      a.setAttribute("href", base + (base.indexOf("?") !== -1 ? "&" : "?") + "partner=" + code + hash);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
