# Tiến độ Phát triển Dự án — AvaClash Chess

> **Cập nhật lần cuối:** 26/10/2026 (Lượt 3a) | **Trạng thái tổng thể:** Phase 5 Đang hoàn thiện (~80%) — ABI sinh tự động, Test Anvil Thật, Lưu trữ & Ký lại Kết quả, signalGameStarted Q16, Stuck Bond Fix, Invariant Testing & Gia cố Bảo mật Relay

AvaClash Chess là nền tảng cờ vua Web3 1v1 PvP trên mạng Avalanche Fuji Testnet, kết hợp giữa luật cờ vua chuẩn quốc tế FIDE (5+0 Blitz) và hạ tầng kinh tế phi tập trung (Escrow cá cược AVAX, On-chain ELO, No-Loss Vault, Parimutuel Spectator Betting).

---

## 1. Tổng quan Trạng thái các Giai đoạn (Roadmap Status)

```
[Phase 1: Core Engine & Shared] ──────► 100% Hoàn thành (95/95 tests pass)
[Phase 2: Smart Contract Escrow] ─────► 100% Hoàn thành (121/121 tests pass, gồm Invariant test 128,000 calls)
[Phase 3: Phaser 3 Game Arena] ───────► 100% Hoàn thành (17/17 tests pass)
[Phase 4: Web3 Meta Layer & Anti-Cheat] ► 100% Hoàn thành (18/18 tests pass)
[Phase 5: Relay, Security & Integration] ► ~80% Thực tế (Relay đã tích hợp Anvil thật, signalGameStarted Q16, ABI sinh từ artifact, Lưu/Ký lại kết quả; CHƯA Deploy Fuji, CHƯA Nối Ví Wagmi)
[Phase 6: Audit, Mainnet & Season 1] ──► 0% Lập kế hoạch
```

| Giai đoạn   | Mô tả                           | Trọng tâm kỹ thuật                                                                     |    Trạng thái     |   Test Coverage    |
| :---------- | :------------------------------ | :------------------------------------------------------------------------------------- | :---------------: | :----------------: |
| **Phase 1** | Monorepo Setup & Shared Package | UCI move format, keccak256 hash, EIP-712 v2, Zod validation, Replay, Cross-spec fixture|   ✅ Hoàn thành   | 95/95 tests (100%) |
| **Phase 2** | Smart Contract Escrow           | `ChessEscrow.sol`, Ownable2Step, setMetaContract timelock, Stuck bond fix, Invariant test, singleSignedEnabled (Q15)|   ✅ Hoàn thành   | 121/121 tests (100%) |
| **Phase 3** | Local Chess Game Arena          | Phaser 3 canvas, `GameState.ts`, FIDE 5+0 clocks, UI 100dvh, Victory Modal, Room Lobby |   ✅ Hoàn thành   | 17/17 tests (100%) |
| **Phase 4** | Web3 Meta Layer & Fair Play     | `AvaClashMeta.sol` (Gross fee on resolve, zero pool cancel, 7-day timeout refund)      |   ✅ Hoàn thành   | 18/18 tests (100%) |
| **Phase 5** | Relay, Security & Integration   | Relay tích hợp Anvil thật, signalGameStarted Q16, ABI sinh từ forge artifact, request_result, Lưu file 48h, Gia cố IP proxy & waiting timeout |  ⚠️ Đang hoàn thiện (~80%) | 24/24 tests (100%) |
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

### Phase 5: P2P Matchmaking Relay & Tích hợp Ví Web3 (Thực tế: ~80% Hoàn tất)

- **Tiến độ thực tế:** ~80% (Đã xây dựng kiến trúc, hoàn thành Anvil integration test, signalGameStarted Q16, ABI sinh từ artifact, Lưu/Ký lại kết quả, Invariant test; CHƯA Deploy Fuji, CHƯA Nối Ví Wagmi)
- **Đặc biệt lưu ý:** **Trước lượt 3a, Relay không đọc được phòng thật trên chain** (chỉ dùng ABI viết tay thiếu sót và mock unit tests); **từ lượt 3a, Relay đã sinh ABI tự động từ forge artifact và sở hữu bộ test tích hợp toàn diện trên Anvil thật** với PublicClient và WalletClient thực thi transaction on-chain.
- **Công việc đã hoàn thành ở Lượt 3a:**
  - [x] **ABI tự động sinh & Kiểm thử Anvil thật (Mục 1):**
    - Xóa bỏ hoàn toàn ABI viết tay trong RelayServer.
    - Script `scripts/generate-abi.ts` trích xuất ABI từ `contracts/out/*/` thành TypeScript (`ChessEscrow.ts`, `AvaClashMeta.ts`), chạy tự động trước build/test relay (`pretest`, `prebuild`) và có unit test so khớp với artifact.
    - Test tích hợp Anvil thật (`anvil-integration.test.ts`): kiểm tra gán màu đúng on-chain cả 2 chế độ `creatorIsWhite`, từ chối người chơi vào phòng Open, giới hạn ví ngoài chỉ được vào dạng spectator, từ chối ký phòng đã Settled, và thực hiện ký kép Player + Relay để settle thành công trên Anvil.
  - [x] **Nâng cấp An ninh `ChessEscrow.sol` & Invariant Testing (Mục 2):**
    - Thêm cờ `singleSignedEnabled` (mặc định `false`, Q15) và hàm `setSingleSignedEnabled(bool)` quản trị bởi Owner. Mặc định chặn `submitSingleSigned` với revert `SingleSignedDisabled()`.
    - Sửa lỗi kẹt bond: Trong `submitResult`, nếu có `singleSignedBond > 0`, hoàn trả cho người nộp nếu đúng winner; nếu khác winner hoặc hòa thì chuyển cho đối thủ. Xóa sạch bond ở mọi nhánh kết thúc (`resolveChallenge`, `resolveDefaultChallenge`, `finalizeSingleSigned`).
    - Viết Foundry Invariant Test (`ChessEscrowInvariant.t.sol`) với handler `ChessEscrowHandler.sol`, kiểm chứng bất biến bảo toàn khả năng thanh toán: `address(escrow).balance == totalPendingWithdrawals + protocolFees + totalActiveStakesAndBonds` qua 256 runs x 500 calls (128,000 calls) không vi phạm.
    - Kiểm thử kịch bản đối xứng G1 (`test_G1_payoffComparison_symmetric_loserSubmitsSingleSigned`): chứng minh kẻ thua nộp claim trước thu lãi +0.01 AVAX khi Arbiter im lặng, làm cơ sở kinh tế vững chắc để mặc định tắt single-signed.
    - Thay thế cơ chế Owner tự viết bằng OpenZeppelin `Ownable2Step`; bổ sung timelock 2 ngày và event `MetaContractChangeScheduled`/`MetaContractChangeExecuted` cho `setMetaContract`.
  - [x] **Relay tự động gọi `signalGameStarted` on-chain (Mục 3 - Q16):**
    - `RelayServer` tích hợp `walletClient` gọi `signalGameStarted(roomId)` ngay khi phòng chuyển sang "active" (cả 2 ghế đã có người), retry backoff trong 150s, chạy ngầm không chặn luồng ván cờ.
    - Kiểm tra số dư AVAX của ví relay khi khởi động, cảnh báo nếu dưới ngưỡng cấu hình `RELAY_MIN_BALANCE`.
    - Test Anvil: phòng đã vào ghế sẽ kích hoạt `gameStarted == true` on-chain, chặn đứng hành vi gian lận gọi `abortRoom` sau 3 phút.
  - [x] **Lưu trữ & Cấp lại Chữ ký Kết quả (Mục 4):**
    - Lưu mỗi ván cờ kết thúc vào thư mục `RESULTS_DIR` (`${roomId}.json`), tự động nạp lại khi khởi động, dọn dẹp sau 48 giờ.
    - Bổ sung thông điệp client `request_result {roomId}`: chỉ người chơi đã xác thực trong phòng được yêu cầu; Relay kiểm tra phòng còn Active on-chain, lấy kết quả đã lưu, ký lại với deadline mới 30 phút và gửi proposal + signature riêng cho socket đó.
    - Test Anvil: ván kết thúc, đóng socket, khởi động lại server mới, người thắng kết nối lại xin ký lại và settle thành công trên Anvil; từ chối ví ngoài và từ chối phòng đã Settled.
  - [x] **Gia cố An ninh Vận hành Relay (Mục 5):**
    - Chỉ tin header `x-forwarded-for` khi `TRUST_PROXY=true`, mặc định lấy `req.socket.remoteAddress`.
    - Từ chối `result_signature` nếu phòng chưa có `result_proposal`.
    - Tự động dọn dẹp phòng ở trạng thái "waiting" quá 10 phút và đóng socket liên quan.
    - Lời gọi `routeMessage` luôn có `.catch` xử lý lỗi, bảo đảm không sập process khi xảy ra ngoại lệ.
    - Chuẩn hóa số liệu giới hạn bảo mật khớp mã nguồn: 20 kết nối/IP, 25 tin/giây, 500 phòng đồng thời.
- **Rủi ro tồn đọng & Việc chưa làm:**
  - ⚠️ **D13:** Khóa cược khán giả theo cửa sổ ngắn (60-120s) và lưu `lockedAt` trong Meta thay vì khóa ngay tại `joinRoom`.
  - ⚠️ **Chống thông đồng qua cửa Hòa (G6) & Tự cược:** Cần hoàn thiện cơ chế hủy thưởng nếu hai kỳ thủ thỏa thuận hòa vi mô để thao túng pool khán giả.
  - ⚠️ **Sybil & ELO:** Hiện chỉ hạn chế theo cặp ví cố định, chưa có giải pháp chống tạo nhiều ví phụ cày điểm.
  - ⚠️ **Q12:** Cơ chế chi trả Quỹ giải thưởng mùa giải (`seasonPrizePool`) vẫn đang mở (Open).
  - ⚠️ **Nối ví Wagmi/RainbowKit trên Web:** Giao diện Web vẫn chạy ở chế độ cục bộ, chưa kết nối trực tiếp ví người dùng để gửi tx on-chain.

---

### Phase 6: Kiểm toán Bảo mật & Ra mắt Mainnet (Kế hoạch)

- **Tiến độ hiện tại:** 0%
- **Các cột mốc dự kiến:**
  - [ ] Audit độc lập các Smart Contract (ChessEscrow và AvaClashMeta).
  - [ ] Tích hợp ví Wagmi/Viem trên Web Client.
  - [ ] Triển khai D13 (cửa sổ khóa cược khán giả và lockedAt).
  - [ ] Deploy Avalanche Fuji Testnet bằng Keystore.
  - [ ] Triển khai Avalanche C-Chain Mainnet & Khởi tranh Season 1.

---

## 3. Tổng hợp Chỉ số Kiểm thử & Mã nguồn (Metrics Thật Lượt 3a)

| Hạng mục kiểm thử                                            | Công cụ | Số lượng Test |          Kết quả          |
| :----------------------------------------------------------- | :------ | :-----------: | :-----------------------: |
| **Logic cờ vua, Mã hóa, EIP-712 v2, Replay, Schema, Cross-Spec**| Vitest |      95       |      ✅ 95/95 Passed      |
| **WebSocket Relay Server (packages/relay unit + hardening)** | Vitest  |      16       |      ✅ 16/16 Passed      |
| **Tích hợp Relay với Anvil thật (anvil-integration.test.ts)**| Vitest  |       8       |       ✅ 8/8 Passed       |
| **Giao diện Client & Game State (web)**                      | Vitest  |      17       |      ✅ 17/17 Passed      |
| **Hợp đồng ký quỹ cược (ChessEscrow unit, fuzz, cross-spec)** | Foundry |      91       |      ✅ 91/91 Passed      |
| **Hợp đồng Meta Layer (AvaClashMeta unit tests)**            | Foundry |      18       |      ✅ 18/18 Passed      |
| **Tích hợp Escrow ↔ Meta (ChessEscrowMetaIntegration)**       | Foundry |       3       |       ✅ 3/3 Passed       |
| **Cô lập try/catch & Cứu hộ (ChessEscrowMetaTryCatch)**      | Foundry |       8       |       ✅ 8/8 Passed       |
| **Bất biến bảo toàn thanh khoản (ChessEscrowInvariant)**      | Foundry |       1       | ✅ 1/1 Passed (128,000 calls)|
| **TỔNG CỘNG TOÀN DỰ ÁN**                                    | —       |    **257**    | **257/257 Passed (100%)** |

---

## 4. Kế hoạch Hành động Tiếp theo

1. **Triển khai D13 (Spectator Betting Window):** Khóa cược theo cửa sổ thời gian (60-120 giây) kèm `lockedAt` trong `AvaClashMeta` để khán giả quan sát được kỳ thủ trước khi cược.
2. **Tích hợp ví Wagmi/RainbowKit trên Web:** Kết nối luồng `createRoom(creatorIsWhite)` và `joinRoom` với ví Web3 của người dùng.
3. **Thiết kế phân bổ Q12 (`seasonPrizePool`):** Lập đặc tả phân phối phần thưởng mùa giải cho người chơi đạt ELO và điểm Season cao.
4. **Deploy Fuji Testnet bằng Keystore:** Khi hoàn thành giao diện Web và ví Wagmi, broadcast hợp đồng lên Fuji qua `Deploy.s.sol`.

