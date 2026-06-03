/* DHI Vehicle Passport tool — issues & verifies blockchain-anchored vehicle
   provenance records via the serverless functions. Front end is presentation
   only; the authoritative hashing + minting happens server-side.
   Endpoints follow the same pattern as checkout.js (absolute Netlify URL,
   overridable via localStorage 'dhi_api_base' or ?api= for local netlify dev). */
(function () {
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    localStorage.getItem("dhi_api_base") ||
    "https://courageous-fairy-0b2d3c.netlify.app";
  const CREATE = API_BASE + "/.netlify/functions/create-vehicle-passport";
  const VERIFY = API_BASE + "/.netlify/functions/verify-vehicle-passport";
  const STORE = "dhi_vehicle_passports";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const short = (h) => (h && h.length > 14 ? h.slice(0, 10) + "…" + h.slice(-6) : h || "");

  let toastT;
  function toast(msg) {
    const t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.remove("opacity-0");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2600);
  }

  function saved() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; } }
  function remember(p) {
    const list = saved().filter((x) => x.vin !== p.vin);
    list.unshift({ vin: p.vin, tokenId: p.tokenId, txHash: p.txHash, explorerToken: p.explorerToken, at: p.record && p.record.issuedAt });
    localStorage.setItem(STORE, JSON.stringify(list.slice(0, 25)));
    renderList();
  }

  function renderList() {
    const el = $("pp-list"); if (!el) return;
    const list = saved();
    if (!list.length) { el.innerHTML = '<p class="text-slate-500">None yet on this device.</p>'; return; }
    el.innerHTML = list.map((p) => `
      <div class="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
        <div class="min-w-0"><p class="truncate font-mono text-xs text-slate-700">${esc(p.vin)}</p>
          <p class="text-[11px] text-slate-400">Token #${esc(p.tokenId || "—")}</p></div>
        ${p.explorerToken ? `<a href="${esc(p.explorerToken)}" target="_blank" rel="noopener" class="flex-none text-xs font-semibold text-cyan-700 hover:underline">View ↗</a>` : ""}
      </div>`).join("");
  }

  function resultCard(d) {
    return `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div class="flex items-center gap-2 text-emerald-700"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg><span class="font-semibold">Passport minted &amp; anchored on-chain</span></div>
      <dl class="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div><dt class="text-slate-500">VIN</dt><dd class="font-mono text-brand-900">${esc(d.vin)}</dd></div>
        <div><dt class="text-slate-500">Token ID</dt><dd class="font-semibold text-brand-900">#${esc(d.tokenId)}</dd></div>
        <div class="sm:col-span-2"><dt class="text-slate-500">Record fingerprint (SHA-256)</dt><dd class="font-mono text-xs text-brand-900 break-all">${esc(d.hash)}</dd></div>
      </dl>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="${esc(d.explorerTx)}" target="_blank" rel="noopener" class="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">View transaction ↗</a>
        <a href="${esc(d.explorerToken)}" target="_blank" rel="noopener" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-white">View token ↗</a>
      </div>
    </div>`;
  }

  async function postJSON(url, payload) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data };
  }

  // ---- Create ----
  const form = $("pp-form");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      vin: $("pp-vin").value.trim().toUpperCase(),
      year: $("pp-year").value.trim(),
      make: $("pp-make").value.trim(),
      model: $("pp-model").value.trim(),
      mileage: $("pp-mileage").value.trim(),
      owner: $("pp-owner").value.trim(),
      history: $("pp-history").value.trim(),
      notes: $("pp-notes").value.trim(),
    };
    const status = $("pp-status"), btn = $("pp-submit"), result = $("pp-result");
    if (!payload.vin || !payload.year || !payload.make || !payload.model || !payload.owner) {
      status.className = "ml-3 text-sm text-red-600"; status.textContent = "VIN, year, make, model, and owner are required.";
      return;
    }
    btn.disabled = true; result.classList.add("hidden");
    status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Minting on-chain… this can take a few seconds.";
    try {
      const { ok, status: code, data } = await postJSON(CREATE, payload);
      if (ok && data.tokenId) {
        status.textContent = ""; result.innerHTML = resultCard(data); result.classList.remove("hidden");
        remember(data); toast("Passport minted ✓");
      } else {
        status.className = "ml-3 text-sm text-red-600";
        status.textContent = data.error || `Could not mint (HTTP ${code}).`;
      }
    } catch (err) {
      status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — is the service reachable?";
    } finally { btn.disabled = false; }
  });

  // ---- Verify ----
  const vfBtn = $("vf-btn");
  async function doVerify() {
    const vin = $("vf-vin").value.trim().toUpperCase();
    const out = $("vf-result");
    if (!vin) { out.innerHTML = '<span class="text-red-600">Enter a VIN.</span>'; return; }
    out.innerHTML = '<span class="text-slate-500">Checking on-chain…</span>';
    try {
      const r = await fetch(VERIFY + "?vin=" + encodeURIComponent(vin));
      const d = await r.json();
      if (r.status === 404) { out.innerHTML = `<span class="text-slate-600">No passport found for ${esc(vin)}.</span>`; return; }
      if (d.verified) {
        out.innerHTML = `<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p class="font-semibold text-emerald-700">✓ Verified — record matches the on-chain anchor</p>
          <p class="mt-1 text-xs text-slate-600">Token #${esc(d.tokenId)} · hash ${esc(short(d.onChainHash))}</p>
          ${d.explorerToken ? `<a href="${esc(d.explorerToken)}" target="_blank" rel="noopener" class="mt-1 inline-block text-xs font-semibold text-cyan-700 hover:underline">View token ↗</a>` : ""}
        </div>`;
      } else {
        out.innerHTML = `<div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p class="font-semibold text-amber-700">⚠ Not verified</p>
          <p class="mt-1 text-xs text-slate-600">The stored record does not match an on-chain anchor${d.tokenId ? " (token #" + esc(d.tokenId) + ")" : ""}.</p></div>`;
      }
    } catch (e) { out.innerHTML = '<span class="text-red-600">Network error.</span>'; }
  }
  if (vfBtn) vfBtn.addEventListener("click", doVerify);

  // Deep link: ?vin=... prefills verify and runs it
  const qvin = new URLSearchParams(location.search).get("vin");
  if (qvin && $("vf-vin")) { $("vf-vin").value = qvin.toUpperCase(); doVerify(); }

  renderList();
})();
