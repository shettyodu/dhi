/* Grounding facts for AI proposal generation. These are curated from DHI's own
   site content + partner catalogs so the proposal writer cites REAL products,
   partners, and standards — not hallucinated ones. Keep concise + truthful. */

const CORP = {
  name: "Digital Health International Inc. (DHI)",
  hq: "Research Triangle, North Carolina",
  registrations: ["SAM.gov-registered contractor", "FEMA-registered for products aligned to our verticals", "GSA pathways"],
  positioning: "A vertically integrated, multi-vertical platform connecting healthcare, technology, infrastructure, and global markets. Verticals operate independently or as one integrated solution.",
  leadership: "Chairman Dr. Juan M. Montero II, M.D., FACS; President & CEO Steven R. Burch.",
  contracting: "Prime or subcontractor for federal, state, local, and international B-to-G engagements; competitive bids, compliance toolboxes, and master-agreement frameworks across the Government Vertical Division.",
};

// Per-vertical capability profiles, keyed by govbids vertical id.
const BY_VERTICAL = {
  "lighting": {
    label: "Lighting & Energy Efficiency",
    partners: ["Keystone Technologies (full-scale manufacturer)"],
    offerings: ["Commercial LED fixtures, lamps, and retrofit systems", "Every fixture ships with a matched Keystone power supply for guaranteed end-to-end performance"],
    quality: ["100% end-of-line tested", "Defect rate under 0.1%"],
    standards: ["DLC / ENERGY STAR-aligned options"],
    differentiators: ["Guaranteed performance via matched driver+fixture", "Energy-efficiency retrofits that reduce consumption and operating cost"],
  },
  "medical-equipment": {
    label: "Medical Equipment & Technology",
    partners: ["GPDI — Global Procurement Development Institute (South Korea); program led by Prof. Man Ki Kim (KAIST)"],
    offerings: ["1,200+ medical equipment products via a globally vetted supply chain", "Featured: Healcerion handheld ultrasound, Otom portable X-ray, iMediSync EEG/PBM helmet, Mezoo HiCardi ECG patch, Man&Tel rehab trainers, Charmcare ACCURO pulse oximeter"],
    quality: ["Globally vetted manufacturers; FDA-listed / CE-marked options"],
    standards: ["Public-procurement-ready catalogs"],
    differentiators: ["Best-in-class pricing from a vetted global supply chain", "Full lifecycle: install, train, maintain; coordinated global freight + customs"],
  },
  "cybersecurity": {
    label: "Cybersecurity & Infrastructure",
    partners: ["Titan (data platform)", "CyberFortify (MSSP)", "PipIQ (private AI)"],
    offerings: ["Titan modules: Discover, Protect, Connect, Analytics, Communicate", "PipIQ — private, branded AI trained on the client's own policies (addresses shadow-AI risk)", "CyberFortify managed security (24/7 monitoring) in Basic/Standard/Premium tiers", "Coverage across users, email, endpoints, cloud workloads, and networks"],
    quality: ["AI-driven anomaly detection; per-element blockchain-grade encryption"],
    standards: ["HIPAA, GDPR, NIST 800-53 aligned; compliance reporting & audit trails"],
    differentiators: ["Enterprise-grade protection without an enterprise budget", "Managed, white-label, or OEM delivery; deployed at scale (e.g., Vanderbilt, SRHO)"],
  },
  "decentralized-software": {
    label: "Decentralized Software",
    partners: ["Titan (built with CCG)", "GenieMD (virtual care)"],
    offerings: ["EMR/EHR and health-data platforms on distributed, quantum-ready infrastructure", "Open APIs + modular design; paper-to-digital AI OCR; blockchain-secured data fabric"],
    quality: ["Sub-millisecond data access; immutable datasets"],
    standards: ["HIPAA, GDPR, NIST 800-53; data-residency ready"],
    differentiators: ["100% modular/mobile/private informatics", "Deploy full platform, infrastructure-only, or virtual-care-only"],
  },
  "data-analytics": {
    label: "Data & Analytics",
    partners: ["Titan data platform"],
    offerings: ["Unified data services, interoperability layers, AI decision support", "Quantum-grade analytics on redacted/synthetic data with federated learning"],
    quality: ["Insight without exposing PHI"],
    standards: ["HIPAA-aligned data governance"],
    differentiators: ["Evidence-based operations across the DHI ecosystem"],
  },
  "supplies": {
    label: "Supplies, Textiles & Linens",
    partners: ["Amaryllis Healthcare", "Mediprro (Sivshree Medittex)"],
    offerings: ["Sterile, single-use surgical gowns, drapes, OT packs, and sterilization wraps (specialty packs across general surgery, cardiac, orthopedic, OB/GYN, urology, neuro, ophthalmic)", "PPE, consumables, hospital-grade textiles & linens"],
    quality: ["SMS/SMMMS non-woven; AAMI Level 1–4; ultrasonically welded; EO-sterile"],
    standards: ["CE (EU MDR 2017/745), ISO 13485, USFDA-registered, MDSAP, GMP, EN 13795"],
    differentiators: ["OEM/white-label/bulk; custom-designed gowns and drape kits", "Volume pricing for large procurements"],
  },
  "clinics": {
    label: "Clinics & Modules",
    partners: ["Odulair (mobile medical units)", "Hospitainer (containerized hospitals)"],
    offerings: ["Modular prefab clinics and mobile/rapid-deployment medical units", "Configurable for primary care, diagnostics, telemedicine, maternity, dialysis, ICU/CT"],
    quality: ["Medical-grade design; installs in days; energy-efficient/solar options"],
    standards: ["Compliant with international health standards"],
    differentiators: ["Deployable for disaster relief, remote/underserved regions", "Connects to DHI EHR, diagnostics, telehealth, and insurance"],
  },
  "wellness": {
    label: "Wellness & Digital Care",
    partners: ["GenieMD (telehealth)", "CogniFit (cognitive health)"],
    offerings: ["AI-powered unified virtual care: telehealth, RPM/RTM/CCM, care management, GLP-1 weight loss, longevity", "Validated cognitive assessment & training (CogniFit)"],
    quality: ["White-labelable for health systems, employers, and government programs"],
    standards: ["HIPAA-aligned"],
    differentiators: ["Single platform across the virtual-care continuum"],
  },
  "insurance": {
    label: "Insurance & Risk Solutions",
    partners: ["ManhattanLife", "Acrisure", "SquareMouth"],
    offerings: ["Group employer benefits, individual/senior/family supplemental, life & annuity, travel/specialty"],
    quality: ["Placed through licensed carriers and brokers"],
    standards: ["State-licensed; eligibility/benefits confirmed before binding"],
    differentiators: ["Analytics-driven program design integrated with wellness & care management"],
  },
  "automotive": {
    label: "AutoCommand AI Marketplace",
    partners: ["AutoCommand (AI vehicle marketplace)"],
    offerings: ["AI-guided vehicle sourcing, financing, protection, and shipping; fleet acquisition", "Blockchain vehicle provenance (Vehicle Passport)"],
    quality: ["Human-reviewed, dealer-backed transactions"],
    standards: [],
    differentiators: ["Cross-dealer sourcing through one Agentic-AI platform"],
  },
};

function profileFor(verticalKey) { return BY_VERTICAL[verticalKey] || null; }

module.exports = { CORP, BY_VERTICAL, profileFor };
