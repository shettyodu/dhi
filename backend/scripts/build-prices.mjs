/* Regenerate data/prices.json from the site catalog so the server reprices
   with the same list prices the catalog shows.
   Run:  node scripts/build-prices.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "..", "site", "assets");
const outPath = join(here, "..", "data", "prices.json");

const prices = {};
function ingest(file) {
  const s = readFileSync(join(assets, file), "utf8");
  const arr = JSON.parse(s.slice(s.indexOf("["), s.lastIndexOf("]") + 1));
  for (const p of arr) {
    if (p.p != null) { prices[p.id] = { p: p.p }; if (p.pr != null) prices[p.id].pr = p.pr; }
  }
}
ingest("catalog-data.js");    // Keystone lighting
ingest("supplies-data.js");   // EHSP PPE / supplies
ingest("nutrition-data.js");  // Vitalleo / Edison nutrition
writeFileSync(outPath, JSON.stringify(prices));
console.log(`Wrote ${outPath} with ${Object.keys(prices).length} priced SKUs`);
