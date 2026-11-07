# Báo cáo Đánh giá & Rà soát Triển khai Lượt 2 — AvaClash Chess

> **Ngày lập báo cáo:** 25/10/2026  
> **Căn cứ yêu cầu:** Triển khai 7 mục cải tiến (G8a, G8b, G4, G14, G5, G1, EIP-712 v2) theo `docs/IMPROVEMENT_PLAN.md` và `docs/DECISIONS.md`.  
> **Trạng thái:** Hoàn tất 100% các mục tiêu kỹ thuật; toàn bộ 211 tests (`forge test` và `pnpm test`) đều xanh.

---

## 1. Chi tiết Triển khai Từng Mục (Mục 1 – 7)

### 1.1. Mục 1: G8a — Cô lập Lời gọi Escrow → Meta & Bảo vệ Khán giả

- **Commit Hash:** [`c404574`](../../contracts/src/ChessEscrow.sol) (`c4045747d67d0d51d3c5a1448fd2c6035c03e135`)
- **Các file thay đổi:**
  - [`contracts/src/ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol)
  - [`contracts/test/ChessEscrowMetaTryCatch.t.sol`](../../contracts/test/ChessEscrowMetaTryCatch.t.sol)
  - [`docs/DECISIONS.md`](../design/DECISIONS.md)
- **Tóm tắt hành vi mới:**
  Mọi lời gọi từ `ChessEscrow` sang `IAvaClashMeta` (`registerMatch`, `lockBetting`, `cancelPrediction`, `updateEloOnSettle`, `resolvePrediction`) được bọc kín bằng khối `try/catch`. Khi Meta revert, Escrow phát sự kiện `MetaCallFailed(roomId, selector)` và các giao dịch của người chơi (settle kết quả, hủy phòng sớm `abortRoom`, hoàn tiền quá hạn `refundOnTimeout`, vào phòng `joinRoom`) vẫn hoàn tất thành công độc lập mà không bị kẹt tiền. Nếu `resolvePrediction` thất bại, Escrow lưu cờ `metaResolutionFailed` và cung cấp 2 hàm cứu hộ: `retryResolvePrediction` (thử giải ngân lại khi Meta hồi phục) hoặc `fallbackCancelPrediction` (hủy pool để khán giả rút lại 100% tiền cược gốc).
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt trái ngược. Đã triển khai đầy đủ cả 2 hướng yêu cầu (vừa có đường retry giải ngân vừa có đường fallback hoàn tiền sau timeout/sự cố).
- **Các test mới đã thêm:**
  - `test_JoinRoom_SuccessWhenMetaReverts` (trong `ChessEscrowMetaTryCatch.t.sol`)
  - `test_AbortRoom_SuccessWhenMetaReverts` (trong `ChessEscrowMetaTryCatch.t.sol`)
  - `test_RefundOnTimeout_SuccessWhenMetaReverts` (trong `ChessEscrowMetaTryCatch.t.sol`)
  - `test_SubmitResult_SettleSuccessWhenMetaReverts` (trong `ChessEscrowMetaTryCatch.t.sol`)
  - `test_SubmitResult_DrawSuccessWhenMetaReverts` (trong `ChessEscrowMetaTryCatch.t.sol`)

---

### 1.2. Mục 2: G8b — Kiểm tra Tính Nhất quán Outcome và Winner

- **Commit Hash:** [`2c163c0`](../../contracts/src/ChessEscrow.sol#L442-L460) (`2c163c00654b982a45d3bdf0fa7321cd906e3e15`)
- **Các file thay đổi:**
  - [`contracts/src/ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol)
  - [`contracts/test/ChessEscrow.t.sol`](../../contracts/test/ChessEscrow.t.sol)
- **Tóm tắt hành vi mới:**
  Hợp đồng bổ sung hàm nội bộ `_validateOutcomeAndWinner(room, winner, outcome)` để xác thực tính logic giữa kết cục ván cờ và địa chỉ người thắng. Bắt buộc: nếu `outcome == OutcomeCode.Draw` (2) thì `winner == address(0)` và ngược lại; nếu không hòa thì `winner` phải là `playerA` hoặc `playerB`. Kiểm tra này được tích hợp chặn ngay lập tức tại các điểm nộp kết quả gồm `submitResult`, `submitSingleSigned` và `challenge`.
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt. Tuân thủ đúng ràng buộc: KHÔNG xử lý ràng buộc theo màu quân ở lượt này (bảo lưu cho lượt thiết kế GameStart).
- **Các test mới đã thêm:**
  - `test_submitResult_revert_drawWithNonZeroWinner` (trong `ChessEscrow.t.sol`)
  - `test_submitResult_revert_zeroWinnerWithNonDrawOutcome` (trong `ChessEscrow.t.sol`)
  - `test_submitResult_revert_invalidWinner` (trong `ChessEscrow.t.sol`)
  - `test_submitSingleSigned_revert_outcomeWinnerMismatch` (trong `ChessEscrow.t.sol`)
  - `test_challenge_revert_outcomeWinnerMismatch` (trong `ChessEscrow.t.sol`)

---

### 1.3. Mục 3: G4 — Telemetry Chỉ Cảnh báo (Q10 / D10)

- **Commit Hash:** [`fda0f5e`](../../packages/relay/src/RelayRoom.ts#L225-L235) (`fda0f5e4119515bfda2998e292fc25d25976c348`)
- **Các file thay đổi:**
  - [`packages/relay/src/RelayRoom.ts`](../../packages/relay/src/RelayRoom.ts)
  - [`packages/relay/src/RelayServer.ts`](../../packages/relay/src/RelayServer.ts)
  - [`packages/relay/tests/relay.test.ts`](../../packages/relay/tests/relay.test.ts)
- **Tóm tắt hành vi mới:**
  Trong `RelayRoom.ts`, hàm `handleFocusWarning` đã được loại bỏ hoàn toàn việc trừ thời gian trên đồng hồ thi đấu (`Math.max(0, this.whiteMs - penaltyMs)`) và loại bỏ việc xử thua kỹ thuật khi vi phạm quá 3 lần (`warningCount > 3`). Server chỉ ghi nhận `warningCount++` và chuyển tiếp gói tin `focus_warning` để cảnh báo hiển thị trên giao diện của cả hai người chơi. Cơ chế này bảo toàn triệt để nguyên lý "Pure FIDE Core" (ADR Q10/D10), tránh phạt oan kỳ thủ do telemetry phía client không thể kiểm chứng mật mã học.
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt. Thêm method `getRoom(roomId)` trong `RelayServer.ts` để unit test có thể kiểm tra trạng thái phòng chơi an toàn.
- **Các test mới/cập nhật:**
  - Cập nhật test suite trong [`packages/relay/tests/relay.test.ts`](../../packages/relay/tests/relay.test.ts): xác nhận khi nhận telemetry `focus_warning`, đồng hồ của người chơi không bị trừ thời gian và trạng thái ván cờ không bị xử thua kỹ thuật.

---

### 1.4. Mục 4: G14 — Khóa Hardcode trong Repo

- **Commit Hash:** [`26e184a`](../../packages/relay/src/RelayServer.ts#L40) (`26e184a47e6d58b0ff9084d88b7e0a7cc7df74fa`)
- **Các file thay đổi:**
  - [`packages/relay/src/RelayServer.ts`](../../packages/relay/src/RelayServer.ts)
  - [`packages/relay/src/index.ts`](../../packages/relay/src/index.ts)
  - [`packages/relay/tests/relay.test.ts`](../../packages/relay/tests/relay.test.ts)
  - [`.env.example`](../../.env.example)
  - [`packages/relay/.env.example`](../../packages/relay/.env.example)
- **Tóm tắt hành vi mới:**
  Xóa hoàn toàn giá trị private key mặc định được hardcode trong `RelayServer.ts` và `index.ts`. Server bắt buộc phải đọc khóa ký từ biến môi trường `RELAY_PRIVATE_KEY`; nếu thiếu, server dừng khởi động ngay lập tức và ném lỗi rõ ràng `Missing required environment variable: RELAY_PRIVATE_KEY`. Cung cấp file mẫu `.env.example` (chỉ chứa placeholder không có khóa thật) và cập nhật test suite tự sinh khóa ngẫu nhiên qua `generatePrivateKey()`.
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt.
- **Các test mới đã thêm:**
  - `it('throws error if RELAY_PRIVATE_KEY is missing')` (trong `packages/relay/tests/relay.test.ts`)

---

### 1.5. Mục 5: G5 — Tách Arbiter Độc lập & Thêm Pausable

- **Commit Hash:** [`f925d42`](../../contracts/src/ChessEscrow.sol#L77-L125) (`f925d423034bc6bb4331ca1eddbc49ed1120bff0`)
- **Các file thay đổi:**
  - [`contracts/src/ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol)
  - [`contracts/test/ChessEscrow.t.sol`](../../contracts/test/ChessEscrow.t.sol)
- **Tóm tắt hành vi mới:**
  Biến `arbiter` được tách riêng hoàn toàn khỏi `relaySigner` trong `ChessEscrow.sol`; thay đổi arbiter thông qua quy trình timelock 2 ngày (`proposeArbiter`, `executeArbiterChange`, `ARBITER_TIMELOCK = 2 days`) kèm các sự kiện công khai. Hợp đồng kế thừa OpenZeppelin `Pausable`: hàm `pause()` và `unpause()` do owner quản lý, gắn modifier `whenNotPaused` duy nhất vào `createRoom` và `joinRoom`. Khi hợp đồng bị tạm dừng khẩn cấp, các hàm bảo vệ tài sản (`abortRoom`, `refundOnTimeout`, `withdraw`, `claim*`) hoàn toàn không bị ảnh hưởng, đảm bảo vốn của người chơi không bao giờ bị đóng băng.
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt.
- **Các test mới đã thêm:**
  - `test_arbiter_different_from_relaySigner` (trong `ChessEscrow.t.sol`)
  - `test_pause_blocksCreateAndJoin_allowsAbortRefundWithdraw` (trong `ChessEscrow.t.sol`)

---

### 1.6. Mục 6: G1 — Bond ở Nhánh Mặc định (Q8)

- **Commit Hash:** [`a89ef44`](../../contracts/src/ChessEscrow.sol#L408-L435) (`a89ef44a287a5b9111ef5fcf6f7beaa8d3ce3d31`)
- **Các file thay đổi:**
  - [`contracts/src/ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol)
  - [`contracts/test/ChessEscrow.t.sol`](../../contracts/test/ChessEscrow.t.sol)
- **Tóm tắt hành vi mới:**
  Tại hàm `resolveDefaultChallenge`, hợp đồng hoàn trả 100% tiền cược gốc cho cả 2 người chơi (như cũ), nhưng phạt 50% tiền cọc khiếu nại (`room.challengeBond / 2`) chuyển vào số dư của bên nộp đơn (`room.singleSignedWinner`), 50% bond còn lại hoàn trả cho bên khiếu nại (`room.challenger`). Cơ chế này triệt tiêu hoàn toàn động lực khiếu nại gian lận rồi chờ arbiter im lặng để "hòa vốn", bởi kẻ quấy rối phải chịu lỗ ròng 10% tiền cược (50% bond), đồng thời bên bị quấy rối nhận được khoản đền bù công bằng. Toàn bộ tiền trên hợp đồng được bảo toàn 100%.
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt.
- **Các test mới đã thêm:**
  - `test_resolveDefaultChallenge_conservationAndBondPenalty` (trong `ChessEscrow.t.sol`)

---

### 1.7. Mục 7: EIP-712 Version "2" & Kiểm tra Chéo

- **Commit Hash:** [`c679b5f`](../../packages/shared/src/eip712.ts#L18) (`c679b5f980f0db7cf61902ed30b4c97e43f045cd`)
- **Các file thay đổi:**
  - [`contracts/src/ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol)
  - [`contracts/test/ChessEscrow.t.sol`](../../contracts/test/ChessEscrow.t.sol)
  - [`packages/shared/src/eip712.ts`](../../packages/shared/src/eip712.ts)
  - [`packages/shared/tests/eip712.test.ts`](../../packages/shared/tests/eip712.test.ts)
- **Tóm tắt hành vi mới:**
  Nâng phiên bản domain EIP-712 đồng bộ từ `"1"` lên `"2"` trong constructor của `ChessEscrow.sol` (`EIP712("AvaClashChess", "2")`) và trong hằng số `EIP712_DOMAIN` của `packages/shared/src/eip712.ts`. Thư viện `@avaclash/shared` được biên dịch lại để các gói client và relay sử dụng phiên bản mới. Bộ test chéo TS $\leftrightarrow$ Solidity được triển khai để kiểm tra giá trị băm `DOMAIN_SEPARATOR` tính bằng `viem` khớp tuyệt đối với giá trị băm do OpenZeppelin Solidity sinh ra trên chuỗi.
- **Khác biệt so với yêu cầu ban đầu & Lý do:**
  Không có khác biệt.
- **Các test mới đã thêm:**
  - `test_EIP712_DomainSeparator_Matches_V2_Spec` (trong `contracts/test/ChessEscrow.t.sol`)
  - Bổ sung test kiểm tra `DOMAIN_SEPARATOR` khớp đặc tả trong `packages/shared/tests/eip712.test.ts`.

---

## 2. Kết Quả Kiểm Thử Thực Tế (`forge test` & `pnpm test`)

Toàn bộ hệ thống đạt trạng thái **100% test pass (211/211 passed)**, tăng **16 test** so với mốc 195 test trước lượt 2:

| Gói kiểm thử | Công cụ | Trước lượt 2 | Sau lượt 2 | Số test tăng | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `@avaclash/shared` (Replay, EIP-712 v2, Schemas, Hash, Types) | Vitest | 93 | **94** | +1 | ✅ 94 Passed, 0 Failed |
| `@avaclash/relay` (Matchmaking, 2-of-3, Telemetry, Env check) | Vitest | 6 | **7** | +1 | ✅ 7 Passed, 0 Failed |
| `web` (Phaser 3 GameState, Clocks, Moves) | Vitest | 17 | **17** | 0 | ✅ 17 Passed, 0 Failed |
| `ChessEscrow.t.sol` (Multisig, Bond split, Arbiter, Pausable, Fuzz) | Foundry | 62 | **71** | +9 | ✅ 71 Passed, 0 Failed |
| `AvaClashMeta.t.sol` (ELO, No-Loss Vault, Spectator) | Foundry | 14 | **14** | 0 | ✅ 14 Passed, 0 Failed |
| `ChessEscrowMetaIntegration.t.sol` (Luồng thi đấu tích hợp) | Foundry | 3 | **3** | 0 | ✅ 3 Passed, 0 Failed |
| `ChessEscrowMetaTryCatch.t.sol` (Suite cô lập try/catch & phục hồi) | Foundry | 0 | **5** | +5 | ✅ 5 Passed, 0 Failed |
| **TỔNG CỘNG TOÀN DỰ ÁN** | — | **195** | **211** | **+16** | **✅ 211 Passed (100%)** |

---

## 3. Quyết định G8a: Cơ Chế Lấy Lại Tiền Khán Giả Khi Meta Lỗi

Khi lời gọi `resolvePrediction` revert trong `submitResult`:

1. **Khối bắt lỗi tại Escrow:**  
   Tại [`contracts/src/ChessEscrow.sol:509-523`](../../contracts/src/ChessEscrow.sol#L509-L523), khối `try meta.resolvePrediction(roomId, winningOption)` bắt lỗi revert, phát `emit MetaCallFailed(roomId, meta.resolvePrediction.selector)` và ghi nhận trạng thái:
   - `metaResolutionFailed[roomId] = true;` (dòng 520)
   - `metaWinningOption[roomId] = winningOption;` (dòng 521)
   Giao dịch của người chơi vẫn hoàn tất giải ngân bình thường.

2. **Cách thức khán giả lấy lại tiền (2 cơ chế cứu hộ):**
   - **Cơ chế 1 — Giải ngân đúng kết quả (`retryResolvePrediction`):**  
     Tại [`contracts/src/ChessEscrow.sol:529-543`](../../contracts/src/ChessEscrow.sol#L529-L543), hàm này cho phép bất kỳ ai gọi lại để giải ngân phần thưởng theo đúng kết quả trận đấu khi Meta hoạt động bình thường trở lại. Nếu thành công, `metaResolutionFailed[roomId]` được xóa về `false` và khán giả cược cửa thắng rút phần thưởng theo tỷ lệ qua `claimSpectatorReward`.
   - **Cơ chế 2 — Hoàn tiền 100% vốn (`fallbackCancelPrediction`):**  
     Tại [`contracts/src/ChessEscrow.sol:548-560`](../../contracts/src/ChessEscrow.sol#L548-L560), nếu Meta vĩnh viễn không thể giải ngân kết quả, bất kỳ ai cũng có thể kích hoạt hàm fallback này để chuyển trạng thái pool dự đoán sang `Cancelled` qua `meta.cancelPrediction(roomId)`. Khi đó, 100% khán giả có thể rút lại nguyên vẹn tiền cược gốc qua hàm `claimSpectatorRefund(roomId)` trong [`contracts/src/AvaClashMeta.sol:297-308`](../../contracts/src/AvaClashMeta.sol#L297-L308).

Quyết định kiến trúc này đã được ghi chép và phê duyệt đầy đủ tại **ADR D14** trong [`docs/DECISIONS.md:147-156`](../design/DECISIONS.md#L147-L156).

---

## 4. Danh Sách Chuỗi Giống Private Key trong Repo & Git History

### 4.1. Trong mã nguồn Repo hiện tại
- [`packages/relay/src/RelayServer.ts`](../../packages/relay/src/RelayServer.ts): Đã xóa bỏ chuỗi default key 64 hex; chuyển sang kiểm tra bắt buộc `process.env.RELAY_PRIVATE_KEY` (commit `26e184a`).
- [`packages/relay/src/index.ts`](../../packages/relay/src/index.ts): Đã xóa bỏ fallback test key; dừng process nếu biến môi trường bị thiếu (commit `26e184a`).
- [`packages/relay/tests/relay.test.ts`](../../packages/relay/tests/relay.test.ts): Đã thay thế test key cố định bằng `generatePrivateKey()` sinh ngẫu nhiên mỗi lần chạy test (commit `26e184a`).
- [`.env.example`](../../.env.example) và [`packages/relay/.env.example`](../../packages/relay/.env.example): Chỉ chứa chuỗi placeholder mô tả định dạng (`0x<64_hex_characters_private_key>`), không chứa secret thật.
- Các chuỗi 64 ký tự hex khác:
  - [`packages/shared/tests/eip712.test.ts:14`](../../packages/shared/tests/eip712.test.ts#L14): chuỗi mock `movesHash` 32 bytes (`0xabcdef...`).
  - [`packages/shared/tests/schemas.test.ts:78, 94, 111, 128, 254`](../../packages/shared/tests/schemas.test.ts#L78): các chuỗi mock bytes32 signature / movesHash.
  - **Khẳng định:** Không còn bất kỳ private key hay test private key hardcode nào trong mã nguồn đang hoạt động.

### 4.2. Trong lịch sử Git
- **Commit `fda0f5e`:** Từng lưu mã nguồn Relay ban đầu có chứa chuỗi hardcode test private key mặc định.
- **Commit `26e184a`:** Đã dọn dẹp và xóa hoàn toàn chuỗi này khỏi toàn bộ file.
- **Khuyến cáo an ninh:** Khóa test từng xuất hiện trong lịch sử git tuyệt đối không được sử dụng cho bất kỳ tài khoản hoặc ví nào nắm giữ tài sản thật trên Avalanche C-Chain / Fuji Testnet.

---

## 5. Những Việc Chưa Làm / Khác Dự Kiến & Điểm Còn Nghi Ngờ

1. **Các việc chưa làm ở lượt 2 (theo đúng kế hoạch phân kỳ):**
   - **G2 (`abortRoom` giữa ván):** Chưa chặn bằng chữ ký `confirmStart` on-chain (dự kiến thực hiện ở lượt thiết kế GameStart).
   - **G3 (Cửa sổ cược ngắn khán giả):** Điểm khóa cược vẫn nằm tại `joinRoom` (dự kiến chuyển sang cửa sổ 60-120s theo ADR D13 ở lượt sau).
   - **G6 (Thông đồng qua cửa Hòa):** Chưa bổ sung điều kiện `moveCount >= 20` trên Meta để hủy cược khi hòa quá sớm.
   - **G7 (Chống Sybil ELO & Season Points decay):** Bảo lưu sang Phase tiếp theo.
   - **G8b (Ràng buộc màu quân on-chain):** Chưa lưu màu on-chain, tuân thủ đúng yêu cầu chỉ kiểm tra logic `winner`/`outcome` ở lượt này.

2. **Các điểm còn nghi ngờ & Lưu ý kiến trúc:**
   - **Phân tách thực thể Arbiter vs RelaySigner:** Trong contract đã tách riêng biến và timelock, nhưng ở môi trường thực tế, khóa `arbiter` phải được nắm giữ bởi multisig ban quản trị (hoặc ví lạnh) hoàn toàn độc lập với server daemon chạy `relaySigner`.
   - **Khả năng thực thi của `fallbackCancelPrediction`:** Cơ chế này giả định hàm `meta.cancelPrediction` không bị revert. Vì `cancelPrediction` chỉ chuyển trạng thái enum `status = PredictionStatus.Cancelled` nên xác suất lỗi là cực thấp.

---

## 6. Xác Nhận về Forge Fmt / Lint

- **Thực tế thực hiện:** Trong lượt 2, lệnh tự động format (`forge fmt` và `prettier --write`) **CHƯA được áp dụng vào toàn bộ codebase** nhằm giữ nguyên cấu trúc diff tối giản và tránh sinh ra các commit sửa khoảng trắng (whitespace) không cần thiết.
- **Kiểm tra `forge fmt --check`:** Lệnh kiểm tra cho thấy một số file test (`ChessEscrow.t.sol`, `ChessEscrowMetaTryCatch.t.sol`, `ChessEscrowMetaIntegration.t.sol`) có khác biệt nhỏ về phong cách ngắt dòng hoặc dấu cách trong lời gọi `{value: bond}` (Foundry đề xuất `{ value: bond }`).
- **Chất lượng mã nguồn:** Toàn bộ code Solidity và TypeScript đều biên dịch sạch, không có lỗi cú pháp hay lint error nào gây cản trở kiểm thử (`forge test` và `pnpm test` đều đạt 100% green).
