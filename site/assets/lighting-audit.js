/* Free lighting audit / savings-proposal intake.
   Posts to /.netlify/functions/submit-lead as { type:"audit", vertical:"lighting" }
   so it auto-routes to the lighting owner (Steve). Capture only — no payments.
   Query params:  ?ref=CODE  affiliate attribution   ?api=BASE  proxy base */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const ref = (qs.get("ref") || "").trim();
  const $ = (id) => document.getElementById(id);
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const IN = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500";
  const LBL = "block text-sm font-medium text-slate-700";
  const opt = (arr) => arr.map((o) => `<option value="${o.replace(/"/g, "&quot;")}">${o}</option>`).join("");

  const FACILITY = ["Warehouse / industrial", "Parking structure or lot", "Office", "Retail", "Healthcare facility", "Multifamily / property mgmt", "School / campus", "House of worship", "Municipal / government", "Other"];
  const CURRENT = ["Fluorescent (T8 / T12)", "HID — metal halide / HPS", "Incandescent / halogen", "Older LED", "Mixed / not sure"];
  const HOURS = ["Under 8 hrs/day", "8–12 hrs/day", "12–18 hrs/day", "24/7", "Not sure"];
  const TIMELINE = ["As soon as possible", "1–3 months", "3–6 months", "Just exploring"];

  function render() {
    const host = $("audit-form");
    if (!host) return;
    host.innerHTML = `
      <form id="af" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" novalidate>
        <h2 class="font-display text-xl font-bold text-brand-900">Tell us about your facility</h2>
        <p class="mt-1 text-sm text-slate-500">Takes about a minute. The more you share, the sharper your savings proposal.</p>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="${LBL}" for="company">Company / organization <span class="text-red-500">*</span></label>
            <input id="company" class="${IN}" autocomplete="organization" />
          </div>
          <div>
            <label class="${LBL}" for="facility">Facility type</label>
            <select id="facility" class="${IN}">${opt(FACILITY)}</select>
          </div>
          <div>
            <label class="${LBL}" for="current">Current lighting</label>
            <select id="current" class="${IN}">${opt(CURRENT)}</select>
          </div>
          <div>
            <label class="${LBL}" for="sqft">Approx. size (sq ft)</label>
            <input id="sqft" class="${IN}" inputmode="numeric" placeholder="e.g. 40,000" />
          </div>
          <div>
            <label class="${LBL}" for="fixtures">Approx. # of fixtures</label>
            <input id="fixtures" class="${IN}" inputmode="numeric" placeholder="e.g. 250" />
          </div>
          <div>
            <label class="${LBL}" for="hours">Daily operating hours</label>
            <select id="hours" class="${IN}">${opt(HOURS)}</select>
          </div>
          <div>
            <label class="${LBL}" for="timeline">Timeline</label>
            <select id="timeline" class="${IN}">${opt(TIMELINE)}</select>
          </div>
          <div class="sm:col-span-2">
            <label class="${LBL}" for="location">Location (city, state or ZIP)</label>
            <input id="location" class="${IN}" autocomplete="address-level2" placeholder="Norfolk, VA" />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <label class="inline-flex items-center gap-2 text-sm text-slate-700"><input id="rebate" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 accent-cyan-600" /> Check my utility-rebate eligibility</label>
          <label class="inline-flex items-center gap-2 text-sm text-slate-700"><input id="install" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-cyan-600" /> I'd want turnkey installation</label>
        </div>

        <hr class="my-5 border-slate-100" />

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="${LBL}" for="name">Your name <span class="text-red-500">*</span></label>
            <input id="name" class="${IN}" autocomplete="name" />
          </div>
          <div>
            <label class="${LBL}" for="email">Work email <span class="text-red-500">*</span></label>
            <input id="email" type="email" class="${IN}" autocomplete="email" />
          </div>
          <div>
            <label class="${LBL}" for="phone">Phone</label>
            <input id="phone" type="tel" class="${IN}" autocomplete="tel" />
          </div>
          <div class="sm:col-span-2">
            <label class="${LBL}" for="notes">Anything else? (problem areas, goals, deadlines)</label>
            <textarea id="notes" rows="3" class="${IN}"></textarea>
          </div>
        </div>

        <p id="af-err" class="mt-4 hidden rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"></p>
        <button id="af-go" type="submit" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">
          Get my free savings proposal
        </button>
        <p class="mt-3 text-xs text-slate-400">No cost, no obligation. We review every request — a person, not a bot, follows up.</p>
      </form>`;
    $("af").addEventListener("submit", submit);
  }

  function showErr(msg) { const e = $("af-err"); e.textContent = msg; e.classList.remove("hidden"); }

  async function submit(ev) {
    ev.preventDefault();
    const v = (id) => ($(id) ? $(id).value.trim() : "");
    const name = v("name"), email = v("email"), company = v("company");
    if (!company) return showErr("Please tell us your company or organization.");
    if (!name) return showErr("Please enter your name.");
    if (!EMAIL_RE.test(email)) return showErr("Please enter a valid work email.");
    $("af-err").classList.add("hidden");
    const btn = $("af-go"); btn.disabled = true; btn.textContent = "Sending…";

    const lead = {
      type: "audit",
      vertical: "lighting",
      source: "lighting-audit",
      referral_code: ref,
      name, email, phone: v("phone"),
      company,
      facility_type: v("facility"),
      current_lighting: v("current"),
      approx_sqft: v("sqft"),
      approx_fixtures: v("fixtures"),
      operating_hours: v("hours"),
      timeline: v("timeline"),
      location: v("location"),
      wants_rebate_help: $("rebate") && $("rebate").checked ? "yes" : "no",
      wants_install: $("install") && $("install").checked ? "yes" : "no",
      notes: v("notes"),
    };

    let ok = false;
    try {
      const r = await fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
      ok = r.ok;
    } catch (e) { ok = false; }

    if (!ok) {
      btn.disabled = false; btn.textContent = "Get my free savings proposal";
      return showErr("Something went wrong sending your request. Please try again, or email lighting@digitalhealthinternational.com.");
    }
    success(name, company);
  }

  function success(name, company) {
    const host = $("audit-form");
    host.innerHTML = `
      <div class="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg class="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 class="mt-4 font-display text-2xl font-bold text-brand-900">Request received${name ? ", " + name.split(" ")[0] : ""} ✓</h2>
        <p class="mx-auto mt-2 max-w-md text-slate-600">Thanks${company ? " — we've got " + company : ""}. Our lighting team will review your facility details and follow up with your savings proposal, rebate eligibility, and a Keystone LED quote.</p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <a href="lighting-roi.html" class="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">Estimate savings now →</a>
          <a href="lighting-catalog.html" class="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">Browse the catalog</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (document.readyState !== "loading") render(); else document.addEventListener("DOMContentLoaded", render);
})();
