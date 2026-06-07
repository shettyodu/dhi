/* AutoCommand creator program sign-up. Posts to the shared sign-up-influencer
   function with program="automotive"; shows referral code + personalized link. */
(function () {
  const API_BASE =
    new URLSearchParams(location.search).get("api") ||
    localStorage.getItem("dhi_api_base") ||
    "";
  const SIGNUP = API_BASE + "/.netlify/functions/sign-up-influencer";
  const STORE = "dhi_auto_influencer_signup";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let toastT;
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.remove("opacity-0"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("opacity-0"), 2400); }

  function resultCard(d) {
    return `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p class="flex items-center gap-2 font-semibold text-emerald-700"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>You're in — pending review</p>
      <p class="mt-2 text-sm text-slate-600">Your referral code:</p>
      <p class="mt-0.5 font-mono text-lg font-bold text-brand-900">${esc(d.code)}</p>
      <p class="mt-3 text-sm text-slate-600">Your personalized link:</p>
      <div class="mt-1 flex items-center gap-2">
        <input id="inf-link" readonly value="${esc(d.link)}" class="ck-in !mt-0 flex-1 font-mono text-xs" />
        <button id="inf-copy" class="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800">Copy</button>
      </div>
      <p class="mt-3 text-xs text-slate-500">Share this link. Sales completed with your code in the order earn your payout. Add FTC disclosure ("#ad").</p>
    </div>`;
  }

  function bindCopy() {
    const copy = $("inf-copy"); if (!copy) return;
    copy.addEventListener("click", () => {
      const link = $("inf-link");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link.value).then(() => toast("Link copied")).catch(() => { link.select(); });
      else { link.select(); try { document.execCommand("copy"); } catch (e) {} toast("Link copied"); }
    });
  }

  const form = $("inf-form");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      program: "automotive",
      name: $("inf-name").value.trim(), email: $("inf-email").value.trim(),
      channel: $("inf-channel").value.trim(), audience: $("inf-audience").value.trim(),
      payoutNote: $("inf-payout").value.trim(),
    };
    const status = $("inf-status"), btn = $("inf-submit"), result = $("inf-result");
    if (!payload.name || !payload.email || !payload.channel) { status.className = "text-sm text-red-600"; status.textContent = "Name, email, and channel are required."; return; }
    btn.disabled = true; result.classList.add("hidden");
    status.className = "text-sm text-slate-500"; status.textContent = "Signing you up…";
    try {
      const r = await fetch(SIGNUP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let d = {}; try { d = await r.json(); } catch (e2) {}
      if (r.ok && d.code) {
        status.textContent = ""; result.innerHTML = resultCard(d); result.classList.remove("hidden"); form.classList.add("hidden");
        try { localStorage.setItem(STORE, JSON.stringify({ code: d.code, link: d.link })); } catch (e3) {}
        bindCopy(); toast("Welcome aboard!");
      } else { status.className = "text-sm text-red-600"; status.textContent = d.error || `Sign-up failed (HTTP ${r.status}).`; }
    } catch (err) { status.className = "text-sm text-red-600"; status.textContent = "Network error — please try again."; }
    finally { btn.disabled = false; }
  });

  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && saved.code && form) {
      const result = $("inf-result");
      result.innerHTML = resultCard(saved); result.classList.remove("hidden"); form.classList.add("hidden"); bindCopy();
    }
  } catch (e) {}
})();
