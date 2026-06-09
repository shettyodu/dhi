/* Insurance Ops (internal) — drives the gated /.netlify/functions/insurance-ai
   endpoint. Generates SmartCare proposals + compliant outreach drafts for
   licensed/compliance review. Shares the dhi_admin_secret passcode. */
(function () {
  const qs = new URLSearchParams(location.search);
  const API_BASE = (qs.get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const FN = API_BASE + "/.netlify/functions/insurance-ai";
  const SKEY = "dhi_admin_secret";
  const $ = (id) => document.getElementById(id);
  let secret = localStorage.getItem(SKEY) || "";

  async function api(payload) {
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", "x-dhi-admin": secret }, body: JSON.stringify(payload) });
    let d = {}; try { d = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, d };
  }

  async function unlock(s) {
    secret = s;
    // a tiny proposal call validates the passcode
    const { ok, status } = await api({ action: "proposal", company: "__probe__", employees: "1" });
    if (ok) { localStorage.setItem(SKEY, secret); $("gate").classList.add("hidden"); $("tool").classList.remove("hidden"); return; }
    secret = "";
    $("gate-note").textContent = status === 401 ? "Incorrect passcode." : status === 503 ? "Tool not configured (ADMIN_SECRET missing)." : "Couldn't verify — try again.";
  }

  async function run(btn, payload, outId, noteId, key) {
    const b = $(btn), out = $(outId), note = $(noteId);
    b.disabled = true; out.value = "Generating…"; note.textContent = "";
    try {
      const { ok, status, d } = await api(payload);
      if (ok && d.ok) { out.value = d[key] || ""; note.textContent = (d.ai ? "AI-generated" : "template") + " draft" + (d.approvedLanguageUsed ? " · approved language" : "") + " · review before use"; }
      else { out.value = ""; note.textContent = status === 401 ? "Session expired — reload + re-enter passcode." : (d && d.error) || "Generation failed."; }
    } catch (e) { out.value = ""; note.textContent = "Network error."; }
    finally { b.disabled = false; }
  }

  function copy(id, note) { const t = $(id); t.select(); navigator.clipboard.writeText(t.value).then(() => { $(note).textContent = "Copied"; }).catch(() => { $(note).textContent = "Select & copy manually"; }); }

  function init() {
    if (secret) { $("gate").classList.add("hidden"); $("tool").classList.remove("hidden"); }
    $("gate-go").addEventListener("click", () => unlock($("gate-secret").value.trim()));
    $("gate-secret").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock($("gate-secret").value.trim()); });
    $("p-go").addEventListener("click", () => run("p-go", { action: "proposal", company: $("p-company").value.trim(), employees: $("p-employees").value.trim(), state: $("p-state").value.trim(), notes: $("p-notes").value.trim() }, "p-out", "p-note", "proposal"));
    $("o-go").addEventListener("click", () => run("o-go", { action: "outreach", segment: $("o-segment").value.trim(), tone: $("o-tone").value.trim(), cta: $("o-cta").value.trim() }, "o-out", "o-note", "email"));
    $("p-copy").addEventListener("click", () => copy("p-out", "p-note"));
    $("o-copy").addEventListener("click", () => copy("o-out", "o-note"));
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
