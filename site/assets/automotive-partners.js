/* Dealer + Supplier sign-up → submit-lead (type=dealer | type=supplier).
   Capture-only; no transaction. */
(function () {
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    localStorage.getItem("dhi_api_base") ||
    "https://courageous-fairy-0b2d3c.netlify.app";
  const ENDPOINT = API_BASE + "/.netlify/functions/submit-lead";

  const $ = (id) => document.getElementById(id);
  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2400); }

  function ok(resultEl, label) {
    resultEl.innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p class="flex items-center gap-2 font-semibold text-emerald-700"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>${label} received</p>
      <p class="mt-1 text-sm text-slate-600">Thanks — our partnerships team will review and reach out. Final terms are set in a partner agreement.</p></div>`;
    resultEl.classList.remove("hidden");
  }

  function wire(opts) {
    const form = $(opts.form);
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = opts.collect();
      const status = $(opts.status), btn = $(opts.submit), result = $(opts.result);
      if (!payload.name || !payload.email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
      btn.disabled = true; result.classList.add("hidden");
      status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Submitting…";
      try {
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        let d = {}; try { d = await r.json(); } catch (e2) {}
        if (r.ok && d.ok) { status.textContent = ""; ok(result, opts.label); form.classList.add("hidden"); toast(opts.label + " received"); }
        else { status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || `Couldn't submit (HTTP ${r.status}).`; }
      } catch (err) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again."; }
      finally { btn.disabled = false; }
    });
  }

  wire({
    form: "dl-form", submit: "dl-submit", status: "dl-status", result: "dl-result", label: "Dealer application",
    collect: () => ({
      type: "dealer", company: $("dl-co").value.trim(), name: $("dl-name").value.trim(), email: $("dl-email").value.trim(),
      phone: $("dl-phone").value.trim(), location: $("dl-location").value.trim(), inventory: $("dl-inv").value.trim(), tier: $("dl-tier").value,
    }),
  });

  wire({
    form: "sp-form", submit: "sp-submit", status: "sp-status", result: "sp-result", label: "Supplier application",
    collect: () => ({
      type: "supplier", company: $("sp-co").value.trim(), name: $("sp-name").value.trim(), email: $("sp-email").value.trim(),
      category: $("sp-cat").value, website: $("sp-web").value.trim(), offer: $("sp-offer").value.trim(),
    }),
  });
})();
