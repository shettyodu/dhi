/* Supplies — custom-design / wholesale requests + DHI Procurement Membership.
   Both forms POST to submit-lead (Blobs + HubSpot). Lead-gen only — no binding
   order or contract. Design → type "design"; vendor membership → type "membership". */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/submit-lead";
  const $ = (id) => document.getElementById(id);

  async function send(payload) {
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok, status: r.status, d };
  }
  function ok(resultEl, formEl, msg, id) {
    formEl.classList.add("hidden");
    resultEl.className = "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700";
    resultEl.innerHTML = `<p class="font-semibold text-emerald-700">${msg}</p><p class="mt-1">Reference: <span class="font-mono text-xs">${id}</span></p>`;
    resultEl.classList.remove("hidden");
  }

  // ----- Custom design / wholesale request (type: design) -----
  const dForm = $("design-form");
  if (dForm) dForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("d-status"), btn = $("d-submit");
    const name = $("d-name").value.trim(), email = $("d-email").value.trim();
    if (!name || !email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Sending…";
    const { ok: good, d } = await send({
      type: "design", name, email, phone: $("d-phone").value.trim(),
      company: $("d-company").value.trim(), product_area: $("d-category").value,
      requirement: $("d-detail").value.trim(), volume: $("d-volume").value.trim(), timeline: $("d-timeline").value.trim(),
      vertical: "Supplies, Textiles & Linens", source: "DHI · Custom design / wholesale request",
    }).catch(() => ({ ok: false, d: {} }));
    btn.disabled = false;
    if (good) ok($("d-result"), dForm, "Thanks — we'll review your design/wholesale request and follow up.", d.id);
    else { status.className = "ml-3 text-sm text-red-600"; status.textContent = (d && d.error) || "Couldn't send — please try again."; }
  });

  // ----- Samples & domestic / Buy-American sourcing (type: sourcing) -----
  const sForm = $("sourcing-form");
  if (sForm) sForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("so-status"), btn = $("so-submit");
    const name = $("so-name").value.trim(), email = $("so-email").value.trim();
    if (!name || !email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Sending…";
    const { ok: good, d } = await send({
      type: "sourcing", name, email, phone: $("so-phone").value.trim(),
      company: $("so-company").value.trim(), products: $("so-products").value.trim(),
      sourcing_preference: $("so-pref").value, request_type: $("so-type").value,
      volume: $("so-volume").value.trim(), notes: $("so-notes").value.trim(),
      vertical: "Supplies, Textiles & Linens", source: "DHI · Samples / domestic sourcing request",
    }).catch(() => ({ ok: false, d: {} }));
    btn.disabled = false;
    if (good) ok($("so-result"), sForm, "Request received — DHI will follow up with samples and/or compliant sourcing options.", d.id);
    else { status.className = "ml-3 text-sm text-red-600"; status.textContent = (d && d.error) || "Couldn't send — please try again."; }
  });

  // ----- DHI Procurement Membership (type: membership) -----
  const vForm = $("vendor-form");
  if (vForm) vForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("v-status"), btn = $("v-submit");
    const name = $("v-name").value.trim(), email = $("v-email").value.trim();
    if (!name || !email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
    btn.disabled = true; status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Submitting…";
    const { ok: good, d } = await send({
      type: "membership", name, email, phone: $("v-phone").value.trim(),
      company: $("v-company").value.trim(), region: $("v-region").value.trim(),
      manufactures: $("v-products").value.trim(), certifications: $("v-certs").value.trim(),
      website: $("v-web").value.trim(), capacity_notes: $("v-notes").value.trim(),
      vertical: "Supplies, Textiles & Linens", source: "DHI · Procurement Membership application",
    }).catch(() => ({ ok: false, d: {} }));
    btn.disabled = false;
    if (good) ok($("v-result"), vForm, "Application received — DHI will review your membership and be in touch.", d.id);
    else { status.className = "ml-3 text-sm text-red-600"; status.textContent = (d && d.error) || "Couldn't submit — please try again."; }
  });
})();
