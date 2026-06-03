/* Find My Vehicle — customer intake. Posts a lead to the submit-lead function
   (type=customer). Capture-only; no transaction. */
(function () {
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    localStorage.getItem("dhi_api_base") ||
    "https://courageous-fairy-0b2d3c.netlify.app";
  const ENDPOINT = API_BASE + "/.netlify/functions/submit-lead";
  const ref = (new URLSearchParams(location.search).get("ref") || "").slice(0, 64);

  const $ = (id) => document.getElementById(id);
  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2400); }

  const form = $("fv-form");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      type: "customer",
      name: $("fv-name").value.trim(),
      email: $("fv-email").value.trim(),
      phone: $("fv-phone").value.trim(),
      referral_code: ref,
      make: $("fv-make").value.trim(), model: $("fv-model").value.trim(),
      year: $("fv-year").value.trim(), mileage: $("fv-mileage").value.trim(),
      price: $("fv-price").value.trim(), payment: $("fv-payment").value.trim(),
      down_trade: $("fv-down").value.trim(), credit: $("fv-credit").value,
      location: $("fv-location").value.trim(), shipping: $("fv-shipping").value,
      use_case: $("fv-use").value.trim(),
    };
    const status = $("fv-status"), btn = $("fv-submit"), result = $("fv-result");
    if (!payload.name || !payload.email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; result.classList.add("hidden");
    status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Submitting your request…";
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let d = {}; try { d = await r.json(); } catch (e2) {}
      if (r.ok && d.ok) {
        status.textContent = "";
        result.innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p class="flex items-center gap-2 font-semibold text-emerald-700"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>Request received</p>
          <p class="mt-2 text-sm text-slate-600">Thanks! Our team will match vehicles to your criteria and follow up with options, real delivered cost, and financing &amp; protection choices. Reference: <span class="font-mono text-xs">${d.id}</span></p>
          <div class="mt-3 flex flex-wrap gap-2">
            <a href="automotive-passport.html" class="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Explore Vehicle Passport →</a>
            <a href="automotive.html" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-white">Back to AutoCommand</a>
          </div></div>`;
        result.classList.remove("hidden"); form.classList.add("hidden"); toast("Request received");
      } else {
        status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || `Couldn't submit (HTTP ${r.status}).`;
      }
    } catch (err) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again."; }
    finally { btn.disabled = false; }
  });
})();
