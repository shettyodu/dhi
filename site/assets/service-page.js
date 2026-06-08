/* =====================================================================
   Renders a DHI vertical service sub-page from SERVICE_CONTENT.
   Each service page sets window.PAGE_SLUG before loading this script.
   Depends on components.js (VERTICALS, icon) and service-data.js.
   ===================================================================== */

(function () {
  const slug = window.PAGE_SLUG;
  // Per Steve's feedback, make the automotive section headers larger/more prominent.
  const HSIZE = slug === "automotive.html" ? "text-3xl" : "text-2xl";
  const meta = VERTICALS.find((v) => v.slug === slug);
  const data = SERVICE_CONTENT[slug];
  const mount = document.getElementById("service-root");
  if (!meta || !data || !mount) return;

  const check =
    '<svg class="h-5 w-5 flex-none text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>';
  const infoIcon =
    '<svg class="h-5 w-5 flex-none text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  const explainers = []; // collected from "explainers" sections; opened in a shared modal
  const IN = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200";

  // ----- Sections -----
  function renderSection(s) {
    if (s.type === "prose") {
      return `
        <div>
          <h2 class="${HSIZE} font-bold tracking-tight text-brand-900">${s.heading}</h2>
          ${s.paragraphs.map((p) => `<p class="mt-4 text-lg leading-relaxed text-slate-600">${p}</p>`).join("")}
        </div>`;
    }
    if (s.type === "cards") {
      return `
        <div>
          <h2 class="${HSIZE} font-bold tracking-tight text-brand-900">${s.heading}</h2>
          <div class="mt-6 grid gap-5 sm:grid-cols-2">
            ${s.items
              .map(
                (it) => `
              <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <h3 class="font-semibold text-brand-900">${it.title}</h3>
                <p class="mt-2 text-sm leading-relaxed text-slate-600">${it.desc}</p>
              </div>`
              )
              .join("")}
          </div>
        </div>`;
    }
    if (s.type === "pricing") {
      const flat = s.flat
        ? `<div class="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
             <span class="text-3xl font-extrabold tracking-tight text-brand-900">${s.flat}</span>
             ${s.flatNote ? `<span class="text-sm leading-relaxed text-slate-600">${s.flatNote}</span>` : ""}
           </div>`
        : "";
      const table = (s.columns && s.rows)
        ? `<div class="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
             <table class="w-full border-collapse text-left" style="min-width:540px">
               <thead><tr class="bg-slate-50">
                 <th class="px-4 py-3 text-sm font-semibold text-slate-500">Organization size</th>
                 ${s.columns.map((c) => `<th class="px-4 py-3 text-sm font-bold text-brand-900">${c}</th>`).join("")}
               </tr></thead>
               <tbody>
                 ${s.rows.map((r) => `<tr class="border-t border-slate-100">
                   <td class="px-4 py-3 text-sm font-semibold text-brand-900">${r.label}</td>
                   ${r.cells.map((c) => `<td class="px-4 py-3 text-sm text-slate-700">${c}</td>`).join("")}
                 </tr>`).join("")}
               </tbody>
             </table>
           </div>`
        : "";
      return `
        <div>
          <h2 class="${HSIZE} font-bold tracking-tight text-brand-900">${s.heading}</h2>
          ${s.intro ? `<p class="mt-3 text-lg leading-relaxed text-slate-600">${s.intro}</p>` : ""}
          ${flat}${table}
          ${s.footnote ? `<p class="mt-3 text-xs leading-relaxed text-slate-400">${s.footnote}</p>` : ""}
        </div>`;
    }
    if (s.type === "list") {
      const colCls = s.cols2 ? "sm:grid-cols-2" : "sm:grid-cols-1";
      return `
        <div>
          <h2 class="${HSIZE} font-bold tracking-tight text-brand-900">${s.heading}</h2>
          ${s.intro ? `<p class="mt-3 text-lg text-slate-600">${s.intro}</p>` : ""}
          <ul class="mt-6 grid gap-3 ${colCls}">
            ${s.items
              .map(
                (it) =>
                  `<li class="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3"><span class="mt-0.5">${check}</span><span class="text-slate-700">${it}</span></li>`
              )
              .join("")}
          </ul>
        </div>`;
    }
    if (s.type === "gallery") {
      return `
        <div>
          <h2 class="${HSIZE} font-bold tracking-tight text-brand-900">${s.heading}</h2>
          ${s.intro ? `<p class="mt-3 text-lg text-slate-600">${s.intro}</p>` : ""}
          <div class="mt-6 grid gap-4 sm:grid-cols-3">
            ${s.items
              .map(
                (it) =>
                  `<figure class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                     <div class="flex h-44 items-center justify-center bg-slate-50 p-3"><img src="${it.src}" alt="${it.caption || ""}" loading="lazy" class="max-h-40 w-auto object-contain" /></div>
                     ${it.caption ? `<figcaption class="border-t border-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-600">${it.caption}</figcaption>` : ""}
                   </figure>`
              )
              .join("")}
          </div>
        </div>`;
    }
    if (s.type === "explainers") {
      return `
        <div>
          <h2 class="${HSIZE} font-bold tracking-tight text-brand-900">${s.heading}</h2>
          ${s.intro ? `<p class="mt-3 text-lg text-slate-600">${s.intro}</p>` : ""}
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            ${s.items
              .map((it) => {
                const idx = explainers.push(it) - 1;
                return `
              <button type="button" data-exp="${idx}" class="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
                <span class="mt-0.5">${infoIcon}</span>
                <span class="flex-1">
                  <span class="font-semibold text-brand-900">${it.title}</span>
                  ${it.tag ? `<span class="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">${it.tag}</span>` : ""}
                  <span class="mt-1 block text-sm font-semibold text-cyan-700 group-hover:underline">Learn more &rarr;</span>
                </span>
              </button>`;
              })
              .join("")}
          </div>
        </div>`;
    }
    return "";
  }

  // ----- "Other verticals" cards -----
  const others = VERTICALS.filter((v) => v.slug !== slug).slice(0, 3);
  const othersHtml = others
    .map(
      (v, i) => `
      <a href="${v.slug}" data-reveal="${i * 80}" class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
        <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white transition-colors">${icon(v.icon, "h-5 w-5")}</span>
        <h3 class="mt-4 font-semibold text-brand-900">${v.title}</h3>
        <p class="mt-2 flex-1 text-sm text-slate-600">${v.summary}</p>
        <span class="mt-3 text-sm font-semibold text-cyan-700 group-hover:underline">Explore &rarr;</span>
      </a>`
    )
    .join("");

  const highlightsHtml = (data.highlights || [])
    .map(
      (h) =>
        `<div class="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-0"><dt class="text-sm text-slate-300">${h.k}</dt><dd class="text-right text-sm font-semibold text-white">${h.v}</dd></div>`
    )
    .join("");

  // Optional partner-logo card (real brand assets)
  const partnersHtml = (data.partners && data.partners.length)
    ? `<div class="rounded-2xl border border-slate-200 bg-white p-6">
         <h3 class="text-sm font-semibold uppercase tracking-wider text-cyan-700">Powered by</h3>
         <div class="mt-4 grid gap-3">
           ${data.partners.map((p) =>
             `<div class="flex h-20 items-center justify-center rounded-xl ${p.dark ? "border border-brand-800 bg-brand-900" : "border border-slate-200 bg-white"} p-4">
                <img src="${p.logo}" alt="${p.name}" class="max-h-12 w-auto object-contain" />
              </div>`).join("")}
         </div>
       </div>`
    : "";

  mount.innerHTML = `
  <!-- HERO -->
  <section class="relative overflow-hidden bg-brand-950">
    <div class="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800"></div>
    <div class="absolute inset-0 opacity-20" style="background-image:radial-gradient(circle at 82% 12%, #06b6d4 0, transparent 42%);"></div>
    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
      <nav class="mb-6 flex items-center gap-2 text-sm text-slate-400">
        <a href="index.html" class="hover:text-cyan-300">Home</a><span>/</span>
        <a href="services.html" class="hover:text-cyan-300">Verticals</a><span>/</span>
        <span class="text-slate-200">${meta.title}</span>
      </nav>
      <div class="flex items-start gap-5">
        ${data.heroLogo
          ? `<span class="hidden h-16 flex-none items-center justify-center rounded-2xl bg-white px-4 shadow-sm sm:flex"><img src="${data.heroLogo}" alt="${meta.title}" class="max-h-12 w-auto object-contain" /></span>`
          : `<span class="hidden h-16 w-16 flex-none items-center justify-center rounded-2xl bg-cyan-600/20 text-cyan-300 sm:flex">${icon(meta.icon, "h-8 w-8")}</span>`}
        <div data-reveal="0">
          <p class="kicker text-sm font-semibold uppercase tracking-wider text-cyan-300">DHI Vertical${data.partner ? " &middot; " + data.partner : ""}</p>
          <h1 class="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">${meta.title}</h1>
          <p class="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">${data.lead}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- BODY -->
  <section class="py-16 sm:py-20">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid gap-12 lg:grid-cols-3">
        <div class="space-y-12 lg:col-span-2">
          ${data.sections.map((s, i) => `<div data-reveal="${(i % 2) * 70}">${renderSection(s)}</div>`).join("")}
        </div>
        <aside class="lg:col-span-1" data-reveal="120">
          <div class="sticky top-24 space-y-6">
            <div class="rounded-2xl bg-brand-900 p-6 text-white">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-cyan-300">At a glance</h3>
              <dl class="mt-3">${highlightsHtml}</dl>
            </div>
            ${partnersHtml}
            <div class="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 class="font-semibold text-brand-900">Bring this vertical to your organization</h3>
              <p class="mt-2 text-sm text-slate-600">Deploy it independently or combine it with other DHI verticals as one integrated solution.</p>
              <a href="contact.html" class="mt-4 block rounded-md bg-cyan-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-cyan-700">Request a consultation</a>
              <a href="services.html" class="mt-2 block rounded-md border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-brand-800 hover:bg-slate-50">All verticals</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </section>

  <!-- REQUEST INFO -->
  <section class="border-t border-slate-100 bg-white py-16" data-reveal="0">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <p class="kicker text-sm font-semibold uppercase tracking-wider text-cyan-700">Get started</p>
      <h2 class="mt-2 text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">Bring ${meta.title} to your organization</h2>
      <p class="mt-2 text-slate-600">Tell us about your needs and our team will follow up with options and pricing.</p>
      <form id="vp-inq" class="mt-6 grid gap-3 sm:grid-cols-2">
        <label class="block"><span class="text-sm font-medium text-slate-700">Name</span><input id="vp-name" class="${IN}" /></label>
        <label class="block"><span class="text-sm font-medium text-slate-700">Email</span><input id="vp-email" type="email" class="${IN}" /></label>
        <label class="block"><span class="text-sm font-medium text-slate-700">Organization <span class="text-slate-400">(optional)</span></span><input id="vp-company" class="${IN}" /></label>
        <label class="block"><span class="text-sm font-medium text-slate-700">Phone <span class="text-slate-400">(optional)</span></span><input id="vp-phone" class="${IN}" /></label>
        <label class="block sm:col-span-2"><span class="text-sm font-medium text-slate-700">What are you looking for?</span><textarea id="vp-msg" rows="3" class="${IN}" placeholder="Goals, timeline, scale…"></textarea></label>
        <div class="sm:col-span-2"><button id="vp-submit" type="submit" class="rounded-md bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">Request information</button><span id="vp-status" class="ml-3 text-sm"></span></div>
      </form>
      <div id="vp-result" class="mt-4 hidden"></div>
    </div>
  </section>

  <!-- OTHER VERTICALS -->
  <section class="bg-slate-50 py-16">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-bold tracking-tight text-brand-900">Explore other verticals</h2>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${othersHtml}</div>
    </div>
  </section>`;

  // ----- Explainer modal (for "explainers" sections) -----
  if (explainers.length) {
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const modal = document.createElement("div");
    modal.id = "exp-modal";
    modal.className = "fixed inset-0 z-[70] hidden";
    modal.innerHTML = `
      <div data-exp-close class="absolute inset-0 bg-black/50"></div>
      <div class="absolute inset-x-3 top-10 bottom-10 mx-auto max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:inset-x-6">
        <div class="flex items-start justify-between gap-3">
          <h3 id="exp-title" class="font-display text-xl font-bold text-brand-900"></h3>
          <button data-exp-close class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div id="exp-video" class="mt-4"></div>
        <p id="exp-what" class="mt-4 leading-relaxed text-slate-600"></p>
        <div id="exp-covers" class="mt-4"></div>
        <div id="exp-why" class="mt-4 rounded-xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-900"></div>
        <p class="mt-4 text-xs text-slate-400">Coverage, limits, exclusions, and pricing are confirmed in your agreement before purchase. Availability varies by state and lender.</p>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.classList.add("hidden");
    function open(it) {
      modal.querySelector("#exp-title").textContent = it.title;
      modal.querySelector("#exp-video").innerHTML = it.video
        ? `<div class="aspect-video w-full overflow-hidden rounded-xl bg-black"><iframe class="h-full w-full" src="${esc(it.video)}" title="${esc(it.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
        : `<div class="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-400"><svg class="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z"/></svg>Video explainer coming soon</div>`;
      modal.querySelector("#exp-what").textContent = it.what || "";
      modal.querySelector("#exp-covers").innerHTML = (it.covers && it.covers.length)
        ? `<p class="text-xs font-semibold uppercase tracking-wider text-slate-400">What it covers</p><ul class="mt-2 space-y-1.5">${it.covers.map((c) => `<li class="flex items-start gap-2 text-sm text-slate-600"><span class="mt-0.5 text-cyan-600">${check}</span><span>${esc(c)}</span></li>`).join("")}</ul>`
        : "";
      modal.querySelector("#exp-why").innerHTML = `<span class="font-semibold">Why it matters:</span> ${esc(it.why || "")}`;
      modal.classList.remove("hidden");
    }
    mount.querySelectorAll("[data-exp]").forEach((btn) => btn.addEventListener("click", () => open(explainers[+btn.dataset.exp])));
    modal.querySelectorAll("[data-exp-close]").forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  // ----- Per-vertical "Request information" → submit-lead (Blobs + HubSpot) -----
  (function () {
    const form = document.getElementById("vp-inq");
    if (!form) return;
    const API_BASE = (new URLSearchParams(location.search).get("api") || localStorage.getItem("dhi_api_base") || "").replace(/\/+$/, "");
    const g = (id) => document.getElementById(id);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = g("vp-name").value.trim(), email = g("vp-email").value.trim();
      const status = g("vp-status"), btn = g("vp-submit"), result = g("vp-result");
      if (!name || !email) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Name and email are required."; return; }
      btn.disabled = true; status.className = "ml-3 text-sm text-slate-500"; status.textContent = "Sending…";
      try {
        const r = await fetch(API_BASE + "/.netlify/functions/submit-lead", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "inquiry", name, email, phone: g("vp-phone").value.trim(), company: g("vp-company").value.trim(), message: g("vp-msg").value.trim(), vertical: meta.title, source: "DHI · " + meta.title }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.ok) {
          status.textContent = ""; form.classList.add("hidden");
          result.className = "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700";
          result.innerHTML = `<p class="font-semibold text-emerald-700">Thanks — we'll be in touch.</p><p class="mt-1">Reference: <span class="font-mono text-xs">${d.id}</span></p>`;
          result.classList.remove("hidden");
        } else { status.className = "ml-3 text-sm text-red-600"; status.textContent = d.error || ("Couldn't send (HTTP " + r.status + ")."); }
      } catch (err) { status.className = "ml-3 text-sm text-red-600"; status.textContent = "Network error — please try again."; }
      finally { btn.disabled = false; }
    });
  })();

  // Set document title dynamically
  document.title = `${meta.title} — Digital Health International Inc.`;
})();
