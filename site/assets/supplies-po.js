/* Supplies — purchase-order checkout. Reads the quote cart (dhi_supplies_quote),
   shows line items, and submits a PO via submit-lead (type "po"). No payment is
   taken; DHI confirms availability, pricing, taxes & freight before fulfilment. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/submit-lead";
  const STORE = "dhi_supplies_quote";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const PRODUCTS = (typeof SUPPLIES_PRODUCTS !== "undefined" ? SUPPLIES_PRODUCTS : []);
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  function loadCart() {
    try { return (JSON.parse(localStorage.getItem(STORE)) || []).map((x) => (typeof x === "string" ? { id: x, qty: 1, v: "" } : { id: x.id, qty: x.qty || 1, v: x.v || "" })); }
    catch (e) { return []; }
  }
  let cart = loadCart();
  const lines = () => cart.map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);

  function renderItems() {
    const el = $("po-items"); const items = lines();
    if (!items.length) {
      el.innerHTML = `<div class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Your quote list is empty. <a href="supplies-catalog.html" class="font-semibold text-cyan-700">Browse the catalog →</a></div>`;
      $("po-submit").disabled = true;
      return;
    }
    el.innerHTML = `<ul class="space-y-2">${items.map((l) => `
      <li class="rounded-lg border border-slate-200 bg-white p-3">
        <p class="text-sm font-semibold text-brand-900">${esc(l.p.t)}</p>
        ${l.v ? `<p class="text-xs font-medium text-cyan-700">${esc(l.v)}</p>` : ""}
        <p class="mt-0.5 flex items-center justify-between"><span class="font-mono text-xs text-slate-400">${esc(l.id)}</span><span class="text-sm font-semibold text-slate-700">Qty ${l.qty}</span></p>
      </li>`).join("")}</ul>
      <p class="mt-2 text-xs text-slate-500">${items.length} line item${items.length === 1 ? "" : "s"} · volume pricing confirmed on the order.</p>`;
  }

  function lineItemsText() {
    return lines().map((l) => `${l.p.t}${l.v ? " [" + l.v + "]" : ""} — ${l.id} ×${l.qty}`).join("; ").slice(0, 800);
  }

  const form = $("po-form");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("po-status"), btn = $("po-submit");
    const name = $("po-name").value.trim(), email = $("po-email").value.trim();
    if (!lines().length) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Your quote list is empty."; return; }
    if (!name || !email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Buyer name and email are required."; return; }
    btn.disabled = true; status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Submitting…";
    try {
      const r = await fetch(FN, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "po", name, email, phone: $("po-phone").value.trim(),
          company: $("po-company").value.trim(), po_number: $("po-number").value.trim(),
          ship_to: $("po-shipto").value.trim(), requested_delivery: $("po-delivery").value.trim(),
          notes: $("po-notes").value.trim(), line_items: lineItemsText(), item_count: String(lines().length),
          vertical: "Supplies, Textiles & Linens", source: "DHI · Supplies purchase order",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        localStorage.removeItem(STORE); cart = [];
        form.classList.add("hidden"); status.textContent = "";
        const res = $("po-result");
        res.className = "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700";
        res.innerHTML = `<p class="font-semibold text-emerald-700">Purchase order received.</p><p class="mt-1">Reference: <span class="font-mono text-xs">${esc(d.id)}</span>. A DHI representative will confirm availability, pricing, taxes &amp; freight and send an order acknowledgement.</p>
          <a href="supplies-catalog.html" class="mt-3 inline-block rounded-md bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Back to catalog</a>`;
        res.classList.remove("hidden");
        renderItems();
      } else { status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || ("Couldn't submit (HTTP " + r.status + ")."); }
    } catch (err) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again."; }
    finally { btn.disabled = false; }
  });

  renderItems();
})();
