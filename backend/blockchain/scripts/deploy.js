// Deploys DHIVehiclePassport to the configured network and writes the ABI +
// address to ../lib/abi/ so the serverless functions can use them.
//   Usage: npx hardhat run scripts/deploy.js --network baseSepolia
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const net = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account. Set DEPLOYER_KEY in backend/blockchain/.env");
  }
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network: ${net}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(bal)} ETH`);
  if (bal === 0n) {
    console.warn("⚠️  Deployer balance is 0 — fund it from a testnet faucet first.");
  }

  const Factory = await hre.ethers.getContractFactory("DHIVehiclePassport");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`\n✅ DHIVehiclePassport deployed to: ${address}`);

  // Export ABI + address for the serverless functions.
  const artifact = await hre.artifacts.readArtifact("DHIVehiclePassport");
  const outDir = path.resolve(__dirname, "../../lib/abi");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "DHIVehiclePassport.json"),
    JSON.stringify({ address, network: net, abi: artifact.abi }, null, 2)
  );
  console.log(`ABI written to backend/lib/abi/DHIVehiclePassport.json`);
  console.log(`\nNext: set PASSPORT_CONTRACT_ADDRESS=${address} in Netlify env.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
