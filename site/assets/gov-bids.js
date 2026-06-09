/* Bid Match-Maker (internal) — drives the gated /.netlify/functions/gov-bids
   endpoint. Rep enters the admin passcode once (shared dhi_admin_secret); then
   searches SAM.gov opportunities matched to DHI verticals, sees fit scores, and
   generates a starter proposal outline + submission checklist per opportunity. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/gov-bids";
  const FN_REFRESH = API_BASE + "/.netlify/functions/gov-bids-refresh";
  const FN_PROPOSAL = API_BASE + "/.netlify/functions/gov-proposal";
  const SKEY = "dhi_admin_secret";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let secret = localStorage.getItem(SKEY) || "";
  let lastResults = [];

  async function api(payload) {
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, d };
  }

  // ---------- gate ----------
  async function unlock(s) {
    secret = s;
    const { ok, status } = await api({ action: "verticals" });
    if (ok) { localStorage.setItem(SKEY, secret); showTool(); return true; }
    secret = "";
    $("gate-note").textContent = status === 401 ? "Incorrect passcode." : status === 503 ? "Tool not configured yet (ADMIN_SECRET missing)." : "Couldn't verify — try again.";
    return false;
  }

  async function showTool() {
    $("gate").classList.add("hidden");
    $("tool").classList.remove("hidden");
    const { ok, d } = await api({ action: "verticals" });
    if (ok && d.verticals) {
      $("vchips").innerHTML = d.verticals.map((v) =>
        `<button type="button" data-v="${esc(v.key)}" class="v-chip rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-cyan-400">${esc(v.label)}</button>`).join("");
      $("vchips").querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
        $("vchips").querySelectorAll(".v-chip").forEach((c) => c.classList.remove("active"));
        b.classList.add("active");
        runSearch({ vertical: b.dataset.v });
      }));
    }
  }

  // ---------- search ----------
  function loading() { $("results").innerHTML = `<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600"></div><p class="mt-3 text-sm text-slate-500">Searching opportunities…</p></div>`; }

  async function runSearch(payload) {
    loading();
    const { ok, status, d } = await api(Object.assign({ action: "search" }, payload));
    if (!ok) {
      $("results").innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">${status === 401 ? "Session expired — reload and re-enter the passcode." : esc((d && d.error) || "Search failed.")}</div>`;
      return;
    }
    lastResults = d.opportunities || [];
    // note + interpretation
    const note = $("note"); if (d.note) { note.textContent = d.note; note.classList.remove("hidden"); } else note.classList.add("hidden");
    const interp = $("interp"); const iv = d.interpreted || {};
    if ((iv.verticals && iv.verticals.length) || iv.title) {
      interp.classList.remove("hidden");
      interp.innerHTML = `Matched: ${(iv.verticals || []).map((v) => `<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">${esc(v)}</span>`).join(" ") || "—"}${iv.naics && iv.naics.length ? ` · NAICS ${esc(iv.naics.join(", "))}` : ""}`;
    } else interp.classList.add("hidden");
    renderResults(lastResults);
  }

  function fitBadge(score) {
    if (score >= 75) return `<span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Strong fit · ${score}</span>`;
    if (score >= 55) return `<span class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Good fit · ${score}</span>`;
    return `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Review · ${score}</span>`;
  }
  function dueLabel(iso) {
    if (!iso) return "—";
    const d = new Date(iso); if (isNaN(d)) return esc(iso);
    const days = Math.round((d.getTime() - Date.now()) / 86400000);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (days < 0) return `<span class="text-red-600">Closed (${date})</span>`;
    if (days === 0) return `<span class="text-red-600 font-semibold">Due today (${date})</span>`;
    return `<span class="${days <= 5 ? "text-amber-700 font-semibold" : "text-slate-600"}">Due in ${days} day${days === 1 ? "" : "s"} · ${date}</span>`;
  }

  function renderResults(list) {
    if (!list.length) { $("results").innerHTML = `<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">No matching opportunities. Try another vertical or broaden the search.</div>`; return; }
    $("results").innerHTML = list.map((o, i) => `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold text-brand-900">${esc(o.title)}</h3>
            <p class="mt-0.5 text-sm text-slate-500">${esc(o.agency || "")}${o.solicitation ? " · " + esc(o.solicitation) : ""}</p>
          </div>
          ${fitBadge(o.score || 0)}
        </div>
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          ${o.naics ? `<span>NAICS ${esc(o.naics)}</span>` : ""}
          ${o.type ? `<span>${esc(o.type)}</span>` : ""}
          ${o.setAside ? `<span class="font-medium text-cyan-700">${esc(o.setAside)}</span>` : ""}
          ${o.place ? `<span>${esc(o.place)}</span>` : ""}
          <span>${dueLabel(o.deadline)}</span>
        </div>
        ${o.why && o.why.length ? `<p class="mt-2 text-xs text-slate-500"><span class="font-medium text-slate-600">Why:</span> ${esc(o.why.join(" · "))}</p>` : ""}
        <div class="mt-4 flex flex-wrap gap-2">
          <a href="${esc(o.link)}" target="_blank" rel="noopener" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">View on ${esc(o.source || "SAM.gov")} ↗</a>
          <button data-prop="${i}" class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">Start a proposal</button>
          <button data-wf="${i}" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-800 hover:bg-slate-50">Submission checklist</button>
        </div>
        <div id="wf-${i}" class="mt-3 hidden rounded-xl bg-slate-50 p-4 text-sm text-slate-700"></div>
      </div>`).join("");
    $("results").querySelectorAll("[data-prop]").forEach((b) => b.addEventListener("click", () => openProposal(list[+b.dataset.prop])));
    $("results").querySelectorAll("[data-wf]").forEach((b) => b.addEventListener("click", () => toggleWorkflow(+b.dataset.wf, list[+b.dataset.wf])));
  }

  function toggleWorkflow(i, o) {
    const el = $("wf-" + i);
    if (!el.classList.contains("hidden")) { el.classList.add("hidden"); return; }
    const steps = [
      "Confirm eligibility — NAICS, active SAM.gov registration, and set-aside status" + (o.setAside ? ` (${esc(o.setAside)})` : ""),
      "Download the solicitation & attachments from the opportunity link",
      "Capability statement + relevant past performance",
      "Pricing / cost proposal (with quotes from vertical partners)",
      "Reps &amp; certs and required compliance forms",
      `Submit via ${esc(o.source || "SAM.gov")} before the response deadline`,
    ];
    el.classList.remove("hidden");
    el.innerHTML = `<p class="font-semibold text-brand-900">Submission checklist</p><ol class="mt-2 list-decimal space-y-1.5 pl-5">${steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
  }

  // ---------- proposal outline ----------
  function proposalText(o) {
    const due = o.deadline ? new Date(o.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD";
    return [
      `PROPOSAL OUTLINE — Digital Health International Inc. (DHI)`,
      `Opportunity: ${o.title}`,
      `Agency: ${o.agency || "—"}    Solicitation: ${o.solicitation || "—"}`,
      `NAICS: ${o.naics || "—"}    Set-aside: ${o.setAside || "Full & open"}    Response due: ${due}`,
      ``,
      `1. COVER LETTER & EXECUTIVE SUMMARY`,
      `   - DHI overview: SAM.gov-registered, multi-vertical platform (Research Triangle, NC).`,
      `   - One-paragraph fit statement for this requirement.`,
      ``,
      `2. UNDERSTANDING & TECHNICAL APPROACH`,
      `   - Restate the requirement in our words; proposed solution and methodology.`,
      `   - Standards/compliance relevant to the work (e.g., HIPAA, NIST, CE/ISO as applicable).`,
      ``,
      `3. PAST PERFORMANCE & CAPABILITIES`,
      `   - Relevant prior engagements, partners, and references.`,
      ``,
      `4. STAFFING & MANAGEMENT PLAN`,
      `   - Key personnel, roles, timeline/milestones.`,
      ``,
      `5. PRICING / COST PROPOSAL`,
      `   - Line-item pricing with partner quotes; assumptions.`,
      ``,
      `6. COMPLIANCE`,
      `   - Reps & certs, set-aside eligibility${o.setAside ? ` (${o.setAside})` : ""}, required forms/attachments.`,
      ``,
      `7. SUBMISSION`,
      `   - File via ${o.source || "SAM.gov"} (${o.link || "https://sam.gov"}) before ${due}.`,
      ``,
      `[Draft outline — human review and final content required before submission.]`,
    ].join("\n");
  }
  async function openProposal(o) {
    $("prop-copied").textContent = "";
    $("prop-text").value = "Generating a complete draft proposal from DHI's capabilities and partner catalog…";
    $("prop-modal").classList.remove("hidden");
    try {
      const r = await fetch(FN_PROPOSAL, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify({ opportunity: o }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok && d.proposal) {
        $("prop-text").value = d.proposal;
        $("prop-copied").textContent = (d.ai ? "AI-generated" : "Template") + " draft · review before submitting";
      } else {
        $("prop-text").value = proposalText(o); // graceful fallback to the local outline
        $("prop-copied").textContent = (d && d.error) ? d.error : "Generated a local outline (server unavailable).";
      }
    } catch (e) {
      $("prop-text").value = proposalText(o);
      $("prop-copied").textContent = "Generated a local outline (network error).";
    }
  }

  // ---------- wire up ----------
  function init() {
    if (secret) { showTool(); } // re-validates via verticals call; if 401, user can re-enter below
    $("gate-go").addEventListener("click", () => unlock($("gate-secret").value.trim()));
    $("gate-secret").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock($("gate-secret").value.trim()); });
    $("go").addEventListener("click", () => { const q = $("q").value.trim(); if (q) runSearch({ query: q }); });
    $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const q = $("q").value.trim(); if (q) runSearch({ query: q }); } });
    $("prop-close").addEventListener("click", () => $("prop-modal").classList.add("hidden"));
    $("prop-backdrop").addEventListener("click", () => $("prop-modal").classList.add("hidden"));
    $("prop-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("prop-text").value); $("prop-copied").textContent = "Copied"; } catch (e) { $("prop-copied").textContent = "Select & copy manually"; } });
    const rb = $("refresh");
    if (rb) rb.addEventListener("click", async () => {
      const st = $("refresh-status"); st.textContent = "Refreshing from SAM.gov…"; rb.disabled = true;
      try {
        const r = await fetch(FN_REFRESH, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: "{}" });
        const d = await r.json().catch(() => ({}));
        st.textContent = r.ok && d.ok ? `Updated — ${d.count} opportunities cached.` : (d.error || "Refresh failed.");
      } catch (e) { st.textContent = "Refresh failed — try again."; }
      finally { rb.disabled = false; }
    });
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
