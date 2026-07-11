/* Karthik's supply-pricing editor. Loads cost/sell/margin/market per SKU, lets
   him edit cost + sell, suggests sell just under market, bulk-imports prices
   pasted from a spreadsheet, and saves in one call. Admin-gated. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = (n) => n == null ? "—" : "$" + Number(n).toFixed(2);
  const cssEsc = (s) => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&");
  const TONE = { slate: "text-slate-500", cyan: "text-cyan-700", emerald: "text-emerald-700", rose: "text-red-600" };
  let ITEMS = [];

  function key() { return $("secret").value.trim() || localStorage.getItem("dhi_admin_key") || ""; }
  function status(msg, tone) { const el = $("status"); el.className = "text-sm " + (TONE[tone] || TONE.slate); el.textContent = msg; }
  function bulkMsg(msg, tone) { const el = $("bulk-status"); el.className = "text-xs " + (TONE[tone] || TONE.slate); el.textContent = msg; }

  async function load() {
    const secret = $("secret").value.trim(); if (secret) localStorage.setItem("dhi_admin_key", secret);
    status("Loading…", "slate");
    try {
      const r = await fetch(FN("supply-pricing"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify({ action: "list" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { status(d.error || `Failed (HTTP ${r.status}).`, "rose"); return; }
      ITEMS = d.items; status("", "slate"); render();
    } catch (e) { status("Network error.", "rose"); }
  }

  function margin(sell, cost) { return (sell > 0 && cost != null) ? Math.round(((sell - cost) / sell) * 1000) / 10 : null; }

  function render() {
    const term = ($("q").value || "").toLowerCase().trim();
    const rows = ITEMS.filter((i) => !term || (i.name + " " + i.cat).toLowerCase().includes(term)).map((i) => {
      const m = margin(i.sell, i.cost);
      return `<tr class="border-b border-slate-100" data-id="${esc(i.id)}">
        <td class="py-2 pr-3 text-sm text-slate-700">${esc(i.name)}<div class="text-xs text-slate-400">${esc(i.cat)} · <span class="font-mono">${esc(i.id)}</span> · base ${usd(i.base)}</div></td>
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
    status("Filled sell prices 3% under market where data exists — review, then Save.", "cyan");
  }

  // ---- Bulk import -----------------------------------------------------------
  const csvCell = (s) => { s = String(s == null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  function downloadTemplate() {
    if (!ITEMS.length) { bulkMsg("Load items first, then download the template.", "rose"); return; }
    const head = "id,name,cost,sell";
    const lines = ITEMS.map((i) => [csvCell(i.id), csvCell(i.name), i.cost != null ? i.cost : "", (i.sell != null && i.managed) ? i.sell : ""].join(","));
    const blob = new Blob([head + "\n" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dhi-supply-pricing-template.csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    bulkMsg(`Template with ${ITEMS.length} items downloaded — fill cost + sell, then paste back.`, "cyan");
  }

  // Quote-aware splitter: tab-delimited if a tab is present, else CSV.
  function splitRow(line) {
    if (line.indexOf("\t") >= 0) return line.split("\t");
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur); return out;
  }

  function applyBulk() {
    if (!ITEMS.length) { bulkMsg("Load items first.", "rose"); return; }
    const raw = ($("bulk").value || "").trim();
    if (!raw) { bulkMsg("Paste some rows first.", "slate"); return; }
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());

    // Column mapping — from a header row if present, else positional.
    let col = { id: 0, name: -1, cost: -1, sell: -1 }, start = 0;
    const head = splitRow(lines[0]).map((s) => s.trim().toLowerCase());
    if (head.indexOf("id") >= 0 && (head.indexOf("cost") >= 0 || head.indexOf("sell") >= 0)) {
      col = { id: head.indexOf("id"), name: head.indexOf("name"), cost: head.indexOf("cost"), sell: head.indexOf("sell") }; start = 1;
    } else {
      const n = splitRow(lines[0]).length;
      col = n >= 4 ? { id: 0, name: 1, cost: 2, sell: 3 } : { id: 0, name: -1, cost: 1, sell: 2 };
    }

    // Make sure every row is on screen so its inputs exist.
    if ($("q").value.trim()) { $("q").value = ""; render(); }
    const known = new Set(ITEMS.map((i) => i.id));
    let applied = 0; const bad = [];
    for (let li = start; li < lines.length; li++) {
      const f = splitRow(lines[li]); const id = (f[col.id] || "").trim();
      if (!id) continue;
      if (!known.has(id)) { bad.push(id); continue; }
      const tr = $("table").querySelector(`tr[data-id="${cssEsc(id)}"]`); if (!tr) { bad.push(id); continue; }
      const cost = col.cost >= 0 ? (f[col.cost] || "").trim() : "";
      const sell = col.sell >= 0 ? (f[col.sell] || "").trim() : "";
      let touched = false;
      if (cost !== "" && !isNaN(Number(cost))) { tr.querySelector(".c-cost").value = cost; touched = true; }
      if (sell !== "" && !isNaN(Number(sell))) { tr.querySelector(".c-sell").value = sell; touched = true; }
      if (touched) { tr.querySelector(".c-cost").dispatchEvent(new Event("input")); tr.style.background = "#fffbeb"; applied++; }
    }
    bulkMsg(`Applied ${applied} row${applied === 1 ? "" : "s"}${bad.length ? `, ${bad.length} unknown id(s) skipped` : ""}. Review the highlighted rows, then Save changes.`, applied ? "cyan" : "rose");
  }

  // ---- Save (one call) -------------------------------------------------------
  async function save() {
    const changes = [];
    $("table").querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id"); const it = ITEMS.find((x) => x.id === id) || {};
      const cost = tr.querySelector(".c-cost").value.trim(); const sell = tr.querySelector(".c-sell").value.trim();
      const cN = cost === "" ? null : Number(cost), sN = sell === "" ? null : Number(sell);
      const wasC = it.cost != null ? it.cost : null, wasS = it.managed && it.sell != null ? it.sell : null;
      if (cN !== wasC || sN !== wasS) changes.push({ id, cost: cN, sell: sN });
    });
    if (!changes.length) { status("No changes to save.", "slate"); return; }
    status(`Saving ${changes.length}…`, "slate");
    try {
      const r = await fetch(FN("supply-pricing"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify({ action: "bulk", rows: changes }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        status(`Saved ${d.saved} of ${changes.length}${d.skipped && d.skipped.length ? ` (${d.skipped.length} skipped)` : ""}.`, "emerald");
        $("bulk").value = ""; bulkMsg("", "slate"); load();
      } else { status(d.error || `Failed (HTTP ${r.status}).`, "rose"); }
    } catch (e) { status("Network error.", "rose"); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const s = localStorage.getItem("dhi_admin_key"); if (s) $("secret").value = s;
    $("load").addEventListener("click", load);
    $("q").addEventListener("input", render);
    $("suggest").addEventListener("click", suggest);
    $("save").addEventListener("click", save);
    $("tmpl").addEventListener("click", downloadTemplate);
    $("apply-bulk").addEventListener("click", applyBulk);
    $("secret").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  });
})();
