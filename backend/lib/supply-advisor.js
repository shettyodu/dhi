/* SupplyScope Advisor — turns a benchmark result into an agentic assessment:
   savings opportunities, single-source / supply-chain risk, and next actions.
   BUY-SIDE only. Every finding is grounded in the caller's own data + DHI's
   catalog — no invented prices, no market-event predictions, no "what to charge
   patients". Deterministic (instant, no external API). */

const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = (n) => "$" + Math.round(Number(n || 0)).toLocaleString("en-US");

function assess(result) {
  const rows = (result && result.rows) || [];
  const s = (result && result.summary) || {};
  const findings = [];

  // 1) Biggest savings opportunities (grounded in real over-payment).
  const over = rows.filter((r) => r.matched && r.line_savings > 0).sort((a, b) => b.line_savings - a.line_savings);
  if (over.length) {
    const top = over.slice(0, 3).map((r) => `${r.desc} — ${r.over_pct}% over, save ${usd(r.line_savings)} at DHI ${usd(r.benchmark_price)}`);
    findings.push({ tone: "win", title: "Where the money is", detail: `Your biggest wins: ${top.join("; ")}.` });
  }

  // 2) Single-source / supply-chain risk (needs vendors on the lines).
  const withV = rows.filter((r) => r.matched && r.vendor);
  if (withV.length >= 3) {
    const vend = {}; withV.forEach((r) => { vend[r.vendor] = (vend[r.vendor] || 0) + 1; });
    const [topV, topN] = Object.entries(vend).sort((a, b) => b[1] - a[1])[0];
    const share = topN / withV.length;
    if (share >= 0.6) {
      findings.push({ tone: "risk", title: "Concentration / single-source risk", detail: `${topV} supplies ${topN} of ${withV.length} priced lines (${Math.round(share * 100)}%). One disruption would hit most of your supply — dual-source the critical items.` });
    }
  } else if (rows.some((r) => r.matched)) {
    findings.push({ tone: "info", title: "Add vendors for a supply-chain read", detail: "Enter your current vendor on each line and we'll flag single-source and concentration risk." });
  }

  // 3) Quote-only items (no current price given).
  const quotes = rows.filter((r) => r.quote_only).length;
  if (quotes) findings.push({ tone: "info", title: "Quantify the rest", detail: `${quotes} item${quotes > 1 ? "s" : ""} had no current price — add what you pay today to see the savings against it.` });

  // 4) Coverage gaps (demand we don't carry yet).
  if (s.unmatched) findings.push({ tone: "info", title: "Coverage gaps", detail: `${s.unmatched} item${s.unmatched > 1 ? "s aren't" : " isn't"} in our catalog yet — send them and we'll benchmark and source them.` });

  // 5) Next action (buy-side, no market-timing fabrication).
  if (s.total_savings > 0) {
    findings.push({ tone: "action", title: "Capture it", detail: `We'll confirm exact equivalents and hold DHI pricing on the flagged items — locking in ~${usd0(s.total_savings)} without changing your contracts.` });
  }

  const headline = s.total_savings > 0
    ? `You're overpaying ~${usd0(s.total_savings)} (${s.savings_pct}%) across ${s.matched} benchmarked item${s.matched > 1 ? "s" : ""}.`
    : (s.matched ? `${s.matched} item${s.matched > 1 ? "s" : ""} matched our catalog — add current prices to see your savings.`
      : "Nothing benchmarked yet — add items (PPE, gowns, coveralls, drapes, scrubs) and we'll assess them.");

  return { headline, findings };
}

/* Optional LLM narrative — a short, natural-language summary written from ONLY the
   computed findings (no new numbers/vendors/claims). Gated on OPENAI_API_KEY;
   returns null on any error/timeout so it never blocks or breaks the result. */
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const NARR_TIMEOUT_MS = Number(process.env.SUPPLYSCOPE_LLM_TIMEOUT_MS || 6000);

const SYS = [
  "You are SupplyScope Advisor, a procurement analyst for medical-supply buyers (clinics, practices).",
  "Write a concise 2–3 sentence, plain-English summary for the buyer, based ONLY on the findings provided.",
  "Hard rules: do NOT invent or alter any number, dollar amount, percentage, vendor, or product — use only what's in the findings.",
  "Stay strictly buy-side: help them purchase smarter. NEVER advise on what to charge patients or on setting retail/patient prices.",
  "No hype, no guarantees; 'indicative' framing is fine. Address the buyer as 'you'.",
].join(" ");

async function narrate(assessment) {
  if (!API_KEY || !assessment || !Array.isArray(assessment.findings) || !assessment.findings.length) return null;
  const facts = { headline: assessment.headline, findings: assessment.findings.map((f) => ({ title: f.title, detail: f.detail })) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NARR_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, temperature: 0.3, max_tokens: 160, messages: [
        { role: "system", content: SYS },
        { role: "user", content: "Findings:\n" + JSON.stringify(facts) },
      ] }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return text ? String(text).trim().slice(0, 600) : null;
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}

module.exports = { assess, narrate };
