import vm from "vm"; import fs from "fs";
function load(file, varName) {
  const src = fs.readFileSync(file, "utf8") + `\n;globalThis.__RESULT = (typeof ${varName} !== 'undefined') ? ${varName} : [];`;
  const ctx = { window: {}, document: { createElement: () => ({}) }, console };
  ctx.globalThis = ctx; vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch (e) { console.error("eval", file, e.message); }
  return Array.isArray(ctx.__RESULT) ? ctx.__RESULT : [];
}
const L = load("site/assets/catalog-data.js", "KEYSTONE_PRODUCTS");
const S = load("site/assets/supplies-data.js", "SUPPLIES_PRODUCTS");
const lite = L.map(p => ({ id: p.id, cat: p.cat, group: p.group, specs: (p.specs || "").slice(0, 140), w: p.w, lm: p.lm, cct: p.cct, base: p.base, p: p.p == null ? null : p.p }));
const slite = S.map(p => ({ id: p.id, name: p.t, cat: p.cat, group: p.group, unit: p.unit, specs: (p.specs || "").slice(0, 160), p: p.p == null ? null : p.p }));
fs.writeFileSync("backend/data/lighting-index.json", JSON.stringify(lite));
fs.writeFileSync("backend/data/supplies-index.json", JSON.stringify(slite));
console.log("lighting:", lite.length, "| supplies:", slite.length);
console.log("L sample:", JSON.stringify(lite[0]));
console.log("S sample:", JSON.stringify(slite[0]));
