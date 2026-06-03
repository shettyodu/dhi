// Local sanity test on Hardhat's in-memory network (no testnet funds needed):
//   npx hardhat run scripts/localtest.js
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [owner, other] = await ethers.getSigners();
  const C = await ethers.getContractFactory("DHIVehiclePassport");
  const c = await C.deploy();
  await c.waitForDeployment();
  console.log("deployed:", await c.getAddress());

  const vin = "1HGCM82633A004352";
  const vinHash = ethers.keccak256(ethers.toUtf8Bytes(vin));
  const recordHash = "0x9dc9da12a6cafacc8c6db04bad503d98219fc1378a155600348a5bacd09b8533";
  const uri = "https://example.com/automotive-passport.html?vin=" + vin;

  const tx = await c.mintPassport(owner.address, vinHash, recordHash, uri);
  await tx.wait();
  const tokenId = await c.tokenIdByVin(vinHash);
  const onChain = await c.recordHashOf(tokenId);
  console.log("tokenId:", tokenId.toString());
  console.log("recordHash matches:", onChain.toLowerCase() === recordHash.toLowerCase());
  console.log("tokenURI:", await c.tokenURI(tokenId));
  console.log("ownerOf:", (await c.ownerOf(tokenId)) === owner.address);

  // duplicate VIN should revert
  let reverted = false;
  try { await (await c.mintPassport(owner.address, vinHash, recordHash, uri)).wait(); }
  catch (e) { reverted = true; }
  console.log("duplicate VIN reverted:", reverted);

  // non-owner cannot mint
  let ownerGuard = false;
  try { await (await c.connect(other).mintPassport(other.address, ethers.keccak256(ethers.toUtf8Bytes("OTHERVIN123456")), recordHash, uri)).wait(); }
  catch (e) { ownerGuard = true; }
  console.log("onlyOwner enforced:", ownerGuard);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
