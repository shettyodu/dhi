/* LED Savings & ROI calculator (client-side, no backend).
   Compares an existing lighting load to an LED retrofit and shows annual energy,
   cost, CO2, payback, and 10-year savings. Mounts into #roi-form + #roi-results. */
(function () {
  const form = document.getElementById("roi-form");
  const out = document.getElementById("roi-results");
  if (!form || !out) return;

  // U.S. avg grid emissions ~0.85 lb CO2 / kWh (EPA eGRID, national avg).
  const CO2_LB_PER_KWH = 0.85;

  // sensible defaults (12h/day commercial, $0.13/kWh, typical fluorescent→LED)
  const state = { qty: 50, existW: 64, newW: 25, hours: 12, days: 365, rate: 0.13, cost: "", unit: "" };

  const F = (id) => document.getElementById(id);
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };
  const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const usd2 = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kfmt = (n) => Math.round(n).toLocaleString("en-US");

  function field(id, label, val, suffix, ph) {
    return `<label class="block">
      <span class="text-sm font-medium text-slate-700">${label}</span>
      <div class="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/30">
        <input id="${id}" inputmode="decimal" value="${val}" placeholder="${ph || ""}" class="w-full rounded-lg bg-transparent px-3 py-2 text-sm focus:outline-none" />
        ${suffix ? `<span class="px-3 text-xs text-slate-400">${suffix}</span>` : ""}
      </div></label>`;
  }

  function renderForm() {
    form.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="font-display text-lg font-bold text-brand-900">Your project</h2>
        <p class="mt-1 text-sm text-slate-500">Enter your current setup — we'll compute the LED savings. Don't know the LED wattage? Browse the <a href="lighting-catalog.html" class="font-medium text-cyan-700 hover:underline">catalog</a>.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          ${field("r-qty", "Number of fixtures", state.qty, "fixtures")}
          ${field("r-rate", "Electricity rate", state.rate, "$/kWh")}
          ${field("r-existW", "Existing watts / fixture", state.existW, "W")}
          ${field("r-newW", "New LED watts / fixture", state.newW, "W")}
          ${field("r-hours", "Hours run / day", state.hours, "hrs")}
          ${field("r-days", "Days run / year", state.days, "days")}
        </div>
        <h3 class="mt-5 text-sm font-semibold text-brand-900">Optional — for payback</h3>
        <div class="mt-2 grid gap-4 sm:grid-cols-2">
          ${field("r-unit", "LED unit price (each)", state.unit, "$", "e.g. 45")}
          ${field("r-cost", "Other project cost (install, etc.)", state.cost, "$", "e.g. 1500")}
        </div>
      </div>`;
    ["r-qty", "r-rate", "r-existW", "r-newW", "r-hours", "r-days", "r-unit", "r-cost"].forEach((id) => {
      const el = F(id); if (el) el.addEventListener("input", read);
    });
  }

  function read() {
    state.qty = num(F("r-qty").value); state.rate = num(F("r-rate").value);
    state.existW = num(F("r-existW").value); state.newW = num(F("r-newW").value);
    state.hours = num(F("r-hours").value); state.days = num(F("r-days").value);
    state.unit = F("r-unit").value.trim(); state.cost = F("r-cost").value.trim();
    renderResults();
  }

  function renderResults() {
    const hoursYr = state.hours * state.days;
    const curKwh = (state.qty * state.existW * hoursYr) / 1000;
    const newKwh = (state.qty * state.newW * hoursYr) / 1000;
    const savedKwh = Math.max(0, curKwh - newKwh);
    const curCost = curKwh * state.rate;
    const newCost = newKwh * state.rate;
    const savedYr = Math.max(0, curCost - newCost);
    const pct = curKwh > 0 ? Math.round((savedKwh / curKwh) * 100) : 0;
    const co2 = savedKwh * CO2_LB_PER_KWH; // lbs/yr
    const tenYr = savedYr * 10;

    const project = (num(state.unit) * state.qty) + num(state.cost);
    const hasCost = project > 0;
    const paybackYrs = hasCost && savedYr > 0 ? project / savedYr : null;
    const paybackTxt = paybackYrs == null ? "—" : (paybackYrs < 1 ? Math.round(paybackYrs * 12) + " months" : paybackYrs.toFixed(1) + " years");
    const roi10 = hasCost && project > 0 ? Math.round(((tenYr - project) / project) * 100) : null;

    const stat = (big, label, accent) => `<div class="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200"><div class="font-display text-xl font-extrabold ${accent || "text-brand-900"}">${big}</div><div class="text-xs text-slate-500">${label}</div></div>`;

    out.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm lg:sticky lg:top-32">
        <h2 class="font-display text-lg font-bold text-brand-900">Estimated savings</h2>
        <div class="mt-3 grid grid-cols-2 gap-2.5">
          ${stat(usd(savedYr) + "/yr", "energy saved / year", "text-emerald-600")}
          ${stat(pct + "%", "energy reduction", "text-cyan-700")}
          ${stat(usd(tenYr), "10-year savings", "text-emerald-600")}
          ${stat(paybackTxt, "payback period")}
        </div>
        <dl class="mt-4 space-y-1.5 text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">Current annual cost</dt><dd class="font-semibold text-slate-700">${usd(curCost)}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">LED annual cost</dt><dd class="font-semibold text-slate-700">${usd(newCost)}</dd></div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5"><dt class="text-slate-600">kWh saved / year</dt><dd class="font-semibold text-brand-900">${kfmt(savedKwh)} kWh</dd></div>
          <div class="flex justify-between"><dt class="text-slate-600">CO₂ avoided / year</dt><dd class="font-semibold text-brand-900">${kfmt(co2)} lbs</dd></div>
          ${hasCost ? `<div class="flex justify-between"><dt class="text-slate-600">Project cost</dt><dd class="font-semibold text-slate-700">${usd(project)}</dd></div>` : ""}
          ${roi10 != null ? `<div class="flex justify-between"><dt class="text-slate-600">10-year ROI</dt><dd class="font-semibold text-emerald-600">${roi10.toLocaleString("en-US")}%</dd></div>` : ""}
        </dl>
        <a href="contact.html?interest=Lighting%20%26%20Energy%20Efficiency" class="mt-4 block rounded-lg bg-cyan-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-cyan-700">Get a quote for this project &rarr;</a>
        <a href="lighting-catalog.html" class="mt-2 block text-center text-xs font-medium text-slate-500 hover:text-cyan-700">or browse LED products &rarr;</a>
      </div>`;
  }

  renderForm();
  renderResults();
})();
