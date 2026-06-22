/* AutoCommand launch landing pages (data-driven). One template (drive.html)
   renders any of the 9 campaign angles via ?c=<slug>, message-matched to the ad
   the visitor clicked, then funnels into the working Find Vehicle / lead flows.
   Each page carries a "Call Bill" block. Ads should link to drive.html?c=<slug>. */
(function () {
  const FIND = "automotive-find-vehicle.html";
  const CONTACT = "contact.html?interest=Automotive";
  // Bill's direct line for "call about a deal" — CONFIRM before launch.
  const BILL_TEL = "";            // e.g. "+17575550100"; empty hides the call link
  const BILL_TEL_LABEL = "(call line — confirm)";

  // 9 launch angles. headline split into two lines (h1/h2 two-tone); cta funnels in.
  const CAMPAIGNS = {
    value: {
      kicker: "A better way to buy",
      h1: "Car buying.", h2: "Rebuilt around you.",
      sub: "Search. Compare. Finance. Protect. Deliver — a better way to buy a vehicle, built around the buyer, not the dealership.",
      bullets: ["Every make &amp; model", "Clear, upfront pricing", "Human review before you buy", "Delivered to you"],
      cta: "Start my search", href: FIND,
    },
    search: {
      kicker: "One search, more possibilities",
      h1: "One search.", h2: "More possibilities.",
      sub: "Compare more makes, more options, and more vehicles — all in one search.",
      bullets: ["All makes &amp; models", "New, used &amp; certified", "Compare side-by-side", "Save time &amp; money"],
      cta: "Search the marketplace", href: FIND,
    },
    options: {
      kicker: "Everything for ownership, one place",
      h1: "Choose the vehicle.", h2: "Build the right plan.",
      sub: "Everything you need for ownership — financing, protection, accessories, and delivery — all in one place.",
      bullets: ["Financing pathways", "Protection products", "Accessories", "Delivery options"],
      cta: "Explore my options", href: FIND,
    },
    price: {
      kicker: "No back-and-forth",
      h1: "Real prices.", h2: "No back-and-forth.",
      sub: "See real pricing up front and get connected to the selling dealer — no haggling, no games.",
      bullets: ["Upfront pricing", "Verified dealers", "We track your deal", "You stay in control"],
      cta: "See my price", href: FIND,
    },
    tradein: {
      kicker: "Trade-in &amp; sell",
      h1: "Know what", h2: "your car's worth.",
      sub: "Find your trade-in value and roll it into your next vehicle — all in one place.",
      bullets: ["Fast trade estimate", "Apply it to your next car", "No obligation", "Human follow-up"],
      cta: "Get my offer", href: FIND,
    },
    finance: {
      kicker: "Financing that fits",
      h1: "Financing that fits.", h2: "All credit considered.",
      sub: "Flexible financing pathways that fit your budget — explore your options before you shop.",
      bullets: ["All credit considered", "Multiple lenders", "Fits your budget", "Subject to lender approval"],
      cta: "Check my options", href: FIND,
    },
    concierge: {
      kicker: "Done-for-you",
      h1: "Tell us what you want.", h2: "We'll find it.",
      sub: "Describe the vehicle you want and we'll line it up for you — concierge car buying, built around you.",
      bullets: ["Tell us your must-haves", "We do the searching", "Clear pricing", "Human review"],
      cta: "Start my request", href: FIND,
    },
    promise: {
      kicker: "Trust built on experience",
      h1: "The", h2: "Dr. Bill Promise.",
      sub: "A customer-first commitment shaped by years of collaboration with top providers and dealers across the automotive industry.",
      bullets: ["Decades of industry insight", "Direct impact on service", "Trusted relationships", "Guidance buyers can trust"],
      cta: "Experience the promise", href: FIND,
    },
    lifecycle: {
      kicker: "Only the beginning",
      h1: "Your purchase is", h2: "only the beginning.",
      sub: "The household mobility system for today — and every mile ahead. Manage your vehicles, reminders, and your next purchase in one place.",
      bullets: ["Manage your vehicles", "Service &amp; protection reminders", "Plan your next vehicle", "Support for your whole household"],
      cta: "Join the experience", href: "portal.html",
    },
  };
  const ORDER = ["value", "search", "options", "price", "tradein", "finance", "concierge", "promise", "lifecycle"];

  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  function callBillBlock() {
    const tel = BILL_TEL
      ? `<a href="tel:${BILL_TEL}" class="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800">&#128222; Call Bill ${BILL_TEL_LABEL}</a>`
      : `<span class="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-5 py-3 text-sm font-semibold text-white opacity-90">&#128222; Call Bill — ${BILL_TEL_LABEL}</span>`;
    return `<div class="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 class="font-display text-lg font-bold text-brand-900">Questions about a deal? Talk to Bill.</h3>
      <p class="mt-1 text-sm text-slate-600">Get a real person on the phone — Bill walks you through pricing, financing, and your options. No pressure.</p>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        ${tel}
        <a href="${CONTACT}&topic=call-bill" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-brand-800 hover:bg-slate-50">Prefer we call you? Request a callback &rarr;</a>
      </div>
    </div>`;
  }

  function render() {
    const slug = (qs.get("c") || "value").toLowerCase();
    const c = CAMPAIGNS[slug] || CAMPAIGNS.value;
    document.title = `${c.h1} ${c.h2} | AutoCommand`;
    const host = $("camp"); if (!host) return;
    host.innerHTML = `
      <section class="relative overflow-hidden bg-brand-950">
        <div class="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800"></div>
        <div class="absolute inset-0 opacity-20" style="background-image:radial-gradient(circle at 85% 12%, #06b6d4 0, transparent 40%), radial-gradient(circle at 8% 92%, #14b8a6 0, transparent 42%);"></div>
        <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p class="kicker text-sm font-semibold uppercase tracking-wider text-cyan-300">${c.kicker}</p>
          <h1 class="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">${c.h1}<br /><span class="text-cyan-300">${c.h2}</span></h1>
          <p class="mt-5 max-w-2xl text-lg text-slate-300">${c.sub}</p>
          <ul class="mt-6 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            ${c.bullets.map((b) => `<li class="flex items-center gap-2 text-sm text-slate-200"><svg class="h-4 w-4 flex-none text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>${b}</li>`).join("")}
          </ul>
          <div class="mt-8 flex flex-wrap gap-3">
            <a href="${c.href}" class="rounded-xl bg-cyan-500 px-7 py-3.5 text-base font-bold text-brand-950 shadow-lg transition hover:bg-cyan-400">${c.cta} &rarr;</a>
            <a href="${FIND}" class="rounded-xl border border-white/30 px-7 py-3.5 text-base font-semibold text-white hover:bg-white/10">Browse vehicles</a>
          </div>
        </div>
      </section>
      <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        ${callBillBlock()}
        <p class="mt-8 text-xs text-slate-400">AutoCommand connects buyers with vehicles and verified dealers. Financing is subject to lender approval; dealer participation subject to verification. We do not take payment for vehicles.</p>
      </main>`;
  }

  // expose the slug list for a simple internal index (drive.html?index=1)
  if (qs.get("index")) {
    const host = $("camp");
    if (host) host.innerHTML = `<main class="mx-auto max-w-3xl px-6 py-16"><h1 class="font-display text-2xl font-bold text-brand-900">AutoCommand launch landing pages</h1><ul class="mt-4 space-y-2">${ORDER.map((s) => `<li><a class="text-cyan-700 hover:underline" href="drive.html?c=${s}">drive.html?c=${s}</a> — ${CAMPAIGNS[s].h1} ${CAMPAIGNS[s].h2}</li>`).join("")}</ul></main>`;
  } else {
    if (document.readyState !== "loading") render(); else document.addEventListener("DOMContentLoaded", render);
  }
})();
