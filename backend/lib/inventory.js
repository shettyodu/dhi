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

// Geocode a city/place to lat/lon so Auto.dev's radius filter works. Common US
// metros resolve instantly from a built-in table; anything else falls back to
// the free, key-less OpenStreetMap (Nominatim) geocoder (US-scoped, short timeout).
const CITY_GEO = {
  "norfolk": [36.8508, -76.2859], "virginia beach": [36.8529, -75.9780], "chesapeake": [36.7682, -76.2875],
  "richmond": [37.5407, -77.4360], "raleigh": [35.7796, -78.6382], "durham": [35.9940, -78.8986],
  "charlotte": [35.2271, -80.8431], "greensboro": [36.0726, -79.7920], "washington": [38.9072, -77.0369],
  "baltimore": [39.2904, -76.6122], "atlanta": [33.7490, -84.3880], "charleston": [32.7765, -79.9311],
  "columbia": [34.0007, -81.0348], "nashville": [36.1627, -86.7816], "knoxville": [35.9606, -83.9207],
  "new york": [40.7128, -74.0060], "philadelphia": [39.9526, -75.1652], "boston": [42.3601, -71.0589],
  "chicago": [41.8781, -87.6298], "detroit": [42.3314, -83.0458], "dallas": [32.7767, -96.7970],
  "houston": [29.7604, -95.3698], "austin": [30.2672, -97.7431], "san antonio": [29.4241, -98.4936],
  "denver": [39.7392, -104.9903], "phoenix": [33.4484, -112.0740], "las vegas": [36.1699, -115.1398],
  "los angeles": [34.0522, -118.2437], "san diego": [32.7157, -117.1611], "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321], "portland": [45.5152, -122.6784], "miami": [25.7617, -80.1918],
  "orlando": [28.5383, -81.3792], "tampa": [27.9506, -82.4572], "jacksonville": [30.3322, -81.6557],
  "minneapolis": [44.9778, -93.2650], "st louis": [38.6270, -90.1994], "kansas city": [39.0997, -94.5786],
  "newport news": [37.0871, -76.4730], "hampton": [37.0299, -76.3452], "suffolk": [36.7282, -76.5836],
};
async function geocode(text, state) {
  const key = String(text || "").toLowerCase().replace(/[.'-]/g, "").replace(/\s+/g, " ").trim();
  if (key && CITY_GEO[key]) return { lat: CITY_GEO[key][0], lon: CITY_GEO[key][1] };
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const params = new URLSearchParams({ format: "json", limit: "1", country: "us", city: text });
    if (state) params.set("state", state);
    const r = await fetch("https://nominatim.openstreetmap.org/search?" + params.toString(), {
      headers: { "User-Agent": "DHI-AutoCommand/1.0 (vehicle search)", Accept: "application/json" }, signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => []);
    if (Array.isArray(j) && j[0] && j[0].lat && j[0].lon) return { lat: Number(j[0].lat), lon: Number(j[0].lon) };
  } catch (e) { /* geocode best-effort */ } finally { clearTimeout(timer); }
  return null;
}

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
// Auto.dev returns price/mileage as formatted strings ("$28,500"), clickoffUrl
// as a relative path, and no market value in the basic listing (so no deal %).
const money = (x) => { if (x == null) return null; if (typeof x === "number") return isNaN(x) ? null : x; const n = Number(String(x).replace(/[^0-9.]/g, "")); return isNaN(n) ? null : n; };
function normAutodev(r) {
  const price = money(r.priceUnformatted != null ? r.priceUnformatted : r.price);
  const ref = money(r.priceMarket != null ? r.priceMarket : (r.marketValue != null ? r.marketValue : r.retailValue));
  // Only use a clickoff URL that's a real absolute link the buyer can actually
  // open. Auto.dev metasearch listings have clickoffUrl=null / clickOff=false and
  // expose only an internal vdpUrl/hrefTarget that 404s off-platform — those are
  // lead-based (acceptsLeads), so we hand the buyer off via a DHI advisor request
  // instead of opening a dead page. listing_url stays "" unless a true clickoff exists.
  let url = r.clickoffUrl || r.clickOffUrl || "";
  if (url && url.indexOf("http") !== 0) url = "";
  const acceptsLeads = r.acceptsLeads === true || (!url && r.clickOff !== true);
  return {
    vehicle_id: String(r.id || r.vin || ""),
    vin: r.vin || "",
    year: num(r.year), make: r.make || "", model: r.model || "", trim: r.trim || "",
    mileage: money(r.mileageUnformatted != null ? r.mileageUnformatted : r.mileage), asking_price: price,
    drivetrain: r.drivetrain || r.driveType || "", fuel_type: r.fuelType || r.fuel || "", transmission: r.transmission || "",
    exterior_color: r.displayColor || r.exteriorColor || r.color || "",
    location_city: r.city || "", location_state: r.state || "",
    photos: (Array.isArray(r.photoUrls) && r.photoUrls) || (r.primaryPhotoUrl ? [r.primaryPhotoUrl] : []),
    source_name: r.dealerName || r.sellerName || "", source_type: r.sellerType || "dealer",
    source_provider: "autodev",
    listing_url: url, accepts_leads: acceptsLeads,
    title_status: r.titleStatus || "", accident_count: null,
    score: { overall_score: null, price_vs_market_pct: pctVsMarket(price, ref), dealer_reliability: null, mileage_class: null, title_risk: false, shipping_adjusted_cost: null },
  };
}

// profile (AutoCommand schema) → provider query, fetch, normalize, dedupe.
async function searchInventory(profile) {
  if (!configured()) return { status: 503, json: { ok: false, configured: false, error: "Live inventory isn't configured yet (set INVENTORY_PROVIDER + INVENTORY_API_KEY)." } };
  const p = Object.assign({}, profile);
  // Auto.dev's make/model query is case-SENSITIVE ("toyota" → 0, "Toyota" → 20).
  // The structured form passes raw user text (often lowercase), so title-case here
  // — fixes "camry"/"toyota" returning no matches regardless of how it was typed.
  const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());
  if (p.make) p.make = titleCase(p.make);
  if (p.model) p.model = titleCase(p.model);
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
      if (p.body_style) q.set("body_style", p.body_style); // honored if supported; client also post-filters
      if (p.budget_max) q.set("price_max", String(Math.round(p.budget_max)));
      if (p.year_min) q.set("year_min", String(p.year_min));
      if (p.year_max) q.set("year_max", String(p.year_max));
      if (p.mileage_max) q.set("mileage_max", String(Math.round(p.mileage_max)));
      // Location: a ZIP filters by zip+radius directly. A city/place is geocoded
      // to lat/lon so the radius is honored (Auto.dev ignores free-text location).
      if (p.location_zip) { q.set("zip", p.location_zip); q.set("radius", String(p.radius || RADIUS)); }
      else if (p.location_text || p.location_state) {
        const geo = await geocode(p.location_text, p.location_state);
        if (geo) { q.set("latitude", String(geo.lat)); q.set("longitude", String(geo.lon)); q.set("radius", String(p.radius || RADIUS)); }
        else if (p.location_state) { q.set("state", p.location_state); }
      }
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
  // Relevance safety net: providers sometimes loosely match make/model, returning
  // (e.g.) every Toyota for a "Camry SE" search. Narrow to the requested model and
  // trim — but only when that leaves results, so a strict trim never zeroes a page.
  let matches = vehicles;
  if (p.make) {
    const want = String(p.make).toLowerCase().replace(/[^a-z]/g, "");
    const f = matches.filter((v) => {
      const mk = String(v.make || "").toLowerCase().replace(/[^a-z]/g, "");
      return mk && (mk === want || mk.includes(want) || want.includes(mk));
    });
    if (f.length) matches = f;
  }
  if (p.model) {
    const want = String(p.model).toLowerCase();
    const f = matches.filter((v) => {
      const m = String(v.model || "").toLowerCase();
      return m && (m.includes(want) || want.includes(m));
    });
    if (f.length) matches = f;
  }
  if (p.trim) {
    const want = String(p.trim).toLowerCase();
    const f = matches.filter((v) => String(v.trim || "").toLowerCase().includes(want));
    if (f.length) matches = f;
  }
  applyCohortDeal(matches);   // deal rating from comparable set when the provider gives no market value
  // single recommendation bucket so the existing find-vehicle UI renders it as-is
  return { status: 200, json: { ok: true, provider: PROVIDER, count: matches.length, results: { total_count: matches.length, buckets: [{ key: "live_inventory", label: "Live inventory matches", vehicles: matches }] } } };
}

// When the provider doesn't return a market value (e.g. Auto.dev), derive a
// deal rating from the median price of each make|model|year cohort in the result
// set (>= 3 comparables). No extra API calls; only fills price_vs_market_pct
// where it's genuinely absent.
function median(a) { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function applyCohortDeal(vehicles) {
  const groups = {};
  for (const v of vehicles) { if (v.asking_price == null) continue; const k = `${v.make}|${v.model}|${v.year}`.toLowerCase(); (groups[k] = groups[k] || []).push(v.asking_price); }
  for (const v of vehicles) {
    if (v.score.price_vs_market_pct != null || v.asking_price == null) continue;
    const g = groups[`${v.make}|${v.model}|${v.year}`.toLowerCase()] || [];
    if (g.length >= 3) {
      const ref = median(g);
      if (ref) { v.score.price_vs_market_pct = Math.round(((v.asking_price - ref) / ref) * 1000) / 10; v.score.market_basis = "comparable set"; }
    }
  }
}

module.exports = { configured, searchInventory, dealTermsFor };
