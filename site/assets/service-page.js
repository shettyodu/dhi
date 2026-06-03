/* =====================================================================
   Renders a DHI vertical service sub-page from SERVICE_CONTENT.
   Each service page sets window.PAGE_SLUG before loading this script.
   Depends on components.js (VERTICALS, icon) and service-data.js.
   ===================================================================== */

(function () {
  const slug = window.PAGE_SLUG;
  const meta = VERTICALS.find((v) => v.slug === slug);
  const data = SERVICE_CONTENT[slug];
  const mount = document.getElementById("service-root");
  if (!meta || !data || !mount) return;

  const check =
    '<svg class="h-5 w-5 flex-none text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>';

  // ----- Sections -----
  function renderSection(s) {
    if (s.type === "prose") {
      return `
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-brand-900">${s.heading}</h2>
          ${s.paragraphs.map((p) => `<p class="mt-4 text-lg leading-relaxed text-slate-600">${p}</p>`).join("")}
        </div>`;
    }
    if (s.type === "cards") {
      return `
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-brand-900">${s.heading}</h2>
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
    if (s.type === "list") {
      const colCls = s.cols2 ? "sm:grid-cols-2" : "sm:grid-cols-1";
      return `
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-brand-900">${s.heading}</h2>
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
          <h2 class="text-2xl font-bold tracking-tight text-brand-900">${s.heading}</h2>
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
    return "";
  }

  // ----- "Other verticals" cards -----
  const others = VERTICALS.filter((v) => v.slug !== slug).slice(0, 3);
  const othersHtml = others
    .map(
      (v) => `
      <a href="${v.slug}" class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
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
        <span class="hidden h-16 w-16 flex-none items-center justify-center rounded-2xl bg-cyan-600/20 text-cyan-300 sm:flex">${icon(meta.icon, "h-8 w-8")}</span>
        <div>
          <p class="text-sm font-semibold uppercase tracking-wider text-cyan-300">DHI Vertical${data.partner ? " &middot; " + data.partner : ""}</p>
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
          ${data.sections.map(renderSection).join("")}
        </div>
        <aside class="lg:col-span-1">
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

  <!-- OTHER VERTICALS -->
  <section class="bg-slate-50 py-16">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 class="text-2xl font-bold tracking-tight text-brand-900">Explore other verticals</h2>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${othersHtml}</div>
    </div>
  </section>`;

  // Set document title dynamically
  document.title = `${meta.title} — Digital Health International Inc.`;
})();
