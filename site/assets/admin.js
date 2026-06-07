/* DHI admin — view/prune captured leads + influencer signups.
   Gated by a shared passphrase (sent as x-dhi-admin header; the function
   validates against ADMIN_SECRET). Passphrase kept in sessionStorage only. */
(function () {
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    localStorage.getItem("dhi_api_base") ||
    "";
  const ENDPOINT = API_BASE + "/.netlify/functions/admin-leads";
  const SKEY = "dhi_admin_secret";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let DATA = { leads: [], signups: [] };

  function secret() { try { return sessionStorage.getItem(SKEY) || ""; } catch (e) { return ""; } }
  function setSecret(v) { try { v ? sessionStorage.setItem(SKEY, v) : sessionStorage.removeItem(SKEY); } catch (e) {} }

  async function api(payload) {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret() }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { status: r.status, ok: r.ok, data: d };
  }

  function showGate(msg) {
    $("panel").classList.add("hidden"); $("gate").classList.remove("hidden"); $("logout").classList.add("hidden");
    if (msg) $("gate-msg").textContent = msg;
  }
  function showPanel() { $("gate").classList.add("hidden"); $("panel").classList.remove("hidden"); $("logout").classList.remove("hidden"); }

  function fmtDate(s) { return s ? String(s).replace("T", " ").slice(0, 16) : ""; }

  function leadRows(list) {
    if (!list.length) return '<p class="text-sm text-slate-400">None.</p>';
    return `<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table class="w-full"><thead><tr>
      <th>Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Ref</th><th>Details</th><th></th></tr></thead><tbody>` +
      list.map((r) => {
        const det = Object.entries(r.details || {}).filter(([k, v]) => v).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ");
        return `<tr>
          <td class="whitespace-nowrap text-slate-500">${esc(fmtDate(r.submittedAt))}</td>
          <td class="font-medium text-brand-900">${esc(r.name)}</td>
          <td>${esc(r.email)}</td><td>${esc(r.phone)}</td><td class="font-mono text-[11px]">${esc(r.referral_code)}</td>
          <td class="max-w-md text-slate-600">${det}</td>
          <td><button class="del rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50" data-store="${esc(r._store)}" data-key="${esc(r._key)}">Delete</button></td>
        </tr>`;
      }).join("") + "</tbody></table></div>";
  }

  function signupRows(list) {
    if (!list.length) return '<p class="text-sm text-slate-400">None.</p>';
    return `<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table class="w-full"><thead><tr>
      <th>Date</th><th>Code</th><th>Name</th><th>Email</th><th>Channel</th><th>Program</th><th>Status</th><th></th></tr></thead><tbody>` +
      list.map((r) => `<tr>
        <td class="whitespace-nowrap text-slate-500">${esc(fmtDate(r.signedUpAt))}</td>
        <td class="font-mono text-[11px] font-bold text-brand-900">${esc(r.code)}</td>
        <td class="font-medium">${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.channel)}</td>
        <td><span class="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-cyan-700">${esc(r.program)}</span></td>
        <td>${esc(r.status)}</td>
        <td><button class="del rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50" data-store="${esc(r._store)}" data-key="${esc(r._key)}">Delete</button></td>
      </tr>`).join("") + "</tbody></table></div>";
  }

  function render() {
    const L = DATA.leads, S = DATA.signups;
    const group = (t) => L.filter((r) => r.type === t);
    $("counts").textContent = `${L.length} leads · ${S.length} signups`;
    $("content").innerHTML = `
      <section><h2 class="mb-2 font-bold text-brand-900">Customer leads <span class="text-slate-400">(${group("customer").length})</span></h2>${leadRows(group("customer"))}</section>
      <section><h2 class="mb-2 font-bold text-brand-900">Dealer leads <span class="text-slate-400">(${group("dealer").length})</span></h2>${leadRows(group("dealer"))}</section>
      <section><h2 class="mb-2 font-bold text-brand-900">Supplier leads <span class="text-slate-400">(${group("supplier").length})</span></h2>${leadRows(group("supplier"))}</section>
      <section><h2 class="mb-2 font-bold text-brand-900">Influencer / creator signups <span class="text-slate-400">(${S.length})</span></h2>${signupRows(S)}</section>`;
    $("content").querySelectorAll(".del").forEach((b) => b.addEventListener("click", () => del(b.dataset.store, b.dataset.key)));
  }

  async function load() {
    $("content") && ($("content").innerHTML = '<p class="text-sm text-slate-500">Loading…</p>');
    const { status, ok, data } = await api({ action: "list" });
    if (status === 401) { setSecret(""); showGate("Wrong passphrase — try again."); return; }
    if (status === 503) { showGate("Admin isn't configured yet — set ADMIN_SECRET in Netlify env."); return; }
    if (!ok) { showGate(data.error || "Couldn't load."); return; }
    DATA = { leads: data.leads || [], signups: data.signups || [] };
    showPanel(); render();
  }

  async function del(store, key) {
    if (!confirm("Delete this record permanently?")) return;
    const { ok } = await api({ action: "delete", store, key });
    if (ok) { DATA.leads = DATA.leads.filter((r) => !(r._store === store && r._key === key)); DATA.signups = DATA.signups.filter((r) => !(r._store === store && r._key === key)); render(); }
    else alert("Delete failed.");
  }

  function exportCSV() {
    const rows = [["kind", "type/program", "date", "code", "name", "email", "phone", "channel", "referral", "status", "details"]];
    DATA.leads.forEach((r) => rows.push(["lead", r.type || "", r.submittedAt || "", "", r.name || "", r.email || "", r.phone || "", "", r.referral_code || "", r.status || "", JSON.stringify(r.details || {})]));
    DATA.signups.forEach((r) => rows.push(["signup", r.program || "", r.signedUpAt || "", r.code || "", r.name || "", r.email || "", "", r.channel || "", "", r.status || "", r.audience || ""]));
    const csv = rows.map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "dhi-leads-export.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $("gate-form").addEventListener("submit", (e) => { e.preventDefault(); $("gate-msg").textContent = ""; setSecret($("gate-secret").value.trim()); load(); });
  $("logout").addEventListener("click", () => { setSecret(""); DATA = { leads: [], signups: [] }; showGate(""); $("gate-secret").value = ""; });
  $("refresh").addEventListener("click", load);
  $("export").addEventListener("click", exportCSV);

  if (secret()) load(); else showGate("");
})();
