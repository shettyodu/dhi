/* sku-photo.js — deterministic SVG product illustration per lighting SKU.
   The catalog has ~1500 SKUs but only ~29 shared raster photos, so cards all
   looked alike. This renders a unique, on-brand illustration from each SKU's
   OWN data — shape archetype (type), glow color (CCT), spec chips (W/lm/base),
   plus a per-id hash so even same-spec SKUs differ. No external image assets.

   It is explicitly an illustration (not a stock photo), which keeps a B2B
   catalog honest while making every SKU visually distinct.

   API:  SKUPhoto.svg(p, { variant })   variant: "card" (default) | "thumb"
   Returns an <svg> string that fills its container (width/height 100%).
*/
(function () {
  "use strict";

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---- CCT → glow color (interpolate warm amber → neutral → cool daylight) ----
  function kelvin(cct) { var m = String(cct || "").match(/(\d{4})\s*K/i); return m ? parseInt(m[1], 10) : null; }
  function glowColor(k) {
    if (k == null) return "rgb(255,224,170)";
    var t = Math.max(0, Math.min(1, (k - 2200) / (6500 - 2200)));
    var L = function (a, b, f) { return Math.round(a + (b - a) * f); };
    var r, g, b;
    if (t < 0.5) { var f = t / 0.5; r = L(255, 255, f); g = L(157, 243, f); b = L(58, 223, f); }
    else { var f2 = (t - 0.5) / 0.5; r = L(255, 207, f2); g = L(243, 224, f2); b = L(223, 255, f2); }
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // ---- pick an archetype shape from img name / category / group / specs ----
  function archetype(p) {
    var s = ((p.img || "") + " " + (p.cat || "") + " " + (p.group || "") + " " + (p.specs || "") + " " + (p.id || "")).toLowerCase();
    var has = function () { for (var i = 0; i < arguments.length; i++) if (s.indexOf(arguments[i]) !== -1) return true; return false; };
    if (has("exit")) return "exit";
    if (has("emergency", "egress", "twin")) return "emergency";
    if (has("driver", "control", "sensor", "dimmer", "commission", "accessor", "controller", "power supply", "battery", "tool", "bracket", "anchor", "cable", "lens kit", "whip", "fuse")) return "module";
    if (has("highbay", "high bay", "ufo")) return "highbay";
    if (has("troffer", "panel", "backlit", "flat panel", "edge-lit", "edge lit")) return "panel";
    if (has("tube", "t8", "t5", "strip", "wrap", "linear", "cabinet", "cove", "tape")) return "tube";
    if (has("wallpack", "wall pack", "flood", "area", "canopy", "vapor", "bollard", "barn", "shoebox", "parking", "outdoor", "post top", "garage")) return "outdoor";
    if (has("downlight", "recess", "cylinder", "surface", "disk", "wafer", "retrofit", "can ", "trim")) return "downlight";
    if (has("candelabra", "b11", "ca10", "flame", "chandelier", "torpedo")) return "candle";
    if (has("globe", "g25", "g16", "g30", "vanity")) return "globe";
    if (has("mr16", "gu10", "track", "par16", "par20")) return "spot";
    if (has("par30", "par38", "br30", "br40", "br20", "reflector", "par ")) return "reflector";
    if (has("a19", "a21", "a-shape", "ashape", "edison", "st19", "st64", "filament", "household", "omni", "corn", "hid", "corncob")) return "bulb";
    return "bulb";
  }

  var STEEL = "#aab4c0", STEEL_D = "#8b96a3", STEEL_L = "#d7dee6";

  // Each fixture is drawn centered at (0,0), roughly within [-46,-46]..[46,46].
  function fixture(arch, glow) {
    var hl = '<ellipse cx="-8" cy="-14" rx="7" ry="11" fill="#ffffff" opacity="0.45"/>';
    var screw =
      '<path d="M-13 20 Q0 29 13 20 L11 28 -11 28 Z" fill="' + STEEL_L + '"/>' +
      '<rect x="-11" y="27" width="22" height="15" rx="2" fill="' + STEEL + '"/>' +
      '<line x1="-11" y1="32" x2="11" y2="32" stroke="' + STEEL_D + '" stroke-width="2"/>' +
      '<line x1="-11" y1="36" x2="11" y2="36" stroke="' + STEEL_D + '" stroke-width="2"/>' +
      '<rect x="-5" y="40" width="10" height="5" rx="2" fill="' + STEEL_D + '"/>';
    switch (arch) {
      case "bulb":
        return '<ellipse cx="0" cy="-8" rx="27" ry="29" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' + hl + screw;
      case "globe":
        return '<circle cx="0" cy="-6" r="31" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' + hl + screw;
      case "reflector":
        return '<path d="M-31 -16 Q0 -42 31 -16 L21 20 -21 20 Z" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' + hl +
          '<rect x="-12" y="19" width="24" height="14" rx="2" fill="' + STEEL + '"/><line x1="-12" y1="24" x2="12" y2="24" stroke="' + STEEL_D + '" stroke-width="2"/><line x1="-12" y1="28" x2="12" y2="28" stroke="' + STEEL_D + '" stroke-width="2"/>';
      case "spot":
        return '<path d="M-15 -20 L15 -20 L25 16 L-25 16 Z" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' +
          '<path d="M-15 -20 L15 -20 L12 -10 L-12 -10 Z" fill="' + STEEL + '"/>' +
          '<line x1="-8" y1="-26" x2="-8" y2="-20" stroke="' + STEEL_D + '" stroke-width="3"/><line x1="8" y1="-26" x2="8" y2="-20" stroke="' + STEEL_D + '" stroke-width="3"/>';
      case "candle":
        return '<path d="M0 -36 C 17 -16 14 8 0 20 C -14 8 -17 -16 0 -36 Z" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' + hl +
          '<rect x="-9" y="19" width="18" height="14" rx="2" fill="' + STEEL + '"/><line x1="-9" y1="24" x2="9" y2="24" stroke="' + STEEL_D + '" stroke-width="2"/>';
      case "tube":
        return '<rect x="-46" y="-12" width="92" height="24" rx="12" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' +
          '<rect x="-46" y="-12" width="7" height="24" rx="3" fill="' + STEEL + '"/><rect x="39" y="-12" width="7" height="24" rx="3" fill="' + STEEL + '"/>' +
          '<rect x="-30" y="-7" width="58" height="4" rx="2" fill="#ffffff" opacity="0.35"/>';
      case "panel":
        return '<rect x="-46" y="-32" width="92" height="64" rx="5" fill="' + STEEL_L + '"/>' +
          '<rect x="-40" y="-26" width="80" height="52" rx="4" fill="' + glow + '"/>' +
          '<rect x="-34" y="-20" width="68" height="6" rx="3" fill="#ffffff" opacity="0.3"/>';
      case "highbay":
        return '<path d="M-36 8 L-27 -16 L27 -16 L36 8 Z" fill="' + STEEL + '"/>' +
          '<rect x="-38" y="7" width="76" height="11" rx="4" fill="' + glow + '"/>' +
          '<rect x="-5" y="-26" width="10" height="10" fill="' + STEEL_D + '"/><line x1="0" y1="-26" x2="0" y2="-34" stroke="' + STEEL_D + '" stroke-width="3"/>';
      case "downlight":
        return '<circle cx="0" cy="0" r="36" fill="' + STEEL_L + '"/>' +
          '<circle cx="0" cy="0" r="28" fill="' + STEEL + '"/>' +
          '<circle cx="0" cy="0" r="21" fill="' + glow + '"/>' +
          '<circle cx="-7" cy="-7" r="5" fill="#ffffff" opacity="0.4"/>';
      case "outdoor":
        return '<rect x="-7" y="-30" width="14" height="14" fill="' + STEEL_D + '"/>' +
          '<path d="M-36 -16 L36 -16 L29 22 L-29 22 Z" fill="' + STEEL + '"/>' +
          '<rect x="-28" y="-9" width="56" height="24" rx="2" fill="' + glow + '"/>' +
          '<rect x="-22" y="-4" width="44" height="5" rx="2" fill="#ffffff" opacity="0.3"/>';
      case "exit":
        return '<rect x="-42" y="-22" width="84" height="44" rx="5" fill="' + STEEL + '"/>' +
          '<rect x="-37" y="-17" width="74" height="34" rx="3" fill="#b91c1c"/>' +
          '<text x="0" y="7" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="22" fill="#ffffff" letter-spacing="2">EXIT</text>';
      case "emergency":
        return '<rect x="-36" y="-4" width="72" height="24" rx="4" fill="' + STEEL_L + '" stroke="' + STEEL + '" stroke-width="2"/>' +
          '<circle cx="-17" cy="-10" r="12" fill="' + glow + '" stroke="' + STEEL + '" stroke-width="2"/>' +
          '<circle cx="17" cy="-10" r="12" fill="' + glow + '" stroke="' + STEEL + '" stroke-width="2"/>' +
          '<rect x="-30" y="9" width="10" height="6" rx="1" fill="#16a34a"/>';
      case "module":
      default:
        if (arch === "module") {
          return '<rect x="-42" y="-18" width="84" height="36" rx="4" fill="' + STEEL_L + '" stroke="' + STEEL + '" stroke-width="2"/>' +
            '<rect x="-36" y="-12" width="26" height="24" rx="2" fill="' + STEEL + '"/>' +
            '<circle cx="20" cy="-6" r="4" fill="' + glow + '"/>' +
            '<line x1="42" y1="-8" x2="52" y2="-8" stroke="' + STEEL_D + '" stroke-width="2"/><line x1="42" y1="0" x2="52" y2="0" stroke="' + STEEL_D + '" stroke-width="2"/><line x1="42" y1="8" x2="52" y2="8" stroke="' + STEEL_D + '" stroke-width="2"/>';
        }
        return '<ellipse cx="0" cy="-8" rx="27" ry="29" fill="' + glow + '" stroke="' + STEEL_L + '" stroke-width="2"/>' + hl + screw;
    }
  }

  // soft glow halo behind the fixture (no gradients → no id collisions)
  function halo(cx, cy, r, glow, on) {
    if (!on) return "";
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.5) + '" fill="' + glow + '" opacity="0.16"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.05) + '" fill="' + glow + '" opacity="0.22"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.7) + '" fill="' + glow + '" opacity="0.28"/>';
  }

  // decorative emission rays — count/rotation vary by id hash for uniqueness
  function rays(cx, cy, r, glow, seed) {
    var n = 3 + (seed % 4);
    var base = (seed >> 3) % 360;
    var out = '<g opacity="0.5" stroke="' + glow + '" stroke-width="2" stroke-linecap="round">';
    for (var i = 0; i < n; i++) {
      var a = (base + (i * 360 / n)) * Math.PI / 180;
      var x1 = cx + Math.cos(a) * (r + 6), y1 = cy + Math.sin(a) * (r + 6);
      var x2 = cx + Math.cos(a) * (r + 16), y2 = cy + Math.sin(a) * (r + 16);
      out += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    return out + '</g>';
  }

  function svg(p, opts) {
    p = p || {};
    opts = opts || {};
    var variant = opts.variant === "thumb" ? "thumb" : "card";
    var arch = archetype(p);
    var emits = arch !== "module"; // electronics don't "glow"
    var k = kelvin(p.cct);
    var glow = emits ? (arch === "exit" ? "#fca5a5" : glowColor(k)) : "#cbd5e1";
    var seed = hash(String(p.id || p.group || arch));
    var ox = (seed % 7) - 3, oy = ((seed >> 4) % 5) - 2; // tiny halo offset

    if (variant === "thumb") {
      var cx = 60, cy = 56;
      return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block" role="img" aria-label="' + esc(p.id || "product") + '">' +
        '<rect width="120" height="120" rx="10" fill="#f8fafc"/>' +
        halo(cx + ox, cy + oy, 34, glow, emits) +
        '<g transform="translate(' + cx + ',' + cy + ') scale(0.95)">' + fixture(arch, glow) + '</g>' +
        '</svg>';
    }

    var CX = 160, CY = 100;
    return '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block" role="img" aria-label="' + esc((p.id || "product") + " illustration") + '">' +
      '<rect width="320" height="200" rx="12" fill="#f8fafc"/>' +
      '<rect x="0" y="0" width="320" height="200" rx="12" fill="#ffffff" opacity="0.45"/>' +
      halo(CX + ox, CY + oy, 50, glow, emits) +
      (emits ? rays(CX, CY, 46, glow, seed) : "") +
      '<g transform="translate(' + CX + ',' + CY + ') scale(1.35)">' + fixture(arch, glow) + '</g>' +
      '</svg>';
  }

  window.SKUPhoto = { svg: svg, archetype: archetype, glowColor: glowColor, kelvin: kelvin };
})();
