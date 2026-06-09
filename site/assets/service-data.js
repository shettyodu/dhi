/* =====================================================================
   Detailed content for each DHI vertical service sub-page.
   Rendered by service-page.js. Keys match VERTICALS slugs.
   Section types: "prose" | "cards" | "list"
   ===================================================================== */

const SERVICE_CONTENT = {
  "decentralized-software.html": {
    partner: "Quantum-ready informatics",
    lead:
      "DHI delivers EMR/EHR and health-data platforms built on distributed, quantum-ready infrastructure. Open APIs and modular design enable efficient integration with hospitals, clinics, payers, employers, and government systems.",
    highlights: [
      { k: "Architecture", v: "100% modular & mobile" },
      { k: "Data", v: "Paper-to-digital, any source" },
      { k: "Security", v: "Blockchain & cryptography" },
    ],
    sections: [
      {
        type: "prose",
        heading: "Quantum transformation for the world",
        paragraphs: [
          "A 100% modular, mobile, and private informatics platform designed for modern needs — bringing every data source into a single secure system and democratizing access for all constituents.",
        ],
      },
      {
        type: "cards",
        heading: "Platform capabilities",
        items: [
          { title: "Paper-to-digital informatics", desc: "An informatics system that ingests data from any source — paper or digital." },
          { title: "AI-driven OCR", desc: "Strong AI-driven OCR that matches forms directly to database fields." },
          { title: "Quantum (FAST) application", desc: "A quantum application that democratizes data to all constituents." },
          { title: "Secure data fabric", desc: "Ties data systems together via blockchain or any other cryptography." },
          { title: "Advanced analytics", desc: "Unheard-of analytics capability to find trends, causes, and other concerns." },
          { title: "Native video", desc: "Built-in video for telemedicine and other humanistic measures." },
        ],
      },
      {
        type: "prose",
        heading: "Built for trust & compliance",
        paragraphs: [
          "A blockchain-ready EHR and care-management layer with a governed \"trust fabric\" — aligned to HIPAA, GDPR, and NIST 800-53, and ready for Ministry-of-Health and data-residency requirements abroad.",
          "Deploy the full platform (DHI + CCG + GenieMD), infrastructure only (Titan modules, powered by CCG), or virtual care only (DHI-branded telehealth, powered by GenieMD) — engaged through a four-step path: Discovery, assessment, focused pilot, and phased scale-up.",
        ],
      },
    ],
  },

  "cybersecurity.html": {
    partner: "CyberFortify · PipIQ · Titan",
    partners: [
      { name: "Titan", logo: "assets/img/partners/titan.png", dark: true },
      { name: "CyberFortify", logo: "assets/img/partners/cyberfortify.png", dark: true },
    ],
    lead:
      "DHI integrates security and compliance into every layer of the platform — from secure communication and data discovery to AI-driven protection for healthcare and enterprise environments.",
    highlights: [
      { k: "Coverage", v: "Users, email, endpoints, cloud, networks" },
      { k: "For", v: "Healthcare & enterprise" },
      { k: "SMB", v: "PipIQ — AI security for SMBs" },
      { k: "Delivery", v: "Managed, white-label & OEM" },
    ],
    sections: [
      {
        type: "cards",
        heading: "Security built into every layer",
        items: [
          { title: "Titan modules", desc: "Data discovery, protection, and secure communication across the organization." },
          { title: "PipIQ", desc: "An AI-driven cybersecurity platform tailored for small to mid-size businesses." },
          { title: "Full-surface coverage", desc: "Protection for users, email, endpoints, cloud workloads, and networks." },
          { title: "Compliance-aligned reporting", desc: "Audit trails and reporting for healthcare and enterprise clients." },
          { title: "Device & EMR hardening", desc: "Medical-device cybersecurity plus telehealth and EMR hardening and monitoring." },
          { title: "Flexible delivery", desc: "Fully managed, white-label, and OEM options through the DHI platform." },
        ],
      },
      {
        type: "prose",
        heading: "PipIQ — your private intelligence platform",
        paragraphs: [
          "PipIQ is a private, branded AI platform purpose-built for small and mid-size businesses — trained exclusively on your own policies, handbooks, and playbooks so your team gets accurate, on-brand answers without sending sensitive data to public AI tools.",
          "It directly addresses the hidden risk of “shadow AI”: industry research shows most employees already use AI at work, many without authorization, and nearly half have uploaded sensitive company data to public platforms. PipIQ keeps that intelligence private by design.",
          "Delivered fully managed, white-label, or OEM through the DHI platform, PipIQ pairs with CyberFortify and the Titan data layer for full-surface protection across users, email, endpoints, cloud workloads, and networks — with continuous monitoring and compliance-aligned reporting.",
        ],
      },
      {
        type: "pricing",
        heading: "PipIQ pricing — one flat rate",
        intro: "Private, branded AI protection with simple, predictable pricing — no surprises.",
        flat: "$995 / month",
        flatNote: "One flat rate for your entire organization (up to 1,000 employees). No per-employee charges, no hidden costs, and no add-on fees — every PipIQ feature included.",
      },
      {
        type: "prose",
        heading: "Healthcare-grade protection at any scale",
        paragraphs: [
          "AI-driven cyber protections safeguard sensitive data and networks across regulated industries — from large health systems to smaller clinics — combining CyberFortify and PipIQ with the Titan data layer.",
        ],
      },
      {
        type: "cards",
        heading: "The Titan suite (built with CCG)",
        items: [
          { title: "Titan Discover", desc: "AI that classifies, digitizes, and indexes unstructured data with 99%+ accuracy and sub-millisecond processing — with automatic redaction, masking, and tokenization across DICOM, PDF, and paper." },
          { title: "Titan Protect", desc: "AI-driven anti-ransomware with real-time access monitoring and per-element, blockchain-grade encryption." },
          { title: "Titan Connect", desc: "Native iOS/Android apps and secure clinic/pharmacy kiosks that let patients grant and revoke access to their health data." },
          { title: "Titan Analytics", desc: "Quantum-grade analytics on redacted/synthetic data with federated learning — insight without exposing PHI." },
        ],
      },
      {
        type: "cards",
        heading: "Flexible deployment options",
        items: [
          { title: "Full platform", desc: "DHI + CCG + GenieMD — the complete data, security, and virtual-care stack. Best for systems modernizing end to end." },
          { title: "Infrastructure only", desc: "DHI Titan modules, powered by CCG — drop the secure data fabric into your existing environment." },
          { title: "Virtual care only", desc: "DHI-branded telehealth, powered by GenieMD — add white-labeled virtual care without re-platforming." },
        ],
      },
      {
        type: "cards",
        heading: "CyberFortify — managed security (MSSP)",
        intro: "Right-sized managed detection and protection in three tiers, scaled to your organization — typically far less than the $72k–$100k cost of a single in-house security hire.",
        items: [
          { title: "Basic", desc: "Core monitoring, endpoint protection, and compliance-aligned reporting for small teams." },
          { title: "Standard", desc: "Adds proactive threat detection, email/cloud coverage, and a dedicated representative." },
          { title: "Premium", desc: "Full-surface managed protection with priority response — multi-tenant single dashboard, white-label, and bundled coverage." },
        ],
      },
      {
        type: "pricing",
        heading: "CyberFortify pricing",
        intro: "Enterprise-grade managed security at predictable monthly rates, scaled to your organization.",
        columns: ["Basic", "Standard", "Premium"],
        rows: [
          { label: "Small (10 users)", cells: ["$1,750 / mo", "$2,250 / mo", "$2,750 / mo"] },
          { label: "Medium (50 users)", cells: ["$7,750 / mo", "$10,250 / mo", "$12,750 / mo"] },
          { label: "Large (100 users)", cells: ["$14,500 / mo", "$19,500 / mo", "$24,500 / mo"] },
        ],
        footnote: "Volume discounts available for larger organizations. For reference, a single in-house security hire typically costs $72,000–$100,000/year plus benefits — without the same tools or 24/7 coverage.",
      },
      {
        type: "prose",
        heading: "Engagement & proof",
        paragraphs: [
          "We engage in four steps — Discovery, technical &amp; business assessment, a focused pilot, then phased scale-up — aligned to HIPAA, GDPR, and NIST 800-53.",
          "Titan Protect and Connect have been deployed at scale across large health systems including Vanderbilt and SRHO.",
        ],
      },
    ],
  },

  "wellness.html": {
    partner: "GenieMD · Cognifit",
    lead:
      "DHI Provider GenieMD delivers telehealth and remote patient monitoring that can be white-labeled for health systems, employers, and government programs. Patients gain easier access to care while organizations gain better visibility and control.",
    highlights: [
      { k: "Platform", v: "AI-powered unified virtual care" },
      { k: "White-label", v: "Health systems, employers, gov" },
      { k: "Cognitive", v: "Cognifit brain health" },
    ],
    sections: [
      {
        type: "list",
        heading: "GenieMD — AI-powered unified virtual care",
        intro: "A single platform spanning the full continuum of virtual care:",
        items: [
          "Telehealth (AI and human doctors)",
          "Remote monitoring (RPM, RTM, CCM)",
          "Care management",
          "Weight loss using GLP-1 drugs",
          "Longevity programs",
        ],
      },
      {
        type: "prose",
        heading: "CogniFit cognitive health",
        paragraphs: [
          "CogniFit provides validated cognitive assessment and training tools that support brain health and performance for individuals and populations, integrated with telehealth and analytics. <a class=\"font-semibold text-cyan-700 hover:underline\" href=\"contact.html?interest=Wellness%20%E2%80%93%20CogniFit\">Request a CogniFit assessment demo &rarr;</a>",
        ],
      },
      {
        type: "cards",
        heading: "CogniFit solutions by audience",
        intro: "Brain-training and assessment programs tailored to each market — available as reseller and white-label offerings:",
        items: [
          { title: "Healthcare", desc: "Cognitive assessment and training to support clinical and patient brain-health programs." },
          { title: "Education", desc: "Tools that help schools measure and strengthen students' cognitive skills." },
          { title: "Employee wellness", desc: "Workplace programs to reduce stress and sharpen focus, agility, and resilience." },
          { title: "Science & research", desc: "Validated instruments for studies and population cognitive research." },
          { title: "Athlete performance", desc: "Mental agility and reaction training for competitive and recreational athletes." },
          { title: "White-label", desc: "Branded CogniFit programs you can offer under your own identity." },
        ],
      },
      {
        type: "prose",
        heading: "Corporate wellness",
        paragraphs: [
          "Comprehensive programs that support businesses, schools, and teams in achieving optimal health and productivity — combining virtual care, cognitive performance, and analytics.",
        ],
      },
    ],
  },

  "insurance.html": {
    partner: "Carriers · Brokers · Specialty platforms",
    partners: [
      { name: "Manhattan Life", logo: "assets/img/partners/manhattanlife.png", dark: false },
    ],
    lead:
      "Insure everyone, everywhere. DHI collaborates with carriers, brokers, and specialty platforms — including ManhattanLife, SquareMouth, and Acrisure — to deliver health, supplemental, and specialty insurance designed to improve benefit value, integrate with wellness and care management, and leverage analytics on utilization and outcomes.",
    highlights: [
      { k: "Lines", v: "Health · Supplemental · Specialty" },
      { k: "Markets", v: "Individuals, families & employers" },
      { k: "Approach", v: "Analytics-driven program design" },
    ],
    sections: [
      {
        type: "finder",
        heading: "Find my coverage",
        intro: "Tell us who you're covering and we'll match the right protection — a licensed advisor follows up. No obligation.",
        source: "DHI · Insurance — Find my coverage",
        audiences: [
          { id: "individual", label: "Individual", products: ["Accident", "Dental, Vision & Hearing", "Hospital Indemnity", "Short-Term Care", "Critical Illness, Cancer & Stroke", "Out-of-Pocket (GAP)"] },
          { id: "family", label: "Family", products: ["Accident", "Dental, Vision & Hearing", "Hospital Indemnity", "Critical Illness & Cancer", "Term Life", "Whole Life"] },
          { id: "senior", label: "Senior", products: ["Home Health Care", "Hospital Indemnity", "Short-Term Care", "Dental, Vision & Hearing", "Whole Life", "Fixed Indexed Annuity"] },
          { id: "employer", label: "Employer / Group", products: ["SmartCare group medical (2+ employees)", "Group Accident", "Critical Illness & Cancer", "Disability", "Hospital Indemnity", "Group GAP", "Group Life"] },
          { id: "traveler", label: "Traveler", products: ["Single-trip medical", "Annual multi-trip", "Adventure & sports", "Trip cancellation", "Medical evacuation"] },
        ],
      },
      {
        type: "prose",
        heading: "SmartCare — group medical for small business",
        paragraphs: [
          "Through our partner <strong class=\"text-brand-900\">InsurTech Hub</strong>, DHI offers <strong class=\"text-brand-900\">SmartCare</strong> — a group medical plan built for small businesses with as few as <strong class=\"text-brand-900\">2 employees</strong>, available in all <strong class=\"text-brand-900\">50 states</strong>. SmartCare uses a <strong class=\"text-brand-900\">debt-free design</strong>: no deductibles and no coinsurance, so members avoid surprise out-of-pocket bills.",
          "It's engineered to cost less than comparable traditional major-carrier group plans — often in the <strong class=\"text-brand-900\">20–30%</strong> range in like-for-like comparisons. <a class=\"font-semibold text-cyan-700 hover:underline\" href=\"contact.html?interest=SmartCare%20group%20medical%20quote\">Request a SmartCare group quote &rarr;</a>",
          "<span class=\"text-sm text-slate-500\">SmartCare is offered through licensed partners (InsurTech Hub). Plan availability, benefits, and pricing are subject to eligibility and underwriting and are confirmed by a licensed advisor; savings vary by group and are not guaranteed. This is a request for information, not an offer of coverage.</span>",
        ],
      },
      {
        type: "cards",
        heading: "Why SmartCare",
        items: [
          { title: "Debt-free design", desc: "No deductibles and no coinsurance — members aren't hit with surprise out-of-pocket costs." },
          { title: "Built for small business", desc: "Group coverage for as few as 2 employees." },
          { title: "Nationwide", desc: "Available across all 50 states." },
          { title: "Designed to save", desc: "Engineered to cost less than comparable traditional-carrier group plans (savings vary by group)." },
          { title: "Guided setup", desc: "A licensed advisor handles quoting and enrollment end to end." },
          { title: "Integrated benefits", desc: "Pairs with DHI wellness, supplemental, and analytics for a complete program." },
        ],
      },
      {
        type: "prose",
        heading: "Employer group benefits — ManhattanLife",
        paragraphs: [
          "Through ManhattanLife — 175+ years of experience — DHI offers customizable or turnkey supplemental group benefits for employers from 2 lives to large groups: Accident, Critical Illness &amp; Cancer, Disability, Hospital Indemnity, Group GAP, Group Affordable Choice, and Life. <a class=\"font-semibold text-cyan-700 hover:underline\" href=\"manhattanlife.html\">Explore ManhattanLife employer benefits &rarr;</a>",
        ],
      },
      {
        type: "list",
        heading: "Individual, seniors & families",
        intro: "Coverage tailored to people at every life stage:",
        items: [
          "Accident",
          "Cancer, Heart Attack & Stroke",
          "Dental, Vision & Hearing",
          "Dental, Vision & Hearing Select",
          "Home Health Care",
          "Hospital Indemnity",
          "Out-of-Pocket (GAP)",
          "Short-Term Care",
          "Ancillary Benefits",
        ],
      },
      {
        type: "list",
        heading: "Employer, life & annuity",
        intro: "Group and long-term financial protection products:",
        items: [
          "Employer group products",
          "Term life insurance",
          "Whole life insurance",
          "Annuity overview",
          "Fixed indexed annuity",
        ],
      },
      {
        type: "explainers",
        heading: "Confusing coverage, explained",
        intro: "Plain-English explainers on the products people ask about most — tap any to learn what it is and why it matters.",
        items: [
          {
            title: "Out-of-Pocket (GAP)", tag: "Supplemental",
            what: "GAP coverage helps pay the difference between what your primary health plan covers and what you actually owe — deductibles, copays, and coinsurance — so a covered medical event doesn't blow up your budget.",
            covers: ["Hospital deductibles & copays", "Coinsurance after your plan pays", "Out-of-pocket maximums on covered care"],
            why: "High-deductible plans are everywhere; GAP cushions the out-of-pocket hit so a single ER visit or surgery doesn't become a financial emergency.",
            video: "",
          },
          {
            title: "Hospital Indemnity", tag: "Supplemental",
            what: "Pays a fixed cash benefit directly to you for covered hospital stays and related services — regardless of what your health plan pays.",
            covers: ["Daily / admission cash benefits", "ICU & surgery benefits", "Cash paid directly to you, to use anywhere"],
            why: "Cash you can spend on anything — rent, travel, childcare — while you're not working and the bills pile up.",
            video: "",
          },
          {
            title: "Critical Illness, Cancer & Stroke", tag: "Supplemental",
            what: "Pays a lump-sum cash benefit on diagnosis of a covered serious condition such as cancer, heart attack, or stroke.",
            covers: ["Lump-sum on covered diagnosis", "Use it for treatment, travel, or living costs", "Often available with no medical exam"],
            why: "Major diagnoses bring costs your health plan never touches — lost income, travel to specialists, experimental care. A lump sum gives you options.",
            video: "",
          },
          {
            title: "Short-Term Care", tag: "Senior & family",
            what: "Covers temporary care needs — recovery after surgery, illness, or injury — bridging the gap before long-term care would apply.",
            covers: ["Home health & nursing care", "Assisted-living & facility stays", "Recovery & rehabilitation support"],
            why: "Most people need help recovering long before they need lifelong care — short-term care is more affordable and easier to qualify for.",
            video: "",
          },
          {
            title: "Fixed Indexed Annuity", tag: "Retirement",
            what: "A retirement product that grows tax-deferred, linked to a market index, with a floor that protects your principal from market losses.",
            covers: ["Principal protected from market drops", "Tax-deferred growth", "Optional guaranteed lifetime income"],
            why: "It aims for more upside than a CD with downside protection a stock account can't promise — useful for turning savings into reliable retirement income. Not a security; guarantees are backed by the issuing carrier.",
            video: "",
          },
        ],
      },
      {
        type: "prose",
        heading: "Trip coverage for every adventure",
        paragraphs: [
          "Every adventure is different, and so is the coverage you need. Through our specialty travel partners, DHI offers insurance tailored to your specific trip type — from a serene beach escape to extreme sports.",
        ],
      },
      // TODO (Todd): confirm the Insurance offering model — packaging, target segments, and how plans are presented/quoted. Section below is a sensible default pending that input.
      {
        type: "cards",
        heading: "How coverage is offered",
        intro: "A simple, advisor-guided path from need to bound coverage — for individuals, families, and employers:",
        items: [
          { title: "1 · Tell us who you're covering", desc: "Share whether it's an individual, family, senior, or employer group, plus the protection goals and budget you have in mind." },
          { title: "2 · We design the program", desc: "DHI matches carriers and products — ManhattanLife, SquareMouth, Acrisure and others — into a tailored, analytics-informed plan." },
          { title: "3 · Review & enroll", desc: "Compare options side by side with clear benefits, limits, and pricing, then enroll with guided support." },
          { title: "4 · Ongoing service", desc: "Claims help, renewals, and plan adjustments as needs change — integrated with DHI wellness and care management where relevant." },
        ],
      },
      // TODO (Todd / compliance): confirm specific licensing for the trust strip —
      // states licensed, agency/agent NPN, and carrier appointments — before adding exact figures.
      {
        type: "cards",
        heading: "Licensed, transparent & on your side",
        intro: "How DHI keeps insurance simple and trustworthy:",
        items: [
          { title: "Through licensed carriers & brokers", desc: "Coverage is placed with established, licensed partners — including ManhattanLife, Acrisure, and SquareMouth — never an unlicensed middleman." },
          { title: "A request, not a binding quote", desc: "Everything starts as a no-obligation request; a licensed advisor confirms eligibility, benefits, limits, and pricing before anything is bound." },
          { title: "Your information is protected", desc: "Personal and health details are handled with privacy and security by design across the DHI platform." },
          { title: "Availability varies by state", desc: "Products, benefits, and pricing differ by state and carrier; your advisor confirms what's available where you live." },
        ],
      },
    ],
  },

  "medical-equipment.html": {
    partner: "GPDI — Global Procurement Development Institute, South Korea",
    partners: [
      { name: "GPDI", logo: "assets/img/partners/gpdi.png", dark: false },
    ],
    lead:
      "DHI has formed a strategic global sourcing partnership with GPDI of South Korea, created to help leading Korean manufacturers compete — and win — in complex international tenders. Through GPDI and our broader network, DHI has access to more than 1,200 medical equipment products.",
    highlights: [
      { k: "Catalog", v: "1,200+ products" },
      { k: "Partner", v: "GPDI, South Korea" },
      { k: "Lifecycle", v: "Install · train · maintain" },
    ],
    sections: [
      {
        type: "prose",
        heading: "World-class sourcing, globally vetted",
        paragraphs: [
          "The partnership is led by Professor Man Ki Kim, a globally recognized authority in defense and public procurement. He serves as Program Director for global procurement programs at KAIST Business College and as a Senior Consultant at Yulchon, advising on major projects for the EU, UN, US, multilateral development banks, and national governments.",
          "His experience across Australia, the U.S., the Middle East, Africa, Europe, and Asia ensures DHI clients benefit from best-in-class technology, quality, and pricing from a rigorously vetted global supply chain.",
        ],
      },
      {
        type: "list",
        heading: "Featured 2026 Global Promo solutions",
        intro: "Ten featured products available for direct purchase and large-scale deployment:",
        cols2: true,
        items: [
          "Handheld Ultrasound (Healcerion)",
          "Portable X-ray (Otom)",
          "EEG & PBM Helmet (iMediSync)",
          "Compression Band (RTBIO)",
          "Rehabilitation Equipment (Man&Tel)",
          "Smart ECG Patch (Mezoo)",
          "Knee Phototherapy Device (LTBIO)",
          "Surgical Examination Device (Bio Protech)",
          "Laser Lancing Device (LaMeditech)",
          "Bedside Pulse Oximeter (Charmcare)",
        ],
      },
      {
        type: "cards",
        heading: "Featured device specifications",
        intro: "Key specs from our 2026 Global Promo line — full datasheets and certifications available on request:",
        items: [
          { title: "Sonon handheld ultrasound (Healcerion)", desc: "Wireless probe, 6–12 MHz, 3–6 cm depth, ~260 g; B / CF / M / PW modes; apps from MSK and thorax to breast/thyroid and aesthetics." },
          { title: "MINE ALNU portable X-ray (Otom)", desc: "40–80 kV, ~2.97 kg, safe-distance sensor, pediatric copper filter for low-dose imaging in the field." },
          { title: "iSyncWave EEG & PBM helmet (iMediSync)", desc: "19-channel dry QEEG plus photobiomodulation; screening support for dementia, Parkinson's, TBI, PTSD, ADHD, and depression (PBM therapy not yet FDA-approved)." },
          { title: "HiCardi SmartPatch ECG (Mezoo)", desc: "Wearable patch detecting 17 arrhythmia types; remote monitoring of up to 256 patients." },
          { title: "Rehabilitation trainers (Man&Tel)", desc: "MSBT-10 / 3DBT-33 balance and rehab systems — FDA-listed, with U.S. patent." },
          { title: "ACCURO bedside pulse oximeter (Charmcare)", desc: "Continuous SpO₂ and pulse-rate monitoring for bedside and transport use." },
        ],
      },
      {
        type: "cards",
        heading: "Full lifecycle support",
        items: [
          { title: "Diagnostics & monitoring", desc: "Imaging, monitoring, surgical, and ancillary equipment." },
          { title: "Compliant catalogs", desc: "Global sourcing with public-procurement–ready offerings." },
          { title: "Service & maintenance", desc: "Installation, commissioning, training, and maintenance." },
          { title: "Shipping & delivery", desc: "Coordinated global freight — air, ocean, and door-to-door — with a trusted carrier handling customs clearance and on-site delivery." },
        ],
      },
      {
        type: "gallery",
        heading: "Featured devices",
        intro: "A sample of the diagnostic and monitoring equipment available through our global sourcing network:",
        items: [
          { src: "assets/img/products/med-ultrasound.png", caption: "Handheld Ultrasound (Healcerion)" },
          { src: "assets/img/products/med-sonon.png", caption: "SONON 300C Wireless Ultrasound" },
          { src: "assets/img/products/med-monitor.png", caption: "Vital Signs Patient Monitor" },
        ],
      },
    ],
  },

  "supplies.html": {
    partner: "Sterile surgical disposables · textiles · PPE",
    lead:
      "DHI supplies sterile, single-use surgical gowns, drapes, OT packs, and sterilization wraps — plus hospital-grade textiles, linens, and PPE — from globally certified manufacturing partners. Quality, durability, and infection control with standardized specifications; bulk and OEM options reduce cost and complexity.",
    highlights: [
      { k: "Range", v: "Gowns · drapes · OT packs · wraps" },
      { k: "Drapes", v: "Specialty-specific OT packs" },
      { k: "Standards", v: "CE · ISO 13485 · USFDA · MDSAP" },
    ],
    sections: [
      {
        type: "prose",
        heading: "Shop PPE with live pricing",
        paragraphs: [
          "Browse certified coveralls, isolation &amp; surgical gowns, scrubs, covers, and masks with list pricing — add items to a quote and check out with tax, freight, card, or purchase order. <a class=\"font-semibold text-cyan-700 hover:underline\" href=\"supplies-catalog.html\">Open the supplies &amp; PPE catalog &rarr;</a>",
        ],
      },
      {
        type: "cards",
        heading: "Surgical OT packs & drapes by specialty",
        intro: "Procedure-ready sterile packs and drapes across every major specialty — single-use, standardized, and customizable:",
        items: [
          { title: "General surgery", desc: "Major & Minor OT packs, Laparoscopy, Laparotomy, Lithotomy, ENT, ICU/CVP line, Universal, and kidney-transplant donor/recipient packs." },
          { title: "Cardiac", desc: "CVTS (adult / pediatric / infant), CABG, Angioplasty, Pacemaker/PPI, and Angiography / Cathlab packs — plus femoral & radial drapes." },
          { title: "Orthopedic", desc: "TKR & THR packs, knee & shoulder arthroscopy, lamino-spinal, and Knee-O / Hip-U / Split-U / Bilateral Knee-O drapes." },
          { title: "OB/GYN", desc: "Cesarean, normal-delivery, hysterectomy, hysteroscopy, and perineal packs, with baby receiving/wiping drapes." },
          { title: "Urology & neuro", desc: "TURP packs and drapes; craniotomy and lamino-spinal neuro packs." },
          { title: "Ophthalmic", desc: "Ophthalmic drapes and complete eye-surgery OT packs." },
        ],
      },
      {
        type: "prose",
        heading: "Sterile surgical disposables — globally certified",
        paragraphs: [
          "DHI sources sterile, single-use surgical gowns, drapes, OT packs, and sterilization wraps from globally certified manufacturing partners — including <strong class=\"text-brand-900\">Amaryllis Healthcare</strong> and <strong class=\"text-brand-900\">Mediprro</strong> (Sivshree Medittex) — built to international quality and infection-control standards.",
          "Products are SMS / SMMMS non-woven, AAMI Level 1–4 rated, ultrasonically welded, and EO-sterile, carrying <strong class=\"text-brand-900\">CE (EU MDR 2017/745), ISO 13485, USFDA registration, MDSAP, GMP, and EN 13795</strong> certifications. Gowns and drape kits can be custom-designed by dimension, fabric, and packing, with OEM, white-label, and bulk options.",
        ],
      },
      {
        type: "list",
        heading: "Gowns, scrubs & protective apparel",
        intro: "Sterile and non-sterile garments for staff and patients (AAMI Level 1–4, EN 13795):",
        cols2: true,
        items: [
          "OT surgeon gowns — standard, reinforced & ultrasoft reinforced",
          "Cathlab, anaesthesia & ophthalmic gowns",
          "Isolation gowns (AAMI Level 1–4) & chemotherapy gowns",
          "Scrub suit sets, clean-air suits & lab coats",
          "AAMI Level 3 coveralls (Type 3-B/4-B, 5-B/6-B)",
          "Patient gowns, feeding gowns & disposable jackets/trousers",
        ],
      },
      {
        type: "gallery",
        heading: "Protective apparel",
        items: [
          { src: "assets/img/products/supply-gowns.jpg", caption: "Surgical & isolation gowns" },
          { src: "assets/img/products/supply-coverall.jpg", caption: "AAMI Level 3 coverall" },
        ],
      },
      {
        type: "list",
        heading: "PPE, consumables & equipment covers",
        intro: "High-turn infection-control supplies for facilities and field programs:",
        cols2: true,
        items: [
          "N95 / FFP2 respirators & surgical masks",
          "Face shields & masks with eye shield",
          "Bouffants, headcovers, oversleeves & gloves",
          "Hand sanitizer (bottles, refills, wipes, sticks)",
          "Disposable underpads & spunbond blankets",
          "Sterilization wraps (SMS, multiple sizes) & scrim hand towels",
          "Equipment covers (camera, fluoroscopy, diathermy)",
        ],
      },
      {
        type: "list",
        heading: "Linens & textiles",
        intro: "Precision-engineered institutional fabrics for hygiene and durability:",
        cols2: true,
        items: [
          "Fitted & flat sheets",
          "Duvet & pillow covers",
          "Patient bedding & in-room textiles",
          "Towels and soft consumables",
        ],
      },
      {
        type: "prose",
        heading: "Solving challenges in consumable supply workflows",
        paragraphs: [
          "With the right technology, your health system can achieve the most efficient workflow and documentation of medical supplies — helping achieve the best quality for price. Our next-generation Medical Consumables Solution simplifies hospital and supply-chain workflows to minimize time spent managing high-volume, high-turn inventory, allowing more time for patient care.",
        ],
      },
    ],
  },

  "clinics.html": {
    partner: "Modular & mobile health infrastructure",
    lead:
      "DHI provides smart, modular health infrastructure designed to bring high-quality care to underserved, remote, or emergency regions. From permanent prefab clinics to mobile care units, our solutions combine medical-grade design, fast setup, and digital integration.",
    highlights: [
      { k: "Deployment", v: "Installed in days" },
      { k: "Settings", v: "Rural · disaster-relief · urban" },
      { k: "Scale", v: "One unit to full campus" },
    ],
    sections: [
      {
        type: "cards",
        heading: "Why our clinics & modules stand out",
        items: [
          { title: "Fast deployment, lasting impact", desc: "Modular clinics install in days and operate reliably for years — adaptable for rural, disaster-relief, or urban-overflow scenarios." },
          { title: "Fully equipped, digitally connected", desc: "Each unit ships with medical devices, power, HVAC, and integrated digital health systems — ready for immediate clinical use." },
          { title: "Flexible, scalable design", desc: "Start with one unit or scale to full health campuses, configurable for general practice, diagnostics, telemedicine, and maternity care." },
          { title: "Built for sustainability", desc: "Energy-efficient systems, water treatment, and solar options ensure long-term, low-footprint operation." },
          { title: "Backed by DHI's ecosystem", desc: "Connect modules with our digital health records, diagnostics, telehealth, and insurance integrations." },
          { title: "Access where it's needed most", desc: "Deploy in refugee camps, isolated regions, or underserved urban areas to close critical healthcare gaps." },
        ],
      },
      {
        type: "cards",
        heading: "Types of clinics & modules we offer",
        items: [
          { title: "Primary care clinics", desc: "Modular units for general health services, consultations, screenings, and chronic-care management." },
          { title: "Mobile medical units", desc: "Truck- or trailer-based systems for outreach programs, vaccination campaigns, and rural access." },
          { title: "Specialized care modules", desc: "Custom-built for maternity, dialysis, diagnostics, or minor surgery — compliant with international health standards." },
        ],
      },
      {
        type: "cards",
        heading: "Provider & manufacturer network",
        intro: "DHI sources mobile and rapid-deployment health infrastructure from specialized manufacturers, matching the right unit to each deployment:",
        items: [
          { title: "Odulair — mobile medical units", desc: "Custom-built mobile clinics and trailers — primary care, dental, mammography, eye care, and ICU/CT configurations — for outreach programs, rural access, and vaccination campaigns." },
          { title: "Hospitainer — rapid-deployment hospitals", desc: "Containerized, rapidly deployable hospitals, operating theatres, and clinics built for disaster relief, humanitarian missions, and field deployment in remote regions." },
        ],
      },
      {
        type: "prose",
        heading: "Scalable health infrastructure, delivered anywhere",
        paragraphs: [
          "Let's build your clinic network — fast, smart, and ready for the future. DHI's modular approach redefines healthcare access, transforming global health delivery one deployable unit at a time.",
        ],
      },
    ],
  },

  "lighting.html": {
    partner: "Keystone — full-scale manufacturer",
    lead:
      "DHI partners with a full-scale manufacturer to offer high-quality commercial lighting. Every Keystone fixture includes a Keystone power supply, so we ensure guaranteed performance — products are 100% end-of-line tested, with a defect rate under 0.1%.",
    highlights: [
      { k: "Tested", v: "100% end-of-line" },
      { k: "Defect rate", v: "< 0.1%" },
      { k: "Shipping", v: "Same-day options" },
    ],
    sections: [
      {
        type: "prose",
        heading: "Guaranteed performance",
        paragraphs: [
          "We take pride in our quality and the unique designs that make our products easy to install, use, and maintain. Because every fixture ships with a matched Keystone power supply, performance is guaranteed end to end.",
        ],
      },
      {
        type: "prose",
        heading: "Your one-stop shop",
        paragraphs: [
          "We know you value convenience and efficiency, so make Keystone your one-stop shop for all your lighting needs. You'll find the latest in LED lamps, fixtures, power supplies, and controls — with same-day shipping options.",
        ],
      },
      {
        type: "cards",
        heading: "Energy efficiency & modernization",
        items: [
          { title: "Healthcare-grade lighting", desc: "LED retrofits for exam rooms and procedure areas." },
          { title: "Facility-wide solutions", desc: "Whole-facility lighting design and auditing." },
          { title: "Sustainability projects", desc: "Energy-efficiency and modernization support across continents." },
        ],
      },
    ],
  },

  "automotive.html": {
    partner: "",
    heroLogo: "assets/img/acm-logo.png",
    lead:
      "AutoCommand AI Marketplace is a digital-first vehicle acquisition platform that helps customers locate, evaluate, finance, protect, purchase, and ship used vehicles through one coordinated, AI-powered system — combining market-wide digital search with a credible onsite dealership in the New Bern / Raleigh, North Carolina corridor.",
    highlights: [
      { k: "Promise", v: "Search to delivery, one platform" },
      { k: "Engine", v: "Agentic AI workflow by DHI" },
      { k: "Reach", v: "Domestic & worldwide shipping" },
      { k: "Trust", v: "Blockchain vehicle passport" },
    ],
    sections: [
      {
        type: "prose",
        heading: "Search smarter. Finance clearer. Protect better. Ship anywhere.",
        paragraphs: [
          "AutoCommand AI Marketplace — the AI-guided, dealer-backed way to find, finance, protect, accessorize, and ship your next vehicle, with a human review before you buy.",
          '<span class="mt-2 inline-flex flex-wrap gap-2"><a class="inline-block rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-700" href="automotive-find-vehicle.html">Start your deal &rarr;</a><a class="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-slate-50" href="automotive-passport.html">Vehicle passport</a><a class="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-slate-50" href="automotive-partners.html">Dealer / supplier sign-up</a><a class="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-slate-50" href="automotive-influencers.html">Creator program</a></span>',
        ],
      },
      {
        type: "list",
        heading: "Buy with confidence",
        cols2: true,
        items: [
          "Clear pricing — no hidden add-ons",
          "Human review before every purchase",
          "AI-guided, dealer-backed process",
          "Vehicle history available on listings",
          "Protection shown up front",
          "Shipping coordinated — local to port",
          "Financing subject to lender approval (prequalification is not final approval)",
          "Dealer participation subject to verification",
        ],
      },
      {
        type: "prose",
        heading: "One platform, one simple promise",
        paragraphs: [
          "Customers search by brand, model, year, mileage, price, monthly payment, domestic or international availability, shipping preference, and protection preference. The system then pulls qualified vehicles, ranks them, attaches vehicle-history information such as a Carfax or equivalent report, presents financing choices, offers protection products, confirms availability, coordinates the purchase path, and arranges delivery or shipment.",
          "The experience is simple enough for a non-automotive consumer to complete an initial search in under five minutes — yet powerful enough to manage dealer negotiation, finance routing, documentation, shipping, and post-sale retention behind the scenes.",
        ],
      },
      {
        type: "cards",
        heading: "The customer journey",
        items: [
          { title: "1 · Search", desc: "Choose brand, model, year, mileage, budget, payment, location, and shipping — in filters or plain language." },
          { title: "2 · Compare", desc: "Receive curated vehicles by best match, price, payment, local, shipped, and protection fit — never a confusing dump of listings." },
          { title: "3 · Finance", desc: "See up to five financing choices where available, with clear prequalification-versus-approval language." },
          { title: "4 · Protect", desc: "Add optional wheel & tire, road-hazard, transit, repair-support, service-contract, and GAP protection — clearly priced, never hidden." },
          { title: "5 · Buy", desc: "Click to buy; the backend opens the transaction file, confirms the dealer, and starts documents and compliance review." },
          { title: "6 · Deliver", desc: "Track pickup, local delivery, national transport, or international shipping to the doorstep or port." },
          { title: "7 · Retain", desc: "Ongoing value checks, protection renewals, maintenance referrals, and trade-cycle offers keep the relationship going." },
        ],
      },
      {
        type: "prose",
        heading: "Powered by DHI Agentic AI",
        paragraphs: [
          "AutoCommand AI is built on DHI's Agentic AI architecture — not a generic chatbot, but a controlled automotive workflow engine with specialized agents for customer intake, vehicle search, inventory normalization, scoring, history review, financing, protection products, dealer communication, shipping, compliance, and CRM reporting.",
          "Every recommended vehicle receives a scorecard covering price-versus-market, mileage, title and accident risk, dealer reliability, financing fit, shipping-adjusted total cost, and export eligibility. The AI recommends, drafts, scores, and routes — but never binds a purchase, financing decision, or contract without documented human approval and customer authorization.",
        ],
      },
      {
        type: "cards",
        heading: "Asset tokenization — the DHI Vehicle Passport",
        intro: "Built on DHI's blockchain trust fabric: each vehicle gets a tamper-evident digital passport so buyers can trust what they're buying.",
        items: [
          { title: "Blockchain-anchored provenance", desc: "Title, history, ownership, and service records are captured as a vehicle passport whose cryptographic fingerprint is written on-chain — so the record can't be quietly altered." },
          { title: "Independently verifiable", desc: "Any buyer can verify a passport against its on-chain anchor in seconds — no need to trust the seller's copy." },
          { title: "Travels with the car", desc: "The passport (and its protection products) can move with the vehicle across resales, building a durable, portable history." },
          { title: "A record, not an investment", desc: "The passport is a verifiable digital record that complements — and does not replace — your DMV legal title. It is not a security or financial instrument." },
        ],
      },
      {
        type: "prose",
        heading: "Try the Vehicle Passport",
        paragraphs: [
          "Issue and verify a blockchain-anchored vehicle passport in our pilot (on a test network). <a class=\"font-semibold text-cyan-700 hover:underline\" href=\"automotive-passport.html\">Open the Vehicle Passport tool &rarr;</a> &middot; <a class=\"font-semibold text-cyan-700 hover:underline\" href=\"automotive-tokenization.html\">Explore the tokenization offering &rarr;</a>",
        ],
      },
      {
        type: "explainers",
        heading: "Vehicle protection & ancillary products",
        intro: "Optional protection, explained in plain English. Tap any product to see what it is, what it covers, and why it might matter — never sold as confusing add-ons.",
        items: [
          {
            title: "Extended Service Contract (VSC)",
            tag: "Mechanical",
            what: "A Vehicle Service Contract — often called an extended warranty — pays for covered mechanical repairs after the factory warranty ends.",
            covers: ["Major systems like engine, transmission, and drivetrain", "Many electrical, cooling, and A/C components (by plan tier)", "Often towing and rental-car reimbursement"],
            why: "Repairs on modern vehicles can run into the thousands. A VSC turns surprise repair bills into a predictable, prepaid cost.",
            video: "",
          },
          {
            title: "GAP (Guaranteed Asset Protection)",
            tag: "Loan / lease",
            what: "GAP covers the difference between what you still owe on your loan or lease and what your insurance pays if the vehicle is totaled or stolen.",
            covers: ["The 'gap' between your loan balance and the insurance payout", "Often your insurance deductible, up to plan limits"],
            why: "New vehicles depreciate fast — early in a loan you can owe more than the car is worth. Without GAP, a total loss could leave you paying for a car you no longer have.",
            video: "",
          },
          {
            title: "Wheel & Tire Protection",
            tag: "Road",
            what: "Covers repair or replacement of tires and wheels damaged by road hazards like potholes, nails, and debris.",
            covers: ["Tire repair or replacement from covered road hazards", "Bent or cracked wheel repair / replacement", "Often mounting, balancing, and disposal"],
            why: "A single damaged tire and wheel can cost hundreds. This keeps everyday road hazards from becoming out-of-pocket surprises.",
            video: "",
          },
          {
            title: "Road-Hazard & Roadside",
            tag: "Road",
            what: "Roadside assistance for the unexpected — breakdowns, lockouts, dead batteries, and flats.",
            covers: ["Towing to a service center", "Jump-starts, fuel delivery, and lockout service", "Flat-tire changes"],
            why: "Peace of mind that help is one call away, wherever you are — especially valuable on longer or shipped-in purchases.",
            video: "",
          },
          {
            title: "Destination & Transit Protection",
            tag: "Delivery",
            what: "Protects your vehicle while it's transported to you — local delivery, national transport, or port-to-port.",
            covers: ["Damage that occurs during shipping or transit", "Coverage aligned to the delivery method you choose"],
            why: "When a car is delivered or shipped it changes hands and travels distances. This makes sure transit risk is covered before it reaches your door.",
            video: "",
          },
          {
            title: "30 / 60 / 90-Day Confidence Plans",
            tag: "Starter",
            what: "Short-term repair-support plans that cover key components for the first 30, 60, or 90 days after purchase.",
            covers: ["Covered repairs during the initial ownership window", "A bridge into a longer service contract if you want one"],
            why: "Extra confidence right after you buy — the period when you're still getting to know the vehicle.",
            video: "",
          },
        ],
      },
      {
        type: "list",
        heading: "We search the entire market",
        intro: "AutoCommand's agents scan the major marketplaces, online retailers, and enthusiast auctions — so you compare the whole market in one place instead of tab-hopping:",
        cols2: true,
        items: [
          "Autotrader",
          "CarGurus",
          "Cars.com",
          "Carvana",
          "CarMax",
          "Bring a Trailer",
          "Cars & Bids",
          "eBay Motors",
          "AutoTempest (multi-site aggregator)",
          "Facebook Marketplace & Craigslist",
          "CarEdge",
        ],
      },
      {
        type: "cards",
        heading: "The Dr Bill Service Guarantee",
        intro: "A service-quality promise that gives first-time and out-of-state buyers confidence the car is right:",
        items: [
          { title: "30-day peace of mind, included", desc: "Every eligible vehicle includes the Dr Bill guarantee — up to $100 toward any needed repair within the first 30 days, at no extra cost." },
          { title: "Year-one extended protection", desc: "After the included window, add a one-year extended service plan through a vetted warranty provider to keep coverage going." },
          { title: "Buy with confidence", desc: "Backed by real support and clear terms — protection is presented up front, never buried in the paperwork." },
        ],
      },
      {
        type: "list",
        heading: "Extended warranty & protection partners",
        intro: "Optional, clearly-priced coverage through established providers — matched to each vehicle and budget (representative providers; final lineup may vary by vehicle and region):",
        cols2: true,
        items: [
          "Endurance — extended vehicle protection",
          "CarShield — flexible monthly plans",
          "Select Auto Protect",
          "Premier Auto Protect",
          "CARCHEX — customizable coverage",
          "Roadside / road-service program",
          "Tire & wheel protection",
          "Paint & interior protection",
          "GAP coverage (where lawful)",
          "Rate buy-down after 12 months on improved credit",
        ],
      },
      // TODO (Bill): dealer-program economics & finance flow are presentational only pending details —
      // free dealer listings, per-sale dealer fee, buyer application/transaction fees, referral profit-share,
      // and what flows to DHI vs. the affiliate brick-and-mortar entity. Do not publish specific fee numbers until confirmed.
      {
        type: "cards",
        heading: "Worldwide shipping & a real operating base",
        items: [
          { title: "Coordinated logistics", desc: "Local delivery, national open and enclosed transport, dealer-to-dealer movement, and port-to-port or door-to-door international shipping." },
          { title: "Onsite dealership", desc: "A licensed New Bern / Raleigh-area location provides test drives, deliveries, document control, trade-ins, and customer trust." },
          { title: "Dealer inventory network", desc: "Move vehicles from a network of dealer, auction, and consignment partners — without owning every car on the lot." },
          { title: "Consumer-first education", desc: "“The AutoCommand Show” podcast educates buyers on pricing, financing, fees, and shipping so they buy with confidence." },
        ],
      },
    ],
  },

  "data-analytics.html": {
    partner: "Titan data platform",
    lead:
      "Unified data services, interoperability layers, and AI decision support enabling evidence-based operations across the entire DHI ecosystem.",
    highlights: [
      { k: "Sources", v: "EMR · telehealth · devices · finance" },
      { k: "Output", v: "Clinical, ops & financial dashboards" },
      { k: "Engine", v: "Advanced analytics & AI modeling" },
    ],
    sections: [
      {
        type: "cards",
        heading: "From raw data to decisions",
        items: [
          { title: "Ingestion & normalization", desc: "Unify data from EMR, telehealth, devices, and finance systems (Titan Discover)." },
          { title: "Leadership dashboards", desc: "Clear views for clinical, operational, and financial leadership." },
          { title: "Advanced analytics", desc: "AI modeling and decision support across the ecosystem." },
          { title: "Interoperability layer", desc: "Open interoperability that connects every DHI vertical (Titan Connect)." },
        ],
      },
      {
        type: "prose",
        heading: "Titan Analytics — insight without exposure",
        paragraphs: [
          "Titan Analytics runs quantum-grade analytics on redacted and synthetic data, using federated learning so models improve without moving or exposing protected health information. The same governed data layer powers compliant data-licensing and research use cases across the DHI ecosystem.",
        ],
      },
    ],
  },
};
