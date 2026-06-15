/* Cross-vertical "My Project" — combines the lighting + supplies carts into one
   view with a single combined-quote / PO request. Reuses the existing per-vertical
   localStorage carts (no checkout refactor); submits via /submit-lead. */
(function () {
  const root = document.getElementById("project-root");
  if (!root) return;
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/submit-lead";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const SECTIONS = [
    { key: "dhi_keystone_quote", vertical: "Lighting", page: "lighting-catalog.html", checkout: "checkout.html", data: () => (typeof KEYSTONE_PRODUCTS !== "undefined" ? KEYSTONE_PRODUCTS : []), name: (p) => p.group || p.cat || p.id, hasV: false },
    { key: "dhi_supplies_quote", vertical: "Supplies", page: "supplies-catalog.html", checkout: "supplies-po.html", data: () => (typeof SUPPLIES_PRODUCTS !== "undefined" ? SUPPLIES_PRODUCTS : []), name: (p) => p.t || p.name || p.id, hasV: true },
  ];

  function readCart(key) { try { const a = JSON.parse(localStorage.getItem(key)) || []; return a.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1, v: x.v })); } catch (e) { return []; } }
  function writeCart(key, lines) { try { localStorage.setItem(key, JSON.stringify(lines)); } catch (e) {} }

  function build() {
    const groups = SECTIONS.map((s) => {
      const byId = Object.fromEntries(s.data().map((p) => [p.id, p]));
      const lines = readCart(s.key).map((l) => ({ ...l, p: byId[l.id] })).filter((l) => l.p);
      const subtotal = lines.reduce((t, l) => t + (l.p.p != null ? l.p.p * l.qty : 0), 0);
      const priced = lines.filter((l) => l.p.p != null).length;
      return { s, lines, subtotal, priced };
    });
    const total = groups.reduce((t, g) => t + g.subtotal, 0);
    const anyItems = groups.some((g) => g.lines.length);
    return { groups, total, anyItems };
  }

  function render() {
    const { groups, total, anyItems } = build();
    if (!anyItems) {
      root.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p class="font-semibold text-brand-900">Your project is empty.</p>
        <p class="mt-2 text-sm text-slate-600">Add items from the <a href="lighting-catalog.html" class="font-medium text-cyan-700 hover:underline">lighting</a> or <a href="supplies-catalog.html" class="font-medium text-cyan-700 hover:underline">supplies</a> catalog and they'll combine here.</p></div>`;
      return;
    }
    const groupHtml = groups.filter((g) => g.lines.length).map((g) => `
      <div class="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-lg font-bold text-brand-900">${esc(g.s.vertical)} <span class="text-sm font-normal text-slate-400">(${g.lines.length})</span></h2>
          <div class="flex gap-2 text-sm"><a href="${g.s.page}" class="font-medium text-cyan-700 hover:underline">Add more</a>${g.priced ? ` · <a href="${g.s.checkout}" class="font-medium text-cyan-700 hover:underline">Check out</a>` : ""}</div>
        </div>
        <ul class="divide-y divide-slate-100">${g.lines.map((l) => `
          <li class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0"><p class="font-mono text-sm font-semibold text-brand-900">${esc(l.id)}</p>
              <p class="truncate text-xs text-slate-500">${esc(g.s.name(l.p))}${l.v ? " · " + esc(l.v) : ""}</p></div>
            <div class="flex flex-none items-center gap-3">
              <div class="inline-flex items-center rounded-md border border-slate-300">
                <button data-dec="${esc(g.s.key)}|${esc(l.id)}|${esc(l.v || "")}" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100">−</button>
                <span class="px-2 text-sm font-semibold text-brand-900">${l.qty}</span>
                <button data-inc="${esc(g.s.key)}|${esc(l.id)}|${esc(l.v || "")}" class="px-2 py-0.5 text-slate-600 hover:bg-slate-100">+</button>
              </div>
              <span class="w-20 text-right text-sm font-semibold ${l.p.p != null ? "text-brand-900" : "text-slate-400"}">${l.p.p != null ? money(l.p.p * l.qty) : "quote"}</span>
            </div>
          </li>`).join("")}</ul>
      </div>`).join("");

    root.innerHTML = `
      <div class="lg:flex lg:items-start lg:gap-6">
        <div class="lg:flex-1">${groupHtml}</div>
        <aside class="lg:w-80 lg:flex-none">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-24">
            <h2 class="font-display text-lg font-bold text-brand-900">Combined quote</h2>
            <div class="mt-3 space-y-1.5 text-sm">
              ${groups.filter((g) => g.lines.length).map((g) => `<div class="flex justify-between"><span class="text-slate-500">${esc(g.s.vertical)}</span><span class="font-semibold text-brand-900">${money(g.subtotal)}</span></div>`).join("")}
              <div class="flex justify-between border-t border-slate-200 pt-1.5"><span class="font-semibold text-slate-700">Total (priced)</span><span class="font-display text-lg font-bold text-brand-900">${money(total)}</span></div>
            </div>
            <p class="mt-1 text-xs text-slate-400">Excludes tax &amp; freight; quote-only items confirmed separately.</p>
            <form id="proj-form" class="mt-4 space-y-2">
              <input id="pj-name" placeholder="Your name" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" />
              <input id="pj-email" type="email" placeholder="Email" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" />
              <input id="pj-phone" placeholder="Phone (optional)" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none" />
              <button class="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">Request combined quote / PO &rarr;</button>
              <span id="pj-status" class="block text-center text-xs"></span>
            </form>
          </div>
        </aside>
      </div>`;

    root.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => bump(b.dataset.inc, 1)));
    root.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => bump(b.dataset.dec, -1)));
    const form = document.getElementById("proj-form");
    if (form) form.addEventListener("submit", submitProject);
  }

  function bump(token, delta) {
    const [key, id, v] = token.split("|");
    const lines = readCart(key);
    const l = lines.find((x) => x.id === id && (x.v || "") === (v || ""));
    if (!l) return;
    l.qty = (l.qty || 1) + delta;
    const next = l.qty <= 0 ? lines.filter((x) => x !== l) : lines;
    writeCart(key, next);
    render();
  }

  async function submitProject(e) {
    e.preventDefault();
    const status = document.getElementById("pj-status");
    const name = document.getElementById("pj-name").value.trim();
    const email = document.getElementById("pj-email").value.trim();
    if (!name || !email) { status.className = "block text-center text-xs text-red-600"; status.textContent = "Name and email are required."; return; }
    const { groups, total } = build();
    const summary = groups.filter((g) => g.lines.length).map((g) => g.s.vertical + ": " + g.lines.map((l) => `${l.qty}× ${l.id}${l.v ? " (" + l.v + ")" : ""}`).join(", ")).join(" | ");
    status.className = "block text-center text-xs text-slate-500"; status.textContent = "Sending…";
    let d = {};
    try {
      const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type: "customer", name, email, phone: document.getElementById("pj-phone").value.trim(),
        vertical: "Multi-vertical project", source: "DHI · Combined project quote",
        project_items: summary.slice(0, 1500), estimated_total: money(total),
      }) });
      d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "failed");
    } catch (err) { status.className = "block text-center text-xs text-red-600"; status.textContent = "Couldn't send — please try again."; return; }
    root.innerHTML = `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"><p class="font-semibold text-emerald-700">Combined quote request received.</p><p class="mt-2 text-sm text-slate-600">A DHI advisor will follow up with pricing across your project. Reference: <span class="font-mono text-xs">${esc(d.id || "")}</span></p></div>`;
  }

  render();
})();
