/* AutoCommand Military — concierge intake for service members (PCS, deployment,
   OCONUS shipping, remote buy/sell). Posts to submit-lead as a customer lead with
   vertical="automotive" + source="military" so it routes to Bill (lead-routing).
   Lead-gen only — no payment, no transaction. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const ENDPOINT = API_BASE + "/.netlify/functions/submit-lead";
  const ref = (qs.get("ref") || "").slice(0, 64);
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const el = $(id); return el ? el.value.trim() : ""; };
  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600); }

  const form = $("mil-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("mil-status"), result = $("mil-result"), btn = $("mil-submit");
    const payload = {
      type: "customer", vertical: "automotive", source: "military",
      referral_code: ref,
      name: val("mil-name"), email: val("mil-email"), phone: val("mil-phone"),
      situation: val("mil-situation"), need: val("mil-need"),
      from_location: val("mil-from"), to_location: val("mil-to"),
      timeline: val("mil-timeline"), vehicle: val("mil-vehicle"),
      message: val("mil-msg"),
    };
    if (!payload.name || !payload.email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; result.classList.add("hidden");
    status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Submitting…";
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (r.ok && d.ok) {
        status.textContent = "";
        result.innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700"><p class="font-semibold text-emerald-700">Received — thank you for your service.</p><p class="mt-1">Bill or a member of our team will reach out shortly to line up your options. Reference: <span class="font-mono text-xs">${d.id}</span></p></div>`;
        result.classList.remove("hidden");
        form.classList.add("hidden");
        toast("Received — we'll follow up.");
      } else {
        status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || `Couldn't submit (HTTP ${r.status}).`;
      }
    } catch (e) {
      status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again.";
    } finally { btn.disabled = false; }
  });
})();
