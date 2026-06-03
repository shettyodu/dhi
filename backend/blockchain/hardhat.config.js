require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const KEY = process.env.DEPLOYER_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    // OpenZeppelin v5.1 emits the `mcopy` opcode → requires the Cancun EVM target.
    // Base Sepolia (and Base mainnet, via Ecotone) support Cancun.
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    baseSepolia: {
      url: RPC,
      chainId: 84532,
      accounts: KEY ? [KEY] : [],
    },
    // Drop-in alternative testnet (set POLYGON_AMOY_RPC_URL to use):
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: KEY ? [KEY] : [],
    },
  },
};
