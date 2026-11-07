# Báo cáo Kỹ thuật & Kiểm thử Lượt 3A — AvaClash Chess

> **Ngày lập báo cáo:** 26/10/2026  
> **Căn cứ yêu cầu:** Lượt 3a — Từng mục là commit riêng, chạy toàn bộ test (forge test, pnpm test) sau mỗi mục. KHÔNG deploy, KHÔNG đọc hay in private key, KHÔNG viết lại lịch sử git.  
> **Trạng thái kiểm thử:** **257/257 tests XANH 100%** (121 Foundry tests gồm Invariant test 128,000 calls, 136 Vitest tests gồm Anvil integration test thật).  
> **Điểm nhấn bước ngoặt Lượt 3a:** Trước lượt 3a, Relay không đọc được phòng thật trên chain; từ lượt 3a, Relay đã sinh ABI tự động từ forge artifact, kết nối PublicClient và WalletClient thật để tương tác trực tiếp với Anvil, tự động phát tín hiệu `signalGameStarted` ngăn chặn triệt để khai thác `abortRoom`, và hỗ trợ lưu trữ cũng như ký lại kết quả sau khi khởi động lại server.

---

## 1. Tổng quan & Danh sách Commit Theo Từng Mục

| Mục | Nội dung | Commit | Tệp thay đổi chính | Trạng thái |
| :-- | :-- | :-: | :-- | :-: |
| **1** | ABI tự động sinh từ forge artifact & Test tích hợp Anvil thật (RelayServer PublicClient thật, ký kép, settle on-chain) | `387e3e8` | `scripts/generate-abi.ts`, `packages/relay/src/RelayServer.ts`, `packages/relay/tests/anvil-integration.test.ts`, `packages/relay/tests/abi.test.ts` | ✅ Đã commit |
| **2** | `ChessEscrow.sol`: `singleSignedEnabled` (Q15), giải phóng bond kẹt (stuck bond fix), Invariant test 128k calls, kiểm thử đối xứng G1, `Ownable2Step` & timelock `setMetaContract` | `02822f2` | `contracts/src/ChessEscrow.sol`, `contracts/test/ChessEscrow.t.sol`, `contracts/test/invariants/*`, `contracts/script/Deploy.s.sol` | ✅ Đã commit |
| **3** | Relay gọi `signalGameStarted(roomId)` (Q16) khi phòng active, retry backoff 150s, kiểm tra số dư ví relay khi khởi động, Anvil integration test | `c74b8c0` | `packages/relay/src/RelayServer.ts`, `packages/relay/tests/anvil-integration.test.ts`, `packages/relay/tests/relay.test.ts` | ✅ Đã commit |
| **4** | Lưu ván cờ vào `RESULTS_DIR` (48h), client gửi `request_result {roomId}` xin cấp lại chữ ký với deadline 30m, test Anvil khôi phục sau restart | `2441952` | `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`, `packages/relay/src/RelayServer.ts`, `packages/relay/tests/anvil-integration.test.ts` | ✅ Đã commit |
| **5** | Gia cố nhỏ: chỉ tin `x-forwarded-for` khi `TRUST_PROXY=true`, từ chối `result_signature` khi chưa có proposal, dọn dẹp phòng waiting sau 10m, `.catch` bọc `routeMessage` | `a301f8f` | `packages/relay/src/RelayServer.ts`, `packages/relay/src/RelayRoom.ts`, `packages/relay/tests/relay.test.ts` | ✅ Đã commit |
| **6** | Cập nhật tài liệu (`DECISIONS.md`, `PROGRESS.md`, `REPORT_LUOT3A.md`) | *(hiện tại)* | `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/REPORT_LUOT3A.md` | ✅ Đang hoàn tất |

---

## 2. Chi Tiết Kỹ Thuật Từng Mục Đã Hoàn Thành

### Mục 1: ABI Tự Động Sinh & Test Tích Hợp Anvil Thật (`387e3e8`)
1. **Loại bỏ hoàn toàn ABI viết tay trong RelayServer:**
   - Xóa bỏ hằng số `ESCROW_ABI` viết tay thủ công vốn thiếu các trường trạng thái và hàm mới.
   - Xây dựng script `scripts/generate-abi.ts` tự động đọc file artifact JSON của Foundry (`contracts/out/ChessEscrow.sol/ChessEscrow.json` và `contracts/out/AvaClashMeta.sol/AvaClashMeta.json`), trích xuất mảng `abi` và xuất ra các file TypeScript strongly-typed với `as const` (`packages/relay/src/abi/ChessEscrow.ts`, `packages/relay/src/abi/AvaClashMeta.ts`).
   - Cấu hình script này chạy tự động trước build và test của relay (`pretest`, `prebuild` trong `packages/relay/package.json`).
   - Bổ sung unit test `packages/relay/tests/abi.test.ts` so khớp chặt chẽ giữa ABI được sinh và artifact gốc.
2. **Bộ test tích hợp Anvil thật (`packages/relay/tests/anvil-integration.test.ts`):**
   - Tự động phát hiện và khởi chạy instance Anvil cục bộ (nếu thiếu anvil trong PATH thì skip test kèm thông báo rõ ràng).
   - Deploy trực tiếp `AvaClashMeta` và `ChessEscrow` (bằng bytecode artifact thật, constructor 3 tham số, liên kết contract hai chiều `setEscrowContract` và `setMetaContract`).
   - Khởi tạo `RelayServer` với `publicClient` thật kết nối tới RPC của Anvil.
   - Kiểm tra:
     - `createRoom(true)` và `createRoom(false)`: gán đúng ghế và màu quân trên chain theo Q13.
     - Phòng `Open` (chưa có người thứ 2 vào cược trên chain) bị Relay từ chối kết nối (`fail-closed`).
     - Ví không thuộc phòng chỉ được kết nối dưới vai trò `spectator` (xem trực tiếp, không gửi được lệnh cờ).
     - Sau khi trận đấu settle trên chain (status = 2), Relay từ chối ký (`Refusing to sign`).
     - Test kết quả ký thật: Relay ký proposal, Alice ký chữ ký kỳ thủ, gửi `submitResult` lên Anvil thành công, phòng chuyển sang `Settled` (2).

### Mục 2: Nâng Cấp An Ninh `ChessEscrow.sol` & Invariant Testing (`02822f2`)
1. **Biến `singleSignedEnabled` & Hàm Quản Trị (Q15):**
   - Thêm biến công khai `bool public singleSignedEnabled = false` (mặc định tắt trên Fuji).
   - Thêm hàm `setSingleSignedEnabled(bool enabled)` chỉ `owner` có quyền gọi, phát sự kiện `SingleSignedStatusUpdated(enabled)`.
   - Hàm `submitSingleSigned` kiểm tra cờ này, nếu tắt sẽ revert ngay với lỗi `SingleSignedDisabled()`.
   - Bật cờ này trong `setUp()` của các unit test cũ để bảo toàn 100% test case hiện có, đồng thời thêm test `test_submitSingleSigned_revert_whenDisabledByDefault()`.
2. **Khắc phục triệt để lỗi kẹt Bond (Stuck Bond Fix):**
   - Trong `submitResult`: nếu phòng từng có `singleSignedAt != 0` và `singleSignedBond > 0`:
     - Nếu `winner == room.singleSignedWinner`: hoàn 100% bond cho người nộp claim (`singleSignedSubmitter`).
     - Ngược lại (người khác thắng hoặc kết quả hòa): chuyển toàn bộ bond cho người chơi còn lại (không phải người nộp claim).
     - Đặt `room.singleSignedBond = 0` sau khi xử lý.
   - Rà soát và xóa sạch bond chưa xử lý ở tất cả các nhánh kết thúc khác (`resolveChallenge`, `resolveDefaultChallenge`, `finalizeSingleSigned`), bảo đảm không còn bất kỳ kịch bản nào bị đọng bond trong hợp đồng.
3. **Kiểm thử Bất biến Bảo toàn Khả năng Thanh toán (Foundry Invariant Test):**
   - Viết handler `contracts/test/invariants/ChessEscrowHandler.sol` bao bọc tất cả các hàm tác động dòng tiền: `createRoom`, `joinRoom`, `cancelRoom`, `abortRoom`, `refundOnTimeout`, `submitResultDual`, `submitSingleSigned`, `finalizeSingleSigned`, `withdraw`, `withdrawProtocolFees`.
   - Viết test suite `contracts/test/invariants/ChessEscrowInvariant.t.sol`:
     - Bất biến: `address(escrow).balance == totalPendingWithdrawals + protocolFees + totalActiveStakesAndBonds`.
     - Chạy 256 runs, mỗi run 500 calls (tổng cộng 128,000 calls ngẫu nhiên). Kết quả: **PASS tuyệt đối, không có sai lệch dù chỉ 1 wei**.
     - Cách chạy: `cd contracts && forge test --match-contract ChessEscrowInvariantTest`.
4. **Kiểm thử Kịch bản Đối xứng G1 (Test `test_G1_payoffComparison_symmetric_loserSubmitsSingleSigned`):**
   - Thiết lập ván đấu Stake = 0.1 AVAX, Challenge Bond = 0.02 AVAX.
   - Kẻ THUA cờ (Bob) gian lận nộp `submitSingleSigned` trước.
   - Người THẮNG thực sự (Alice) buộc phải nộp bond để `challenge`.
   - Arbiter gặp sự cố và im lặng suốt 24 giờ.
   - Khi gọi `resolveDefaultChallenge`:
     - Kẻ thua (Bob) nhận: 0.1 AVAX stake + 0.02 AVAX submitter bond + 0.01 AVAX bồi thường = 0.13 AVAX $\to$ **LÃI RÒNG +0.01 AVAX (+10% stake)**.
     - Người thắng chân chính (Alice) chỉ nhận: 0.1 AVAX stake + 0.01 AVAX = 0.11 AVAX $\to$ **LỖ RÒNG -0.01 AVAX (-10% stake)**.
   - Kết quả này chứng minh lỗ hổng kinh tế mang tính hệ thống của single-signed khi thiếu cơ chế xác thực chuỗi nước đi E1, là căn cứ thuyết phục để tắt mặc định tính năng này (Q15).
5. **Nâng cấp Quản trị Hợp đồng:**
   - Thay thế cơ chế Owner tự viết bằng thư viện chuẩn `@openzeppelin/contracts/access/Ownable2Step.sol`.
   - Hàm `setMetaContract`: nếu chưa đặt (`metaContract == address(0)`) thì cho phép đặt trực tiếp ngay lần đầu; nếu đã có meta thì bắt buộc đi qua timelock 2 ngày (`executeMetaContractChange`) và phát event theo dõi.

### Mục 3: Relay Tự Động Gọi `signalGameStarted` On-Chain (`c74b8c0` - Q16)
1. **WalletClient trên RelayServer:**
   - `RelayServer` nhận thêm cấu hình `walletClient` (tạo từ ví relay account và RPC URL).
   - Thêm phương thức `handleGameStarted(room: RelayRoom)`: ngay khi phòng chuyển sang trạng thái "active" (cả 2 kỳ thủ đã nhận ghế), Relay tự động gửi giao dịch `signalGameStarted(roomId)` on-chain.
   - Cơ chế retry: chờ receipt, nếu lỗi sẽ retry với exponential backoff tối đa 150 giây (hoàn tất trước ngưỡng `ABORT_TIMEOUT = 180s`), ghi log chi tiết.
   - Chạy nền bất đồng bộ, không chặn luồng gửi nhận nước đi cờ vua.
2. **Kiểm tra Số dư Khởi động:**
   - Kiểm tra số dư ví Relay khi khởi động thông qua `publicClient.getBalance`, phát cảnh báo rõ ràng nếu số dư thấp hơn `RELAY_MIN_BALANCE` (mặc định 0.1 AVAX).
3. **Kiểm thử Tích hợp Anvil Thật:**
   - Sau khi cả 2 người chơi vào ghế, `room.gameStarted` on-chain chuyển thành `true`.
   - Sau 3 phút, gọi `abortRoom` lập tức revert lỗi custom `GameAlreadyStarted()`.
   - Nếu tắt tính năng (`signalGameStartedEnabled: false`), `abortRoom` vẫn hoạt động thành công sau 3 phút như cũ.

### Mục 4: Lưu Trữ & Cấp Lại Chữ Ký Kết Quả Ván Đấu (`2441952`)
1. **Lưu trữ Kết quả vào File (Persistence):**
   - Khi ván đấu kết thúc (`handleGameOver`), Relay tự động lưu thông tin kết quả ván cờ vào thư mục `RESULTS_DIR` dưới dạng JSON `${roomId}.json`: `moves`, `outcome`, `reason`, `winner`, `timestamp`.
   - Khi Relay khởi động lại (`loadAndPruneResults`), nạp lại toàn bộ kết quả hợp lệ vào bộ nhớ `savedResults`. Các bản ghi cũ hơn 48 giờ tự động bị xóa bỏ để giải phóng ổ đĩa.
2. **Client Thông điệp `request_result {roomId}`:**
   - Thêm schema Zod `requestResultSchema` vào `@avaclash/shared`.
   - Chỉ người chơi đã xác thực của đúng phòng đó mới được yêu cầu.
   - Relay đọc trạng thái phòng trên chain: bắt buộc phòng vẫn còn `Active` (status = 1).
   - Đọc kết quả từ bản lưu, ký lại EIP-712 Result với deadline mới (30 phút từ thời điểm yêu cầu), gửi `result_proposal` và `result_signature` riêng cho socket yêu cầu.
   - Cơ chế hoạt động xuyên suốt ngay cả khi RelayServer bị restart hoàn toàn.
3. **Kiểm thử Tích hợp Anvil Thật:**
   - Ván đấu hoàn thành, đóng tất cả socket, tắt server.
   - Khởi động server mới từ cùng thư mục `resultsDir`.
   - Người thắng kết nối socket mới, gửi `request_result`, nhận chữ ký mới và gọi `submitResult` settle thành công trên Anvil.
   - Ví không thuộc phòng hoặc chưa xác thực bị từ chối.
   - Phòng đã `Settled` trên chain bị từ chối khi gọi `request_result`.

### Mục 5: Gia Cố Bảo Mật & Ổn Định Vận Hành Relay (`a301f8f`)
1. **Xử lý IP Proxy an toàn:**
   - Thêm cấu hình `trustProxy?: boolean` (mặc định lấy theo `process.env.TRUST_PROXY === "true"`).
   - Chỉ tin cậy header `x-forwarded-for` khi `TRUST_PROXY=true`; mặc định sử dụng `req.socket.remoteAddress` để chống giả mạo IP vượt rate limit.
2. **Từ chối `result_signature` không hợp lệ:**
   - Kiểm tra `room.lastResultProposal` và `room.lastResultMessage`. Nếu phòng chưa có proposal kết thúc ván thì từ chối ngay lập tức với thông báo `No active result proposal found for room`.
3. **Tự động Dọn dẹp Phòng Chờ (Waiting Room Cleanup):**
   - Nếu phòng ở trạng thái `waiting` quá 10 phút (kỳ thủ thứ hai không vào), server tự động kích hoạt timeout, đóng kết nối các socket đang chờ (code 4002) và xóa phòng khỏi bộ nhớ.
4. **Bọc Lỗi Toàn Diện:**
   - Lời gọi `routeMessage` tại `handleRawMessage` được bọc `.catch` xử lý lỗi, gửi thông báo lỗi thân thiện về client và tuyệt đối không làm crash Node.js process.
5. **Đồng bộ Số liệu Giới hạn Bảo mật:**
   - Chọn cách **giữ nguyên số liệu trong mã nguồn và chuẩn hóa lại tài liệu/báo cáo**:
     - Tối đa **20 kết nối đồng thời trên mỗi IP** (cho phép nhiều tab/người xem cùng mạng).
     - Tối đa **25 tin nhắn/giây trên mỗi socket** (cho phép gửi nước đi và ping không bị ngắt oan).
     - Tối đa **500 phòng đồng thời** trên một instance relay.

---

## 3. Output Thô Kiểm Thử Toàn Bộ Dự Án

### A. Output `pnpm test` (Vitest: Shared, Web, Relay)
```text
> @avaclash/shared@0.1.0 test C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\shared
> vitest run

 ✓ tests/replay.test.ts (24 tests) 15ms
 ✓ tests/hash.test.ts (23 tests) 7ms
 ✓ tests/eip712.test.ts (15 tests) 10ms
 ✓ tests/schemas.test.ts (24 tests) 14ms
 ✓ tests/cross-spec.test.ts (9 tests) 7ms

 Test Files  5 passed (5)
      Tests  95 passed (95)
   Duration  1.02s

> web@0.1.0 test C:\Users\Admin\Desktop\PRJ1\avaclash-chess\web
> vitest run

 ✓ src/tests/GameState.test.ts (11 tests) 9ms
 ✓ src/tests/ChessScene.test.ts (6 tests) 19ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
   Duration  971ms

> @avaclash/relay@0.1.0 pretest C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay
> tsx scripts/generate-abi.ts

[generate-abi] Successfully generated packages\relay\src\abi\ChessEscrow.ts
[generate-abi] Successfully generated packages\relay\src\abi\AvaClashMeta.ts

> @avaclash/relay@0.1.0 test C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay
> vitest run

 ✓ tests/abi.test.ts (2 tests) 5ms
 ✓ tests/relay.test.ts (14 tests) 556ms
 ✓ tests/anvil-integration.test.ts (8 tests) 2218ms

 Test Files  3 passed (3)
      Tests  24 passed (24)
   Duration  3.46s

==================================================
TỔNG KẾT VITEST: 136/136 tests passed (100%)
==================================================
```

### B. Output `forge test` (Foundry: Unit, Fuzz, Integration, Try/Catch, Invariants)
```text
Ran 3 tests for test/ChessEscrowMetaIntegration.t.sol:ChessEscrowMetaIntegrationTest
[PASS] test_CrossContract_AbortRoom_CancelsPredictionAndElo() (gas: 479904)
[PASS] test_CrossContract_FullFlow_EloAndPredictionSettled() (gas: 1146757)
[PASS] test_CrossContract_RefundOnTimeout_CancelsPredictionAndElo() (gas: 480295)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 65.12ms (12.28ms CPU time)

Ran 8 tests for test/ChessEscrowMetaTryCatch.t.sol:ChessEscrowMetaTryCatchTest
[PASS] test_AbortRoom_SucceedsEvenIfMetaReverts() (gas: 471015)
[PASS] test_ClaimSpectatorRefund_IndependentAfter7Days() (gas: 247509)
[PASS] test_FallbackCancelPrediction_ConservesAllFundsAndSpectatorsRefunded() (gas: 686772)
[PASS] test_FinalizeSingleSigned_SucceedsEvenIfMetaReverts() (gas: 671040)
[PASS] test_RefundOnTimeout_SucceedsEvenIfMetaReverts() (gas: 471241)
[PASS] test_ResolveDefaultChallenge_SucceedsEvenIfMetaReverts() (gas: 825121)
[PASS] test_RetryResolvePrediction_SuccessAfterRevertingMetaSwapped() (gas: 686500)
[PASS] test_SubmitResult_SucceedsEvenIfMetaReverts() (gas: 521870)
Suite result: ok. 8 passed; 0 failed; 0 skipped; finished in 68.42ms (23.95ms CPU time)

Ran 18 tests for test/AvaClashMeta.t.sol:AvaClashMetaTest
[PASS] test_AntiWinTradingDeltaReduction() (gas: 222889)
[PASS] test_BetOnMatch_FeeSplit() (gas: 217588)
[PASS] test_BetOnMatch_LockBeforeStart() (gas: 94512)
[PASS] test_BetOnMatch_SelfBetNotAllowed() (gas: 142922)
[PASS] test_CancelPrediction_FullRefund() (gas: 246659)
[PASS] test_ClaimSpectatorRefund_IndependentAfter7Days() (gas: 248450)
[PASS] test_EnterNoLossVault_RevertBelowMin() (gas: 44143)
[PASS] test_EnterNoLossVault_Success() (gas: 95902)
[PASS] test_ExitNoLossVault_100PercentPrincipal() (gas: 133647)
[PASS] test_InitialElo() (gas: 18169)
[PASS] test_ResolveAndClaimSpectatorReward_Draw() (gas: 366401)
[PASS] test_ResolveAndClaimSpectatorReward_WhiteWins() (gas: 408898)
[PASS] test_ResolvePrediction_RevertIfAlreadyCancelledOrResolved() (gas: 191782)
[PASS] test_ResolvePrediction_WinningPoolZero_TreatedAsCancelled_RefundsAll() (gas: 261746)
[PASS] test_SeasonPointsAwardedIfStaked() (gas: 218746)
[PASS] test_SpectatorReward_GrossFeeConservationMultipleBettors() (gas: 421009)
[PASS] test_UpdateEloOnSettle() (gas: 116942)
[PASS] test_UpdateElo_revert_notEscrow() (gas: 39349)
Suite result: ok. 18 passed; 0 failed; 0 skipped; finished in 70.83ms (30.46ms CPU time)

Ran 91 tests for test/ChessEscrow.t.sol:ChessEscrowTest
[PASS] testFuzz_challengeBond(uint256) (runs: 256)
[PASS] testFuzz_createRoom_stakeRange(uint256) (runs: 256)
[PASS] testFuzz_refundTimeout_warpAmount(uint256) (runs: 256)
[PASS] testFuzz_submitResult_invalidOutcomesAndWinners(uint8,address,uint8,uint16,uint256) (runs: 256)
[PASS] testFuzz_submitResult_validOutcomesAndWinners(uint8,uint8,uint16,uint256,uint256) (runs: 256)
[PASS] test_EIP712_DomainSeparator_Matches_V2_Spec() (gas: 8291)
[PASS] test_G1_payoffComparison_loserSignsVsChallengeWithSilentArbiter() (gas: 1222880)
[PASS] test_G1_payoffComparison_symmetric_loserSubmitsSingleSigned() (gas: 761795)
[PASS] test_abortRoom_afterTimeout() (gas: 388957)
[PASS] test_abortRoom_revert_gameAlreadyStarted() (gas: 315771)
[PASS] test_abortRoom_revert_singleSignedPending() (gas: 474377)
[PASS] test_abortRoom_revert_tooEarly() (gas: 273984)
[PASS] test_arbiter_different_from_relaySigner() (gas: 33061)
[PASS] test_cancelRoom() (gas: 248914)
[PASS] test_cancelRoom_revert_notCreator() (gas: 163381)
[PASS] test_cancelRoom_revert_roomActive() (gas: 269501)
[PASS] test_cancelRoom_thenWithdraw() (gas: 242461)
[PASS] test_challenge_revert_afterWindow() (gas: 511127)
[PASS] test_challenge_revert_insufficientBond() (gas: 511622)
[PASS] test_challenge_revert_outcomeWinnerMismatch() (gas: 509943)
[PASS] test_challenge_revert_samePlayer() (gas: 504362)
[PASS] test_challenge_withBond() (gas: 615610)
[PASS] test_createRoom() (gas: 184900)
[PASS] test_createRoom_bothColorModes() (gas: 532359)
[PASS] test_createRoom_emitsEvent() (gas: 138181)
[PASS] test_createRoom_incrementsId() (gas: 241246)
[PASS] test_createRoom_revert_stakeAboveMax() (gas: 42297)
[PASS] test_createRoom_revert_stakeBelowMin() (gas: 67558)
[PASS] test_crossSpec_submitResult_acceptsViemSignatures() (gas: 436720)
[PASS] test_executeRelaySignerChange_revert_tooEarly() (gas: 110674)
[PASS] test_finalizeSingleSigned() (gas: 573670)
[PASS] test_finalizeSingleSigned_revert_tooEarly() (gas: 470236)
[PASS] test_fullFlow_loserSilent_finalize() (gas: 537747)
[PASS] test_fullFlow_whiteWinsAndWithdraws() (gas: 417402)
[PASS] test_getDomainSeparator_nonZero() (gas: 7230)
[PASS] test_joinRoom() (gas: 277455)
[PASS] test_joinRoom_revert_notOpen() (gas: 279656)
[PASS] test_joinRoom_revert_selfJoin() (gas: 171799)
[PASS] test_joinRoom_revert_wrongStake() (gas: 174612)
[PASS] test_maxStake() (gas: 166039)
[PASS] test_multipleRooms_independentState() (gas: 626680)
[PASS] test_ownable2step_transferOwnership() (gas: 178703)
[PASS] test_pause_blocksCreateAndJoin_allowsAbortRefundWithdraw() (gas: 714817)
[PASS] test_proposeAndExecuteRelaySigner() (gas: 141534)
[PASS] test_proposeRelaySigner_revert_notOwner() (gas: 39358)
[PASS] test_protocolFee_noFeeOnDraw() (gas: 384257)
[PASS] test_protocolFee_onWin() (gas: 385269)
[PASS] test_reentrancy_withdraw() (gas: 733668)
[PASS] test_refundOnTimeout() (gas: 389054)
[PASS] test_refundOnTimeout_revert_singleSignedPending() (gas: 480613)
[PASS] test_refundOnTimeout_revert_tooEarly() (gas: 278815)
[PASS] test_resolveChallenge_challengerRight() (gas: 721386)
[PASS] test_resolveChallenge_challengerWrong() (gas: 692210)
[PASS] test_resolveDefaultChallenge() (gas: 735664)
[PASS] test_resolveDefaultChallenge_conservationAndBondPenalty() (gas: 786304)
[PASS] test_resolveDefaultChallenge_revert_tooEarly() (gas: 617121)
[PASS] test_setMetaContract_immediateFirstTime_andTimelockSubsequent() (gas: 234317)
[PASS] test_setSingleSignedEnabled_onlyOwner() (gas: 123109)
[PASS] test_signalGameStarted() (gas: 311783)
[PASS] test_signalGameStarted_revert_notRelay() (gas: 270188)
[PASS] test_submitResult_clearsPendingSingleSignedBond_awardsBondToOpponentIfWinnerMismatch() (gas: 628838)
[PASS] test_submitResult_clearsPendingSingleSignedBond_awardsBondToOpponentOnDraw() (gas: 626526)
[PASS] test_submitResult_clearsPendingSingleSignedBond_refundsSubmitterIfWinnerMatches() (gas: 667289)
[PASS] test_submitResult_creatorIsBlack_validWinnerAndMetaOption() (gas: 471082)
[PASS] test_submitResult_draw() (gas: 401617)
[PASS] test_submitResult_dualPlayerSigs() (gas: 435712)
[PASS] test_submitResult_nonceIsolation() (gas: 734297)
[PASS] test_submitResult_playerAndRelaySigs() (gas: 415220)
[PASS] test_submitResult_revert_deadlineExpired() (gas: 320709)
[PASS] test_submitResult_revert_drawWithNonZeroWinner() (gas: 320498)
[PASS] test_submitResult_revert_invalidOutcomeCode() (gas: 319735)
[PASS] test_submitResult_revert_invalidWinner() (gas: 323379)
[PASS] test_submitResult_revert_roomNotActive() (gas: 205124)
[PASS] test_submitResult_revert_sameSigner() (gas: 312911)
[PASS] test_submitResult_revert_winnerColorMismatch() (gas: 399504)
[PASS] test_submitResult_revert_wrongSigner() (gas: 331093)
[PASS] test_submitResult_revert_zeroWinnerWithNonDrawOutcome() (gas: 316406)
[PASS] test_submitResult_sigsReversed() (gas: 388723)
[PASS] test_submitSingleSigned() (gas: 473250)
[PASS] test_submitSingleSigned_cannotBurnOthersNonce() (gas: 449387)
[PASS] test_submitSingleSigned_revert_deadlineExpired() (gas: 322621)
[PASS] test_submitSingleSigned_revert_insufficientBond() (gas: 432501)
[PASS] test_submitSingleSigned_revert_invalidSig() (gas: 331143)
[PASS] test_submitSingleSigned_revert_notWinner() (gas: 316705)
[PASS] test_submitSingleSigned_revert_outcomeWinnerMismatch() (gas: 321069)
[PASS] test_submitSingleSigned_revert_overwriteExistingClaim() (gas: 560804)
[PASS] test_submitSingleSigned_revert_whenDisabledByDefault() (gas: 324169)
[PASS] test_withdraw() (gas: 247544)
[PASS] test_withdrawProtocolFees() (gas: 462074)
[PASS] test_withdraw_emitsEvent() (gas: 244330)
[PASS] test_withdraw_revert_nothingToWithdraw() (gas: 41318)
Suite result: ok. 91 passed; 0 failed; 0 skipped; finished in 70.45ms (356.27ms CPU time)

Ran 1 test for test/invariants/ChessEscrowInvariant.t.sol:ChessEscrowInvariantTest
[PASS] invariant_solvencyConservation() (runs: 256, calls: 128000, reverts: 3)
╭--------------------+----------------------------+-------+---------+----------╮
| Contract           | Selector                   | Calls | Reverts | Discards |
+==============================================================================+
| ChessEscrowHandler | abortRoom                  | 12872 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | cancelRoom                 | 12784 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | createRoom                 | 12644 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | finalizeSingleSignedAction | 12909 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | joinRoom                   | 12669 | 3       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | refundOnTimeoutAction      | 12715 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | submitResultDual           | 12916 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | submitSingleSignedAction   | 12771 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | withdraw                   | 12717 | 0       | 0        |
|--------------------+----------------------------+-------+---------+----------|
| ChessEscrowHandler | withdrawProtocolFees       | 13003 | 0       | 0        |
╰--------------------+----------------------------+-------+---------+----------╯
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 57.55s (57.55s CPU time)

Ran 5 test suites in 57.56s (57.84s CPU time): 121 tests passed, 0 failed, 0 skipped (121 total tests)
==================================================
TỔNG KẾT FOUNDRY: 121/121 tests passed (100%)
==================================================
```

---

## 4. Các Việc Còn Lại Chưa Thực Hiện (Backlog & Residual Gaps)

1. **Quyết định D13 — Cửa sổ Khóa Cược Spectator & Trường `lockedAt` trong Meta:**
   - Hiện tại, cược Spectator bị khóa ngay lập tức khi đối thủ `joinRoom` (Q4).
   - D13 đề xuất dời thời điểm khóa cược sang một cửa sổ ngắn (60-120 giây sau `joinRoom` hoặc khi `signalGameStarted` phát ra) kèm việc bổ sung trường `lockedAt` trong `AvaClashMeta.sol` để khán giả có đủ thời gian quan sát hai kỳ thủ, màu quân và mức cược trước khi tham gia dự đoán mà chưa kịp dùng engine phân tích.
2. **Ngăn chặn Thông đồng Qua Cửa Hòa (Collusion / Win-Trading qua Draw - G6):**
   - Hiện tại, ván hòa sẽ hoàn 100% tiền cược cho 2 người chơi (phí 0%) trong khi cửa cược "Hòa" của khán giả có thể được chia thưởng lớn.
   - Cần nghiên cứu cơ chế chống kỳ thủ thông đồng cố tình đánh hòa nhanh để ăn tiền cược khán giả.
3. **Chống Tấn công Sybil & Cày Điểm ELO:**
   - Hiện tại hàm `updateEloOnSettle` mới chỉ giảm $\Delta$ ELO theo `pairId = keccak256(min(A,B), max(A,B), currentDay)` (chặn 2 ví quen mặt).
   - Chưa chặn được trường hợp kẻ gian tạo ra hàng chục ví Sybil để thay phiên cày điểm ELO và Season Points.
4. **Quyết định Q12 — Cơ chế Chi trả Quỹ Giải Thưởng Mùa Giải (`seasonPrizePool`):**
   - 5% phí từ cược khán giả đang được tích lũy vào `seasonPrizePool` trong `AvaClashMeta.sol`.
   - Thuật toán và hợp đồng phân phối quỹ này cho top kỳ thủ vào cuối mùa giải vẫn đang ở trạng thái `Open`, cần thiết kế ADR chi tiết trước khi giải ngân.
5. **Nối Ví Web3 Wagmi / RainbowKit trên Web Client:**
   - Frontend Next.js hiện đang chạy mô phỏng bàn cờ trên Canvas (Phaser 3), chưa kết nối với ví Wagmi/Viem để gửi giao dịch `createRoom`, `joinRoom`, `submitResult` trực tiếp từ trình duyệt của người dùng.
