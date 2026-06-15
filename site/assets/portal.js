/* DHI buyer portal — Netlify Identity auth + saved quotes/reorder.
   Logged out: sign-in / create-account CTA. Logged in: save the current cart to
   the account, see saved quotes, reorder (re-loads the cart) or delete. Talks to
   the Identity-gated /portal function with the user's bearer token. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/portal";
  const root = document.getElementById("portal-root");
  const ni = window.netlifyIdentity;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // localStorage carts we can save/reorder. (store key, label, catalog page)
  const CARTS = [
    { key: "dhi_keystone_quote", kind: "lighting", label: "Lighting (Keystone)", page: "lighting-catalog.html" },
    { key: "dhi_supplies_quote", kind: "supplies", label: "Medical supplies", page: "supplies-catalog.html" },
  ];
  function readCart(key) { try { const a = JSON.parse(localStorage.getItem(key)) || []; return a.map((x) => (typeof x === "string" ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1, v: x.v })); } catch (e) { return []; } }

  function token() { const u = ni && ni.currentUser(); return (u && u.token && u.token.access_token) || null; }
  async function api(payload) {
    const t = token();
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, d };
  }

  function loggedOut() {
    root.innerHTML = `
      <div class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 class="font-display text-xl font-bold text-brand-900">Sign in to your DHI account</h2>
        <p class="mt-2 text-sm text-slate-600">Save quotes across lighting &amp; supplies, reorder in one click, and keep your requests together.</p>
        <div class="mt-5 flex justify-center gap-2">
          <button id="p-login" class="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">Sign in</button>
          <button id="p-signup" class="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">Create account</button>
        </div>
        <p class="mt-4 text-xs text-slate-400">Your quote builders still work without an account — signing in just saves them.</p>
      </div>`;
    const open = (tab) => { if (ni) ni.open(tab); else notReady(); };
    document.getElementById("p-login").onclick = () => open("login");
    document.getElementById("p-signup").onclick = () => open("signup");
  }

  function notReady() {
    root.innerHTML = `<div class="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><p class="font-semibold text-amber-800">Accounts are being set up.</p><p class="mt-2 text-sm text-slate-600">Sign-in isn't enabled on this site yet. In the meantime, your quote builders work without an account, or <a href="contact.html" class="font-semibold text-cyan-700 hover:underline">contact us</a>.</p></div>`;
  }

  async function dashboard() {
    const user = ni.currentUser();
    const email = (user && user.email) || "your account";
    // current carts that can be saved
    const saveable = CARTS.map((c) => ({ ...c, items: readCart(c.key) })).filter((c) => c.items.length);
    const saveCards = saveable.length ? saveable.map((c) => `
      <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <div><p class="font-semibold text-brand-900">${esc(c.label)} cart</p><p class="text-xs text-slate-500">${c.items.length} item${c.items.length === 1 ? "" : "s"} in your current ${esc(c.kind)} quote</p></div>
        <button data-save="${esc(c.kind)}" class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">Save to account</button>
      </div>`).join("") : `<p class="text-sm text-slate-500">No active quote to save. Build one in the <a href="lighting-catalog.html" class="font-medium text-cyan-700 hover:underline">lighting</a> or <a href="supplies-catalog.html" class="font-medium text-cyan-700 hover:underline">supplies</a> catalog, then come back.</p>`;

    root.innerHTML = `
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p class="text-sm text-slate-500">Signed in as</p><p class="font-semibold text-brand-900">${esc(email)}</p></div>
        <button id="p-logout" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Sign out</button>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 class="font-display text-lg font-bold text-brand-900">Save your current quote</h2>
        <div class="mt-3 space-y-2">${saveCards}</div>
        <p class="mt-3 text-center"><a href="project.html" class="text-sm font-medium text-cyan-700 hover:underline">View your combined project (lighting + supplies) &rarr;</a></p>
      </div>
      <div class="mt-6">
        <h2 class="font-display text-lg font-bold text-brand-900">Saved quotes</h2>
        <div id="p-quotes" class="mt-3"><div class="text-sm text-slate-400">Loading…</div></div>
      </div>
      <div class="mt-6">
        <h2 class="font-display text-lg font-bold text-brand-900">Your requests</h2>
        <p class="text-xs text-slate-500">Inquiries you've submitted to DHI, with their assigned owner.</p>
        <div id="p-requests" class="mt-3"><div class="text-sm text-slate-400">Loading…</div></div>
      </div>`;
    document.getElementById("p-logout").onclick = () => ni.logout();
    root.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", () => doSave(b.dataset.save, b)));
    loadQuotes();
    loadRequests();
  }

  function statusPill(s) {
    const m = { new: "bg-cyan-100 text-cyan-700", working: "bg-amber-100 text-amber-800", won: "bg-emerald-100 text-emerald-700", lost: "bg-slate-100 text-slate-500" };
    return `<span class="rounded-full px-2 py-0.5 text-xs font-semibold ${m[(s || "new").toLowerCase()] || "bg-slate-100 text-slate-600"}">${esc(s || "new")}</span>`;
  }
  async function loadRequests() {
    const host = document.getElementById("p-requests"); if (!host) return;
    const { ok, d } = await api({ action: "requests" });
    if (!ok) { host.innerHTML = `<p class="text-sm text-slate-500">${esc((d && d.error) || "Couldn't load your requests.")}</p>`; return; }
    const reqs = d.requests || [];
    if (!reqs.length) { host.innerHTML = `<p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No requests yet. When you submit an inquiry from any DHI page, it'll show here.</p>`; return; }
    host.innerHTML = reqs.map((r) => `
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div class="min-w-0">
          <p class="font-semibold text-brand-900">${esc(r.vertical || r.type)} <span class="text-xs font-normal text-slate-400">· ${esc(r.type)}</span></p>
          <p class="text-xs text-slate-500">${esc((r.submittedAt || "").slice(0, 10))}${r.owner ? " · owner: " + esc(r.owner) : ""}</p>
        </div>
        ${statusPill(r.status)}
      </div>`).join("");
  }

  async function doSave(kind, btn) {
    const c = CARTS.find((x) => x.kind === kind); if (!c) return;
    const items = readCart(c.key); if (!items.length) return;
    btn.disabled = true; btn.textContent = "Saving…";
    const name = (prompt("Name this quote:", c.label + " — " + new Date().toLocaleDateString()) || "").trim() || (c.label + " quote");
    const { ok, d } = await api({ action: "save", kind, store_key: c.key, name, items });
    btn.disabled = false; btn.textContent = ok ? "✓ Saved" : "Save to account";
    if (ok) loadQuotes(); else alert((d && d.error) || "Couldn't save — please try again.");
  }

  async function loadQuotes() {
    const host = document.getElementById("p-quotes"); if (!host) return;
    const { ok, d } = await api({ action: "list" });
    if (!ok) { host.innerHTML = `<p class="text-sm text-slate-500">${esc((d && d.error) || "Couldn't load your saved quotes.")}</p>`; return; }
    const quotes = d.quotes || [];
    if (!quotes.length) { host.innerHTML = `<p class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No saved quotes yet. Save one above to reorder it anytime.</p>`; return; }
    host.innerHTML = quotes.map((q) => `
      <div class="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div class="min-w-0">
          <p class="truncate font-semibold text-brand-900">${esc(q.name)}</p>
          <p class="text-xs text-slate-500">${esc(q.kind)} · ${q.count || (q.items || []).length} item${(q.count || 1) === 1 ? "" : "s"} · ${esc((q.createdAt || "").slice(0, 10))}</p>
        </div>
        <div class="flex flex-none gap-2">
          <button data-reorder="${esc(q.id)}" class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">Reorder</button>
          <button data-del="${esc(q.id)}" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">Delete</button>
        </div>
      </div>`).join("");
    host.querySelectorAll("[data-reorder]").forEach((b) => b.addEventListener("click", () => reorder(quotes.find((x) => x.id === b.dataset.reorder))));
    host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { await api({ action: "remove", id: b.dataset.del }); loadQuotes(); }));
  }

  function reorder(q) {
    if (!q) return;
    const c = CARTS.find((x) => x.kind === q.kind) || CARTS.find((x) => x.key === q.store_key);
    const key = (c && c.key) || q.store_key;
    const page = (c && c.page) || "index.html";
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify((q.items || []).map((l) => ({ id: l.id, qty: l.qty, v: l.v })))); } catch (e) {}
    location.href = page;
  }

  function render() {
    if (!ni) { notReady(); return; }
    if (ni.currentUser()) dashboard(); else loggedOut();
  }

  if (ni) {
    ni.on("init", render);
    ni.on("login", () => { ni.close(); dashboard(); });
    ni.on("logout", loggedOut);
    ni.on("error", () => notReady());
    // init() may already have fired before this script bound handlers
    if (ni.currentUser() !== undefined) render();
  } else {
    notReady();
  }
})();
