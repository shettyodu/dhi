/* Framework-agnostic core logic for the Vehicle Passport tokenization feature.
   Mirrors lib/handlers.js: each function takes plain inputs and returns
   { status, json }. Thin Netlify/Vercel wrappers handle HTTP/CORS.

   Phase 1 — PROVENANCE ONLY. A passport is a verifiable digital record (title,
   history, ownership) whose SHA-256 hash is anchored on-chain (ERC-721, testnet).
   It is NOT a security or financial instrument and does not replace DMV title. */

const crypto = require("crypto");
const { ethers } = require("ethers");
const { getStore } = require("@netlify/blobs");

const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const CONTRACT = process.env.PASSPORT_CONTRACT_ADDRESS || "";
const MINTER_KEY = process.env.PASSPORT_MINTER_KEY || "";
const EXPLORER = process.env.PASSPORT_EXPLORER || "https://sepolia.basescan.org";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "https://courageous-fairy-0b2d3c.netlify.app";

// Minimal ABI — only what the functions call (no dependency on build artifacts).
const ABI = [
  "function mintPassport(address to, bytes32 vinHash, bytes32 recordHash, string uri) returns (uint256)",
  "function recordHashOf(uint256 tokenId) view returns (bytes32)",
  "function tokenIdByVin(bytes32) view returns (uint256)",
];

const STORE = "vehicle-passports";
const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/; // excludes I, O, Q per VIN spec

function store() { return getStore(STORE); }
function sha256Hex(s) { return crypto.createHash("sha256").update(s, "utf8").digest("hex"); }
function vinHashOf(vin) { return ethers.keccak256(ethers.toUtf8Bytes(vin)); }
function provider() { return new ethers.JsonRpcProvider(RPC); }

// Stable, deterministic serialization of the fields that the on-chain hash commits to.
function canonical(rec) {
  const c = {
    vin: String(rec.vin || "").trim().toUpperCase(),
    year: rec.year != null ? String(rec.year).trim() : "",
    make: String(rec.make || "").trim(),
    model: String(rec.model || "").trim(),
    owner: String(rec.owner || "").trim(),
    mileage: rec.mileage != null ? String(rec.mileage).trim() : "",
    history: String(rec.history || "").trim(),
    notes: String(rec.notes || "").trim(),
    issuedAt: String(rec.issuedAt || ""),
  };
  return JSON.stringify(c, Object.keys(c).sort());
}

function txUrl(h) { return `${EXPLORER}/tx/${h}`; }
function tokenUrl(addr, id) { return `${EXPLORER}/token/${addr}?a=${id}`; }

async function createPassport(body) {
  const rec = body || {};
  const vin = String(rec.vin || "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) return { status: 400, json: { error: "A valid VIN (11–17 chars) is required" } };
  if (!rec.year || !rec.make || !rec.model) return { status: 400, json: { error: "year, make, and model are required" } };
  if (!rec.owner) return { status: 400, json: { error: "owner is required" } };
  if (!CONTRACT || !MINTER_KEY) {
    return { status: 503, json: { error: "Tokenization is not configured yet (PASSPORT_CONTRACT_ADDRESS / PASSPORT_MINTER_KEY)." } };
  }

  const vh = vinHashOf(vin);
  const ro = new ethers.Contract(CONTRACT, ABI, provider());

  // Prevent duplicates with a friendly error before spending gas.
  try {
    const existing = await ro.tokenIdByVin(vh);
    if (existing && existing !== 0n) {
      return { status: 409, json: { error: `A passport already exists for VIN ${vin}`, tokenId: existing.toString() } };
    }
  } catch (e) { /* if RPC read fails, let the mint attempt surface the error */ }

  const record = {
    vin,
    year: String(rec.year).trim(),
    make: String(rec.make).trim(),
    model: String(rec.model).trim(),
    owner: String(rec.owner).trim(),
    mileage: rec.mileage != null ? String(rec.mileage).trim() : "",
    history: String(rec.history || "").trim(),
    notes: String(rec.notes || "").trim(),
    issuedAt: new Date().toISOString(),
  };
  const canonStr = canonical(record);
  const hashHex = sha256Hex(canonStr);          // 64 hex chars = 32 bytes
  const recordHash = "0x" + hashHex;            // bytes32
  const uri = `${PUBLIC_BASE}/automotive-passport.html?vin=${encodeURIComponent(vin)}`;

  // Persist the record first so we never lose it if the chain call is slow.
  const blob = store();
  await blob.setJSON(vin, { ...record, hash: recordHash, status: "minting" });

  // Mint the passport (anchors the hash on-chain).
  const wallet = new ethers.Wallet(MINTER_KEY, provider());
  const rw = new ethers.Contract(CONTRACT, ABI, wallet);
  const tx = await rw.mintPassport(wallet.address, vh, recordHash, uri);
  const receipt = await tx.wait();
  const tokenId = (await ro.tokenIdByVin(vh)).toString();

  const finalRec = { ...record, hash: recordHash, tokenId, txHash: tx.hash, contract: CONTRACT, status: "minted" };
  await blob.setJSON(vin, finalRec);

  return {
    status: 200,
    json: {
      passportId: vin,
      vin,
      tokenId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      hash: recordHash,
      contract: CONTRACT,
      explorerTx: txUrl(tx.hash),
      explorerToken: tokenUrl(CONTRACT, tokenId),
      record: finalRec,
    },
  };
}

async function verifyPassport(query) {
  const vin = String((query && (query.vin || query.passportId)) || "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) return { status: 400, json: { error: "A valid VIN is required" } };

  let rec;
  try { rec = await store().get(vin, { type: "json" }); } catch (e) { rec = null; }
  if (!rec) return { status: 404, json: { verified: false, error: `No passport found for VIN ${vin}` } };

  const computed = "0x" + sha256Hex(canonical(rec));
  let onChainHash = null, tokenId = null, verified = false;
  if (CONTRACT) {
    try {
      const ro = new ethers.Contract(CONTRACT, ABI, provider());
      const id = await ro.tokenIdByVin(vinHashOf(vin));
      if (id && id !== 0n) {
        tokenId = id.toString();
        onChainHash = await ro.recordHashOf(id);
        verified = onChainHash.toLowerCase() === computed.toLowerCase();
      }
    } catch (e) { /* chain read failure -> verified stays false */ }
  }

  return {
    status: 200,
    json: {
      verified,
      vin,
      tokenId,
      computedHash: computed,
      onChainHash,
      contract: CONTRACT || null,
      explorerToken: tokenId ? tokenUrl(CONTRACT, tokenId) : null,
      record: rec,
    },
  };
}

module.exports = { createPassport, verifyPassport, canonical, sha256Hex, vinHashOf };
