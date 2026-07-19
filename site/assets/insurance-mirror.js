/* =====================================================================
   Agent white-label MIRROR for the insurance sales page.
   When insurance.html is opened as ?agent=<code>, this re-skins it as the
   agent's own branded page — their logo/name in place of DHI's, a focused
   layout (marketing nav hidden), and every lead tagged to that agent — while
   the page is still "mirrored through" to the DHI mother site that processes it.
   Depends on insurance-agents.js. Sets window.DHI_AGENT for the lead submit.
   ===================================================================== */
(function () {
  var params = new URLSearchParams(location.search);
  var code = params.get("agent") || params.get("ref");
  var agent = (typeof getInsuranceAgent === "function") ? getInsuranceAgent(code) : null;
  if (!agent) return; // no agent context -> plain DHI page

  // Expose to the page's lead-submit so leads are credited to this agent.
  window.DHI_AGENT = { code: agent.code, name: agent.name };

  var mono = (typeof agentMonogram === "function") ? agentMonogram(agent.name) : "AG";

  function brand() {
    // accent color -> the four-color hero kicker + primary CTA lean to the agent's brand
    document.documentElement.style.setProperty("--ink", "#0f2740");
    var kicker = document.querySelector(".hero p.text-xs");
    if (kicker) { kicker.textContent = agent.name; kicker.style.color = agent.brand; }
    if (agent.tagline) {
      var sub = document.querySelector(".hero h1 + p");
      // keep the DHI value prop; append the agent tagline subtly is risky — leave copy as-is.
    }

    // Re-skin the shared header (built by components.js on DOMContentLoaded).
    var header = document.querySelector("header");
    if (header) {
      var logoLink = header.querySelector('a[href="index.html"]') || header.querySelector("a");
      if (logoLink) {
        logoLink.removeAttribute("href");
        logoLink.style.cursor = "default";
        logoLink.innerHTML =
          '<span style="display:inline-flex;align-items:center;gap:10px">' +
          '<span style="width:38px;height:38px;border-radius:9px;background:' + agent.brand + ';color:#fff;font-weight:800;display:grid;place-items:center;font-size:14px;letter-spacing:.02em">' + mono + '</span>' +
          '<span style="display:flex;flex-direction:column;line-height:1.05">' +
          '<span style="font-weight:800;color:#0f2740;font-size:15px">' + agent.name + '</span>' +
          '<span style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8">Powered by DHI</span>' +
          '</span></span>';
      }
      // Focused mode: hide the marketing nav + "Partner with us" so it reads as the agent's own funnel.
      header.querySelectorAll("nav, #svc-dd, #mobile-btn, #mobile-menu").forEach(function (el) { el.style.display = "none"; });
      var partner = header.querySelector('a[href="contact.html"]');
      if (partner) partner.style.display = "none";
    }
  }

  if (document.readyState === "loading") {
    // run after components.js builds the header (its listener is registered first)
    document.addEventListener("DOMContentLoaded", function () { setTimeout(brand, 0); });
  } else {
    setTimeout(brand, 0);
  }
})();
