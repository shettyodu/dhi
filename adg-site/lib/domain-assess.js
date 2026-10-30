/* Asset Data Group — domain-based pre-qualifier.
   Input a company website; fetch its public homepage; an LLM infers the business,
   likely operational data, a rough value range, AND a candidacy verdict
   (strong / possible / NOT a candidate). The disqualifier is first-class: it saves
   sales time by filtering out poor fits before anyone spends a call.

   OpenAI-compatible wiring. Returns { status, json:{ assessment } }.
   503 when OPENAI_API_KEY is unset.

   Honesty: a rough estimate from PUBLIC signals only; wide range; never a quote or a
   guarantee of value/sale/buyer. The accurate read still needs the owner's real data
   details (lib/data-assess.js). */

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 12000);
const FETCH_MS = 7000;

function isConfigured() { return !!API_KEY; }

// Normalize + validate a user-supplied domain. Reject IPs, localhost, and internal
// hosts (basic SSRF guard); only public-looking hostnames over https.
function normalizeDomain(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;                 // must be a domain
  if (/^(localhost|\d+\.\d+\.\d+\.\d+)$/.test(s)) return null;          // no IPs / localhost
  if (/\.(local|internal|lan|test|localhost)$/.test(s)) return null;    // no internal TLDs
  return s;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSite(domain) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch("https://" + domain, {
      redirect: "follow",
      headers: { "User-Agent": "AssetDataGroup/1.0 (+https://assetdatagrp.com)", Accept: "text/html" },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false };
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain/.test(ct)) return { ok: false };
    const html = await res.text();
    return { ok: true, text: stripHtml(html).slice(0, 6000) };
  } catch (e) { return { ok: false }; }
  finally { clearTimeout(timer); }
}

const KB = `
You assess whether a company is a good candidate to commercialize (license) its operational data, based on its public website text. Infer what the business does, its scale, and the operational data it likely generates (work orders, quotes, tickets, service logs, transactions, CRM, inspection records, and similar).

Candidacy:
- "strong": likely generates substantial, proprietary, human-generated operational or workflow data at scale (for example distribution, engineering, manufacturing, logistics, field services, or established B2B operations with years of records).
- "possible": some operational data, but smaller scale, unclear volume, or mixed signals.
- "not": unlikely to hold licensable operational data at meaningful scale. For example a very small or solo business, a purely consumer-facing content or media site with no proprietary workflow data, a pure reseller or affiliate, or an organization whose only data is heavily regulated core data (for example a medical practice's patient records) that cannot be licensed. Be clear and specific about why, kindly.

Value: a ROUGH, wide, illustrative range grounded in the real market. Operational-data licensing deals run roughly $100,000 to $2,000,000, typically around $200,000 to $300,000; small or uncertain cases sit lower, large and unique datasets higher. Always give a range, clearly labeled illustrative and dependent on actual volume, quality, and rights, which a public estimate cannot confirm. For "not" candidates, say it is not a fit rather than giving a range. Never guarantee a value, a sale, or a buyer.

This is a preliminary estimate from public signals only. It is not a quote, and the accurate figure requires the owner's real data details.

Return ONLY a JSON object:
{
 "business": "one sentence on what the company does",
 "candidacy": "strong" | "possible" | "not",
 "candidacySummary": "one or two sentences on why",
 "likelyDataTypes": ["operational data types they probably generate"],
 "valueEstimate": "rough illustrative range, or a short note that it is not a fit",
 "reasons": ["brief reasons for the verdict"],
 "disclaimer": "Preliminary estimate from public information only. Not a quote or a guarantee."
}`;

async function callOpenAI(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 700, response_format: { type: "json_object" } }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally { clearTimeout(timer); }
}

async function assess(body) {
  if (!isConfigured()) return { status: 503, json: { error: "Estimator is offline right now.", configured: false } };
  const domain = normalizeDomain(body && body.domain);
  if (!domain) return { status: 400, json: { error: "Enter a valid company website, for example yourcompany.com." } };

  const site = await fetchSite(domain);
  const context = site.ok
    ? "Website: " + domain + "\n\nPublic homepage text:\n" + site.text
    : "Website: " + domain + "\n\n(The site could not be fetched; estimate from the domain name and any inference you can make, and lower your confidence accordingly.)";

  try {
    const r = await callOpenAI([{ role: "system", content: KB }, { role: "user", content: "Assess this company as a data-commercialization candidate.\n\n" + context }]);
    if (!r.ok) { console.error("domain-assess upstream:", r.status, JSON.stringify(r.data).slice(0, 160)); return { status: 502, json: { error: "The estimator had trouble responding. Please try again." } }; }
    const content = r.data.choices && r.data.choices[0] && r.data.choices[0].message && r.data.choices[0].message.content;
    let assessment;
    try { assessment = JSON.parse(content); } catch (e) { return { status: 502, json: { error: "Could not parse the estimate. Please try again." } }; }
    assessment.domain = domain;
    assessment.siteFetched = !!site.ok;
    return { status: 200, json: { assessment } };
  } catch (e) {
    const aborted = e.name === "AbortError";
    console.error("domain-assess error:", aborted ? "timeout" : e.message);
    return { status: aborted ? 504 : 500, json: { error: "The estimate is taking too long. Please try again shortly." } };
  }
}

module.exports = { assess, isConfigured, normalizeDomain };
