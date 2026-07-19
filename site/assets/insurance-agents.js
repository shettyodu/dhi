/* =====================================================================
   Insurance agent registry (demo/scaffold).
   Drives the per-agent white-label MIRROR of insurance.html (?agent=<code>)
   and the agent console. In production this comes from the agent sign-up
   backend; kept client-side here so the mirror + console are demoable now.
   Logos are text wordmark + colored monogram placeholders — drop in a real
   logo path (`logo`) when an agent provides one.
   ===================================================================== */
const INSURANCE_AGENTS = {
  demo: {
    code: "demo", name: "Demo Insurance Agency", brand: "#1c6cb0",
    tagline: "Your coverage, simplified.", phone: "", email: "", logo: "",
  },
  summit: {
    code: "summit", name: "Summit Benefits Group", brand: "#8f2d43",
    tagline: "Protecting families & businesses since 1998.", phone: "", email: "", logo: "",
  },
  evergreen: {
    code: "evergreen", name: "Evergreen Insurance Partners", brand: "#3f9a46",
    tagline: "Independent. Trusted. Local.", phone: "", email: "", logo: "",
  },
};

// Look up an agent by code (case-insensitive). Returns null if unknown.
function getInsuranceAgent(code) {
  if (!code) return null;
  const k = String(code).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(INSURANCE_AGENTS, k) ? INSURANCE_AGENTS[k] : null;
}

// Monogram (first letters of the agency name) for the placeholder logo.
function agentMonogram(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

if (typeof module !== "undefined" && module.exports) module.exports = { INSURANCE_AGENTS, getInsuranceAgent, agentMonogram };
