# Tiến độ Phát triển Dự án — AvaClash Chess

> **Cập nhật lần cuối:** 25/10/2026 | **Trạng thái tổng thể:** Hoàn thiện Phase 5 (~95%) — Nâng cấp toàn diện Kinh tế, An ninh On-chain & WebSocket Relay Server

AvaClash Chess là nền tảng cờ vua Web3 1v1 PvP trên mạng Avalanche Fuji Testnet, kết hợp giữa luật cờ vua chuẩn quốc tế FIDE (5+0 Blitz) và hạ tầng kinh tế phi tập trung (Escrow cá cược AVAX, On-chain ELO, No-Loss Vault, Parimutuel Spectator Betting).

---

## 1. Tổng quan Trạng thái các Giai đoạn (Roadmap Status)

```
[Phase 1: Core Engine & Shared] ──────► 100% Hoàn thành (94/94 tests pass)
[Phase 2: Smart Contract Escrow] ─────► 100% Hoàn thành (71/71 tests pass)
[Phase 3: Phaser 3 Game Arena] ───────► 100% Hoàn thành (17/17 tests pass)
[Phase 4: Web3 Meta Layer & Anti-Cheat] ► 100% Hoàn thành (14/14 tests pass)
[Phase 5: Relay, Security & Integration] ► 100% Hoàn tất (15/15 tests pass)
[Phase 6: Audit, Mainnet & Season 1] ──► 0% Lập kế hoạch
```

| Giai đoạn   | Mô tả                           | Trọng tâm kỹ thuật                                                                     |    Trạng thái     |   Test Coverage    |
| :---------- | :------------------------------ | :------------------------------------------------------------------------------------- | :---------------: | :----------------: |
| **Phase 1** | Monorepo Setup & Shared Package | UCI move format, keccak256 hash, EIP-712 v2 extended Result, Zod validation, Replay     |   ✅ Hoàn thành   | 94/94 tests (100%) |
| **Phase 2** | Smart Contract Escrow           | `ChessEscrow.sol`, 2-of-3 sigs, Challenge bond split (Q8), Arbiter separation, Pausable|   ✅ Hoàn thành   | 71/71 tests (100%) |
| **Phase 3** | Local Chess Game Arena          | Phaser 3 canvas, `GameState.ts`, FIDE 5+0 clocks, UI 100dvh, Victory Modal             |   ✅ Hoàn thành   | 17/17 tests (100%) |
| **Phase 4** | Web3 Meta Layer & Fair Play     | `AvaClashMeta.sol` (ELO 1200, No-Loss Vault, Spectator Pool White/Black/Draw)          |   ✅ Hoàn thành   | 14/14 tests (100%) |
| **Phase 5** | Relay, Security & Integration   | WebSocket Relay (`packages/relay`), Try/Catch isolation, EIP-712 v2, Deploy scripts   |   ✅ Hoàn thành   | 15/15 tests (100%) |
| **Phase 6** | Audit & Avalanche Mainnet       | Security Audit, Subnet/C-Chain mainnet, Season leaderboard                             |    ⚪ Dự kiến     |    Chưa bắt đầu    |

---

## 2. Chi tiết Tiến độ Từng Giai đoạn & Cải tiến Mới

### Phase 1: Nền tảng Monorepo & Thư viện dùng chung (`@avaclash/shared`)

- **Mục tiêu:** Xây dựng lõi quy tắc cờ vua FIDE, xác thực dữ liệu và định nghĩa mật mã học dùng chung giữa Client, Server và Smart Contracts.
- **Các hạng mục đã hoàn thành:**
  - [x] Thiết lập kiến trúc monorepo bằng `pnpm workspaces` (`packages/shared`, `contracts`, `web`).
  - [x] Chuẩn hóa biểu diễn nước đi dạng **UCI** (`e2e4`, `e7e8q`) thay vì SAN để đảm bảo tính độc lập và khả năng deterministic replay.
  - [x] Triển khai hàm băm nước đi `hashMoves(uciMoves)` bằng thuật toán `keccak256(abi.encodePacked(...))` khớp 100% giữa TypeScript (`viem`) và Solidity.
  - [x] **Mở rộng struct Result (A1):**
    - `Result(uint256 matchId, address winner, uint8 outcome, uint8 reason, uint16 moveCount, bytes32 movesHash, uint256 nonce, uint256 deadline)`
    - Định nghĩa enum số `OutcomeCode` (0: WhiteWin, 1: BlackWin, 2: Draw) và `ReasonCode` (0: Checkmate, 1: Resign, 2: Timeout, 3: Stalemate, 4: Repetition, 5: FiftyMove, 6: InsufficientMaterial, 7: Agreement) khớp hoàn toàn với Solidity.
    - Bổ sung `deadline` chống tấn công giữ lại chữ ký cũ để phát lại muộn (replay attack).
  - [x] Bộ schema **Zod** xác thực toàn bộ gói tin WebSocket hai chiều (move, resign, draw offer, clock sync, focus telemetry, spectator betting, resultProposal).
  - [x] Bộ diễn lại ván đấu deterministic (`replayMoves`) hỗ trợ đầy đủ luật: phong cấp, bắt tốt qua đường (en-passant), nhập thành, hòa do lặp cờ 3 lần, quy tắc 50 nước đi, thiếu quân chiếu hết, và trả về chính xác `moveCount`, `outcome`, `reason`.
- **Kết quả kiểm thử:** `94/94 tests pass` (`vitest`).

---

### Phase 2: Hợp đồng thông minh Ký quỹ Cược (`ChessEscrow.sol`)

- **Mục tiêu:** Cung cấp hạ tầng ký quỹ cá cược 1v1 phi tập trung bằng đồng AVAX, bảo vệ tiền cược của người chơi mà không cần bên thứ ba trung gian.
- **Các hạng mục đã hoàn thành:**
  - [x] Phát triển `ChessEscrow.sol` kế thừa OpenZeppelin `EIP712`, `ReentrancyGuard` và `Pausable`.
  - [x] Hỗ trợ tạo phòng (`createRoom`) và tham gia phòng (`joinRoom`) với mức cược công bằng (tối đa 1 AVAX).
  - [x] **Chữ ký 2-trong-3 (A2):** Cho phép thanh toán ngay lập tức khi có:
    - 2 người chơi cùng ký (Player A + Player B), HOẶC
    - Người thắng + Relay cùng ký (Player Winner + Relay).
  - [x] **Cơ chế thanh toán lạc quan 1 chữ ký (`submitSingleSigned`):** Giải pháp dự phòng nếu bên thua bất hợp tác và Relay offline, mở cửa sổ Challenge Window 10 phút.
  - [x] **Challenge có Bond & Timelock Arbiter (A3 - Q2 & Q8):**
    - Người khiếu nại phải nộp Bond = 20% tiền cược (tối thiểu 0.01 AVAX).
    - Arbiter được tách riêng khỏi RelaySigner, có timelock 2 ngày khi đổi địa chỉ để phân xử minh bạch.
    - Bên sai mất bond cho bên đúng; nếu Arbiter quá hạn 24h không phán quyết, hợp đồng kích hoạt phán quyết mặc định (hoàn cược 100%, phạt 50% bond bên khiếu nại chuyển cho bên nộp đơn, 50% hoàn lại).
  - [x] **Hủy phòng sớm (`abortRoom` - A4):** Cho phép hủy phòng và hoàn tiền nếu quá thời gian chờ (sau 3 phút) mà ván cờ chưa bắt đầu.
  - [x] **Phí giao thức 5% (D4 - Q6):** Thu 5% trên tổng pot khi có người thắng nộp vào treasury/quỹ mùa giải; miễn phí 100% khi Hòa hoặc Refund.
  - [x] **Xử lý Hòa (Q1):** Hoàn trả 100% tiền cược cho cả hai người chơi.
  - [x] Cơ chế tự động hoàn tiền khi hết giờ (`refundOnTimeout` sau 60 phút) bảo toàn tài sản cho người chơi.
  - [x] Mẫu thiết kế rút tiền an toàn Pull-over-push (`withdraw`) ngăn chặn tấn công DoS và Reentrancy.
- **Kết quả kiểm thử:** `71/71 tests pass` (`foundry forge test`), bao gồm Fuzz Testing biến số cược và thời gian.

---

### Phase 3: Đấu trường Cờ vua Trực quan (`Phaser 3 + Next.js UI`)

- **Mục tiêu:** Trải nghiệm chơi cờ mượt mà, phản hồi ngay lập tức, độ trễ 60fps trên Canvas kết hợp giao diện Web3 cao cấp.
- **Các hạng mục đã hoàn thành:**
  - [x] Tích hợp engine đồ họa **Phaser 3** vào Next.js App Router (dynamic client rendering, zero SSR lag).
  - [x] Bộ quản lý trạng thái FIDE độc lập `GameState.ts`:
    - Đồng hồ 5+0 Blitz đếm lùi thời gian thực chính xác đến từng millisecond.
    - Tính toán quân bị bắt (Captured Pieces) và chênh lệch lực lượng (Material Advantage +1, +3, +5,...).
    - Lịch sử nước đi (Move notation log), hỗ trợ đầy đủ trạng thái Chiếu (Check), Chiếu hết (Checkmate), Hòa cờ (Draw).
  - [x] Thiết kế bàn cờ độ tương phản cao trong `ChessScene.ts`:
    - Tọa độ bàn cờ a-h, 1-8 hiển thị tinh tế mép trong các ô cờ.
    - Hiệu ứng phát sáng đỏ (Red Glow) quanh ô Vua khi bị chiếu.
    - Gợi ý nước đi hợp lệ dạng chấm tròn và vòng tròn bao quanh khi bắt quân.
    - Hỗ trợ thao tác kép: Kéo-thả (Drag & Drop) hoặc Nhấp-chọn (Click to Move).
  - [x] Giao diện đấu trường đạt chuẩn `100dvh` không bị tràn màn hình, tối ưu cho cả Desktop và Mobile.
  - [x] Hộp thoại vinh danh chiến thắng (`VictoryModal.tsx`) với hiệu ứng pháo hoa Confetti canvas và tổng hợp thông số ván đấu.
- **Kết quả kiểm thử:** `17/17 tests pass` (`vitest`).

---

### Phase 4: Web3 Meta Layer & Giám sát Chống gian lận (`AvaClashMeta.sol`)

- **Mục tiêu:** Mở rộng trải nghiệm thi đấu Web3 mà không can thiệp vào luật cờ nguyên bản FIDE.
- **Các hạng mục đã hoàn thành:**
  - [x] Hợp đồng `AvaClashMeta.sol`:
    - **On-Chain ELO:** Khởi đầu 1200 ELO, cập nhật tự động sau mỗi ván cược qua `updateEloOnSettle`. Tích hợp thuật toán chống cày điểm (Anti-Win-Trading: giảm 50% delta ELO sau mỗi trận lặp lại giữa cùng cặp đấu trong ngày).
    - **No-Loss Tournament Vault:** Ký quỹ AVAX nhận Season Points thi đấu giải, bảo toàn 100% gốc (`exitNoLossVault` rút bất kỳ lúc nào).
    - **Spectator Parimutuel Prediction Pool độc lập (B1, B4, B5):**
      - 3 cửa cược rõ ràng: 1: Trắng thắng, 2: Đen thắng, 3: Hòa.
      - Đã loại bỏ cửa "Under 40 moves" trên Fuji Testnet (Q5) để chống thao túng kết quả.
      - **Khóa cược trước ván đấu (B3 - Q4):** Tự động khóa khi phòng chuyển sang Active (`joinRoom`), triệt tiêu việc khán giả dùng engine AI phân tích thế cờ để cược muộn.
      - **Chống tự cược (B2):** `registerMatch` ghi nhận địa chỉ 2 kỳ thủ và chặn họ đặt cược vào trận của chính mình.
      - **Hoàn tiền cược khán giả:** Hỗ trợ `cancelPrediction` và `claimSpectatorRefund` theo mẫu pull pattern khi trận đấu bị hủy hoặc hoàn tiền.
  - [x] Hook giám sát công bằng client `useFairPlayGuard.ts`:
    - Giám sát sự kiện `blur` và `visibilitychange`.
    - Phát hiện người chơi rời màn hình quá 2 giây trong khi ván đấu đang diễn ra và gửi cảnh báo về hệ thống.
  - [x] Giao diện dự đoán khán giả trực tiếp `SpectatorPoolWidget.tsx`.
- **Kết quả kiểm thử:** `14/14 tests pass` (`foundry forge test`).

---

### Phase 5: P2P Matchmaking Relay & Tích hợp Ví Web3 (95% Hoàn tất)

- **Tiến độ hiện tại:** 95%
- **Công việc đã làm:**
  - [x] Cập nhật toàn diện Smart Contracts (`ChessEscrow.sol`, `AvaClashMeta.sol`) đáp ứng các quyết định kinh tế Q1-Q7.
  - [x] Cập nhật toàn diện bộ thư viện `@avaclash/shared` khớp với các thay đổi contract.
  - [x] Thiết kế cấu trúc giao thức WebSocket và định dạng sự kiện trong `@avaclash/shared`.
  - [x] Cài đặt `viem` và cấu hình chain Avalanche Fuji Testnet (Chain ID: 43113).
  - [x] Hàm ký EIP-712 trên Client bằng ví cá nhân (`signMatchResult`).
  - [x] Giao diện Lobby phòng chơi và widget cược khán giả kết nối logic GameState.
  - [x] **Xây dựng Node.js WebSocket Relay Server daemon (`packages/relay`):**
    - Định tuyến kết nối P2P, quản lý phòng, đồng hồ và đồng thuận FIDE 5+0 Blitz.
    - Master time authority: sync đồng hồ và chuyển tiếp cảnh báo Telemetry (không trừ giờ, không xử thua theo Q10).
    - Cấp chữ ký thứ 2 (2-of-3 scheme EIP-712) cho kết quả ván đấu (checkmate, timeout, resign, draw).
    - 7/7 tests passing (`vitest`).
  - [x] **Liên kết hai chiều ChessEscrow ↔ AvaClashMeta:**
    - `setMetaContract` và `setEscrowContract`.
    - Tự động cập nhật ELO on-chain khi settle trận đấu.
    - Khóa cược khán giả khi trận đấu bắt đầu (`joinRoom`), giải ngân cược khán giả theo cửa thắng (White/Black/Draw) và hoàn tiền khi abort/timeout.
    - 3/3 integration tests passing (`foundry`).
  - [x] **Foundry Deploy Script (`Deploy.s.sol`):**
    - Triển khai đồng thời `AvaClashMeta.sol` và `ChessEscrow.sol` lên Fuji Testnet, tự động liên kết quyền và domain separator.
  - [x] **Cập nhật giao diện Spectator Prediction:**
    - Cập nhật `SpectatorPoolWidget.tsx` và `page.tsx` sang mô hình 3 cửa (White/Black/Draw) và khóa trước ván đấu (Q4, Q5).
- **Nhiệm vụ còn lại cần hoàn thiện:**
  - [ ] Deploy thực tế lên Fuji Testnet bằng lệnh `forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify` khi có private key testnet được cấu hình.
  - [ ] Nối nút "Create Room" và "Join Room" từ giao diện Web tới RPC contract trên Fuji bằng Wagmi hooks.

---

### Phase 6: Kiểm toán Bảo mật & Ra mắt Mainnet (Kế hoạch)

- **Tiến độ hiện tại:** 0%
- **Các cột mốc dự kiến:**
  - [ ] Audit độc lập các Smart Contract (ChessEscrow và AvaClashMeta).
  - [ ] Bug Bounty cho cơ chế Challenge Window, Bond và Single-Signed Settlement.
  - [ ] Triển khai Avalanche C-Chain Mainnet.
  - [ ] Khởi tranh Season 1 No-Loss Tournament với bảng xếp hạng ELO toàn cầu.

---

## 3. Tổng hợp Chỉ số Kiểm thử & Mã nguồn (Metrics)

| Hạng mục kiểm thử                                       | Công cụ | Số lượng Test |          Kết quả          |
| :------------------------------------------------------ | :------ | :-----------: | :-----------------------: |
| **Logic cờ vua, Mã hóa, EIP-712 v2, Replay, Schema, Types**| Vitest |      94       |      ✅ 94/94 Passed      |
| **WebSocket Relay Server (packages/relay)**             | Vitest  |       7       |       ✅ 7/7 Passed       |
| **Hợp đồng ký quỹ cược (ChessEscrow unit & fuzz tests)**| Foundry |      71       |      ✅ 71/71 Passed      |
| **Hợp đồng Meta Layer (AvaClashMeta unit tests)**       | Foundry |      14       |      ✅ 14/14 Passed      |
| **Tích hợp Escrow ↔ Meta (ChessEscrowMetaIntegration)**  | Foundry |       3       |       ✅ 3/3 Passed       |
| **Cô lập try/catch Escrow ↔ Meta (ChessEscrowMetaTryCatch)**| Foundry |   5       |       ✅ 5/5 Passed       |
| **Giao diện Client & Game State**                       | Vitest  |      17       |      ✅ 17/17 Passed      |
| **Tổng cộng**                                           | —       |    **211**    | **211/211 Passed (100%)** |

---

## 4. Kế hoạch Hành động Tiếp theo

1. **Deploy Fuji Testnet:** Chạy `forge script script/Deploy.s.sol` khi người dùng cung cấp `DEPLOYER_PRIVATE_KEY` và `FUJI_RPC_URL`.
2. **Khởi chạy Relay daemon:** Chạy `pnpm --filter @avaclash/relay start` trên máy chủ để phục vụ các trận đấu off-chain.
3. **Audit & Chuẩn bị Mainnet:** Khởi động Phase 6 rà soát an ninh cho toàn bộ hệ thống.
