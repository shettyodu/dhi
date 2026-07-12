/* DHI Supplies store — reads the public price list (supply-pricing action=public,
   driven by Karthik's back-office), renders a clean catalog with pricing, and
   submits an order request via submit-lead (routes to Karthik). No card charge. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let toastT; const toast = (m) => { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2400); };

  let ITEMS = [];
  const cart = {}; // id -> qty

  async function loadCatalog() {
    try {
      const r = await fetch(FN("supply-pricing"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public" }) });
      const d = await r.json().catch(() => ({}));
      ITEMS = (d && d.items) || [];
    } catch (e) { ITEMS = []; }
    renderCatalog();
  }

  function renderCatalog() {
    const term = ($("q").value || "").toLowerCase().trim();
    const shown = ITEMS.filter((it) => !term || (it.name + " " + it.cat + " " + (it.specs || "")).toLowerCase().includes(term));
    $("count").textContent = `${shown.length} product${shown.length === 1 ? "" : "s"}`;
    const groups = {};
    shown.forEach((it) => { (groups[it.cat] = groups[it.cat] || []).push(it); });
    $("catalog").innerHTML = Object.keys(groups).sort().map((cat) => `
      <div>
        <h2 class="font-display text-lg font-bold text-brand-900">${esc(cat)}</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          ${groups[cat].map((it) => `
            <div class="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="font-semibold text-brand-900">${esc(it.name)}</p>
              ${it.specs ? `<p class="mt-0.5 text-xs text-slate-400">${esc(it.specs)}</p>` : ""}
              <div class="mt-2 flex items-end justify-between">
                <span class="font-display text-lg font-extrabold text-brand-900">${usd(it.price)}<span class="text-xs font-normal text-slate-400"> /${esc(it.unit || "ea")}</span></span>
                <div class="flex items-center gap-2">
                  <input type="number" min="1" value="1" data-qty="${esc(it.id)}" class="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm" />
                  <button data-add="${esc(it.id)}" class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">Add</button>
                </div>
              </div>
            </div>`).join("")}
        </div>
      </div>`).join("") || `<p class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No products match "${esc(term)}".</p>`;
    $("catalog").querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      const id = b.getAttribute("data-add");
      const qEl = $("catalog").querySelector(`[data-qty="${CSS.escape(id)}"]`);
      const qty = Math.max(1, parseInt(qEl && qEl.value, 10) || 1);
      cart[id] = (cart[id] || 0) + qty; renderCart(); toast("Added to order");
    }));
  }

  function renderCart() {
    const ids = Object.keys(cart);
    if (!ids.length) { $("cart").innerHTML = "No items yet — add products from the list."; $("cart-total").classList.add("hidden"); $("order-form").classList.add("hidden"); return; }
    let total = 0;
    $("cart").innerHTML = ids.map((id) => {
      const it = ITEMS.find((x) => x.id === id) || {}; const line = (it.price || 0) * cart[id]; total += line;
      return `<div class="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm">
        <div><span class="font-medium text-slate-700">${esc(it.name || id)}</span><div class="text-xs text-slate-400">${cart[id]} × ${usd(it.price)}</div></div>
        <div class="flex items-center gap-2"><span class="font-semibold">${usd(line)}</span><button data-rm="${esc(id)}" class="text-xs text-slate-400 hover:text-rose-600">✕</button></div>
      </div>`;
    }).join("");
    $("cart-total").innerHTML = `<div class="flex justify-between font-semibold text-brand-900"><span>Subtotal (est.)</span><span>${usd(total)}</span></div><p class="mt-1 text-xs text-slate-400">Before freight &amp; tax — confirmed on your invoice.</p>`;
    $("cart-total").classList.remove("hidden"); $("order-form").classList.remove("hidden");
    $("cart").querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { delete cart[b.getAttribute("data-rm")]; renderCart(); }));
  }

  async function submitOrder(e) {
    e.preventDefault();
    const st = $("o-status");
    const name = $("o-name").value.trim(), email = $("o-email").value.trim(), org = $("o-org").value.trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { st.className = "text-sm text-red-600"; st.textContent = "Name and a valid email, please."; return; }
    const lines = Object.keys(cart).map((id) => { const it = ITEMS.find((x) => x.id === id) || {}; return `${cart[id]}× ${it.name || id} @ ${usd(it.price)}`; });
    if (!lines.length) { st.textContent = "Your order is empty."; return; }
    st.className = "text-sm text-slate-500"; st.textContent = "Sending…"; $("o-send").disabled = true;
    const payload = { type: "po", vertical: "supplies", source: "store", name, email, company: org, order: lines.join(" · "), items: Object.keys(cart).length, hp: ($("o-hp") || {}).value || "" };
    try {
      const r = await fetch(FN("submit-lead"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        $("order-form").innerHTML = `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700"><p class="font-semibold text-emerald-700">Order received.</p><p class="mt-1">We'll confirm availability, freight, and delivery shortly. Ref: <span class="font-mono text-xs">${esc(d.id)}</span></p></div>`;
        toast("Order request sent");
      } else { st.className = "text-sm text-red-600"; st.textContent = d.error || "Couldn't send — try again."; }
    } catch (e) { st.className = "text-sm text-red-600"; st.textContent = "Network error — try again."; }
    finally { $("o-send").disabled = false; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("q").addEventListener("input", renderCatalog);
    $("order-form").addEventListener("submit", submitOrder);
    loadCatalog();
  });
})();
