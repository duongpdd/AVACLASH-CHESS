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

## Hướng dẫn chạy thử cục bộ End-to-End với Anvil

Dưới đây là hướng dẫn chi tiết từng bước để khởi chạy và chơi thử nghiệm AvaClash Chess cục bộ end-to-end trên máy tính với Anvil:

### Bước 1: Build Smart Contracts & Sinh ABI
```bash
# Build contracts với Foundry
cd contracts
forge build
cd ..

# Sinh ABI TypeScript sang packages/shared
pnpm -r pretest
```

### Bước 2: Chạy Anvil Local Node (Chain ID 31337)
Mở một cửa sổ Terminal mới:
```bash
anvil --chain-id 31337 --port 8545
```
Anvil cung cấp sẵn 10 tài khoản thử nghiệm với 10,000 ETH mỗi tài khoản:
- Tài khoản 0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`): Dùng làm Deployer.
- Tài khoản 1 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`): Dùng làm `RELAY_SIGNER_ADDRESS` (Private key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`).
- Tài khoản 2 (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`): Dùng làm `ARBITER_ADDRESS`.
- Tài khoản 3 (`0x90F79bf6EB2c4f870365E785982E1f101E93b906`): Dùng làm `TREASURY_ADDRESS`.
- Tài khoản 4 & 5: Dùng làm Người chơi A và Người chơi B.

### Bước 3: Deploy Smart Contracts lên Anvil
Tại thư mục `contracts`:
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```
Lấy địa chỉ hợp đồng `ChessEscrow` và `AvaClashMeta` được in ra trên Terminal sau khi script hoàn thành.

### Bước 4: Chạy Relay Server
Tạo file cấu hình `.env` cho Relay hoặc export trực tiếp các biến môi trường:
```bash
cd packages/relay
```
Cấu hình các biến môi trường:
- `PORT=8080`
- `RELAY_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- `CONTRACT_ADDRESS=<địa_chỉ_ChessEscrow_vừa_deploy>`
- `RPC_URL=http://127.0.0.1:8545`
- `CHAIN_ID=31337`
- `ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000` *(BẮT BUỘC: phải chứa origin của web để không bị chặn lỗi 403 Forbidden)*
- `RESULTS_DIR=./results`
- `ACTIVE_DIR=./active`

Khởi động Relay Server:
```bash
pnpm start
```

### Bước 5: Chạy Web Frontend
Mở cửa sổ Terminal mới:
```bash
cd web
```
Cấu hình file `web/.env.local`:
```env
NEXT_PUBLIC_ESCROW_ADDRESS=<địa_chỉ_ChessEscrow>
NEXT_PUBLIC_META_ADDRESS=<địa_chỉ_AvaClashMeta>
NEXT_PUBLIC_RELAY_URL=ws://127.0.0.1:8080
NEXT_PUBLIC_CHAIN_ID=31337
```
Khởi động giao diện web:
```bash
pnpm dev
```
Giao diện sẽ chạy tại `http://localhost:3000`.

### Bước 6: Chơi Thử Nghiệm Giữa 2 Trình Duyệt / 2 Ví
1. Mở 2 trình duyệt riêng biệt (ví dụ: Google Chrome và Microsoft Edge, hoặc 1 cửa sổ Ẩn danh):
   - Trình duyệt 1: Import Tài khoản 4 vào MetaMask/ví Web3, kết nối với mạng Anvil Local RPC (`http://127.0.0.1:8545`, Chain ID `31337`).
   - Trình duyệt 2: Import Tài khoản 5 vào MetaMask/ví Web3, kết nối với cùng mạng Anvil.
2. Tại Trình duyệt 1:
   - Truy cập `http://localhost:3000`, bấm **Tạo phòng**, chọn cược (ví dụ: 0.1 ETH) và chọn màu quân (Trắng/Đen). Xác nhận giao dịch `createRoom` trên ví.
3. Tại Trình duyệt 2:
   - Xem danh sách phòng hoặc nhập mã Room ID, bấm **Vào phòng** (`joinRoom`). Xác nhận nạp tiền cược tương ứng trên ví.
4. Cả hai người chơi sẽ tự động chuyển sang trang `/game?room=<id>`:
   - Hệ thống tự động kết nối WebSocket tới Relay Server và yêu cầu ký EIP-712 `Join` trên ví cá nhân (tuyệt đối không nhập khóa riêng trên trang web).
   - Ván cờ bắt đầu: bàn cờ hiển thị đúng màu quân, chỉ cho đi khi đến lượt; nước đi được chuyển qua Relay và đồng bộ tức thì cho đối thủ.
   - Hỗ trợ các nút hành động: Xin hòa, Chấp nhận/Từ chối hòa, Đầu hàng.
   - Khi có kết quả (chiếu hết, đối thủ đầu hàng hoặc đồng ý hòa), hệ thống gọi `verifyResultProposal` để kiểm tra tính toàn vẹn, sau đó yêu cầu người thắng/hòa ký EIP-712 Result và gọi `submitResult` lên `ChessEscrow` (cơ chế đồng thuận 2-trong-3: chữ ký người chơi + chữ ký Relay).
   - Sau khi phòng chuyển sang trạng thái Settled, số dư thắng cuộc xuất hiện tại mục **Rút tiền**, người chơi bấm nút để rút tiền thưởng về ví.

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
8. **Chữ ký Join chưa gắn Origin (Rủi ro Phishing):** Payload ký EIP-712 `Join(uint256 roomId, address player, bytes32 nonce, uint256 expiresAt)` hiện tại chưa gắn trường origin/domain web (`webOrigin`), dẫn đến rủi ro lừa đảo chữ ký (cross-origin signature phishing) nếu người dùng tương tác với một trang web độc hại nhắm vào cùng Relay Server.
9. **Relay là bên tin cậy duy nhất cho phán quyết thắng/thua:** Relay Server là bên trung gian duy nhất xác thực và đồng ký (co-sign) kết quả ván cờ theo cơ chế đồng thuận 2-trong-3 (`submitResult`).
10. **Người chơi chỉ kiểm tra được tính nhất quán logic:** Hàm xác thực phía client (`verifyResultProposal`) chỉ kiểm tra được tính nhất quán logic và tính hợp lệ của chuỗi nước đi (replay ván cờ, chiếu hết tự nhiên, hòa tự nhiên). Người chơi không thể xác minh bằng chứng mật mã học cho các sự kiện đơn phương như đối thủ xin đầu hàng (resign) hoặc đối thủ hết giờ (timeout) nếu phía đối thủ không cùng ký.
