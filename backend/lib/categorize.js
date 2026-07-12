/* Phase 3 — agentic categorization for a full procurement list. Assigns a
   department + product category to each line so the Supply Proposal can roll up
   spend and savings by department. Cost-bounded: a deterministic keyword
   classifier handles the obvious majority; the LLM is called ONCE per batch, only
   for the lines rules couldn't place. No prices are invented here — this is
   classification only. */
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.SUPPLYSCOPE_LLM_TIMEOUT_MS || 9000);

const DEPARTMENTS = [
  "Central Sterile", "Lab", "Engineering / Facilities", "Surgery / OR",
  "Patient Care", "Administration / Office", "Pharmacy", "Imaging",
  "Housekeeping / EVS", "Other",
];

// Order matters — more specific rules first.
const RULES = [
  { re: /\b(ot pack|surgical|scalpel|blade|suture|trocar|cautery|bovie|drape|bone wax|surgeon gown)\b/, dept: "Surgery / OR", cat: "Surgical" },
  { re: /\b(enzymatic|steriliz|sterilis|autoclave|biological indicator|chemical indicator|csr wrap|sterrad|instrument cleaner|sterile pouch|steam indicator)\b/, dept: "Central Sterile", cat: "Sterilization" },
  { re: /\b(reagent|vial|pipette|pipet|cuvette|slide|specimen|petri|culture|assay|centrifuge|dosimeter|monitor badge|test tube|microplate|serolog)\b/, dept: "Lab", cat: "Laboratory" },
  { re: /\b(filter|hvac|air handler|bulb|lamp|ballast|lubricant|bearing|belt|gasket|valve|sensor|degreaser|solenoid|actuator|fan motor|refrigerant)\b/, dept: "Engineering / Facilities", cat: "MRO / Facilities" },
  { re: /\b(toner|printer ink|ink cartridge|copy paper|letterhead|stapler|envelope|ballpoint|binder|office paper)\b/, dept: "Administration / Office", cat: "Office" },
  { re: /\b(detergent|trash liner|can liner|mop|floor pad|disinfectant wipe|surface disinfect|evs|housekeeping)\b/, dept: "Housekeeping / EVS", cat: "EVS" },
  { re: /\b(tablet|capsule|saline|medication|pharmac|iv fluid|ampoule|injectable)\b/, dept: "Pharmacy", cat: "Pharmacy" },
  { re: /\b(contrast|x-ray|radiolog|imaging cassette|ultrasound gel|film)\b/, dept: "Imaging", cat: "Imaging" },
  { re: /\b(gown|drape)\b/, dept: "Surgery / OR", cat: "PPE / Gowns" },
  { re: /\b(glove|mask|respirator|n95|face shield|coverall|bouffant|shoe cover|apron|goggle)\b/, dept: "Patient Care", cat: "PPE" },
  { re: /\b(syringe|needle|catheter|iv set|bandage|gauze|dressing|wipe|sanitizer|thermometer|tourniquet|scrub set|underpad)\b/, dept: "Patient Care", cat: "Medical consumable" },
];

function classifyLocal(desc) {
  const d = String(desc || "").toLowerCase();
  for (const r of RULES) if (r.re.test(d)) return { department: r.dept, category: r.cat, source: "rule" };
  return null;
}

async function classifyAI(items) {
  if (!API_KEY || !items.length) return {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const list = items.map((it) => `${it.i}: ${String(it.desc || "").slice(0, 100)}`).join("\n");
    const sys = [
      "You classify hospital procurement line items by DEPARTMENT and a short product CATEGORY.",
      "Department MUST be exactly one of: " + DEPARTMENTS.join(", ") + ".",
      "Return STRICT JSON: {\"results\":[{\"i\":number,\"department\":string,\"category\":string}]} — one entry per input line, echoing its i.",
      "Classification only. Do NOT include prices or any other fields.",
    ].join(" ");
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 900, response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: list }] }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    const txt = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!txt) return {};
    let o; try { o = JSON.parse(txt); } catch (e) { return {}; }
    const out = {};
    (Array.isArray(o.results) ? o.results : []).forEach((r) => {
      const i = Number(r.i);
      if (!isNaN(i)) out[i] = { department: DEPARTMENTS.includes(r.department) ? r.department : "Other", category: String(r.category || "").slice(0, 40) || "General", source: "ai" };
    });
    return out;
  } catch (e) { return {}; }
  finally { clearTimeout(timer); }
}

// items: [{i, desc}] (batch, <= ~60). Returns [{i, department, category, source}].
async function categorize(items) {
  const list = Array.isArray(items) ? items.slice(0, 60) : [];
  const results = {}; const unknown = [];
  list.forEach((it) => { const c = classifyLocal(it.desc); if (c) results[it.i] = c; else unknown.push(it); });
  if (unknown.length) {
    const ai = await classifyAI(unknown);
    unknown.forEach((it) => { results[it.i] = ai[it.i] || { department: "Other", category: "Unclassified", source: "none" }; });
  }
  return list.map((it) => ({ i: it.i, ...results[it.i] }));
}

module.exports = { categorize, classifyLocal, DEPARTMENTS };
