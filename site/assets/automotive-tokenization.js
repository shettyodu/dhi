/* Vehicle Tokenization — dual lead capture (owner/dealer + investor).
   Posts to submit-lead with type="tokenization" and a role; flows to Netlify
   Blobs + HubSpot. Informational/lead-gen only — no offer, no transaction. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const ENDPOINT = API_BASE + "/.netlify/functions/submit-lead";
  const ref = (qs.get("ref") || "").slice(0, 64);
  const $ = (id) => document.getElementById(id);
  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600); }
  const val = (id) => { const el = $(id); return el ? el.value.trim() : ""; };

  async function submit(payload, btn, status, result, okMsg) {
    if (!payload.name || !payload.email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; result.classList.add("hidden");
    status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Submitting…";
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (r.ok && d.ok) {
        status.textContent = "";
        result.innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700"><p class="font-semibold text-emerald-700">Received</p><p class="mt-1">${okMsg} Reference: <span class="font-mono text-xs">${d.id}</span></p></div>`;
        result.classList.remove("hidden");
        result.previousElementSibling.classList.add("hidden"); // hide the form
        toast("Received — we'll follow up.");
      } else {
        status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || `Couldn't submit (HTTP ${r.status}).`;
      }
    } catch (e) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again."; }
    finally { btn.disabled = false; }
  }

  const own = $("own-form");
  if (own) own.addEventListener("submit", (e) => {
    e.preventDefault();
    submit({
      type: "tokenization", role: "owner", referral_code: ref,
      name: val("own-name"), email: val("own-email"), phone: val("own-phone"),
      company: val("own-company"), goal: val("own-goal"), asset: val("own-desc"),
    }, $("own-submit"), $("own-status"), $("own-result"),
      "Thanks — our team will map the right tokenization tier for your vehicle or fleet and follow up.");
  });

  const inv = $("inv-form");
  if (inv) inv.addEventListener("submit", (e) => {
    e.preventDefault();
    submit({
      type: "tokenization", role: "investor", referral_code: ref,
      name: val("inv-name"), email: val("inv-email"),
      interest: val("inv-interest"), accredited: val("inv-accred"), ticket_size: val("inv-ticket"),
    }, $("inv-submit"), $("inv-status"), $("inv-result"),
      "Thanks — your interest is logged. Any investment access is offered only through a licensed partner, subject to eligibility and KYC/AML. This is not an offer.");
  });
})();
