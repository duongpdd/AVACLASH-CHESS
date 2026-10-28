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

## Phạm vi demo Fuji

Dự án AvaClash Chess hiện đang triển khai và thử nghiệm trên mạng **Avalanche Fuji Testnet**. Phạm vi demo bao gồm:
- **Ký quỹ cá cược 1v1 PvP:** Nạp cược AVAX, chọn màu quân, ghép cặp và ký quỹ qua hợp đồng `ChessEscrow.sol`.
- **Luật cờ FIDE 5+0 Blitz:** Bàn cờ trực quan (Phaser 3 / Canvas) đồng bộ thời gian thực qua WebSocket Relay Server.
- **Chứng thực phân xử EIP-712:** Kết quả ván đấu có chữ ký kép (hai người chơi) hoặc chữ ký relay (`relaySigner`) giải ngân trực tiếp on-chain.
- **Thị trường cược khán giả Parimutuel:** Đặt cược vào 3 cửa (Trắng / Đen / Hòa) trong cửa sổ 120s trước khi ván đấu diễn ra với cơ chế hoàn trả an toàn.
- **Tính điểm ELO on-chain & No-Loss Vault:** Cập nhật ELO minh bạch trên `AvaClashMeta.sol` và staking AVAX nhận điểm mùa giải.

## Hạn chế đã biết

1. **Cơ chế Single-Signed tắt mặc định:** `isSingleSignedEnabled = false` trên Fuji để triệt tiêu rủi ro tranh chấp bất đối xứng; chỉ mở lại khi có giải pháp fraud-proof hoặc chữ ký từng nước đi hoàn chỉnh.
2. **Trọng tài (`arbiter`) là địa chỉ đơn lẻ:** Trọng tài hiện là một khóa ví đáng tin cậy giải quyết tranh chấp bond mà chưa có bằng chứng mật mã học (zero-knowledge proof hay interactive fraud proof on-chain).
3. **Hệ thống ELO chưa chống Sybil triệt để:** Thuật toán hiện tại chỉ giảm hệ số thay đổi $\Delta$ khi hai địa chỉ ví gặp nhau nhiều lần trong ngày, chưa phát hiện và ngăn chặn được việc người dùng tạo nhiều ví phụ để cày điểm.
4. **Cược khán giả chỉ là thử nghiệm:** Mô hình parimutuel spectator pool trên `AvaClashMeta.sol` hiện tại đóng vai trò thử nghiệm thị trường dự đoán; người dùng không nên sử dụng với giá trị vốn lớn.
5. **Relay là điểm tin cậy duy nhất (Single Point of Trust):** Relay Server đóng vai trò điều phối nước đi và đồng hồ ngoài chuỗi; nếu Relay gặp sự cố hoặc offline kéo dài, ván đấu cần giải quyết qua cơ chế timeout hoặc khôi phục từ snapshot đĩa.
6. **Chưa qua kiểm toán độc lập (Audit):** Toàn bộ mã nguồn hợp đồng thông minh và relay server chưa được kiểm toán bởi đơn vị bảo mật bên thứ ba; không phù hợp để triển khai trên Avalanche C-Chain Mainnet mà không có audit.
7. **Quỹ giải thưởng mùa giải (`seasonPrizePool`) chưa có cơ chế chi trả:** Phần tích lũy 5% phí spectator vào `seasonPrizePool` hiện được giữ an toàn trên hợp đồng và chưa có smart contract phân bổ thưởng cuối mùa giải.
