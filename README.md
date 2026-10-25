# AvaClash Chess

Deterministic on-chain/off-chain hybrid chess wagering platform on Avalanche.

## Smart Contracts & Deployment Guide

Contracts are developed using Foundry and deployed to Avalanche Fuji Testnet or C-Chain Mainnet.

### 1. Requirements & Configuration
Ensure you have Foundry installed (`forge`, `cast`).

Copy `.env.example` to `.env` and configure the mandatory public addresses:
- `RELAY_SIGNER_ADDRESS`: Public address of the off-chain WebSocket relay server signer.
- `ARBITER_ADDRESS`: Public address of the challenge resolution arbiter (must differ from relay signer).
- `TREASURY_ADDRESS`: Public address where protocol fees (5%) are withdrawn.
- `FUJI_RPC_URL`: Avalanche Fuji RPC endpoint (e.g. `https://api.avax-test.network/ext/bc/C/rpc`).

> **Security Rule:** Never store plaintext / naked deployer private keys (`DEPLOYER_PRIVATE_KEY`) in `.env` or shell history.

### 2. Secure Deployment with Foundry Keystore (`--account`)

1. **Import your deployer account into encrypted local keystore:**
   ```bash
   cast wallet import avaclash-deployer --interactive
   ```
   You will be securely prompted to enter your private key and choose a password.

2. **Verify imported account:**
   ```bash
   cast wallet list
   ```

3. **Dry-run deployment simulation:**
   ```bash
   forge script contracts/script/Deploy.s.sol:DeployScript \
     --rpc-url $FUJI_RPC_URL \
     --account avaclash-deployer
   ```

4. **Broadcast deployment on-chain:**
   ```bash
   forge script contracts/script/Deploy.s.sol:DeployScript \
     --rpc-url $FUJI_RPC_URL \
     --account avaclash-deployer \
     --broadcast \
     --verify
   ```

`Deploy.s.sol` automatically:
- Validates that `RELAY_SIGNER_ADDRESS`, `ARBITER_ADDRESS`, and `TREASURY_ADDRESS` are non-zero and mutually distinct.
- Deploys `AvaClashMeta`.
- Deploys `ChessEscrow(relaySigner, arbiter, treasury)`.
- Links contracts bidirectionally (`meta.setEscrowContract` and `escrow.setMetaContract`).

### 3. Testing
```bash
# Run smart contract tests
forge test

# Run TypeScript / workspace tests
pnpm test
```
