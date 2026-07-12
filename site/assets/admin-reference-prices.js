/* Reference-price loader — DHI loads real public/GSA prices per SKU. They appear
   as a labeled external reference in the benchmark + Product Finder. Peer median
   (opt-in index) shown read-only. Bulk import + one-call save. Admin-gated. */
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
      const r = await fetch(FN("reference-prices"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify({ action: "list" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { status(d.error || `Failed (HTTP ${r.status}).`, "rose"); return; }
      ITEMS = d.items; if (d.min_peers) $("minpeers").textContent = d.min_peers; status("", "slate"); render();
    } catch (e) { status("Network error.", "rose"); }
  }

  function render() {
    const term = ($("q").value || "").toLowerCase().trim();
    const rows = ITEMS.filter((i) => !term || (i.name + " " + i.cat).toLowerCase().includes(term)).map((i) => `
      <tr class="border-b border-slate-100" data-id="${esc(i.id)}">
        <td class="py-2 pr-3 text-sm text-slate-700">${esc(i.name)}<div class="text-xs text-slate-400">${esc(i.cat)} · <span class="font-mono">${esc(i.id)}</span> · DHI ${usd(i.dhi_price)}</div></td>
        <td class="px-2 py-2"><input class="in cell c-ref" type="number" step="0.01" value="${i.ref_price != null ? i.ref_price : ""}" placeholder="price" /></td>
        <td class="px-2 py-2"><input class="in c-src" value="${esc(i.ref_source || "")}" placeholder="e.g. GSA Advantage" /></td>
        <td class="px-2 py-2 text-right text-sm text-slate-500">${i.peer_median != null ? usd(i.peer_median) + ` <span class="text-xs text-slate-400">(${i.peer_n})</span>` : "—"}</td>
      </tr>`).join("");
    $("table").innerHTML = `<table class="w-full border-collapse">
      <thead><tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
        <th class="py-2 pr-3 text-left font-semibold">Item</th>
        <th class="px-2 py-2 text-left font-semibold">GSA / public price</th>
        <th class="px-2 py-2 text-left font-semibold">Source</th>
        <th class="px-2 py-2 text-right font-semibold">Peer median</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
  }

  const csvCell = (s) => { s = String(s == null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function downloadTemplate() {
    if (!ITEMS.length) { bulkMsg("Load items first, then download the template.", "rose"); return; }
    const lines = ITEMS.map((i) => [csvCell(i.id), csvCell(i.name), i.ref_price != null ? i.ref_price : "", csvCell(i.ref_source || "")].join(","));
    const blob = new Blob(["id,name,ref_price,source\n" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dhi-reference-prices-template.csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    bulkMsg(`Template with ${ITEMS.length} items downloaded — fill ref_price + source, then paste back.`, "cyan");
  }

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
  const has = (h, l) => l.some((k) => h.indexOf(k) >= 0);

  function applyBulk() {
    if (!ITEMS.length) { bulkMsg("Load items first.", "rose"); return; }
    const raw = ($("bulk").value || "").trim();
    if (!raw) { bulkMsg("Paste some rows first.", "slate"); return; }
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    let col = { id: 0, price: 2, src: 3 }, start = 0;
    const head = splitRow(lines[0]).map((s) => s.trim().toLowerCase());
    if (head.indexOf("id") >= 0 && head.some((h) => has(h, ["ref_price", "price", "ref price"]))) {
      const find = (keys) => { for (let i = 0; i < head.length; i++) if (has(head[i], keys)) return i; return -1; };
      col = { id: head.indexOf("id"), price: find(["ref_price", "ref price", "price"]), src: find(["source", "src", "basis"]) }; start = 1;
    } else { const n = splitRow(lines[0]).length; col = n >= 4 ? { id: 0, price: 2, src: 3 } : { id: 0, price: 1, src: 2 }; }

    if ($("q").value.trim()) { $("q").value = ""; render(); }
    const known = new Set(ITEMS.map((i) => i.id));
    let applied = 0; const bad = [];
    for (let li = start; li < lines.length; li++) {
      const f = splitRow(lines[li]); const id = (f[col.id] || "").trim();
      if (!id) continue;
      if (!known.has(id)) { bad.push(id); continue; }
      const tr = $("table").querySelector(`tr[data-id="${cssEsc(id)}"]`); if (!tr) { bad.push(id); continue; }
      const price = col.price >= 0 ? (f[col.price] || "").trim().replace(/[$,]/g, "") : "";
      const src = col.src >= 0 ? (f[col.src] || "").trim() : "";
      let touched = false;
      if (price !== "" && !isNaN(Number(price))) { tr.querySelector(".c-ref").value = price; touched = true; }
      if (src !== "") { tr.querySelector(".c-src").value = src; touched = true; }
      if (touched) { tr.style.background = "#fffbeb"; applied++; }
    }
    bulkMsg(`Applied ${applied} row${applied === 1 ? "" : "s"}${bad.length ? `, ${bad.length} unknown id(s) skipped` : ""}. Review, then Save changes.`, applied ? "cyan" : "rose");
  }

  async function save() {
    const changes = [];
    $("table").querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id"); const it = ITEMS.find((x) => x.id === id) || {};
      const price = tr.querySelector(".c-ref").value.trim(); const src = tr.querySelector(".c-src").value.trim();
      const pN = price === "" ? null : Number(price);
      const wasP = it.ref_price != null ? it.ref_price : null, wasS = it.ref_source || "";
      if (pN !== wasP || src !== wasS) changes.push({ id, price: pN, source: src || "GSA / public" });
    });
    if (!changes.length) { status("No changes to save.", "slate"); return; }
    status(`Saving ${changes.length}…`, "slate");
    try {
      const r = await fetch(FN("reference-prices"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify({ action: "bulk", rows: changes }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { status(`Saved ${d.saved} of ${changes.length}${d.skipped && d.skipped.length ? ` (${d.skipped.length} skipped)` : ""}.`, "emerald"); $("bulk").value = ""; bulkMsg("", "slate"); load(); }
      else { status(d.error || `Failed (HTTP ${r.status}).`, "rose"); }
    } catch (e) { status("Network error.", "rose"); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const s = localStorage.getItem("dhi_admin_key"); if (s) $("secret").value = s;
    $("load").addEventListener("click", load);
    $("q").addEventListener("input", render);
    $("save").addEventListener("click", save);
    $("tmpl").addEventListener("click", downloadTemplate);
    $("apply-bulk").addEventListener("click", applyBulk);
    $("secret").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  });
})();
