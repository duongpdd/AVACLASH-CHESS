# Tiến độ Phát triển Dự án — AvaClash Chess

> **Cập nhật lần cuối:** 28/10/2026 (Lượt 3b-Fix) | **Trạng thái tổng thể:** Phase 5 Đang hoàn thiện (~88%) — Xác nhận winningOption 1/2/3 và Ma trận 12 test tích hợp Meta thật, Khôi phục trọn bộ 8 test MetaTryCatch mock revert, Invariant afterInvariant assert ghost counters fuzz độc lập, Đồng hồ không dừng khi ngắt mạng & ân hạn 120s khi restart, Lưu kết quả trước RPC & retry backoff 5m, Bảo vệ Proxy TRUST_PROXY & verifyClient Origin 403

AvaClash Chess là nền tảng cờ vua Web3 1v1 PvP trên mạng Avalanche Fuji Testnet, kết hợp giữa luật cờ vua chuẩn quốc tế FIDE (5+0 Blitz) và hạ tầng kinh tế phi tập trung (Escrow cá cược AVAX, On-chain ELO, No-Loss Vault, Parimutuel Spectator Betting).

---

## 1. Tổng quan Trạng thái các Giai đoạn (Roadmap Status)

```
[Phase 1: Core Engine & Shared] ──────► 100% Hoàn thành (95/95 tests pass)
[Phase 2: Smart Contract Escrow] ─────► 100% Hoàn thành (128/128 tests pass: 94 escrow + 21 meta-integ + 13 try-catch)
[Phase 3: Phaser 3 Game Arena] ───────► 100% Hoàn thành (17/17 tests pass)
[Phase 4: Web3 Meta Layer & Anti-Cheat] ► 100% Hoàn thành (24/24 tests pass)
[Phase 5: Relay, Security & Invariants] ► ~88% Thực tế (154 contract tests gồm fuzz invariant 3,800 depth, 36 relay tests gồm 13 Anvil e2e; CHƯA Deploy Fuji, CHƯA Nối Ví Wagmi)
[Phase 6: Audit, Mainnet & Season 1] ──► 0% Lập kế hoạch
```

| Giai đoạn   | Mô tả                           | Trọng tâm kỹ thuật                                                                     |    Trạng thái     |   Test Coverage    |
| :---------- | :------------------------------ | :------------------------------------------------------------------------------------- | :---------------: | :----------------: |
| **Phase 1** | Monorepo Setup & Shared Package | UCI move format, keccak256 hash, EIP-712 v2, Zod validation, Replay, Cross-spec fixture|   ✅ Hoàn thành   | 95/95 tests (100%) |
| **Phase 2** | Smart Contract Escrow           | `ChessEscrow.sol`, Ownable2Step, winningOption 1/2/3, Meta try/catch fallback delay    |   ✅ Hoàn thành   | 128/128 tests (100%) |
| **Phase 3** | Local Chess Game Arena          | Phaser 3 canvas, `GameState.ts`, FIDE 5+0 clocks, UI 100dvh, Victory Modal, Room Lobby |   ✅ Hoàn thành   | 17/17 tests (100%) |
| **Phase 4** | Web3 Meta Layer & Fair Play     | `AvaClashMeta.sol` (Q18 joinedAt window, hasBet anti-self-bet, 20-move void refund)    |   ✅ Hoàn thành   | 24/24 tests (100%) |
| **Phase 5** | Relay, Security & Integration   | Relay clock disconnect/restart ân hạn, saveGameResult retry 5m, TRUST_PROXY & verifyClient, Invariant afterInvariant | ⚠️ Đang hoàn thiện (~88%) | 38/38 tests (100%: 36 Vitest + 2 Invariants) |
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
  - [x] Bộ schema **Zod** xác thực toàn bộ gói tin WebSocket hai chiều (move, resign, draw offer, clock sync, focus telemetry, spectator betting, resultProposal, game_finished).
  - [x] Bộ diễn lại ván đấu deterministic (`replayMoves`) hỗ trợ đầy đủ luật: phong cấp, bắt tốt qua đường, nhập thành, hòa do lặp cờ 3 lần, quy tắc 50 nước đi, thiếu quân chiếu hết, và trả về chính xác `moveCount`, `outcome`, `reason`.
  - [x] **Kiểm tra chéo chữ ký EIP-712 (Cross-Spec Test):** Tự sinh khóa ngẫu nhiên trong TypeScript bằng `viem`, ký Result struct v2, ghi fixture JSON và nạp vào Foundry test để xác thực `submitResult`.
- **Kết quả kiểm thử:** `95/95 tests pass` (`vitest`).

---

### Phase 2: Hợp đồng thông minh Ký quỹ Cược (`ChessEscrow.sol`)

- **Mục tiêu:** Cung cấp hạ tầng ký quỹ cá cược 1v1 phi tập trung bằng đồng AVAX, bảo vệ tiền cược của người chơi mà không cần bên thứ ba trung gian.
- **Các hạng mục hoàn thành và nâng cấp ở Lượt 3b:**
  - [x] **Cột mốc `gameStartedAt` và try/catch `lockBetting` (Mục 3a):**
    - Bổ sung `uint256 gameStartedAt` vào cuối struct `Room`.
    - `signalGameStarted` gán `gameStartedAt = block.timestamp` nếu chưa gán (idempotent, không revert nếu gọi lại).
    - Gọi `Meta.lockBetting` trong khối `try/catch` (bắn `MetaCallFailed` nếu lỗi), tách hoàn toàn khỏi luồng `joinRoom`.
  - [x] **Mốc tính `refundOnTimeout` chính xác (Mục 3b):**
    - Hạn hoàn tiền timeout tính theo `max(startedAt, gameStartedAt) + REFUND_TIMEOUT`. Nếu ván đấu bắt đầu muộn, đối thủ không thể rút trộm tiền cược khi đồng hồ cờ đang chạy.
  - [x] **Timelock Cứu hộ Dự đoán 3 ngày `fallbackCancelPrediction` (Mục 3c):**
    - Ghi nhận `metaFailedAt` khi `metaResolutionFailed` được bật.
    - Cho phép gọi `fallbackCancelPrediction` sau `FALLBACK_DELAY = 3 days`; `retryResolvePrediction` có thể gọi ngay không cần chờ.
  - [x] **Truyền `moveCount` sang Meta Layer (Mục 3d - Q20):**
    - Truyền `moveCount` từ kết quả ký kép (hoặc `singleSignedMoveCount` từ claim đơn) sang `IAvaClashMeta.resolvePrediction`.
  - [x] **Chặn vĩnh viễn `renounceOwnership` (Mục 3e):**
    - Ghi đè hàm với revert `CannotRenounceOwnership()`.
- **Kết quả kiểm thử:** `107/107 tests pass` (`foundry forge test`).

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
- **Các hạng mục hoàn thành và nâng cấp ở Lượt 3b:**
  - [x] **Cửa sổ đặt cược linh hoạt `BET_WINDOW` (Q18 - D13):**
    - `registerMatch` ghi nhận `joinedAt` (chỉ một lần) và revert `PlayerHasBets` nếu một trong hai kỳ thủ đã từng đặt cược ở bất kỳ cửa nào (thông qua mapping `hasBet[matchId][player]`).
    - `betOnMatch` chặn cược khi `joinedAt != 0` và `block.timestamp > joinedAt + BET_WINDOW` (120 giây), hoặc khi trận đã khóa/đã settle/đã hủy.
  - [x] **Chống dàn xếp tỉ số vi mô qua `moveCount` (Q20):**
    - `resolvePrediction` nhận `uint16 moveCount`. Nếu `moveCount < MIN_MOVES_FOR_PREDICTION (20)` thì tự động hủy pool (`cancelled = true`), hoàn trả 100% gross cho khán giả, không thu phí giao thức.
  - [x] **Hạn hoàn tiền độc lập neo theo `joinedAt`:**
    - Cột mốc hoàn tiền độc lập sau 7 ngày: `anchor = joinedAt != 0 ? joinedAt : createdAt`; `timeout = anchor + MAX_UNRESOLVED`. Bảo vệ ván cờ đang diễn ra không bị khán giả hủy pool sớm.
- **Kết quả kiểm thử:** `24/24 tests pass` (`foundry forge test`).

---

### Phase 5: P2P Matchmaking Relay & Tích hợp Bảo mật (Thực tế: ~85% Hoàn tất)

- **Tiến độ thực tế:** ~85% (Relay đã tích hợp Anvil thật, ngăn chặn hồi sinh, lưu trữ ván chơi nguyên tử Q19, Invariant Ghost Counters 18 actions, Rate Limiting; CHƯA Deploy Fuji, CHƯA Nối Ví Wagmi)
- **Công việc đã hoàn thành ở Lượt 3b:**
  - [x] **Relay: Chống hồi sinh ván đã kết thúc (Mục 1):**
    - Khóa cô lập kết quả: `${chainId}:${contractAddress.toLowerCase()}:${roomId}` kèm `whiteAddress` và `blackAddress`. Tự động bỏ qua tệp khác chain hoặc contract.
    - `handleJoinRoom` từ chối tạo phòng mới nếu đã có kết quả lưu, gửi ServerMessage `game_finished` và chỉ cho phép `request_result` với người chơi trong phòng.
    - `request_result` đối chiếu trắng/đen lưu với on-chain, từ chối ký khi phòng không còn Active.
    - `handleGameOver` không ghi đè kết quả cũ và không ký ván thứ hai.
    - `result_signature` chỉ chấp nhận chữ ký từ đúng trắng hoặc đen của phòng.
  - [x] **Relay: Lưu trữ & Khôi phục ván đang chơi (Mục 2 - Q19):**
    - Ghi trạng thái nguyên tử vào `active/<key>.json` (qua tệp tạm `.tmp` rồi rename) sau mỗi nước đi và khi bắt đầu ván.
    - Khôi phục RelayRoom khi khởi động lại: replay moves qua `ChessGame`, thời gian relay tắt không bị trừ vào đồng hồ, và đồng hồ chỉ chạy tiếp khi cả 2 người chơi vào lại phòng.
  - [x] **Kiểm thử Bất biến Độc lập & Ghost Counters (Mục 5):**
    - Bổ sung 7 hành động handler mới (`challengeAction`, `resolveChallengeAction`, `resolveDefaultChallengeAction`, `signalGameStartedAction`, `submitResultRelay`, `pauseAction`, `unpauseAction`, `setSingleSignedEnabledAction`).
    - Bảng Ghost Counters theo dõi 18 hành động thành công, khẳng định các nhánh bond đạt $\ge 110$ lần (vượt ngưỡng yêu cầu $\ge 100$).
    - Kiểm tra bảo toàn thanh khoản độc lập: duyệt toàn bộ phòng, tự tính stake + bond dựa trên trạng thái phòng, cộng `pendingWithdrawals` và `protocolFees`, xác nhận khớp 100% với `address(escrow).balance`.
  - [x] **Bộ đệm On-Chain Cache & Giới hạn Tần suất (Mục 6):**
    - Cache `getRoom` 3 giây cho các luồng `join_room` và `request_result`; luồng `handleGameOver` luôn đọc trực tiếp on-chain.
    - Giới hạn tần suất `join_room` theo IP (60 lần/phút). Đóng socket (mã 1008) nếu vi phạm rate limit liên tiếp 3 lần.
- **Rủi ro tồn đọng & Việc chưa làm:**
  - ⚠️ **Nối ví Wagmi/RainbowKit trên Web Client:** Giao diện Web vẫn chạy ở chế độ mô phỏng cục bộ, chưa có module kết nối ví Web3 để người chơi thực hiện giao dịch `createRoom` và `joinRoom` trên trình duyệt.
  - ⚠️ **Q12: Cơ chế chi trả Quỹ giải thưởng mùa giải (`seasonPrizePool`):** Chưa có hợp đồng phân phối thưởng cuối mùa (phân bổ theo Leaderboard ELO / Season Points).
  - ⚠️ **Sybil Resistance cho ELO (G7):** Cơ chế chống cày ELO hiện tại chỉ phát hiện cùng cặp ví trong 24h, chưa có bảo vệ chống tạo nhiều ví phụ.
  - ⚠️ **Chống Phishing chữ ký Join (Domain Binding):** Chữ ký Join Room EIP-712 hiện chưa gắn trực tiếp nguồn gốc origin/domain của client.
  - ⚠️ **Kiểm toán Bảo mật Độc lập (Phase 6):** Cần audit bên thứ ba trước khi phát hành Mainnet.

---

## 3. Tổng hợp Chỉ số Kiểm thử & Mã nguồn (Metrics Thật Lượt 3b-Fix)

| Hạng mục kiểm thử                                            | Công cụ | Số lượng Test |          Kết quả          |
| :----------------------------------------------------------- | :------ | :-----------: | :-----------------------: |
| **Logic cờ vua, Mã hóa, EIP-712 v2, Replay, Schema, Cross-Spec**| Vitest |      95       |      ✅ 95/95 Passed      |
| **WebSocket Relay Server (packages/relay unit, proxy, origin)**| Vitest  |      23       |      ✅ 23/23 Passed (gồm 2 ABI tests)|
| **Tích hợp Relay với Anvil thật (anvil-integration.test.ts)**| Vitest  |      13       |      ✅ 13/13 Passed      |
| **Giao diện Client & Game State (web)**                      | Vitest  |      17       |      ✅ 17/17 Passed      |
| **Hợp đồng ký quỹ cược (ChessEscrow unit, fuzz, cross-spec)** | Foundry |      94       |      ✅ 94/94 Passed      |
| **Hợp đồng Meta Layer (AvaClashMeta unit tests)**            | Foundry |      24       |      ✅ 24/24 Passed      |
| **Tích hợp Escrow ↔ Meta (ChessEscrowMetaIntegration)**       | Foundry |      21       |      ✅ 21/21 Passed      |
| **Cô lập try/catch & Cứu hộ (ChessEscrowMetaTryCatch)**      | Foundry |      13       |      ✅ 13/13 Passed      |
| **Bất biến bảo toàn thanh khoản & Ghost Counters**           | Foundry |       2       | ✅ 2/2 Passed (3,800 depth campaign)|
| **TỔNG CỘNG TOÀN DỰ ÁN**                                    | —       |    **302**    | **302/302 Passed (100%)** |

---

## 4. Kế hoạch Hành động Tiếp theo

1. **Tích hợp ví Wagmi/RainbowKit trên Web:** Kết nối luồng `createRoom(creatorIsWhite)` và `joinRoom` với ví Web3 của người dùng.
2. **Thiết kế phân bổ Q12 (`seasonPrizePool`):** Lập đặc tả phân phối phần thưởng mùa giải cho người chơi đạt ELO và điểm Season cao.
3. **Sybil Resistance & Phishing Protection:** Gắn `origin` vào EIP-712 Join Signature và hoàn thiện cơ chế phân tích cặp đấu.
4. **Kiểm toán Độc lập & Deploy Fuji Testnet bằng Keystore:** Khi hoàn thành giao diện Web và ví Wagmi, broadcast hợp đồng lên Fuji qua `Deploy.s.sol`.

