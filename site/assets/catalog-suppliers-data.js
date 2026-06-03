/* =====================================================================
   Additional lighting suppliers (kept SEPARATE from the Keystone catalog
   so no supplier's products are ever co-mingled in source).
   catalog-search.js merges this with KEYSTONE_PRODUCTS and silos by the
   `supplier` field + the catalog filter.

   Add a new supplier by appending objects with the SAME shape as
   KEYSTONE_PRODUCTS plus a required `supplier` field. Keep each supplier's
   items grouped together. Apply the standard 2x cost->list markup to `p`.

   Per-item shape:
   {
     id: "RAB-XYZ-123",          // unique SKU (prefix by supplier to avoid clashes)
     supplier: "RAB Lighting",   // REQUIRED — drives the supplier filter / silo
     cat: "Fixtures",            // one of: Lamps | Fixtures | Power Supplies | Controls
     group: "Area Lights",       // product family (feeds the family filter)
     specs: "…",                 // description
     w: "", lm: "", cct: "", base: "", len: "",  // optional badge fields
     p: 0.00,                    // list price (cost x 2, rounded per pricing ladder)
     c: 0.00,                    // cost (for margin/affiliate-payout math)
     img: ""                     // optional image path under assets/img/products/
   }
   ===================================================================== */
const EXTRA_LIGHTING_PRODUCTS = [];
