/* SmartCare group-quote / enrollment request → submit-lead (Blobs + HubSpot).
   Public, lead-gen only — no health PII collected, no binding. Tagged to the
   Insurance vertical with product = SmartCare. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/submit-lead";
  const $ = (id) => document.getElementById(id);

  const form = $("sc-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("sc-name").value.trim(), email = $("sc-email").value.trim();
    const status = $("sc-status"), btn = $("sc-submit"), result = $("sc-result");
    if (!name || !email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Sending…";
    try {
      const r = await fetch(FN, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "inquiry", name, email, phone: $("sc-phone").value.trim(),
          company: $("sc-company").value.trim(), location: $("sc-state").value.trim(),
          employees: $("sc-employees").value.trim(), currentCoverage: $("sc-coverage").value,
          message: $("sc-notes").value.trim(),
          vertical: "Insurance & Risk Solutions", product: "SmartCare group medical",
          source: "DHI · SmartCare group quote",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        form.classList.add("hidden"); status.textContent = "";
        result.className = "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700";
        result.innerHTML = `<p class="font-semibold text-emerald-700">Thanks — a licensed advisor will follow up with your SmartCare options.</p><p class="mt-1">Reference: <span class="font-mono text-xs">${d.id}</span></p>`;
        result.classList.remove("hidden");
      } else { status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || ("Couldn't send (HTTP " + r.status + ")."); }
    } catch (err) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again."; }
    finally { btn.disabled = false; }
  });
})();
