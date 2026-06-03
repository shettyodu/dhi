/* =====================================================================
   Authoritative server-side pricing for DHI lighting orders.
   The browser shows ESTIMATES; this module is the source of truth used to
   build the Stripe charge amount (never trust a price sent by the client).
   Keep the tax/zone tables in sync with site/assets/checkout.js (display),
   and regenerate data/prices.json with scripts/build-prices.mjs when the
   catalog changes.
   ===================================================================== */
const PRICES = require("../data/prices.json");

const CONFIG = { freeShipThreshold: 2500, poThreshold: 2500, currency: "usd" };

// estimated combined (state+avg local) sales-tax rates, %
const TAX = { AL:9.29,AK:1.81,AZ:8.37,AR:9.45,CA:8.85,CO:7.81,CT:6.35,DE:0,DC:6.0,FL:7.0,GA:7.4,HI:4.44,ID:6.02,IL:8.85,IN:7.0,IA:6.94,KS:8.75,KY:6.0,LA:9.56,ME:5.5,MD:6.0,MA:6.25,MI:6.0,MN:8.04,MS:7.07,MO:8.39,MT:0,NE:6.97,NV:8.24,NH:0,NJ:6.6,NM:7.72,NY:8.53,NC:6.98,ND:7.04,OH:7.24,OK:8.99,OR:0,PA:6.34,RI:7.0,SC:7.5,SD:6.4,TN:9.55,TX:8.2,UT:7.25,VT:6.36,VA:5.77,WA:9.38,WV:6.55,WI:5.43,WY:5.44 };
const ZONE = { NC:1,SC:1,VA:1,GA:1,TN:1, MD:2,DC:2,WV:2,KY:2,AL:2,FL:2,DE:2,PA:2,NJ:2,
  NY:3,OH:3,IN:3,MS:3,AR:3,LA:3,CT:3,RI:3,MA:3,NH:3,VT:3,ME:3,MI:3,IL:3,MO:3,WI:3,IA:3,MN:3,
  ND:4,SD:4,NE:4,KS:4,OK:4,TX:4,CO:4,WY:4,MT:4,NM:4,AZ:4,UT:4,ID:4,NV:4,CA:4,OR:4,WA:4, AK:5,HI:5 };
const ZONE_BASE = { 1:19, 2:29, 3:45, 4:69, 5:129 };
const ZR = [[5,5,"NY"],[10,27,"MA"],[28,29,"RI"],[30,38,"NH"],[39,49,"ME"],[50,59,"VT"],[60,69,"CT"],
  [70,89,"NJ"],[100,149,"NY"],[150,196,"PA"],[197,199,"DE"],[200,205,"DC"],[206,219,"MD"],[220,246,"VA"],
  [247,268,"WV"],[270,289,"NC"],[290,299,"SC"],[300,319,"GA"],[320,349,"FL"],[350,369,"AL"],[370,385,"TN"],
  [386,397,"MS"],[398,399,"GA"],[400,427,"KY"],[430,459,"OH"],[460,479,"IN"],[480,499,"MI"],[500,528,"IA"],
  [530,549,"WI"],[550,567,"MN"],[570,577,"SD"],[580,588,"ND"],[590,599,"MT"],[600,629,"IL"],[630,658,"MO"],
  [660,679,"KS"],[680,693,"NE"],[700,714,"LA"],[716,729,"AR"],[730,749,"OK"],[750,799,"TX"],[800,816,"CO"],
  [820,831,"WY"],[832,838,"ID"],[840,847,"UT"],[850,865,"AZ"],[870,884,"NM"],[889,898,"NV"],[900,961,"CA"],
  [967,968,"HI"],[970,979,"OR"],[980,994,"WA"],[995,999,"AK"]];

function zipToState(zip) {
  const z = parseInt(String(zip || "").slice(0, 3), 10);
  if (isNaN(z)) return "";
  for (const [lo, hi, st] of ZR) if (z >= lo && z <= hi) return st;
  return "";
}

/* reprice from the cart + ship-to; returns authoritative amounts in cents */
function reprice({ items = [], ship = {}, exempt = false } = {}) {
  let subtotal = 0;
  const lines = [];
  for (const it of items) {
    const rec = PRICES[it.id];
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    if (!rec || rec.p == null) continue; // skip unknown / quote-only
    const lineTotal = rec.p * qty;
    subtotal += lineTotal;
    lines.push({ id: it.id, qty, unit: rec.p, lineTotal });
  }
  const st = ship.state || zipToState(ship.zip);
  const rate = exempt ? 0 : (TAX[st] || 0);
  const tax = subtotal * rate / 100;
  let shipping = 0;
  if (subtotal > 0 && subtotal < CONFIG.freeShipThreshold && st) {
    shipping = Math.min(350, ZONE_BASE[ZONE[st] || 4] + 0.025 * subtotal);
  }
  const round2 = (n) => Math.round(n * 100) / 100;
  subtotal = round2(subtotal); const taxR = round2(tax); const shipR = round2(shipping);
  const total = round2(subtotal + taxR + shipR);
  return {
    currency: CONFIG.currency, state: st, rate,
    subtotal, tax: taxR, shipping: shipR, total,
    amountCents: Math.round(total * 100),
    lines,
  };
}

module.exports = { reprice, zipToState, CONFIG, PRICES };
