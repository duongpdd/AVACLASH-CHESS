# Tiến độ Phát triển Dự án — AvaClash Chess

> **Cập nhật lần cuối:** 25/10/2026 | **Trạng thái tổng thể:** Hoàn thiện Phase 5 (~95%) — Nâng cấp toàn diện Kinh tế, An ninh On-chain & WebSocket Relay Server

AvaClash Chess là nền tảng cờ vua Web3 1v1 PvP trên mạng Avalanche Fuji Testnet, kết hợp giữa luật cờ vua chuẩn quốc tế FIDE (5+0 Blitz) và hạ tầng kinh tế phi tập trung (Escrow cá cược AVAX, On-chain ELO, No-Loss Vault, Parimutuel Spectator Betting).

---

## 1. Tổng quan Trạng thái các Giai đoạn (Roadmap Status)

```
[Phase 1: Core Engine & Shared] ──────► 100% Hoàn thành (95/95 tests pass)
[Phase 2: Smart Contract Escrow] ─────► 100% Hoàn thành (76/76 tests pass)
[Phase 3: Phaser 3 Game Arena] ───────► 100% Hoàn thành (17/17 tests pass)
[Phase 4: Web3 Meta Layer & Anti-Cheat] ► 100% Hoàn thành (18/18 tests pass)
[Phase 5: Relay, Security & Integration] ► ~60% Thực tế (Chưa Deploy Fuji, Chưa Nối Ví Web, Relay Chưa Xác Thực)
[Phase 6: Audit, Mainnet & Season 1] ──► 0% Lập kế hoạch
```

| Giai đoạn   | Mô tả                           | Trọng tâm kỹ thuật                                                                     |    Trạng thái     |   Test Coverage    |
| :---------- | :------------------------------ | :------------------------------------------------------------------------------------- | :---------------: | :----------------: |
| **Phase 1** | Monorepo Setup & Shared Package | UCI move format, keccak256 hash, EIP-712 v2, Zod validation, Replay, Cross-spec fixture|   ✅ Hoàn thành   | 95/95 tests (100%) |
| **Phase 2** | Smart Contract Escrow           | `ChessEscrow.sol`, SingleSigned isolation, MIN_STAKE, Arbiter constructor, Pausable    |   ✅ Hoàn thành   | 76/76 tests (100%) |
| **Phase 3** | Local Chess Game Arena          | Phaser 3 canvas, `GameState.ts`, FIDE 5+0 clocks, UI 100dvh, Victory Modal             |   ✅ Hoàn thành   | 17/17 tests (100%) |
| **Phase 4** | Web3 Meta Layer & Fair Play     | `AvaClashMeta.sol` (Gross fee on resolve, zero pool cancel, 7-day timeout refund)      |   ✅ Hoàn thành   | 18/18 tests (100%) |
| **Phase 5** | Relay, Security & Integration   | WebSocket Relay (`packages/relay`), Try/Catch Escrow-Meta, Keystore Deploy script      |  ⚠️ Đang hoàn thiện (~60%) | 18/18 tests (100%) |
| **Phase 6** | Audit & Avalanche Mainnet       | Security Audit, Subnet/C-Chain mainnet, Season leaderboard                             |    ⚪ Dự kiến     |    Chưa bắt đầu    |

---

## 2. Chi tiết Tiến độ Từng Giai đoạn & Cải tiến Mới

### Phase 1: Nền tảng Monorepo & Thư viện dùng chung (`@avaclash/shared`)

- **Mục tiêu:** Xây dựng lõi quy tắc cờ vua FIDE, xác thực dữ liệu và định nghĩa mật mã học dùng chung giữa Client, Server và Smart Contracts.
- **Các hạng mục đã hoàn thành:**
  - [x] Thiết lập kiến trúc monorepo bằng `pnpm workspaces` (`packages/shared`, `contracts`, `web`, `packages/relay`).
  - [x] Chuẩn hóa biểu diễn nước đi dạng **UCI** (`e2e4`, `e7e8q`) thay vì SAN để đảm bảo tính độc lập và khả năng deterministic replay.
  - [x] Triển khai hàm băm nước đi `hashMoves(uciMoves)` bằng thuật toán `keccak256(abi.encodePacked(...))` khớp 100% giữa TypeScript (`viem`) và Solidity.
  - [x] **Mở rộng struct Result (A1):**
    - `Result(uint256 matchId, address winner, uint8 outcome, uint8 reason, uint16 moveCount, bytes32 movesHash, uint256 nonce, uint256 deadline)`
    - Định nghĩa enum số `OutcomeCode` (0: WhiteWin, 1: BlackWin, 2: Draw) và `ReasonCode` khớp hoàn toàn với Solidity.
    - Bổ sung `deadline` chống tấn công replay.
  - [x] Bộ schema **Zod** xác thực toàn bộ gói tin WebSocket hai chiều (move, resign, draw offer, clock sync, focus telemetry, spectator betting, resultProposal).
  - [x] Bộ diễn lại ván đấu deterministic (`replayMoves`) hỗ trợ đầy đủ luật: phong cấp, bắt tốt qua đường, nhập thành, hòa do lặp cờ 3 lần, quy tắc 50 nước đi, thiếu quân chiếu hết, và trả về chính xác `moveCount`, `outcome`, `reason`.
  - [x] **Kiểm tra chéo chữ ký EIP-712 (Cross-Spec Test):** Tự sinh khóa ngẫu nhiên trong TypeScript bằng `viem`, ký Result struct v2, ghi fixture JSON và nạp vào Foundry test để xác thực `submitResult`.
- **Kết quả kiểm thử:** `95/95 tests pass` (`vitest`).

---

### Phase 2: Hợp đồng thông minh Ký quỹ Cược (`ChessEscrow.sol`)

- **Mục tiêu:** Cung cấp hạ tầng ký quỹ cá cược 1v1 phi tập trung bằng đồng AVAX, bảo vệ tiền cược của người chơi mà không cần bên thứ ba trung gian.
- **Các hạng mục đã hoàn thành:**
  - [x] Phát triển `ChessEscrow.sol` kế thừa OpenZeppelin `EIP712`, `ReentrancyGuard` và `Pausable`.
  - [x] **Mức cược tối thiểu & tối đa (MIN_STAKE / MAX_STAKE):** Bắt buộc `MIN_STAKE = 0.01 ether` và `MAX_STAKE = 1 ether` tại `createRoom` (revert `StakeTooLow` / `StakeTooHigh`). Đảm bảo ELO và Season Points chỉ tính cho ván cược $\ge 0.01$ AVAX (D12).
  - [x] **Cô lập claim đơn lẻ (`submitSingleSigned`):** Chỉ cho phép claim đầu tiên (`singleSignedAt == 0`); nỗ lực claim đè sau đó revert (phản hồi duy nhất là `challenge()`). Chặn gọi khi hết hạn challenge window.
  - [x] **Bỏ nonce toàn phòng:** `submitResult` không dùng usedNonces; `submitSingleSigned` dùng `usedNonces[roomId][msg.sender][nonce]` chống đốt nonce của người khác.
  - [x] **Chữ ký 2-trong-3 (A2):** Cho phép thanh toán ngay lập tức khi có:
    - 2 người chơi cùng ký (Player A + Player B), HOẶC
    - Người thắng + Relay cùng ký (Player Winner + Relay).
  - [x] **Challenge có Bond & Timelock Arbiter (A3 - Q2 & Q8):**
    - Người khiếu nại phải nộp Bond = 20% tiền cược (tối thiểu 0.01 AVAX).
    - Constructor nhận riêng biệt `_arbiter != _relaySigner != address(0)`. Đổi arbiter qua timelock 2 ngày.
    - Bên sai mất bond cho bên đúng; nếu Arbiter quá hạn 24h không phán quyết, `resolveDefaultChallenge` hoàn cược 100%, phạt 50% bond bên khiếu nại chuyển cho bên nộp đơn, hoàn 50% còn lại (Accepted with residual risk, Q8).
  - [x] **Fail-Fast tại `joinRoom` (D14):** `registerMatch` và `lockBetting` sang Meta không nuốt lỗi; nếu Meta revert thì `joinRoom` revert để bảo đảm an toàn. Các lời gọi post-game (`updateEloOnSettle`, `resolvePrediction`, `cancelPrediction`) giữ `try/catch`.
  - [x] **Hủy phòng sớm (`abortRoom` - A4):** Cho phép hủy phòng và hoàn tiền nếu quá thời gian chờ (sau 3 phút) mà ván cờ chưa bắt đầu.
  - [x] **Phí giao thức 5% (D4 - Q6):** Thu 5% trên tổng pot khi có người thắng nộp vào `treasury` qua `withdrawProtocolFees()`; miễn phí 100% khi Hòa hoặc Refund.
  - [x] Mẫu thiết kế rút tiền an toàn Pull-over-push (`withdraw`).
- **Kết quả kiểm thử:** `76/76 tests pass` (`foundry forge test`), bao gồm Fuzz Testing biến số cược, thời gian, và các kịch bản kết quả hợp lệ.

---

### Phase 3: Đấu trường Cờ vua Trực quan (`Phaser 3 + Next.js UI`)

- **Mục tiêu:** Trải nghiệm chơi cờ mượt mà, phản hồi ngay lập tức, độ trễ 60fps trên Canvas kết hợp giao diện Web3 cao cấp.
- **Các hạng mục đã hoàn thành:**
  - [x] Tích hợp engine đồ họa **Phaser 3** vào Next.js App Router.
  - [x] Bộ quản lý trạng thái FIDE độc lập `GameState.ts` (đồng hồ 5+0 Blitz, quân bị bắt, Material Advantage, log nước đi).
  - [x] Thiết kế bàn cờ độ tương phản cao trong `ChessScene.ts` (tọa độ mép, Red Glow Vua bị chiếu, Drag & Drop / Click to move).
  - [x] Giao diện đấu trường đạt chuẩn `100dvh` không tràn màn hình.
  - [x] Hộp thoại vinh danh chiến thắng (`VictoryModal.tsx`) kèm Confetti.
- **Kết quả kiểm thử:** `17/17 tests pass` (`vitest`).

---

### Phase 4: Web3 Meta Layer & Giám sát Chống gian lận (`AvaClashMeta.sol`)

- **Mục tiêu:** Mở rộng trải nghiệm thi đấu Web3 mà không can thiệp vào luật cờ nguyên bản FIDE.
- **Các hạng mục đã hoàn thành:**
  - [x] Hợp đồng `AvaClashMeta.sol`:
    - **On-Chain ELO:** Khởi đầu 1200 ELO, cập nhật tự động sau mỗi ván cược qua `updateEloOnSettle`. Tích hợp Anti-Win-Trading giảm 50% delta ELO sau mỗi trận lặp lại giữa cùng cặp đấu trong ngày.
    - **No-Loss Tournament Vault:** Ký quỹ AVAX nhận Season Points thi đấu giải, bảo toàn 100% gốc.
    - **Spectator Parimutuel Prediction Pool độc lập (B1, B4, B5):**
      - 3 cửa cược rõ ràng: 1: Trắng thắng, 2: Đen thắng, 3: Hòa. Đã loại bỏ cửa "Under 40 moves" trên Fuji Testnet (Q5).
      - **Cược Gross & Gộp phí khi Resolve:** Tiền cược lưu nguyên vẹn (gross). Khi resolve, phí 5% trên tổng pool được trích nộp vào `seasonPrizePool`, người thắng nhận `userBet * (totalPool - fee) / winningPool`. Khi pool bị hủy, hoàn trả 100% gross.
      - **Hủy pool khi cửa thắng không có người cược:** Nếu pool của cửa thắng bằng 0 khi resolve, tự động coi là hủy (`cancelled = true`) để mọi người rút lại 100% tiền cược gốc.
      - **Đường hoàn tiền độc lập sau 7 ngày (`MAX_UNRESOLVED`):** Nếu pool đã tạo quá 7 ngày mà chưa được resolve hoặc cancel, khán giả gọi `claimSpectatorRefund` độc lập mà không cần Escrow can thiệp.
      - **Khóa cược trước ván đấu (B3 - Q4):** Tự động khóa khi phòng chuyển sang Active (`joinRoom`).
      - **Chống tự cược (B2):** `registerMatch` ghi nhận địa chỉ 2 kỳ thủ và chặn họ đặt cược vào trận của chính mình.
  - [x] Hook giám sát client `useFairPlayGuard.ts`: phát hiện rời màn hình quá 2 giây và gửi cảnh báo về hệ thống (chỉ cảnh báo theo Q10/D10, không trừ giờ, không forfeit).
  - [x] Giao diện dự đoán khán giả trực tiếp `SpectatorPoolWidget.tsx`.
- **Kết quả kiểm thử:** `18/18 tests pass` (`foundry forge test`).

---

### Phase 5: P2P Matchmaking Relay & Tích hợp Ví Web3 (Thực tế: ~60% Hoàn tất)

- **Tiến độ thực tế:** ~60% (Đã xây dựng kiến trúc, đang hoàn thiện an ninh và tích hợp thực tế)
- **Công việc đã làm:**
  - [x] Cập nhật toàn diện Smart Contracts (`ChessEscrow.sol`, `AvaClashMeta.sol`) đáp ứng các quyết định kinh tế và an ninh.
  - [x] Thư viện `@avaclash/shared` cập nhật đầy đủ EIP-712 v2, schema Zod, và cross-spec fixture.
  - [x] **WebSocket Relay Server daemon (`packages/relay`):**
    - Định tuyến kết nối, quản lý phòng, đồng hồ và đồng thuận FIDE 5+0 Blitz.
    - Cấp chữ ký thứ 2 (2-of-3 scheme EIP-712) cho kết quả ván đấu.
    - Đã loại bỏ hardcoded private key (G14), yêu cầu biến môi trường `RELAY_PRIVATE_KEY`.
    - 7/7 tests passing (`vitest`).
  - [x] **Liên kết hai chiều ChessEscrow ↔ AvaClashMeta:**
    - Fail-fast tại `joinRoom` và try/catch tại các hàm phân phối/hủy.
    - Cung cấp cơ chế cứu hộ `retryResolvePrediction` và `fallbackCancelPrediction` bảo toàn 100% vốn.
    - 11/11 tests passing (`ChessEscrowMetaIntegration` + `ChessEscrowMetaTryCatch`).
  - [x] **Deploy Script hỗ trợ Keystore (`Deploy.s.sol`):**
    - Yêu cầu bắt buộc 3 địa chỉ khác nhau: `RELAY_SIGNER_ADDRESS`, `ARBITER_ADDRESS`, `TREASURY_ADDRESS` (không dùng địa chỉ 0, không trùng nhau).
    - Hỗ trợ triển khai an toàn bằng Foundry Keystore (`--account`) thay vì biến môi trường trần.
- **Hạn chế kỹ thuật phát hiện qua rà soát Lượt 2B (Mục 7):**
  - ⚠️ **Relay chưa xác thực chữ ký của người kết nối:** Gói tin `join_room` nhận chuỗi địa chỉ trần từ client, chưa yêu cầu chữ ký mật mã (SIWE) để chứng minh quyền sở hữu khóa.
  - ⚠️ **Relay chưa đối chiếu on-chain:** Khi nhận `join_room`, server chưa kiểm tra `ChessEscrow.getRoom(roomId)` để xác thực người kết nối có đúng là `playerA`/`playerB` và phòng đã `Active` hay chưa.
  - ⚠️ **Chưa triển khai seed chọn màu quân (Q3):** Relay đang gán màu quân theo thứ tự socket kết nối (FCFS - ai vào trước cầm Trắng), chưa có thuật toán sinh seed ngẫu nhiên.
  - ⚠️ **Hàm `signalGameStarted` chưa được gọi:** Không có daemon nào gọi giao dịch on-chain này khi ván cờ bắt đầu.
  - ⚠️ **Chưa deploy testnet và chưa nối ví người dùng thật:** Hợp đồng chưa được broadcast lên Fuji Testnet; giao diện Web chưa kết nối RPC thực tế của người dùng.

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

| Hạng mục kiểm thử                                            | Công cụ | Số lượng Test |          Kết quả          |
| :----------------------------------------------------------- | :------ | :-----------: | :-----------------------: |
| **Logic cờ vua, Mã hóa, EIP-712 v2, Replay, Schema, Cross-Spec**| Vitest |      95       |      ✅ 95/95 Passed      |
| **WebSocket Relay Server (packages/relay)**                  | Vitest  |       7       |       ✅ 7/7 Passed       |
| **Giao diện Client & Game State (web)**                      | Vitest  |      17       |      ✅ 17/17 Passed      |
| **Hợp đồng ký quỹ cược (ChessEscrow unit, fuzz, cross-spec)** | Foundry |      76       |      ✅ 76/76 Passed      |
| **Hợp đồng Meta Layer (AvaClashMeta unit tests)**            | Foundry |      18       |      ✅ 18/18 Passed      |
| **Tích hợp Escrow ↔ Meta (ChessEscrowMetaIntegration)**       | Foundry |       3       |       ✅ 3/3 Passed       |
| **Cô lập try/catch & Cứu hộ (ChessEscrowMetaTryCatch)**      | Foundry |       8       |       ✅ 8/8 Passed       |
| **TỔNG CỘNG TOÀN DỰ ÁN**                                    | —       |    **224**    | **224/224 Passed (100%)** |

---

## 4. Kế hoạch Hành động Tiếp theo

1. **Deploy Fuji Testnet bằng Keystore:**
   - Tạo keystore: `cast wallet import avaclash-deployer --interactive`
   - Cấu hình địa chỉ: `RELAY_SIGNER_ADDRESS`, `ARBITER_ADDRESS`, `TREASURY_ADDRESS`
   - Broadcast: `forge script contracts/script/Deploy.s.sol:DeployScript --rpc-url $FUJI_RPC_URL --account avaclash-deployer --broadcast`
2. **Nâng cấp an ninh cho Relay Server:**
   - Bổ sung xác thực chữ ký EIP-4361 (SIWE) trong gói tin `join_room`.
   - Kết nối Viem `PublicClient` trong Relay để đối chiếu `playerA`/`playerB` và trạng thái `Active` on-chain.
   - Triển khai thuật toán bốc thăm màu quân theo seed ngẫu nhiên (Q3).
3. **Audit & Chuẩn bị Mainnet:** Khởi động Phase 6 rà soát an ninh cho toàn bộ hệ thống.

