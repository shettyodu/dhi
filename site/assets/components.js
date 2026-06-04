/* =====================================================================
   Digital Health International Inc. — shared site components
   Injects a consistent navigation bar and footer on every page,
   and exposes shared site data (verticals, contact info).
   ===================================================================== */

const SITE = {
  name: "Digital Health International Inc.",
  short: "DHI",
  tagline: "Where Health Meets Innovation",
  phone: "(919) 275-2474",
  ceoPhone: "(919) 434-9760",
  email: "steve@digitalhealthinternational.com",
  web: "digitalhealthinternational.com",
  address: "68 Jeans Way, Benson, NC 27504",
  region: "Research Triangle, North Carolina",
};

/* The verticals / service sub-pages. Order drives the Services menu,
   the services hub grid, and the footer. */
const VERTICALS = [
  {
    slug: "decentralized-software.html",
    title: "Decentralized Software",
    menu: "Decentralized Software Solutions",
    summary:
      "EMR/EHR and health-data platforms on distributed, quantum-ready infrastructure with open APIs and modular design.",
    icon: "cube",
  },
  {
    slug: "cybersecurity.html",
    title: "Cybersecurity & Infrastructure",
    menu: "Secure Communication & Cybersecurity",
    summary:
      "Security and compliance built into every layer — Titan data protection and the PipIQ AI-driven cybersecurity platform.",
    icon: "shield",
  },
  {
    slug: "wellness.html",
    title: "Wellness & Digital Care",
    menu: "Wellness & Digital Care",
    summary:
      "GenieMD telehealth and remote care plus Cognifit cognitive health — a unified, white-label virtual care platform.",
    icon: "heart",
  },
  {
    slug: "nutrition.html",
    title: "Nutrition & Supplements",
    menu: "Nutrition & Supplements",
    summary:
      "Custom-branded supplements, diagnostic lab kits, and corporate wellness plans — plus consumables and field supplies for clinics and programs worldwide.",
    icon: "leaf",
  },
  {
    slug: "insurance.html",
    title: "Insurance & Risk Solutions",
    menu: "Insurance & Risk Solutions",
    summary:
      "Health, supplemental, and specialty insurance with carriers and brokers, integrated with wellness and analytics.",
    icon: "umbrella",
  },
  {
    slug: "medical-equipment.html",
    title: "Medical Equipment & Technology",
    menu: "Medical Equipment & Technology",
    summary:
      "Access to 1,200+ products through our GPDI global sourcing partnership in South Korea — diagnostics to lifecycle support.",
    icon: "pulse",
  },
  {
    slug: "clinics.html",
    title: "Clinics & Modules",
    menu: "Clinics & Modules",
    summary:
      "Scalable, modular health infrastructure — prefab clinics and mobile medical units deployable in days for remote, disaster-relief, and underserved regions.",
    icon: "clinic",
  },
  {
    slug: "supplies.html",
    title: "Supplies, Textiles & Linens",
    menu: "Supplies, Textiles & Linens",
    summary:
      "Hospital-grade textiles, linens, and consumables focused on quality, durability, and infection control.",
    icon: "layers",
  },
  {
    slug: "lighting.html",
    title: "Lighting & Energy Efficiency",
    menu: "Lighting & Energy Efficiency",
    summary:
      "Keystone-backed LED lighting and retrofits — 100% end-of-line tested, with a defect rate under 0.1%.",
    icon: "bolt",
  },
  {
    slug: "data-analytics.html",
    title: "Data & Analytics",
    menu: "Data & Analytics (Titan)",
    summary:
      "Unified data services, interoperability layers, and AI decision support across the DHI ecosystem.",
    icon: "chart",
  },
  {
    slug: "automotive.html",
    title: "Automotive & Mobility",
    menu: "Automotive & Mobility (AutoCommand AI)",
    summary:
      "AutoCommand AI Marketplace — a digital-first vehicle acquisition platform to search, finance, protect, buy, and ship vehicles through one Agentic AI-powered system.",
    icon: "car",
  },
  {
    slug: "government.html",
    title: "Government Contracting",
    menu: "Government & Public Health",
    summary:
      "SAM.gov-registered prime contractor and subcontractor for federal, state, local, and international B-to-G engagements.",
    icon: "building",
  },
];

/* Minimal inline SVG icon set (Heroicons-style, stroke-based). */
const ICONS = {
  cube: '<path d="M21 7.5l-9-5-9 5m18 0l-9 5m9-5v9l-9 5m0-9L3 7.5m9 5v9m0-9L21 7.5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>',
  heart:
    '<path d="M12 20.5l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 5 4 3 6.5 3c1.74 0 3.41.81 4.5 2.09C12.09 3.81 13.76 3 15.5 3 18 3 20 5 20 7.5c0 3.78-3.4 6.86-8.55 11.68L12 20.5z"/>',
  umbrella:
    '<path d="M12 3v2m0 0a9 9 0 00-9 9h18a9 9 0 00-9-9zm0 9v6a2 2 0 01-4 0"/>',
  pulse: '<path d="M3 12h4l2 6 4-14 2 8h6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5zm9 9l-9 5-9-5m18 4l-9 5-9-5"/>',
  bolt: '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
  building:
    '<path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16m4 0V9a2 2 0 00-2-2h-2M8 7h2m-2 4h2m-2 4h2M2 21h20"/>',
  car:
    '<path d="M3 13l2-5.2A2 2 0 016.9 6.5h10.2A2 2 0 0119 7.8L21 13v5a1 1 0 01-1 1h-1.5a1 1 0 01-1-1v-1H6.5v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z"/><path d="M3 13h18"/><circle cx="7.5" cy="16" r="1.1"/><circle cx="16.5" cy="16" r="1.1"/>',
  leaf:
    '<path d="M11 20A7 7 0 014 13C4 7 9 3 20 3c0 11-4 16-10 16a7 7 0 01-2-.3"/><path d="M8 18c1.5-4 4.5-7 9-9"/>',
  clinic:
    '<path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M12 8.5v3M10.5 10h3"/>',
};

function icon(name, cls = "h-6 w-6") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

function currentFile() {
  const p = window.location.pathname.split("/").pop();
  return p && p.length ? p : "index.html";
}

/* ----------------------------- NAV ----------------------------- */
function buildHeader() {
  const here = currentFile();
  const isService = VERTICALS.some((v) => v.slug === here);

  const link = (href, label) => {
    const active = here === href;
    return `<a href="${href}" class="px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      active
        ? "text-cyan-700"
        : "text-slate-600 hover:text-brand-800 hover:bg-slate-50"
    }">${label}</a>`;
  };

  const serviceItems = VERTICALS.map(
    (v) =>
      `<a href="${v.slug}" class="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 group">
         <span class="mt-0.5 text-cyan-600 group-hover:text-cyan-700">${icon(v.icon, "h-5 w-5")}</span>
         <span>
           <span class="block text-sm font-semibold text-brand-900">${v.menu}</span>
           <span class="block text-xs text-slate-500 leading-snug">${v.summary}</span>
         </span>
       </a>`
  ).join("");

  const mobileServiceItems = VERTICALS.map(
    (v) =>
      `<a href="${v.slug}" class="block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-800">${v.menu}</a>`
  ).join("");

  const header = document.createElement("header");
  header.className =
    "sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200";
  header.innerHTML = `
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <a href="index.html" class="flex items-center" aria-label="Digital Health International — home">
        <img src="assets/img/dhi-logo.svg" alt="Digital Health International" onerror="this.onerror=null;this.src='assets/img/dhi-logo.png'" class="h-7 w-auto sm:h-9" />
      </a>

      <nav class="hidden items-center gap-1 lg:flex">
        ${link("index.html", "Home")}
        ${link("about.html", "About")}
        <div class="relative" id="svc-dd">
          <button id="svc-btn" class="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            isService ? "text-cyan-700" : "text-slate-600 hover:text-brand-800 hover:bg-slate-50"
          }">
            Services
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div id="svc-menu" class="invisible absolute left-1/2 z-50 mt-2 w-[34rem] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition-all duration-150">
            <div class="grid grid-cols-2 gap-1">${serviceItems}</div>
            <a href="services.html" class="mt-1 block rounded-lg bg-brand-50 px-3 py-2 text-center text-sm font-semibold text-brand-800 hover:bg-brand-100">View all verticals &rarr;</a>
          </div>
        </div>
        ${link("government.html", "Government")}
        ${link("contact.html", "Contact")}
        <a href="contact.html" class="ml-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 transition-colors">Partner with us</a>
      </nav>

      <button id="mobile-btn" class="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </div>

  <div id="mobile-menu" class="hidden border-t border-slate-200 bg-white lg:hidden">
    <div class="space-y-1 px-4 py-3">
      <a href="index.html" class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Home</a>
      <a href="about.html" class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">About</a>
      <div class="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Services</div>
      ${mobileServiceItems}
      <a href="government.html" class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Government</a>
      <a href="contact.html" class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Contact</a>
      <a href="contact.html" class="mt-2 block rounded-md bg-cyan-600 px-3 py-2 text-center text-sm font-semibold text-white">Partner with us</a>
    </div>
  </div>`;

  document.body.prepend(header);

  // Mobile toggle
  const mb = header.querySelector("#mobile-btn");
  const mm = header.querySelector("#mobile-menu");
  mb.addEventListener("click", () => mm.classList.toggle("hidden"));

  // Desktop dropdown (click + hover)
  const dd = header.querySelector("#svc-dd");
  const menu = header.querySelector("#svc-menu");
  const show = () => {
    menu.classList.remove("invisible", "opacity-0");
    menu.classList.add("visible", "opacity-100");
  };
  const hide = () => {
    menu.classList.add("invisible", "opacity-0");
    menu.classList.remove("visible", "opacity-100");
  };
  dd.addEventListener("mouseenter", show);
  dd.addEventListener("mouseleave", hide);
  header.querySelector("#svc-btn").addEventListener("click", (e) => {
    e.preventDefault();
    menu.classList.contains("opacity-0") ? show() : hide();
  });
  document.addEventListener("click", (e) => {
    if (!dd.contains(e.target)) hide();
  });
}

/* ---------------------------- FOOTER ---------------------------- */
function buildFooter() {
  const col1 = VERTICALS.slice(0, 5)
    .map(
      (v) =>
        `<li><a href="${v.slug}" class="text-slate-300 hover:text-cyan-400 transition-colors">${v.title}</a></li>`
    )
    .join("");
  const col2 = VERTICALS.slice(5)
    .map(
      (v) =>
        `<li><a href="${v.slug}" class="text-slate-300 hover:text-cyan-400 transition-colors">${v.title}</a></li>`
    )
    .join("");

  const footer = document.createElement("footer");
  footer.className = "bg-brand-950 text-slate-300";
  footer.innerHTML = `
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
    <div class="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
      <div>
        <div class="flex items-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-brand-600 text-white font-bold text-sm">DHI</span>
          <span class="text-base font-bold text-white">Digital Health International</span>
        </div>
        <p class="mt-4 text-sm leading-relaxed text-slate-400">
          Ten verticals. One global platform. Unifying healthcare, energy, and enterprise into a single integrated ecosystem — anywhere in the world.
        </p>
        <p class="mt-4 text-xs uppercase tracking-wider text-cyan-400">${SITE.tagline}</p>
      </div>

      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wider text-white">Verticals</h3>
        <ul class="mt-4 space-y-2.5 text-sm">${col1}</ul>
      </div>
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wider text-white">&nbsp;</h3>
        <ul class="mt-4 space-y-2.5 text-sm">${col2}</ul>
      </div>

      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wider text-white">Contact</h3>
        <ul class="mt-4 space-y-2.5 text-sm text-slate-300">
          <li>${SITE.address}</li>
          <li>${SITE.region}</li>
          <li><a href="tel:+19192752474" class="hover:text-cyan-400">${SITE.phone}</a></li>
          <li><a href="mailto:${SITE.email}" class="hover:text-cyan-400 break-all">${SITE.email}</a></li>
        </ul>
        <a href="contact.html" class="mt-5 inline-block rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Get in touch</a>
      </div>
    </div>

    <div class="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
      <p>&copy; 2025 Digital Health International Inc. — Research Triangle, NC. All rights reserved.</p>
      <p>SAM.gov registered &middot; CAGE V93LC35DCVN5 &middot; UEI 33-4356283</p>
    </div>
  </div>`;

  document.body.appendChild(footer);
}

/* ----------------------- HERO IMAGE CAROUSEL ----------------------- */
/* Adds the rotating banner images behind the hero of every page.
   The homepage builds its own carousel (with dot controls), so it is
   detected and skipped here to avoid duplication. */
const HERO_IMAGES = ["assets/img/banner.jpg", "assets/img/banner1.jpg", "assets/img/banner2.jpg"];

function initHeroCarousel() {
  if (document.getElementById("hero-carousel")) return; // homepage already has one
  const hero = document.querySelector("section");
  if (!hero || hero.querySelector(".dhi-hero-bg")) return;

  // shared slide styles (injected once)
  if (!document.getElementById("dhi-hero-style")) {
    const st = document.createElement("style");
    st.id = "dhi-hero-style";
    st.textContent =
      ".dhi-hero-bg{position:absolute;inset:0;overflow:hidden}" +
      ".dhi-hero-bg .s{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.05);transition:opacity 1.4s ease-in-out,transform 7s ease-out}" +
      ".dhi-hero-bg .s.on{opacity:1;transform:scale(1)}" +
      ".dhi-hero-bg .o1{position:absolute;inset:0;background:linear-gradient(to right,rgba(7,26,48,.94),rgba(7,26,48,.80),rgba(10,37,64,.55))}" +
      ".dhi-hero-bg .o2{position:absolute;inset:0;background:linear-gradient(to top,rgba(7,26,48,.80),transparent 60%)}" +
      "@media (prefers-reduced-motion:reduce){.dhi-hero-bg .s{transition:opacity .6s ease-in-out;transform:none}.dhi-hero-bg .s.on{transform:none}}";
    document.head.appendChild(st);
  }

  if (getComputedStyle(hero).position === "static") hero.style.position = "relative";

  // hide the page's existing decorative full-bleed background layers
  [...hero.children].forEach((ch) => {
    if (ch.tagName === "DIV" && /\babsolute\b/.test(ch.className) && /\binset-0\b/.test(ch.className)) {
      ch.style.display = "none";
    }
  });

  // build + insert the carousel behind the hero content
  const wrap = document.createElement("div");
  wrap.className = "dhi-hero-bg";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML =
    HERO_IMAGES.map((u, i) => `<div class="s${i === 0 ? " on" : ""}" style="background-image:url('${u}')"></div>`).join("") +
    '<div class="o1"></div><div class="o2"></div>';
  hero.prepend(wrap);

  // auto-cycle
  const slides = [...wrap.querySelectorAll(".s")];
  if (slides.length < 2) return;
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove("on");
    i = (i + 1) % slides.length;
    slides[i].classList.add("on");
  }, 6000);
}

document.addEventListener("DOMContentLoaded", () => {
  buildHeader();
  buildFooter();
  initHeroCarousel();
});
