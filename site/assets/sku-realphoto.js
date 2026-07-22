/* sku-realphoto.js — resolves a lighting SKU to a REAL manufacturer product
   photo (or "" if none), shared by the catalog page and the AI advisor so the
   photo mapping lives in ONE place. Falls back (caller's job) to the generated
   SKUPhoto illustration when this returns "".

   Two sources:
   - Keystone: one photo per fixture family, keyed off the SKU's illustration
     basename (p.img), sourced from keystonetech.com.
   - Other suppliers: one real hero photo per fixture archetype per brand
     (validated raster images under assets/img/products/<dir>/), mapped from the
     product's `group` (authoritative) with a spec-keyword fallback.

   API:  SKURealPhoto(p) -> "assets/img/products/.../file.ext" | ""
*/
(function () {
  "use strict";
  var BASE = "assets/img/products/";

  // Keystone family map (illustration basename -> keystone photo basename).
  var KS_PHOTO = {
    "light-par": "par", "light-tube": "tube", "light-ashape": "ashape", "light-br": "br",
    "light-highbay": "highbay", "light-strip": "strip", "light-wrap": "strip", "light-vapor": "vapor",
    "light-troffer": "troffer", "light-panel": "troffer", "light-area": "area", "light-wallpack": "wallpack",
    "light-flood": "flood", "light-bollard": "bollard", "light-driver": "driver", "light-control": "control",
    "light-exit": "exit", "light-emergency": "emergency", "light-corncob": "corncob", "light-cylinder": "cylinder",
    "light-canopy": "canopy", "light-surface": "surface", "light-downlight-rd": "downlight", "light-downlight-ps": "downlight",
    "light-candelabra": "candelabra", "light-edison": "edison", "light-globe": "globe",
  };

  // Per-brand archetype photos (supplier -> { dir, arch: {archetype -> file} }).
  var SUP_PHOTO = {
    "Acuity Brands": { dir: "acuity", arch: { "panel": "panel.png", "downlight": "downlight.png", "area": "area.png", "wallpack": "wallpack.png", "flood": "flood.jpg", "canopy": "canopy.jpg", "strip": "strip.jpg", "vaportight": "vaportight.png", "wraparound": "wraparound.png", "exit": "exit.jpg", "emergency": "emergency.png", "occupancy-sensor": "occupancy-sensor.png", "photocell": "photocell.png", "power-pack": "power-pack.jpg", "room-controller": "room-controller.png", "fixture-sensor": "fixture-sensor.png", "outdoor-sensor": "outdoor-sensor.png" } },
    "Cree Lighting": { dir: "cree", arch: { "high-bay": "high-bay.png", "troffer": "troffer.jpg", "panel": "panel.jpg", "downlight": "downlight.jpg", "strip": "strip.jpg", "wallpack": "wallpack.jpg", "flood": "flood.jpg", "canopy": "canopy.png", "area": "area.jpg" } },
    "Alcon Lighting": { dir: "alcon", arch: { "downlight": "downlight.jpg", "cylinder": "cylinder.jpg", "panel": "panel.png", "track": "track.png", "strip": "strip.jpg", "vaportight": "vaportight.jpg", "high-bay": "high-bay.jpg", "wall-sconce": "wall-sconce.jpg" } },
    "Eaton": { dir: "eaton", arch: { "troffer": "troffer.webp", "panel": "panel.webp", "wraparound": "wraparound.webp", "downlight": "downlight.webp", "high-bay": "high-bay.webp", "area": "area.webp", "roadway": "roadway.webp", "flood": "flood.webp", "canopy": "canopy.webp", "vaportight": "vaportight.webp", "wallpack": "wallpack.webp", "strip": "strip.webp" } },
    "Orion Energy Systems": { dir: "orion", arch: { "high-bay": "high-bay.jpg", "vaportight": "vaportight.png", "area": "area.png", "flood": "flood.png", "troffer": "troffer.png", "panel": "panel.png", "linear": "linear.webp", "wallpack": "wallpack.png", "canopy": "canopy.jpg", "strip": "strip.png", "stairwell": "stairwell.webp", "roadway": "roadway.webp" } },
    "Signify": { dir: "signify", arch: { "high-bay": "high-bay.webp", "troffer": "troffer.webp", "panel": "panel.webp", "downlight": "downlight.jpg", "area": "area.webp", "flood": "flood.webp", "vaportight": "vaportight.webp", "tube": "tube.webp", "lamp": "lamp.webp", "wallpack": "wallpack.webp", "batten": "batten.jpg" } },
  };

  // group (authoritative) -> archetype slug.
  var GROUP_ARCH = {
    "high bay": "high-bay", "troffer": "troffer", "flat panel": "panel", "panel": "panel",
    "downlight": "downlight", "area light": "area", "area": "area", "wall pack": "wallpack",
    "flood": "flood", "floodlight": "flood", "canopy": "canopy", "strip": "strip",
    "vapor tight": "vaportight", "vaportight": "vaportight", "vaportite": "vaportight",
    "wraparound": "wraparound", "roadway": "roadway", "roadway / streetlight": "roadway",
    "exit": "exit", "emergency": "emergency", "cylinder": "cylinder", "track": "track",
    "batten": "batten", "stairwell": "stairwell", "linear": "linear", "multipurpose linear": "linear",
    "recessed linear": "linear", "pendant linear": "linear", "surface linear": "linear",
    "wall sconce": "wall-sconce", "tube": "tube", "lamp": "lamp",
    "occupancy sensor": "occupancy-sensor", "photocell": "photocell", "power pack": "power-pack",
    "room controller": "room-controller", "wireless sensor": "fixture-sensor",
    "fixture sensor": "fixture-sensor", "outdoor sensor": "outdoor-sensor",
  };
  // Cross-map an archetype a brand lacks to a visually-equivalent one it has.
  var ARCH_ALIAS = { "linear": "strip" };

  function photoArch(p) {
    var g = (p.group || "").toLowerCase().trim();
    if (GROUP_ARCH[g]) return GROUP_ARCH[g];
    var s = (g + " " + (p.cat || "") + " " + (p.specs || "") + " " + (p.id || "")).toLowerCase();
    var has = function () { for (var i = 0; i < arguments.length; i++) if (s.indexOf(arguments[i]) !== -1) return true; return false; };
    if (has("high bay", "highbay")) return "high-bay";
    if (has("troffer")) return "troffer";
    if (has("flat panel", "panel", "backlight")) return "panel";
    if (has("vapor")) return "vaportight";
    if (has("wrap")) return "wraparound";
    if (has("wall pack", "wallpack")) return "wallpack";
    if (has("area")) return "area";
    if (has("flood")) return "flood";
    if (has("canopy", "soffit", "garage", "parking")) return "canopy";
    if (has("strip")) return "strip";
    if (has("roadway", "street")) return "roadway";
    if (has("cylinder")) return "cylinder";
    if (has("track")) return "track";
    if (has("linear")) return "linear";
    if (has("downlight", "wafer")) return "downlight";
    if (has("tube")) return "tube";
    if (has("lamp", "bulb", "spot", "mr16", "gu10", "par")) return "lamp";
    return "";
  }

  function realPhoto(p) {
    if (!p) return "";
    // Keystone: family map on the illustration basename.
    if (p.img) {
      var base = p.img.split("/").pop().replace(/\.(png|jpe?g|webp|svg)$/i, "");
      var f = KS_PHOTO[base];
      if (f) return BASE + "keystone/" + f + ".jpg";
    }
    // Other suppliers: brand + archetype photo (illustration fallback if absent).
    var sp = SUP_PHOTO[p.supplier];
    if (sp) {
      var a = photoArch(p);
      var file = sp.arch[a] || (ARCH_ALIAS[a] && sp.arch[ARCH_ALIAS[a]]);
      if (file) return BASE + sp.dir + "/" + file;
    }
    return "";
  }

  window.SKURealPhoto = realPhoto;
})();
