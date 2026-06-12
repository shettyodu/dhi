/* AutoCommand — external inventory aggregation (Model A: referral marketplace).
   Pulls live used-car listings from a LICENSED provider (Marketcheck or Auto.dev),
   normalizes them to AutoCommand's vehicle schema (so the existing find-vehicle UI
   renders them with deal badges), dedupes by VIN, and tags each with its deal
   terms — Model A: the sale completes on the SOURCE; DHI hands the buyer off with
   attribution and earns a referral/sale fee.

   DORMANT until INVENTORY_PROVIDER + INVENTORY_API_KEY are set, so it ships safely
   and "flips on" when a key is added. NEVER scrape — use the provider API only.

   Env:
     INVENTORY_PROVIDER   "marketcheck" | "autodev"
     INVENTORY_API_KEY    provider key
     INVENTORY_RADIUS_MI  optional default search radius (default 250)
     INVENTORY_TIMEOUT_MS optional (default 9000) */

const PROVIDER = String(process.env.INVENTORY_PROVIDER || "").toLowerCase().trim();
const KEY = process.env.INVENTORY_API_KEY || "";
const RADIUS = Number(process.env.INVENTORY_RADIUS_MI || 250);
const TIMEOUT_MS = Number(process.env.INVENTORY_TIMEOUT_MS || 9000);

function configured() { return !!PROVIDER && !!KEY; }
const num = (x) => { const n = Number(x); return isNaN(n) ? null : n; };

// Model A deal terms — the source completes the transaction; DHI refers + earns.
function dealTermsFor(v) {
  return { model: "referral", completes_on: "source", source: v.source_name || v.source_provider || "", handoff_url: v.listing_url || "" };
}

async function fetchJSON(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, data: await r.json().catch(() => null) };
  } catch (e) { return { ok: false, status: e.name === "AbortError" ? 504 : 502 }; }
  finally { clearTimeout(timer); }
}

const pctVsMarket = (price, ref) => (price && ref) ? Math.round(((price - ref) / ref) * 1000) / 10 : null;

// ---- Marketcheck (api.marketcheck.com/v2/search/car/active) -----------------
function normMarketcheck(r) {
  const vd = r.vehicle || r.build || {};
  const price = num(r.price);
  const ref = num(r.ref_price) || num(r.predicted_price) || (r.price_analysis && num(r.price_analysis.predicted)) || null;
  return {
    vehicle_id: String(r.id || r.vin || ""),
    vin: r.vin || "",
    year: num(vd.year || r.year), make: vd.make || r.make || "", model: vd.model || r.model || "", trim: vd.trim || r.trim || "",
    mileage: num(r.miles), asking_price: price,
    drivetrain: vd.drivetrain || "", fuel_type: vd.fuel_type || "", transmission: vd.transmission || "",
    exterior_color: vd.exterior_color || "",
    location_city: (r.dealer && r.dealer.city) || "", location_state: (r.dealer && r.dealer.state) || "",
    photos: (r.media && Array.isArray(r.media.photo_links) && r.media.photo_links) || [],
    source_name: (r.dealer && r.dealer.name) || r.source || "", source_type: r.seller_type || "dealer",
    source_provider: "marketcheck",
    listing_url: r.vdp_url || (r.dealer && r.dealer.website) || "",
    title_status: "", accident_count: null,
    score: { overall_score: null, price_vs_market_pct: pctVsMarket(price, ref), dealer_reliability: null, mileage_class: null, title_risk: false, shipping_adjusted_cost: price },
  };
}

// ---- Auto.dev (auto.dev/api/listings) ---------------------------------------
function normAutodev(r) {
  const price = num(r.price || r.priceUnformatted);
  const ref = num(r.priceMarket || r.marketValue) || null;
  return {
    vehicle_id: String(r.id || r.vin || ""),
    vin: r.vin || "",
    year: num(r.year), make: r.make || "", model: r.model || "", trim: r.trim || "",
    mileage: num(r.mileage || r.mileageUnformatted), asking_price: price,
    drivetrain: r.drivetrain || r.driveType || "", fuel_type: r.fuelType || r.fuel || "", transmission: r.transmission || "",
    exterior_color: r.exteriorColor || r.color || "",
    location_city: r.city || "", location_state: r.state || "",
    photos: (Array.isArray(r.photoUrls) && r.photoUrls) || (r.primaryPhotoUrl ? [r.primaryPhotoUrl] : []),
    source_name: r.dealerName || r.sellerName || "", source_type: r.sellerType || "dealer",
    source_provider: "autodev",
    listing_url: r.clickoffUrl || r.vdpUrl || r.detailUrl || "",
    title_status: r.titleStatus || "", accident_count: null,
    score: { overall_score: null, price_vs_market_pct: pctVsMarket(price, ref), dealer_reliability: null, mileage_class: null, title_risk: false, shipping_adjusted_cost: price },
  };
}

// profile (AutoCommand schema) → provider query, fetch, normalize, dedupe.
async function searchInventory(profile) {
  if (!configured()) return { status: 503, json: { ok: false, configured: false, error: "Live inventory isn't configured yet (set INVENTORY_PROVIDER + INVENTORY_API_KEY)." } };
  const p = profile || {};
  let raw = [], norm = normMarketcheck;
  try {
    if (PROVIDER === "marketcheck") {
      const q = { api_key: KEY, car_type: "used", start: "0", rows: "30" };
      if (p.make) q.make = p.make;
      if (p.model) q.model = p.model;
      if (p.body_style) q.body_type = p.body_style;
      if (p.budget_max) q.price_range = `0-${Math.round(p.budget_max)}`;
      if (p.year_min || p.year_max) q.year_range = `${p.year_min || 1990}-${p.year_max || 2030}`;
      if (p.mileage_max) q.miles_range = `0-${Math.round(p.mileage_max)}`;
      if (p.location_zip) { q.zip = p.location_zip; q.radius = String(p.radius || RADIUS); }
      const r = await fetchJSON("https://api.marketcheck.com/v2/search/car/active?" + new URLSearchParams(q));
      if (!r.ok) return { status: 502, json: { ok: false, error: "Inventory provider unavailable (Marketcheck)." } };
      raw = (r.data && r.data.listings) || [];
      norm = normMarketcheck;
    } else if (PROVIDER === "autodev") {
      const q = new URLSearchParams();
      if (p.make) q.set("make", p.make);
      if (p.model) q.set("model", p.model);
      if (p.budget_max) q.set("price_max", String(Math.round(p.budget_max)));
      if (p.year_min) q.set("year_min", String(p.year_min));
      if (p.year_max) q.set("year_max", String(p.year_max));
      if (p.mileage_max) q.set("mileage_max", String(Math.round(p.mileage_max)));
      if (p.location_zip) { q.set("zip", p.location_zip); q.set("radius", String(p.radius || RADIUS)); }
      const r = await fetchJSON("https://auto.dev/api/listings?" + q.toString(), { headers: { Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return { status: 502, json: { ok: false, error: "Inventory provider unavailable (Auto.dev)." } };
      raw = (r.data && (r.data.records || r.data.listings)) || [];
      norm = normAutodev;
    } else {
      return { status: 400, json: { ok: false, error: `Unknown INVENTORY_PROVIDER "${PROVIDER}" (use marketcheck | autodev).` } };
    }
  } catch (e) {
    return { status: 502, json: { ok: false, error: "Inventory lookup failed." } };
  }
  const seen = new Set(), vehicles = [];
  for (const row of raw) {
    const v = norm(row);
    const key = v.vin || v.vehicle_id;
    if (!key || seen.has(key) || !v.make) continue;
    seen.add(key);
    v.deal_terms = dealTermsFor(v);
    vehicles.push(v);
  }
  // single recommendation bucket so the existing find-vehicle UI renders it as-is
  return { status: 200, json: { ok: true, provider: PROVIDER, count: vehicles.length, results: { buckets: [{ key: "live_inventory", label: "Live inventory matches", vehicles }] } } };
}

module.exports = { configured, searchInventory, dealTermsFor };
