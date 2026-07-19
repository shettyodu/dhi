/* =====================================================================
   Insurance Agent Console (Phase-2 SHELL).
   Sidebar toolbar + views: Overview, Leads (real easy-submittal), Book of
   Business, Census (real CSV template), Contracts (real DHI+agent code
   stamping), My Mirror Page (real link generator).

   HONESTY: analytics / leads table / book of business show clearly-labeled
   SAMPLE data — live per-agent data needs secure agent sign-in (backend, next),
   and book/commission connect to the carrier feed. The mirror link, census
   template, contract code-stamping, and lead submittal are REAL.
   Depends on insurance-agents.js.
   ===================================================================== */
(function () {
  var AGENTS = (typeof INSURANCE_AGENTS !== "undefined") ? INSURANCE_AGENTS : {};
  var codes = Object.keys(AGENTS);
  var state = { code: codes[0] || "demo", view: "overview" };
  var API_BASE = (new URLSearchParams(location.search).get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var money = function (n) { return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); };
  function agent() { if (session && session.agent) return session.agent; return AGENTS[state.code] || { code: state.code, name: state.code, brand: "#1c6cb0" }; }

  // ---- session / live agent sign-in ----
  var SKEY = "dhi_agent_session";
  var session = loadSession();
  var realLeads = null;
  function loadSession() { try { var s = JSON.parse(localStorage.getItem(SKEY) || "null"); if (s && s.token && s.exp && Date.now() < s.exp) return s; } catch (e) {} return null; }
  function saveSession(s) { session = s; try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { session = null; realLeads = null; try { localStorage.removeItem(SKEY); } catch (e) {} }
  function LIVE() { return !!(session && session.token); }
  function tokenExp(tok) { try { return JSON.parse(atob(tok.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).e || 0; } catch (e) { return 0; } }
  function relTime(iso) { try { var days = Math.floor((Date.now() - new Date(iso)) / 86400000); return days <= 0 ? "today" : days === 1 ? "1d ago" : days + "d ago"; } catch (e) { return ""; } }
  function normLead(l) { var st = String(l.status || "new"); st = st.charAt(0).toUpperCase() + st.slice(1); return { name: l.name || "—", product: l.interest || l.product || "—", zip: l.zip || "", status: st, date: l.date || (l.submittedAt ? relTime(l.submittedAt) : "") }; }
  function leadsData() { if (LIVE() && Array.isArray(realLeads)) return { leads: realLeads.map(normLead), sample: false }; return { leads: SAMPLE_LEADS.map(normLead), sample: true }; }

  var NAV = [
    { id: "overview", label: "Overview", ic: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" },
    { id: "leads", label: "Leads", ic: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" },
    { id: "book", label: "Book of Business", ic: "M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z" },
    { id: "census", label: "Census", ic: "M9 17v-6M12 17V7M15 17v-4M4 21h16M5 3h14v18H5z" },
    { id: "contracts", label: "Contracts", ic: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 15l2 2 4-4" },
    { id: "mirror", label: "My Mirror Page", ic: "M4 7h13l-3-3M20 17H7l3 3" },
  ];
  var svg = function (p) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + p + '"/></svg>'; };

  /* ---------------- sample data (LABELED, not real) ---------------- */
  var SAMPLE_LEADS = [
    { name: "Sample Client — J. Rivera", product: "Medical + Life", zip: "23320", status: "New", date: "today" },
    { name: "Sample Client — A. Chen", product: "Travel", zip: "23451", status: "Contacted", date: "2d ago" },
    { name: "Sample Client — M. Okafor", product: "Annuity", zip: "23188", status: "Quoted", date: "4d ago" },
    { name: "Sample Client — D. Brooks", product: "Medical (Group 12 EE)", zip: "23502", status: "Bound", date: "1w ago" },
    { name: "Sample Client — L. Nguyen", product: "Life (Whole)", zip: "23606", status: "Lost", date: "2w ago" },
  ];
  var SAMPLE_BOOK = [
    { client: "Sample — Harbor Cafe (Group)", carrier: "ManhattanLife", product: "Group Medical", premium: 4820, comm: 289, status: "Active" },
    { client: "Sample — J. Rivera", carrier: "ManhattanLife", product: "Whole Life", premium: 96, comm: 38, status: "Active" },
    { client: "Sample — A. Chen", carrier: "SquareMouth", product: "Annual Travel", premium: 42, comm: 8, status: "Active" },
    { client: "Sample — T. Wells", carrier: "Acrisure", product: "Hospital Indemnity", premium: 61, comm: 15, status: "Cancelled" },
  ];
  var STATUS = { New: "#ecfeff,#155e75", Contacted: "#fef3c7,#92400e", Quoted: "#ede9fe,#5b21b6", Bound: "#d1fae5,#065f46", Lost: "#f1f5f9,#64748b", Active: "#d1fae5,#065f46", Cancelled: "#fee2e2,#b91c1c" };
  var pill = function (s) { var c = (STATUS[s] || "#f1f5f9,#475569").split(","); return '<span class="pill" style="background:' + c[0] + ";color:" + c[1] + '">' + esc(s) + "</span>"; };

  /* ---------------- views ---------------- */
  function liveTag(sample, n) { return sample ? '<span class="sample">sample data</span>' : '<span class="pill" style="background:#d1fae5;color:#065f46">live' + (n != null ? " · " + n : "") + "</span>"; }
  function vOverview() {
    var ld = leadsData(), L = ld.leads;
    var neu = L.filter(function (l) { return l.status === "New"; }).length;
    var contacted = L.filter(function (l) { return l.status !== "New" && l.status !== "Lost"; }).length;
    var bound = L.filter(function (l) { return l.status === "Bound"; }).length;
    var active = SAMPLE_BOOK.filter(function (b) { return b.status === "Active"; });
    var monthlyComm = active.reduce(function (s, b) { return s + b.comm; }, 0), bookPrem = active.reduce(function (s, b) { return s + b.premium; }, 0);
    return sectionHead("Overview", "A snapshot of your pipeline and book.") +
      '<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">' +
        kpi(L.length, "Leads") + kpi(neu, "New / uncontacted") + kpi(contacted, "Contacted") + kpi(bound, "Bound / sold") +
      '</div>' +
      '<div class="mt-4 grid gap-4 lg:grid-cols-2">' +
        '<div class="card p-4"><div class="flex items-center justify-between"><h3 class="text-sm font-bold" style="color:var(--ink)">Recent leads</h3>' + liveTag(ld.sample) + "</div>" +
          '<div class="mt-2 space-y-2">' + (L.length ? L.slice(0, 5).map(function (l) { return '<div class="flex items-center justify-between text-sm"><span class="truncate text-slate-600">' + esc(l.name) + '</span>' + pill(l.status) + "</div>"; }).join("") : '<p class="py-3 text-sm text-slate-400">No leads yet — share your mirror link to start.</p>') + "</div></div>" +
        '<div class="card p-4"><div class="flex items-center justify-between"><h3 class="text-sm font-bold" style="color:var(--ink)">Book value</h3><span class="sample">sample · carrier feed</span></div>' +
          '<p class="mt-2 text-sm text-slate-500">Active monthly premium <b class="text-slate-800">' + money(bookPrem) + "</b> across " + active.length + ' policies. Residual commission <b class="text-slate-800">' + money(monthlyComm) + "/mo</b> accrues while active.</p>" +
          '<p class="mt-2 text-xs text-slate-400">Book &amp; commission connect to the carrier feed.</p></div>' +
      "</div>";
  }
  function statusSelect(key, current) {
    var opts = ["new", "contacted", "quoted", "bound", "lost"].map(function (s) { return '<option value="' + s + '"' + (s === current ? " selected" : "") + ">" + s.charAt(0).toUpperCase() + s.slice(1) + "</option>"; }).join("");
    return '<select data-status-key="' + esc(key) + '" data-prev="' + esc(current) + '" class="inp" style="padding:4px 8px;font-size:12px;width:auto">' + opts + "</select>";
  }
  function vLeads() {
    var live = LIVE() && Array.isArray(realLeads);
    var src = live ? realLeads : SAMPLE_LEADS;
    var rows = src.length ? src.map(function (l) {
      var n = normLead(l);
      var statusCell = live ? statusSelect(l.key, String(l.status || "new").toLowerCase()) : pill(n.status);
      return "<tr><td>" + esc(n.name) + "</td><td>" + esc(n.product) + "</td><td>" + esc(n.zip || "—") + "</td><td>" + statusCell + "</td><td class='text-slate-400'>" + esc(n.date || "") + "</td></tr>";
    }).join("") : '<tr><td colspan="5" style="padding:18px;color:#94a3b8">No leads yet. Share your mirror link, or add one &rarr;</td></tr>';
    return sectionHead("Leads", "Every lead from your mirror page lands here — update status as you work it, or add one below.") +
      '<div class="grid gap-4 lg:grid-cols-3">' +
        '<div class="card p-4 lg:col-span-2"><div class="flex items-center justify-between"><h3 class="text-sm font-bold" style="color:var(--ink)">Lead tracking</h3>' + liveTag(!live, live ? src.length : null) + "</div>" +
          '<div class="mt-2 overflow-x-auto"><table><thead><tr><th>Client</th><th>Interest</th><th>ZIP</th><th>Status</th><th>Added</th></tr></thead><tbody>' +
          rows +
          "</tbody></table></div></div>" +
        '<div class="card p-4"><h3 class="text-sm font-bold" style="color:var(--ink)">Add a lead</h3><p class="mt-1 text-xs text-slate-500">Submits to DHI, credited to you.</p>' +
          '<form id="lead-form" class="mt-3 space-y-2">' +
            '<input class="inp" id="la-name" placeholder="Client name" required />' +
            '<input class="inp" id="la-email" type="email" placeholder="Client email" required />' +
            '<input class="inp" id="la-phone" placeholder="Phone (optional)" />' +
            '<select class="inp" id="la-int"><option>Medical</option><option>Life</option><option>Annuity</option><option>Travel</option><option>Group / Employer</option></select>' +
            '<input type="text" id="la-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true" />' +
            '<button class="btn btn-a w-full" type="submit">Submit lead</button>' +
            '<p class="text-xs" id="la-note"></p>' +
          "</form></div>" +
      "</div>";
  }
  function vBook() {
    var active = SAMPLE_BOOK.filter(function (b) { return b.status === "Active"; });
    var stopped = SAMPLE_BOOK.filter(function (b) { return b.status === "Cancelled"; });
    var monthlyComm = active.reduce(function (s, b) { return s + b.comm; }, 0);
    return sectionHead("Book of Business", "Active policies pay residual commission monthly; cancellations auto-stop payment.") +
      '<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">' +
        kpi(active.length, "Active policies") + kpi(money(monthlyComm) + "/mo", "Residual commission") + kpi(stopped.length, "Cancelled · payment stopped") +
      '</div>' +
      '<div class="card mt-4 p-4"><div class="flex items-center justify-between"><h3 class="text-sm font-bold" style="color:var(--ink)">Policies</h3><span class="sample">sample · connects to carrier feed</span></div>' +
        '<div class="mt-2 overflow-x-auto"><table><thead><tr><th>Client</th><th>Carrier</th><th>Product</th><th>Premium/mo</th><th>Commission/mo</th><th>Status</th></tr></thead><tbody>' +
        SAMPLE_BOOK.map(function (b) { return "<tr><td>" + esc(b.client) + "</td><td>" + esc(b.carrier) + "</td><td>" + esc(b.product) + "</td><td>" + money(b.premium) + "</td><td>" + (b.status === "Cancelled" ? '<span class="text-red-500 line-through">' + money(b.comm) + "</span> <span class='text-[11px] text-red-500'>stopped</span>" : money(b.comm)) + "</td><td>" + pill(b.status) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
        '<p class="mt-3 text-xs text-slate-400">Commission engine (new + residual + cancellation/stop-pay) activates once the carrier commission &amp; policy-status feed is connected.</p></div>';
  }
  function vCensus() {
    return sectionHead("Census", "Send a client a ready-to-fill employee census for group quoting.") +
      '<div class="card p-5 max-w-xl"><h3 class="text-sm font-bold" style="color:var(--ink)">Group census template</h3>' +
        '<p class="mt-1 text-sm text-slate-500">Download a clean CSV, send it to the employer to complete, then upload it back for a group quote. No PHI required — demographics &amp; coverage tier only.</p>' +
        '<button id="census-dl" class="btn btn-a mt-3">Download census template (CSV)</button>' +
        '<div class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">Upload completed census &rarr; group quote <span class="sample ml-1">next build</span></div>' +
      "</div>";
  }
  function vContracts() {
    var a = agent();
    return sectionHead("Contracts", "Generate a producer agreement stamped with your DHI + agent codes.") +
      '<div class="card p-5 max-w-xl"><h3 class="text-sm font-bold" style="color:var(--ink)">New e-form agreement</h3>' +
        '<div class="mt-3 space-y-2">' +
          '<input class="inp" id="k-client" placeholder="Client / group name" />' +
          '<select class="inp" id="k-carrier"><option>ManhattanLife</option><option>SquareMouth</option><option>Acrisure</option></select>' +
          '<select class="inp" id="k-product"><option>Medical</option><option>Life</option><option>Annuity</option><option>Travel</option><option>Group Medical</option></select>' +
        "</div>" +
        '<div class="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Will stamp: <b>DHI code</b> DHI-INS-2026 · <b>Agent code</b> ' + esc(a.code.toUpperCase()) + ' · a unique agreement #.</div>' +
        '<button id="k-gen" class="btn mt-3">Generate agreement</button>' +
        '<p class="mt-2 text-xs text-slate-400">Electronic submission to the carrier connects to the carrier portal (next build).</p>' +
      "</div>";
  }
  function vMirror() {
    var url = mirrorUrl();
    return sectionHead("My Mirror Page", "Your branded copy of the DHI insurance page. Share it — every lead is credited to you.") +
      '<div class="card p-5 max-w-2xl"><div class="flex items-center gap-3"><span class="flex h-11 w-11 items-center justify-center rounded-lg text-white font-extrabold" style="background:' + esc(agent().brand) + '">' + esc(mono()) + "</span>" +
        '<div><p class="text-sm font-bold" style="color:var(--ink)">' + esc(agent().name) + '</p><p class="text-[11px] uppercase tracking-wide text-slate-400">Powered by DHI</p></div></div>' +
        '<label class="mt-4 block text-xs font-semibold text-slate-500">Your shareable link</label>' +
        '<div class="mt-1 flex gap-2"><input class="inp font-mono text-xs" id="m-url" readonly value="' + esc(url) + '" /><button id="m-copy" class="btn btn-a">Copy</button></div>' +
        '<div class="mt-3 flex gap-2"><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">Open my page &rarr;</a></div>' +
        '<p class="mt-3 text-xs text-slate-400">Leads submitted from this link carry your agent code and appear under Leads &amp; Book of Business.</p>' +
      "</div>";
  }

  function sectionHead(t, s) { return '<div class="mb-4"><h2 class="text-xl font-extrabold" style="color:var(--ink)">' + esc(t) + '</h2><p class="text-sm text-slate-500">' + esc(s) + "</p></div>"; }
  function kpi(n, l) { return '<div class="kpi"><div class="n">' + esc(n) + '</div><div class="l">' + esc(l) + "</div></div>"; }
  function mono() { return (typeof agentMonogram === "function") ? agentMonogram(agent().name) : "AG"; }
  function mirrorUrl() { return location.origin + location.pathname.replace(/insurance-agent\.html$/, "insurance.html") + "?agent=" + encodeURIComponent(agent().code); }

  var VIEWS = { overview: vOverview, leads: vLeads, book: vBook, census: vCensus, contracts: vContracts, mirror: vMirror };

  /* ---------------- actions ---------------- */
  function wire() {
    var f = $("lead-form");
    if (f) f.addEventListener("submit", submitLead);
    var cd = $("census-dl"); if (cd) cd.addEventListener("click", downloadCensus);
    var kg = $("k-gen"); if (kg) kg.addEventListener("click", genContract);
    var mc = $("m-copy"); if (mc) mc.addEventListener("click", function () { copy($("m-url").value, mc); });
    [].forEach.call(document.querySelectorAll("[data-status-key]"), function (sel) {
      sel.addEventListener("change", function () { updateStatus(sel.getAttribute("data-status-key"), sel.value, sel); });
    });
  }
  async function updateStatus(key, status, sel) {
    var prev = sel.getAttribute("data-prev"); sel.disabled = true;
    try {
      var r = await fetch(API_BASE + "/.netlify/functions/agent-lead-status", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.token }, body: JSON.stringify({ key: key, status: status }) });
      if (r.ok) {
        var rec = realLeads && realLeads.filter(function (x) { return x.key === key; })[0]; if (rec) rec.status = status;
        sel.setAttribute("data-prev", status);
        sel.style.borderColor = "#10b981"; setTimeout(function () { sel.style.borderColor = ""; }, 900);
      } else { sel.value = prev; if (r.status === 401) { clearSession(); render(); } }
    } catch (e) { sel.value = prev; }
    sel.disabled = false;
  }
  async function submitLead(e) {
    e.preventDefault();
    var note = $("la-note");
    if ($("la-hp").value) { e.target.reset(); return; }
    var payload = {
      type: "inquiry", vertical: "insurance",
      name: $("la-name").value.trim(), email: $("la-email").value.trim(), phone: $("la-phone").value.trim(),
      interest: "Insurance — " + $("la-int").value, message: "Submitted by agent " + agent().name + " via console",
      source: "Agent console — " + agent().name, referral_code: agent().code, hp: $("la-hp").value,
    };
    var btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Submitting…";
    try {
      var r = await fetch(API_BASE + "/.netlify/functions/submit-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) { note.className = "text-xs text-emerald-600"; note.textContent = "Lead submitted and credited to you."; e.target.reset(); }
      else { var d = await r.json().catch(function () { return {}; }); note.className = "text-xs text-red-500"; note.textContent = d.error || "Couldn't submit — try again."; }
    } catch (err) { note.className = "text-xs text-red-500"; note.textContent = "Network error — try again."; }
    btn.disabled = false; btn.textContent = "Submit lead";
  }
  function downloadCensus() {
    var cols = ["Employee Last Name", "First Name", "Date of Birth (MM/DD/YYYY)", "Gender", "Home ZIP", "Coverage Tier (EE/ES/EC/FAM)", "# Dependents", "Current Plan", "Annual Salary (optional)"];
    var sample = ["Doe", "Jane", "01/15/1985", "F", "23320", "FAM", "2", "", ""];
    var csv = cols.join(",") + "\n" + sample.join(",") + "\n";
    dl("DHI-Group-Census-Template.csv", csv, "text/csv");
  }
  function genContract() {
    var a = agent();
    var stamp = Date.now().toString(36).toUpperCase().slice(-6);
    var agr = "DHI-" + a.code.toUpperCase() + "-" + stamp;
    var client = ($("k-client").value || "____________").trim();
    var carrier = $("k-carrier").value, product = $("k-product").value;
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + agr + '</title>' +
      '<style>body{font-family:Inter,Arial,sans-serif;color:#1e293b;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.5}' +
      'h1{font-size:20px;color:#0f2740}.band{height:5px;background:linear-gradient(90deg,#0a2540,#0891b2,#10b981);margin-bottom:16px}' +
      'table{width:100%;border-collapse:collapse;margin:14px 0}td{border:1px solid #e2e8f0;padding:7px 10px;font-size:13px}' +
      '.k{background:#f8fafc;font-weight:700;width:34%}.sig{margin-top:40px;display:flex;gap:40px}.sig div{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:12px;color:#64748b}</style></head><body>' +
      '<div class="band"></div><h1>Producer Placement Agreement</h1>' +
      '<p style="font-size:12px;color:#64748b">Digital Health International Inc. — Insurance</p>' +
      '<table><tr><td class="k">Agreement #</td><td>' + agr + '</td></tr>' +
      '<tr><td class="k">DHI code</td><td>DHI-INS-2026</td></tr>' +
      '<tr><td class="k">Agent code</td><td>' + esc(a.code.toUpperCase()) + " — " + esc(a.name) + '</td></tr>' +
      '<tr><td class="k">Client / group</td><td>' + esc(client) + '</td></tr>' +
      '<tr><td class="k">Carrier</td><td>' + esc(carrier) + '</td></tr>' +
      '<tr><td class="k">Product</td><td>' + esc(product) + '</td></tr></table>' +
      '<p style="font-size:12.5px">This agreement authorizes the named agent to place the referenced coverage through Digital Health International with the named carrier, under the DHI producer program. Commissions are payable per the applicable carrier schedule. <b>This is a draft template</b> — carrier appointment, licensing verification, and electronic submission are completed before binding.</p>' +
      '<div class="sig"><div>Agent signature / date</div><div>DHI authorized signature / date</div></div>' +
      '<p style="margin-top:30px;font-size:10px;color:#94a3b8">Generated by the DHI Insurance Agent Console · ' + agr + ' · not a binding contract until countersigned and carrier-accepted.</p>' +
      "</body></html>";
    var w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); } else { dl(agr + ".html", html, "text/html"); }
  }
  function dl(name, content, mime) {
    var blob = new Blob([content], { type: mime }); var u = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }
  function copy(text, btn) {
    try { navigator.clipboard.writeText(text); var t = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = t; }, 1400); } catch (e) {}
  }

  /* ---------------- auth flow ---------------- */
  function renderAuth() {
    var pill = $("mode-pill"), sw = $("agent-switch"), btn = $("auth-btn");
    if (LIVE()) {
      pill.textContent = "LIVE · " + agent().name; pill.style.background = "#d1fae5"; pill.style.color = "#065f46"; pill.style.border = "1px solid #a7f3d0";
      sw.style.display = "none";
      btn.textContent = "Sign out"; btn.onclick = function () { clearSession(); state.code = codes[0] || "demo"; render(); };
    } else {
      pill.textContent = "PREVIEW · sample data"; pill.style.background = "#fffbeb"; pill.style.color = "#92400e"; pill.style.border = "1px solid #fde68a";
      sw.style.display = "";
      btn.textContent = "Sign in"; btn.onclick = openSignin;
    }
  }
  function openSignin() { $("si-note").textContent = ""; $("signin-ov").style.display = "flex"; setTimeout(function () { $("si-code").focus(); }, 0); }
  function closeSignin() { $("signin-ov").style.display = "none"; }
  async function doLogin(e) {
    e.preventDefault();
    var note = $("si-note"); note.className = "text-xs text-slate-500"; note.textContent = "Signing in…";
    var go = $("si-go"); go.disabled = true;
    try {
      var r = await fetch(API_BASE + "/.netlify/functions/agent-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: $("si-code").value.trim(), password: $("si-pass").value }) });
      var d = await r.json().catch(function () { return {}; });
      if (r.ok && d.token) { saveSession({ token: d.token, agent: d.agent, exp: tokenExp(d.token) }); state.code = d.agent.code; $("si-pass").value = ""; closeSignin(); await loadRealLeads(); render(); }
      else if (r.status === 503) { note.className = "text-xs text-amber-600"; note.textContent = "Sign-in isn't configured yet (admin: set AGENT_AUTH_SECRET + provision agents)."; }
      else { note.className = "text-xs text-red-500"; note.textContent = d.error || "Sign-in failed."; }
    } catch (err) { note.className = "text-xs text-red-500"; note.textContent = "Network error — try again."; }
    go.disabled = false;
  }
  async function loadRealLeads() {
    if (!LIVE()) return;
    try {
      var r = await fetch(API_BASE + "/.netlify/functions/agent-leads", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.token }, body: "{}" });
      if (r.status === 401) { clearSession(); return; }
      var d = await r.json().catch(function () { return {}; });
      realLeads = (d && d.ok && Array.isArray(d.leads)) ? d.leads : [];
    } catch (e) { realLeads = []; }
  }

  /* ---------------- shell render ---------------- */
  function applyAccent() { document.documentElement.style.setProperty("--accent", agent().brand); }
  function renderNav() {
    var html = NAV.map(function (n) { return '<button class="navbtn" data-view="' + n.id + '" data-on="' + (state.view === n.id ? 1 : 0) + '">' + svg(n.ic) + "<span>" + n.label + "</span></button>"; }).join("");
    $("nav").innerHTML = html;
    $("nav-m").innerHTML = NAV.map(function (n) { return '<button class="navbtn" style="width:auto;white-space:nowrap;font-size:12px;padding:7px 10px" data-view="' + n.id + '" data-on="' + (state.view === n.id ? 1 : 0) + '">' + esc(n.label) + "</button>"; }).join("");
    [].forEach.call(document.querySelectorAll("[data-view]"), function (b) { b.addEventListener("click", function () { state.view = b.getAttribute("data-view"); render(); }); });
  }
  function renderMini() {
    var ml = $("mini-link"); if (ml) ml.textContent = "…/insurance.html?agent=" + agent().code;
    var mc = $("mini-copy"); if (mc) mc.onclick = function () { copy(mirrorUrl(), mc); };
  }
  function render() {
    applyAccent();
    renderAuth(); renderNav(); renderMini();
    $("view").innerHTML = (VIEWS[state.view] || vOverview)();
    wire();
    window.scrollTo(0, 0);
  }

  // agent switcher
  var sw = $("agent-switch");
  sw.innerHTML = codes.map(function (c) { return '<option value="' + c + '">' + esc(AGENTS[c].name) + "</option>"; }).join("");
  sw.value = state.code;
  sw.addEventListener("change", function () { state.code = sw.value; render(); });

  // deep link ?agent= preselects (preview only)
  var qp = new URLSearchParams(location.search).get("agent");
  if (qp && AGENTS[qp.toLowerCase()]) { state.code = qp.toLowerCase(); sw.value = state.code; }

  // auth wiring
  $("signin-form").addEventListener("submit", doLogin);
  $("si-cancel").addEventListener("click", closeSignin);
  $("signin-ov").addEventListener("click", function (e) { if (e.target === $("signin-ov")) closeSignin(); });

  if (LIVE()) { state.code = session.agent.code; loadRealLeads().then(render); } else { render(); }
})();
