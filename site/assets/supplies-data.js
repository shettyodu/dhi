/* Supplies, Textiles & Linens — PPE catalog ported from Vertical 6
   (ECEP Han Global / EHSP FOB price list, 3/2025).
   p = list price = FOB unit cost x2 (same markup as lighting), rounded.
   Box-unit items priced per box; ambiguous KN95 lines are quote-only (p=null). */
const SUPPLIES_PRODUCTS = [
  // ---- Coveralls ----
  { id: "EHSP-600",   t: "Coverall — Type 5-B / 6-B (AAMI Level 3)", cat: "Coveralls", group: "Protective coverall", unit: "each", p: 4.94, img: "assets/img/products/supply-coverall.jpg", specs: "55 GSM (PP+PE) · White · 60/box · AAMI Level 3" },
  { id: "EHSP-610",   t: "Reinforced Coverall — Type 3-B / 4-B (AAMI Level 3)", cat: "Coveralls", group: "Reinforced coverall", unit: "each", p: 8.99, img: "assets/img/products/supply-coverall.jpg", specs: "55 GSM (PP+PE) · White · 60/box · reinforced seams" },
  { id: "EHSP-610B",  t: "RED-ZONE Coverall — Type 3-B / 4-B + Boot Cover", cat: "Coveralls", group: "Reinforced coverall + boot", unit: "each", p: 10.99, img: "assets/img/products/supply-coverall.jpg", specs: "55 GSM (PP+PE) · White · 60/box · integrated boot cover" },
  // ---- Gowns ----
  { id: "EHSP-800",   t: "Isolation Gown — AAMI Level 1", cat: "Gowns", group: "Isolation gown", unit: "each", p: 2.70, img: "assets/img/products/supply-gowns.jpg", specs: "35 GSM (PP+PE) laminated · Blue · 100/box" },
  { id: "EHSP-810",   t: "Isolation Gown — AAMI Level 2", cat: "Gowns", group: "Isolation gown", unit: "each", p: 2.78, img: "assets/img/products/supply-gowns.jpg", specs: "41 GSM (PP+PE) laminated · Blue · 100/box" },
  { id: "EHSP-820-3", t: "Isolation Gown — AAMI Level 3", cat: "Gowns", group: "Isolation gown", unit: "each", p: 3.20, img: "assets/img/products/supply-gowns.jpg", specs: "55 GSM (PP+PE) laminated · White · 100/box" },
  { id: "EHSP-900",   t: "Surgical Reinforced Isolation Gown — AAMI Level 4", cat: "Gowns", group: "Surgical gown", unit: "each", p: 5.99, img: "assets/img/products/supply-gowns.jpg", specs: "55 (PP+PE) + 25 GSM barrier · White · 60/box" },
  { id: "EHSP-830-1", t: "Surgical Isolation Gown — AAMI Level 3", cat: "Gowns", group: "Surgical gown", unit: "each", p: 5.99, img: "assets/img/products/supply-gowns.jpg", specs: "40 GSM SMS + 25 GSM barrier · Blue · 60/box" },
  // ---- Scrubs ----
  { id: "EHSP-700",   t: "Disposable Fluid-Resistant Scrub", cat: "Scrubs", group: "Disposable scrub set", unit: "set", p: 13.99, img: "", specs: "55 GSM (PP+PE) laminated · White · 50/box" },
  { id: "EHSP-710",   t: "Disposable Scrub (SMS 40–45 GSM)", cat: "Scrubs", group: "Disposable scrub set", unit: "set", p: 13.99, img: "", specs: "40–45 GSM SMS fabric · Blue · 100/box" },
  { id: "EHSP-720-GREEN", t: "Reusable Scrub + Cap Set — Green", cat: "Scrubs", group: "Reusable scrub set", unit: "set", p: 33.99, img: "", specs: "100% cotton poplin medical fabric · Green · 50/box" },
  { id: "EHSP-720-BLUE",  t: "Reusable Scrub + Cap Set — Blue", cat: "Scrubs", group: "Reusable scrub set", unit: "set", p: 33.99, img: "", specs: "100% cotton poplin medical fabric · Blue · 50/box" },
  // ---- Covers & Caps ----
  { id: "ESHP-500",   t: "Disposable Boot Cover, 13\" (non-slip soles)", cat: "Covers & Caps", group: "Foot cover", unit: "pair", p: 3.24, img: "", specs: "55 GSM (PP+PE) laminated · White · 150/box · +3 mm non-slip sole" },
  { id: "EHSP-520",   t: "Disposable Shoe Cover, 4\"", cat: "Covers & Caps", group: "Foot cover", unit: "pair", p: 3.06, img: "", specs: "55 GSM (PP+PE) laminated · White · 250/box" },
  { id: "ESHP-580",   t: "Protective Oversleeves, 16\" (elasticated)", cat: "Covers & Caps", group: "Sleeve cover", unit: "pair", p: 1.98, img: "", specs: "55 GSM (PP+PE) laminated · White · 250/box" },
  { id: "EHSP-530",   t: "Protective Head Cover (laminated)", cat: "Covers & Caps", group: "Head cover", unit: "each", p: 1.98, img: "", specs: "55 GSM (PP+PE) laminated · White · 250/box" },
  { id: "EHSP-560-21", t: "Bouffant Cap, SMS 21\"", cat: "Covers & Caps", group: "Bouffant (box of 1,440)", unit: "box", p: 100.00, img: "", specs: "30 GSM non-woven · Blue/Green · 1,440/box" },
  { id: "EHSP-560-24", t: "Bouffant Cap, SMS 24\"", cat: "Covers & Caps", group: "Bouffant (box of 1,440)", unit: "box", p: 110.00, img: "", specs: "30 GSM non-woven · Blue/Green · 1,440/box" },
  { id: "EHSP-540",   t: "Bouffant Cap, Non-Woven 15 GSM", cat: "Covers & Caps", group: "Bouffant (box of 1,440)", unit: "box", p: 50.00, img: "", specs: "15 GSM non-woven · Blue/Green · 1,440/box" },
  // ---- Masks & Respirators ----
  { id: "EHSP-430",   t: "Medical Mask — Type IIR", cat: "Masks & Respirators", group: "Surgical mask (box of 50)", unit: "box", p: 3.06, img: "", specs: "Medical Blue · 50 pc/box · fluid-resistant" },
  { id: "EHSP-420",   t: "Medical Mask — Type II", cat: "Masks & Respirators", group: "Surgical mask (box of 50)", unit: "box", p: 2.70, img: "", specs: "Medical Blue · 50 pc/box" },
  { id: "EHSP-415",   t: "Kiddo Mask — Type II", cat: "Masks & Respirators", group: "Children's mask (box of 50)", unit: "box", p: 4.32, img: "", specs: "Colorful · 50 pc/box" },
  { id: "EHSP-400",   t: "KN95 / N95 / FFP2 Respirator — 5-Layer", cat: "Masks & Respirators", group: "Respirator (box of 50)", unit: "box", p: null, img: "", specs: "Medical-grade 5-layer · White · 50 pc/box · request pricing" },
  { id: "EHSP-300",   t: "KN95 Respirator — 5-Layer, Individually Packed", cat: "Masks & Respirators", group: "Respirator (box of 50)", unit: "box", p: null, img: "", specs: "Medical-grade 5-layer · individually packed · White · 50 pc/box · request pricing" },
];
