/* Savings-realization / gainshare admin. Records identified vs captured savings
   per client, shows ROI rollup + gainshare fee. Admin-gated. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = (n) => API_BASE + "/.netlify/functions/" + n;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd0 = (n) => n == null ? "—" : "$" + Math.round(Number(n)).toLocaleString("en-US");
  const TONE = { slate: "text-slate-500", cyan: "text-cyan-700", emerald: "text-emerald-700", rose: "text-red-600" };
  function key() { return $("secret").value.trim() || localStorage.getItem("dhi_admin_key") || ""; }
  function status(el, msg, tone) { el.className = (el.id === "add-status" ? "mt-2 text-xs " : "text-sm ") + (TONE[tone] || TONE.slate); el.textContent = msg; }
  const pct = () => { const p = Number($("pct").value); return p > 0 ? p / 100 : 0.25; };

  async function api(payload) {
    const r = await fetch(FN("savings-ledger"), { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": key() }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.ok, status: r.status, d };
  }

  async function load() {
    const secret = $("secret").value.trim(); if (secret) localStorage.setItem("dhi_admin_key", secret);
    status($("status"), "Loading…", "slate");
    const { ok, status: code, d } = await api({ action: "list", gainshare_pct: pct() });
    if (!ok) { status($("status"), d.error || `Failed (HTTP ${code}).`, "rose"); return; }
    status($("status"), "", "slate"); render(d);
  }

  function render(d) {
    const t = d.rollup.totals;
    $("totals").innerHTML = [
      ["Identified", usd0(t.identified), "slate"],
      ["Captured", usd0(t.captured), "emerald"],
      ["Capture rate", t.capture_rate == null ? "—" : t.capture_rate + "%", "slate"],
      [`Gainshare fee (${Math.round(pct() * 100)}%)`, usd0(t.gainshare_fee), "cyan"],
    ].map(([l, v, tone]) => `<div class="rounded-xl border ${tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "cyan" ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white"} p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${esc(l)}</p>
      <p class="mt-1 font-display text-xl font-extrabold ${tone === "emerald" ? "text-emerald-700" : tone === "cyan" ? "text-cyan-700" : "text-brand-900"}">${v}</p></div>`).join("");

    $("rollup").innerHTML = d.rollup.tenants.length ? `<table class="w-full border-collapse"><thead><tr>
      <th>Client</th><th class="text-right">Identified</th><th class="text-right">Captured</th><th class="text-right">Capture rate</th><th class="text-right">Gainshare fee</th></tr></thead><tbody>${
      d.rollup.tenants.map((r) => `<tr><td class="font-medium text-slate-700">${esc(r.tenant)}</td>
        <td class="text-right">${usd0(r.identified)}</td><td class="text-right">${usd0(r.captured)}</td>
        <td class="text-right">${r.capture_rate == null ? "—" : r.capture_rate + "%"}</td>
        <td class="text-right font-semibold text-cyan-700">${usd0(r.gainshare_fee)}</td></tr>`).join("")}</tbody></table>` : `<p class="text-sm text-slate-500">No entries yet.</p>`;

    $("entries").innerHTML = d.entries.length ? `<table class="w-full border-collapse"><thead><tr>
      <th>Date</th><th>Client</th><th class="text-right">Identified</th><th class="text-right">Captured</th><th>Note</th><th></th></tr></thead><tbody>${
      d.entries.map((e) => `<tr><td>${esc(e.date)}</td><td class="text-slate-700">${esc(e.tenant)}</td>
        <td class="text-right">${usd0(e.identified)}</td><td class="text-right text-emerald-700">${usd0(e.captured)}</td>
        <td class="text-slate-500">${esc(e.note || "")}</td>
        <td class="text-right"><button data-del="${esc(e.id)}" class="text-xs text-slate-400 hover:text-rose-600">delete</button></td></tr>`).join("")}</tbody></table>` : "";
    $("entries").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this entry?")) return;
      const { ok } = await api({ action: "delete", id: b.getAttribute("data-del") });
      if (ok) load();
    }));
  }

  async function addEntry() {
    const tenant = $("e-tenant").value.trim();
    const identified = $("e-identified").value.trim(), captured = $("e-captured").value.trim();
    if (!tenant) { status($("add-status"), "Enter a client name.", "rose"); return; }
    if (identified === "" && captured === "") { status($("add-status"), "Enter identified and/or captured $.", "rose"); return; }
    status($("add-status"), "Saving…", "slate");
    const { ok, d } = await api({ action: "add", tenant, date: $("e-date").value || undefined, identified, captured, note: $("e-note").value.trim() });
    if (!ok) { status($("add-status"), d.error || "Failed.", "rose"); return; }
    status($("add-status"), "Saved.", "emerald");
    ["e-identified", "e-captured", "e-note"].forEach((id) => { $(id).value = ""; });
    load();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const s = localStorage.getItem("dhi_admin_key"); if (s) $("secret").value = s;
    $("load").addEventListener("click", load);
    $("add").addEventListener("click", addEntry);
    $("pct").addEventListener("change", load);
    $("secret").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  });
})();
