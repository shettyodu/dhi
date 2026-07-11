/* Karthik's supply-pricing editor. Loads cost/sell/margin/market per SKU, lets
   him edit cost + sell, suggests sell just under market, and saves changes to
   the supply-pricing store (action=set). Admin-gated. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = (n) => n == null ? "—" : "$" + Number(n).toFixed(2);
  let ITEMS = [];

  function key() { return $("secret").value.trim() || localStorage.getItem("dhi_admin_key") || ""; }

  async function load() {
    const secret = $("secret").value.trim(); if (secret) localStorage.setItem("dhi_admin_key", secret);
    $("status").className = "text-sm text-slate-500"; $("status").textContent = "Loading…";
    try {
      const r = await fetch(FN("supply-pricing"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify({ action: "list" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { $("status").className = "text-sm text-red-600"; $("status").textContent = d.error || `Failed (HTTP ${r.status}).`; return; }
      ITEMS = d.items; $("status").textContent = ""; render();
    } catch (e) { $("status").className = "text-sm text-red-600"; $("status").textContent = "Network error."; }
  }

  function margin(sell, cost) { return (sell > 0 && cost != null) ? Math.round(((sell - cost) / sell) * 1000) / 10 : null; }

  function render() {
    const term = ($("q").value || "").toLowerCase().trim();
    const rows = ITEMS.filter((i) => !term || (i.name + " " + i.cat).toLowerCase().includes(term)).map((i) => {
      const m = margin(i.sell, i.cost);
      return `<tr class="border-b border-slate-100" data-id="${esc(i.id)}">
        <td class="py-2 pr-3 text-sm text-slate-700">${esc(i.name)}<div class="text-xs text-slate-400">${esc(i.cat)} · base ${usd(i.base)}</div></td>
        <td class="px-2 py-2"><input class="in cell c-cost" type="number" step="0.01" value="${i.cost != null ? i.cost : ""}" placeholder="cost" /></td>
        <td class="px-2 py-2"><input class="in cell c-sell" type="number" step="0.01" value="${i.sell != null ? i.sell : ""}" placeholder="sell" /></td>
        <td class="px-2 py-2 text-right text-sm c-margin ${m != null && m < 15 ? "text-rose-600 font-semibold" : "text-slate-600"}">${m == null ? "—" : m + "%"}</td>
        <td class="px-2 py-2 text-right text-sm text-slate-500">${usd(i.market_median)}</td>
      </tr>`;
    }).join("");
    $("table").innerHTML = `<table class="w-full border-collapse">
      <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
        <th class="py-2 pr-3 text-left font-semibold">Item</th>
        <th class="px-2 py-2 text-left font-semibold">Cost</th>
        <th class="px-2 py-2 text-left font-semibold">Sell</th>
        <th class="px-2 py-2 text-right font-semibold">Margin</th>
        <th class="px-2 py-2 text-right font-semibold">Mkt median</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
    // live margin recompute
    $("table").querySelectorAll("tr[data-id]").forEach((tr) => {
      const upd = () => { const c = parseFloat(tr.querySelector(".c-cost").value); const s = parseFloat(tr.querySelector(".c-sell").value); const m = margin(s, isNaN(c) ? null : c); const el = tr.querySelector(".c-margin"); el.textContent = m == null ? "—" : m + "%"; el.className = "px-2 py-2 text-right text-sm c-margin " + (m != null && m < 15 ? "text-rose-600 font-semibold" : "text-slate-600"); };
      tr.querySelector(".c-cost").addEventListener("input", upd); tr.querySelector(".c-sell").addEventListener("input", upd);
    });
  }

  function suggest() {
    $("table").querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id"); const it = ITEMS.find((x) => x.id === id);
      if (it && it.market_median != null) { const s = Math.round(it.market_median * 0.97 * 100) / 100; tr.querySelector(".c-sell").value = s; tr.querySelector(".c-sell").dispatchEvent(new Event("input")); }
    });
    $("status").className = "text-sm text-cyan-700"; $("status").textContent = "Filled sell prices 3% under market where data exists — review, then Save.";
  }

  async function save() {
    const changes = [];
    $("table").querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id"); const it = ITEMS.find((x) => x.id === id) || {};
      const cost = tr.querySelector(".c-cost").value.trim(); const sell = tr.querySelector(".c-sell").value.trim();
      const cN = cost === "" ? null : Number(cost), sN = sell === "" ? null : Number(sell);
      const wasC = it.cost != null ? it.cost : null, wasS = it.managed && it.sell != null ? it.sell : null;
      if (cN !== wasC || sN !== wasS) changes.push({ id, cost: cN, sell: sN });
    });
    if (!changes.length) { $("status").className = "text-sm text-slate-500"; $("status").textContent = "No changes to save."; return; }
    $("status").className = "text-sm text-slate-500"; $("status").textContent = `Saving ${changes.length}…`;
    let ok = 0;
    for (const ch of changes) {
      try { const r = await fetch(FN("supply-pricing"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify({ action: "set", ...ch }) }); if (r.ok) ok++; } catch (e) { /* skip */ }
    }
    $("status").className = "text-sm text-emerald-700"; $("status").textContent = `Saved ${ok} of ${changes.length}.`;
    load();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const s = localStorage.getItem("dhi_admin_key"); if (s) $("secret").value = s;
    $("load").addEventListener("click", load);
    $("q").addEventListener("input", render);
    $("suggest").addEventListener("click", suggest);
    $("save").addEventListener("click", save);
    $("secret").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  });
})();
