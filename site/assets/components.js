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
  // Canonical site URL (for SEO/OG tags + sitemap). CHANGE this when the custom
  // domain (e.g. https://digitalhealthinternational.com) goes live.
  baseUrl: "https://digitalhealthinternational.com",
  // Ad / analytics IDs — leave blank until you have them; pixels inject only when set.
  analytics: { ga4: "", metaPixel: "", linkedinPartnerId: "", googleAdsId: "" },
};

/* The verticals / service sub-pages. Order drives the Services menu,
   the services hub grid, and the footer. */
const VERTICALS = [
  {
    slug: "aicore.html",
    title: "AICORE Datacenter",
    menu: "AICORE Datacenter",
    summary:
      "Quantum-ready, end-to-end data center solutions — planning, construction, power, cooling, racks, compute, agentic AI, managed operations, and lifecycle support. One partner, every stage.",
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
    slug: "supplies.html",
    title: "Supplies, Textiles & Linens",
    menu: "Supplies, Textiles & Linens",
    summary:
      "Hospital-grade textiles, linens, and consumables focused on quality, durability, and infection control.",
    icon: "layers",
  },
  {
    slug: "supply-spend-check.html",
    title: "SupplyScope",
    menu: "SupplyScope — Price Intelligence",
    summary:
      "AI supply-price benchmarking — see where you're overpaying, capture the savings, and source at DHI pricing. Free to run.",
    icon: "chart",
    store: { slug: "supplies-store.html", label: "Shop the DHI Supplies store" },
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
    slug: "automotive.html",
    title: "AutoCommand AI Marketplace",
    menu: "AutoCommand AI Marketplace",
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
  {
    slug: "insurance.html",
    title: "Insurance & Risk Solutions",
    menu: "Insurance & Risk Solutions",
    summary:
      "Health, supplemental, and specialty insurance with carriers and brokers — including the ITH SmartCare access plans.",
    icon: "umbrella",
  },
  {
    slug: "wellness.html",
    title: "Wellness & Digital Care",
    menu: "Wellness & Digital Care",
    summary:
      "GenieMD telehealth and remote care plus Cognifit cognitive health — a unified, white-label virtual care platform.",
    icon: "heart",
    soon: "2027",
  },
];

/* Parent categories used as an index into the twelve verticals (home page).
   Each vertical maps to exactly one category via VERTICAL_CAT_BY_SLUG. */
const VERTICAL_CATEGORIES = [
  { id: "tech", label: "Technology & Data", blurb: "AI-ready data centers & solutions and cybersecurity & infrastructure.", icon: "cube" },
  { id: "medical", label: "Medical & Care", blurb: "Hospital supplies, textiles & linens and insurance & risk — with wellness/telehealth and medical equipment coming 2027.", icon: "pulse" },
  { id: "energy", label: "Energy & Mobility", blurb: "Lighting & energy efficiency and the AutoCommand AI vehicle marketplace.", icon: "bolt" },
  { id: "gov", label: "Government & Procurement", blurb: "SAM.gov-ready contracting and public-sector modernization.", icon: "building" },
];
const VERTICAL_CAT_BY_SLUG = {
  "aicore.html": "tech", "cybersecurity.html": "tech",
  "supplies.html": "medical", "supply-spend-check.html": "medical", "insurance.html": "medical", "wellness.html": "medical",
  "lighting.html": "energy", "automotive.html": "energy",
  "government.html": "gov",
};

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

  const serviceItems = VERTICALS.flatMap(
    (v) => {
      const rows = [
        `<a href="${v.slug}" class="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 group">
         <span class="mt-0.5 text-cyan-600 group-hover:text-cyan-700">${icon(v.icon, "h-5 w-5")}</span>
         <span>
           <span class="block text-sm font-semibold text-brand-900">${v.menu}${v.soon ? ` <span class="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">Coming ${v.soon}</span>` : ""}</span>
           <span class="block text-xs text-slate-500 leading-snug">${v.summary}</span>
         </span>
       </a>`,
      ];
      if (v.store)
        rows.push(
          `<a href="${v.store.slug}" class="flex items-center gap-3 rounded-lg py-2 pl-11 pr-3 hover:bg-slate-50 group">
         <span class="text-sm font-semibold text-cyan-700 group-hover:text-cyan-800">${v.store.label} &rarr;</span>
       </a>`
        );
      return rows;
    }
  ).join("");

  const mobileServiceItems = VERTICALS.flatMap(
    (v) => {
      const rows = [
        `<a href="${v.slug}" class="block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-brand-800">${v.menu}${v.soon ? ` <span class="text-xs font-semibold uppercase text-amber-600">· Coming ${v.soon}</span>` : ""}</a>`,
      ];
      if (v.store)
        rows.push(
          `<a href="${v.store.slug}" class="block rounded-md py-2 pl-6 pr-3 text-sm font-semibold text-cyan-700 hover:bg-slate-50 hover:text-cyan-800">${v.store.label} &rarr;</a>`
        );
      return rows;
    }
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
        ${link("portal.html", "Account")}
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
      <a href="portal.html" class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Account</a>
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
        `<li><a href="${v.slug}" class="text-slate-300 hover:text-cyan-400 transition-colors">${v.title}${v.soon ? ` <span class="text-xs font-semibold uppercase text-amber-500">· ${v.soon}</span>` : ""}</a></li>`
    )
    .join("");
  const col2 = VERTICALS.slice(5)
    .map(
      (v) =>
        `<li><a href="${v.slug}" class="text-slate-300 hover:text-cyan-400 transition-colors">${v.title}${v.soon ? ` <span class="text-xs font-semibold uppercase text-amber-500">· ${v.soon}</span>` : ""}</a></li>`
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
          Nine verticals. One global platform. Unifying data, energy, healthcare, and enterprise into a single integrated ecosystem — anywhere in the world.
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

/* ---------------------------------------------------------------------------
   Motion system (global, opt-in, no-JS-safe):
   - elements with [data-reveal] fade/rise in on scroll (stagger via the value, ms)
   - elements with [data-countup] animate their number when scrolled into view
   - a `.kicker` class renders mono-accent eyebrow labels
   Content is fully visible if JS is off or prefers-reduced-motion is set.
   --------------------------------------------------------------------------- */
function initMotion() {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!document.getElementById("dhi-motion-style")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap";
    document.head.appendChild(link);
    const st = document.createElement("style");
    st.id = "dhi-motion-style";
    st.textContent =
      ".kicker{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}" +
      "html.reveal-on [data-reveal]{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);will-change:opacity,transform}" +
      "html.reveal-on [data-reveal].in{opacity:1;transform:none}" +
      "@media (prefers-reduced-motion:reduce){html.reveal-on [data-reveal]{opacity:1;transform:none;transition:none}}";
    document.head.appendChild(st);
  }

  const reveals = [...document.querySelectorAll("[data-reveal]")];
  const counts = [...document.querySelectorAll("[data-countup]")];

  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
    return;
  }

  document.documentElement.classList.add("reveal-on");
  const ro = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.transitionDelay = (parseFloat(e.target.getAttribute("data-reveal")) || 0) + "ms";
      e.target.classList.add("in");
      ro.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  reveals.forEach((el) => ro.observe(el));

  const co = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); co.unobserve(e.target); } });
  }, { threshold: 0.5 });
  counts.forEach((el) => co.observe(el));
}

function countUp(el) {
  const raw = (el.getAttribute("data-countup") || el.textContent || "").trim();
  const m = raw.match(/^(\D*)([\d,.]+)(.*)$/);
  if (!m) return;
  const prefix = m[1], suffix = m[3];
  const target = parseFloat(m[2].replace(/,/g, ""));
  if (isNaN(target)) return;
  const big = target >= 1000, dur = 1100, t0 = performance.now();
  const fmt = (n) => (big ? Math.round(n).toLocaleString("en-US") : Math.round(n).toString());
  (function tick(now) {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = prefix + fmt(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = prefix + fmt(target) + suffix;
  })(t0);
}

/* ---------------------------------------------------------------------------
   Site-wide AI assistant — a floating chat widget backed by /chat.
   Answers DHI/AutoCommand questions, routes to pages, nudges lead capture.
   Degrades to a friendly "use a Request info form" message if the backend
   isn't configured. Conversation lives in memory only.
   --------------------------------------------------------------------------- */
function initChatWidget() {
  if (document.getElementById("dhi-chat-btn")) return;
  const API_BASE = (new URLSearchParams(location.search).get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const btn = document.createElement("button");
  btn.id = "dhi-chat-btn";
  btn.setAttribute("aria-label", "Open DHI Assistant");
  btn.className = "fixed bottom-5 right-5 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-700";
  btn.innerHTML = '<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  const panel = document.createElement("div");
  panel.id = "dhi-chat-panel";
  panel.className = "fixed bottom-24 right-5 z-[90] hidden w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl";
  panel.style.height = "28rem"; panel.style.maxHeight = "70vh";
  panel.innerHTML = `
    <div class="flex items-center justify-between bg-brand-900 px-4 py-3 text-white">
      <div><p class="text-sm font-semibold">DHI Assistant</p><p class="text-xs text-slate-300">Ask about our solutions</p></div>
      <button id="dhi-chat-close" aria-label="Close" class="rounded-full p-1 text-slate-300 hover:bg-white/10 hover:text-white"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div id="dhi-chat-msgs" class="flex-1 space-y-3 overflow-y-auto p-4 text-sm"></div>
    <form id="dhi-chat-form" class="flex items-center gap-2 border-t border-slate-200 p-3">
      <input id="dhi-chat-in" autocomplete="off" placeholder="Ask a question…" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
      <button class="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700">Send</button>
    </form>`;
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const msgs = panel.querySelector("#dhi-chat-msgs");
  const input = panel.querySelector("#dhi-chat-in");
  const convo = [];
  let greeted = false;

  function bubble(role, text) {
    const wrap = document.createElement("div");
    wrap.className = role === "user" ? "flex justify-end" : "flex justify-start";
    const b = document.createElement("div");
    b.className = (role === "user" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700") + " max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed";
    b.innerHTML = esc(text).replace(/\n/g, "<br>");
    wrap.appendChild(b); msgs.appendChild(wrap); msgs.scrollTop = msgs.scrollHeight;
    return b;
  }
  function toggle(open) {
    const show = open === undefined ? panel.classList.contains("hidden") : open;
    panel.classList.toggle("hidden", !show);
    panel.classList.toggle("flex", show);
    if (show && !greeted) { greeted = true; bubble("assistant", "Hi! I'm the DHI Assistant. Ask me about our verticals, AutoCommand, the Vehicle Passport, or how to get started."); input.focus(); }
  }
  btn.addEventListener("click", () => toggle());
  panel.querySelector("#dhi-chat-close").addEventListener("click", () => toggle(false));

  panel.querySelector("#dhi-chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = ""; bubble("user", text); convo.push({ role: "user", content: text });
    const typing = bubble("assistant", "…");
    try {
      const r = await fetch(API_BASE + "/.netlify/functions/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: convo }) });
      const d = await r.json().catch(() => ({}));
      const reply = r.ok && d.reply ? d.reply : (d.error || "Sorry — I'm having trouble. Please use a Request information form or email steve@digitalhealthinternational.com.");
      typing.innerHTML = esc(reply).replace(/\n/g, "<br>");
      if (r.ok && d.reply) convo.push({ role: "assistant", content: d.reply });
      msgs.scrollTop = msgs.scrollHeight;
    } catch (err) { typing.textContent = "Network error — please try again."; }
  });
}

/* -------- Campaign / influencer attribution + focused landing mode --------
   - Captures ?ref (influencer code) and utm_* params and persists them for the
     session, so any lead form can attach them (window.DHIAttribution()).
   - "Focused mode": when a link carries ?ref or ?lp=1, the full nav menu is
     hidden so the visitor stays on the promoted offer until they're done.
   - Injects ad/analytics pixels only when SITE.analytics IDs are configured. */
function injectAnalytics() {
  const a = (SITE && SITE.analytics) || {};
  if (a.ga4 && !window.__ga4) {
    window.__ga4 = true;
    const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + a.ga4; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date()); gtag("config", a.ga4); if (a.googleAdsId) gtag("config", a.googleAdsId);
  }
  if (a.metaPixel && !window.__fbq) {
    window.__fbq = true;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", a.metaPixel); fbq("track", "PageView");
  }
}
function initCampaign() {
  const qs = new URLSearchParams(location.search);
  try {
    const ref = qs.get("ref"); if (ref) localStorage.setItem("dhi_ref", ref.slice(0, 64));
    const utm = {}; ["source", "medium", "campaign", "content", "term"].forEach((k) => { const v = qs.get("utm_" + k); if (v) utm[k] = v.slice(0, 120); });
    if (Object.keys(utm).length) localStorage.setItem("dhi_utm", JSON.stringify(utm));
  } catch (e) { /* storage disabled */ }
  window.DHIAttribution = function () {
    let ref = "", utm = {};
    try { ref = localStorage.getItem("dhi_ref") || ""; utm = JSON.parse(localStorage.getItem("dhi_utm") || "{}"); } catch (e) {}
    return { ref: ref, utm: utm };
  };
  if (qs.get("ref") || qs.get("lp") === "1") {
    document.body.classList.add("lp-mode");
    if (!document.getElementById("dhi-lp-style")) {
      const st = document.createElement("style"); st.id = "dhi-lp-style";
      st.textContent = ".lp-mode header nav,.lp-mode #mobile-btn,.lp-mode #mobile-menu{display:none!important}.lp-mode [data-lp-hide]{display:none!important}";
      document.head.appendChild(st);
    }
  }
  injectAnalytics();
}

/* ---- SEO: inject canonical + Open Graph + Twitter + JSON-LD on every page ----
   Pages may provide their own static og:* tags (better for social scrapers);
   this only fills in what's missing, so Google + most platforms get full meta. */
function initSEO() {
  const head = document.head;
  const base = (SITE.baseUrl || location.origin).replace(/\/+$/, "");
  const path = location.pathname.replace(/\/index\.html$/, "/");
  const url = base + (path === "/" || path === "" ? "/" : path);
  const title = document.title || SITE.name;
  const descEl = document.querySelector('meta[name="description"]');
  const desc = (descEl && descEl.content) || "Digital Health International — connecting healthcare, technology, infrastructure & global markets across multiple specialized verticals.";
  const img = base + "/assets/img/banner.jpg";
  const m = (a, k, v) => { const e = document.createElement("meta"); e.setAttribute(a, k); e.setAttribute("content", v); head.appendChild(e); };

  if (!document.querySelector('link[rel="canonical"]')) { const l = document.createElement("link"); l.rel = "canonical"; l.href = url; head.appendChild(l); }
  if (!document.querySelector('meta[property="og:title"]')) {
    m("property", "og:type", "website"); m("property", "og:site_name", SITE.name);
    m("property", "og:title", title); m("property", "og:description", desc);
    m("property", "og:url", url); m("property", "og:image", img);
  }
  if (!document.querySelector('meta[name="twitter:card"]')) {
    m("name", "twitter:card", "summary_large_image"); m("name", "twitter:title", title);
    m("name", "twitter:description", desc); m("name", "twitter:image", img);
  }
  if (!document.getElementById("dhi-jsonld")) {
    const ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "dhi-jsonld";
    ld.textContent = JSON.stringify([
      { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: base + "/", logo: base + "/assets/img/dhi-logo.png", telephone: SITE.phone, address: { "@type": "PostalAddress", streetAddress: "68 Jeans Way", addressLocality: "Benson", addressRegion: "NC", postalCode: "27504", addressCountry: "US" } },
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: base + "/" },
    ]);
    head.appendChild(ld);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCampaign();
  initSEO();
  buildHeader();
  buildFooter();
  initHeroCarousel();
  initMotion();
  initChatWidget();
});
