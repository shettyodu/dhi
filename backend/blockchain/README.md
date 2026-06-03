# DHI Vehicle Passport — Smart Contract (Phase 1, testnet)

ERC-721 contract that anchors the SHA-256 hash of a vehicle's canonical
provenance record on-chain. **Provenance record, not a security.** Testnet only.

This subproject is **deploy-time only** — it is NOT bundled into the serverless
functions. The functions only need the deployed address + ABI (written to
`../lib/abi/DHIVehiclePassport.json` by the deploy script) and a minter key.

## One-time setup

1. **Create a testnet wallet** (e.g., in MetaMask, or `npx hardhat` console). Copy its private key.
2. **Fund it** from a Base Sepolia faucet (free), e.g. the Coinbase/Alchemy Base Sepolia faucet. You only need a tiny amount of test ETH.
3. `cd backend/blockchain && npm install`
4. `cp .env.example .env` and set `DEPLOYER_KEY` (and optionally `BASE_SEPOLIA_RPC_URL`).

## Compile & deploy

```bash
npm run compile
npm run deploy:base      # deploys to Base Sepolia, prints the contract address
```

The deploy script writes `../lib/abi/DHIVehiclePassport.json` (address + ABI).

## After deploy — set these in Netlify env (NOT in code)

- `PASSPORT_CONTRACT_ADDRESS` = the printed address
- `PASSPORT_MINTER_KEY` = the same testnet private key (the contract owner mints)
- `BASE_SEPOLIA_RPC_URL` = your RPC (defaults to the public endpoint)

## Notes
- **Testnet only.** Mainnet, real custody, KYC/AML, and a transfer agent are a
  later, security-and-legal-reviewed phase.
- The minter wallet is the contract `owner` (only the owner can mint passports).
- Explorer: https://sepolia.basescan.org/
