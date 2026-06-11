/* Bid pipeline ("Bid Board") store for the Government Bid Match-Maker.
   A shared board (one team, gated by ADMIN_SECRET) persisted to Netlify Blobs:
   reps save matched opportunities and move them through stages, with notes and
   deadline tracking. Borrowed from preconstruction bid-board workflows.

   Store: gov-pipeline · key: board · shape { entries: [ {id, opportunity, stage,
   owner, notes, addedAt, updatedAt} ] }. Returns plain objects; never throws. */

const { getStore } = require("@netlify/blobs");
const STORE = "gov-pipeline";
const KEY = "board";

const STAGES = ["Identified", "Qualifying", "Drafting", "Submitted", "Won", "Lost", "No-bid"];

function store() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.BLOBS_TOKEN;
  return siteID && token ? getStore({ name: STORE, siteID, token }) : getStore(STORE);
}

async function read() {
  try { return (await store().get(KEY, { type: "json" })) || { entries: [] }; }
  catch (e) { return { entries: [] }; }
}
async function write(d) { await store().setJSON(KEY, d); }

async function listBoard() {
  const d = await read();
  return { ok: true, stages: STAGES, entries: Array.isArray(d.entries) ? d.entries : [] };
}

// Save (or update) an opportunity on the board. `entry.id` required (= opportunity id).
async function upsert(entry) {
  if (!entry || !entry.id) return { ok: false, error: "missing opportunity id" };
  const d = await read();
  const e = Array.isArray(d.entries) ? d.entries : [];
  const now = new Date().toISOString();
  const i = e.findIndex((x) => x.id === entry.id);
  if (i >= 0) {
    e[i] = Object.assign({}, e[i], entry, { updatedAt: now });
  } else {
    e.push(Object.assign({ stage: "Identified", owner: "", notes: "", addedAt: now, updatedAt: now }, entry));
  }
  d.entries = e;
  await write(d);
  return { ok: true, count: e.length, alreadyOnBoard: i >= 0 };
}

// Patch stage / notes / owner on an existing entry.
async function patch(id, fields) {
  const d = await read();
  const e = Array.isArray(d.entries) ? d.entries : [];
  const i = e.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false, error: "not found" };
  const allow = {};
  if (fields.stage && STAGES.includes(fields.stage)) allow.stage = fields.stage;
  if (typeof fields.notes === "string") allow.notes = fields.notes.slice(0, 4000);
  if (typeof fields.owner === "string") allow.owner = fields.owner.slice(0, 120);
  e[i] = Object.assign({}, e[i], allow, { updatedAt: new Date().toISOString() });
  d.entries = e;
  await write(d);
  return { ok: true, entry: e[i] };
}

async function remove(id) {
  const d = await read();
  d.entries = (Array.isArray(d.entries) ? d.entries : []).filter((x) => x.id !== id);
  await write(d);
  return { ok: true, count: d.entries.length };
}

module.exports = { STAGES, listBoard, upsert, patch, remove };
