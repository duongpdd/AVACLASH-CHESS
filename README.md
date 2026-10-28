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

## Running Relay Behind Reverse Proxy (Caddy / Nginx)

When deploying `@avaclash/relay` in production, terminate TLS at a reverse proxy (Caddy or Nginx) to serve secure WebSocket (`wss://`).

### Environment Variables
- `TRUST_PROXY=true`: Instructs the relay to trust the `X-Forwarded-For` header and extract the client's public IP (the first IP in the list).
- `ALLOWED_ORIGINS=https://avaclash.app,https://staging.avaclash.app`: Comma-separated list of allowed Origins. Connections with other origins are rejected with `403 Forbidden` during WebSocket upgrade (`verifyClient`).
- `ALLOW_NO_ORIGIN=false`: Reject requests missing the `Origin` header (defaults to true only in test environments).

### 1. Caddy Configuration (`Caddyfile`)
```caddy
relay.avaclash.app {
    reverse_proxy localhost:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### 2. Nginx Configuration (`nginx.conf`)
```nginx
server {
    server_name relay.avaclash.app;
    listen 443 ssl http2;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;

        # Overwrite X-Forwarded-For with the real client IP:
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```
