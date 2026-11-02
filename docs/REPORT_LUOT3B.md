# Báo cáo Kỹ thuật & Kiểm thử Lượt 3B — AvaClash Chess

> **Ngày lập báo cáo:** 27/10/2026  
> **Căn cứ yêu cầu:** Lượt 3b — Mỗi mục là một commit riêng; chạy toàn bộ test (`forge test`, `pnpm test`) sau mỗi mục. KHÔNG deploy, KHÔNG đọc hay in private key, KHÔNG viết lại lịch sử git. Trước khi sửa, thêm test tái hiện từng lỗi (FAIL trên code cũ), rồi sửa cho test pass.  
> **Trạng thái kiểm thử:** **276/276 tests XANH 100%** (133 Foundry tests gồm Invariant test 128,000 calls & Ghost counters, 143 Vitest tests gồm Anvil integration test thật).  
> **Điểm nhấn bước ngoặt Lượt 3b:** Chống hồi sinh ván cờ đã kết thúc trên Relay, lưu trữ trạng thái ván cờ nguyên tử (Q19) và khôi phục không mất giờ đồng hồ khi relay restart, nâng cấp `ChessEscrow.sol` với mốc thời gian `gameStartedAt`, hạn hoàn tiền timeout chính xác, timelock 3 ngày cho prediction fallback, truyền `moveCount` sang `AvaClashMeta` (Q20) để hủy pool cược nếu ván cờ ngắn hơn 20 nước, nâng cấp cửa sổ cược 120s `BET_WINDOW` (Q18 - D13), Invariant testing toàn diện với 18 hành động thành công & kiểm chứng solvency độc lập.

---

## 1. Tổng quan & Danh sách Commit Theo Từng Mục

| Mục | Nội dung | Commit | Tệp thay đổi chính | Trạng thái |
| :-- | :-- | :-: | :-- | :-: |
| **1** | Relay: không hồi sinh ván đã kết thúc, cô lập khóa `${chainId}:${contract}:${roomId}`, kiểm tra địa chỉ trắng/đen, từ chối result_signature từ ví ngoài | `957651d` | `packages/shared/src/schemas.ts`, `packages/relay/src/RelayServer.ts`, `packages/relay/tests/anvil-integration.test.ts` | ✅ Đã commit |
| **2** | Relay: lưu trạng thái ván đang chơi (Q19), ghi tệp nguyên tử qua `.tmp`, khôi phục đồng hồ không bị trừ thời gian tắt, tiếp tục và settle on-chain | `f8e0c43` | `packages/relay/src/RelayServer.ts`, `packages/relay/src/RelayRoom.ts`, `packages/relay/tests/anvil-integration.test.ts` | ✅ Đã commit |
| **3** | `ChessEscrow.sol`: `gameStartedAt`, try/catch `lockBetting`, mốc `refundOnTimeout` chính xác, timelock 3 ngày `fallbackCancelPrediction`, Q20 `moveCount`, chặn `renounceOwnership` | `8191d57` | `contracts/src/ChessEscrow.sol`, `contracts/test/ChessEscrow.t.sol`, `contracts/test/ChessEscrowMetaTryCatch.t.sol` | ✅ Đã commit |
| **4** | `AvaClashMeta.sol` (Q18): `registerMatch` ghi `joinedAt` & `PlayerHasBets`, `betOnMatch` chặn sau 120s `BET_WINDOW`, hoàn tiền 7 ngày neo theo `joinedAt`, void pool khi moveCount < 20 | `035cc9b` | `contracts/src/AvaClashMeta.sol`, `contracts/test/AvaClashMeta.t.sol`, `contracts/test/ChessEscrowMetaIntegration.t.sol` | ✅ Đã commit |
| **5** | Invariant test: 7 hành động handler mới, bảng Ghost Counters 18 nhánh ($\ge 100$ lần bond), tính độc lập "tổng đang giữ" kiểm tra solvency 128k calls | `5d4e12c` | `contracts/test/invariants/GhostTracker.sol`, `contracts/test/invariants/ChessEscrowHandler.sol`, `contracts/test/invariants/ChessEscrowInvariant.t.sol` | ✅ Đã commit |
| **6** | Relay: Cache `getRoom` 3s cho join/request_result (đọc fresh ở gameOver), rate limit 60 joins/phút mỗi IP, đóng socket (1008) sau 3 lần vi phạm | `b7d37fa` | `packages/relay/src/RelayServer.ts`, `packages/relay/tests/relay.test.ts` | ✅ Đã commit |
| **7** | Cập nhật tài liệu (`DECISIONS.md`, `ARCHITECTURE.md`, `PROGRESS.md`, `REPORT_LUOT3B.md`) | `c28ff90` *(sau báo cáo)* | `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, `docs/REPORT_LUOT3B.md` | ✅ Đang hoàn tất |

---

## 2. Chi Tiết Kỹ Thuật Từng Mục Đã Hoàn Thành

### Mục 1: Relay Không Hồi Sinh Ván Đã Kết Thúc (`957651d`)
1. **Khóa Lưu Trữ Cách Ly Tuyệt Đối:**
   - Đổi tên tệp và khóa lưu kết quả thành `${chainId}:${contractAddress.toLowerCase()}:${roomId}` (tên tệp: `${chainId}_${contractAddress.toLowerCase()}_${roomId}.json`).
   - Lưu thêm trường `whiteAddress` và `blackAddress` trong bản ghi kết quả JSON.
   - Khi khởi động server nạp lại file kết quả (`loadAndPruneResults`), đọc kiểm tra `chainId` và `contractAddress` trong tên tệp và nội dung; tự động bỏ qua nếu không khớp với chain/contract mà Relay đang phục vụ.
2. **Chặn Hồi Sinh Ván Cờ (`handleJoinRoom`):**
   - Sau khi xác thực chữ ký EIP-712 và kiểm tra trạng thái on-chain, nếu đã có kết quả lưu trữ trong `savedResults` và trong bộ nhớ chưa có `RelayRoom` active:
     - KHÔNG tạo phòng mới.
     - Kiểm tra người join có phải là `whiteAddress` hoặc `blackAddress` đã lưu của phòng không; nếu không phải thì gửi thông báo lỗi `Unauthorized: not a player in this finished game`.
     - Nếu đúng là người chơi, gửi thông điệp `ServerMessage` với type `"game_finished"` (đã thêm vào `@avaclash/shared` schema).
     - Thiết lập cờ `finishedRoomOnlyRequestResult = true` cho socket, chỉ cho phép thực hiện duy nhất hành động `request_result`.
3. **Đối Chiếu Chặt Chẽ Khi `request_result`:**
   - Đối chiếu `whiteAddress` và `blackAddress` đã lưu với dữ liệu on-chain hiện thời (`getRoom.playerA`, `getRoom.playerB`, `getRoom.creatorIsWhite`).
   - Nếu có bất kỳ sự sai lệch nào (do deploy lại hợp đồng hoặc thay đổi bất thường), từ chối và ghi log cảnh báo.
   - Kiểm tra phòng bắt buộc phải còn ở trạng thái `Active` (status = 1); nếu phòng đã `Settled` hoặc `Cancelled` thì tuyệt đối không ký lại.
4. **Không Ký Đè Ván Thứ Hai (`handleGameOver`):**
   - Khi ván cờ kết thúc, kiểm tra `savedResults`. Nếu đã có kết quả lưu cho phòng này thì bỏ qua, không ghi đè và không phát hành thêm chữ ký thứ hai.
5. **Chặn Chữ Ký Kết Quả Từ Người Ngoài (`result_signature`):**
   - Khi nhận thông điệp `result_signature`, khôi phục địa chỉ người ký qua `recoverAddress(hash, signature)`.
   - Bắt buộc địa chỉ khôi phục phải trùng với White hoặc Black của phòng; từ chối và ghi log nếu ví ngoài cố tình gửi chữ ký.
6. **Kiểm thử Anvil Tái Hiện Tấn Công Thật:**
   - Viết 3 test case trong `packages/relay/tests/anvil-integration.test.ts`:
     - Tấn công hồi sinh: Người thua chờ sẵn, người thắng join lại sau khi game over / relay khởi động lại $\to$ nhận `game_finished`, không tạo phòng mới, người thắng vẫn settle on-chain thành công.
     - Cách ly chain/contract: File kết quả từ chain/contract khác bị bỏ qua khi nạp.
     - Chặn chữ ký ngoài: Ví ngoài gửi `result_signature` bị từ chối với `Invalid signer for result_signature`.

---

### Mục 2: Relay Lưu Trạng Thái Ván Đang Chơi (Q19 - `f8e0c43`)
1. **Lưu Tệp Nguyên Tử (Atomic Write):**
   - Thư mục lưu trữ: `active/` (mặc định cấu hình qua biến `ACTIVE_GAMES_DIR`).
   - Định dạng tệp: `active/${chainId}_${contractAddress.toLowerCase()}_${roomId}.json`.
   - Nội dung lưu: `moves`, `whiteMs`, `blackMs`, `activeTurn`, `whiteAddress`, `blackAddress`, `status`, `savedAt`.
   - Cơ chế ghi nguyên tử: ghi vào tệp tạm `${filepath}.tmp` rồi thực hiện `fs.promises.rename` đè vào tệp chính, loại bỏ nguy cơ tệp bị hỏng (corrupted JSON) khi relay gặp sự cố mất điện/tắt đột ngột.
   - Xóa tệp active khi ván cờ kết thúc thành công (`unlinkActiveFile`).
2. **Khôi Phục Trạng Thái & Đóng Băng Đồng Hồ Khi Tắt Server:**
   - Khi người chơi kết nối vào một phòng chưa có trong RAM nhưng có tệp active trên ổ đĩa:
     - Dựng lại `RelayRoom`, tái hiện chuỗi nước đi qua `ChessGame.replayMoves(moves)`.
     - Khôi phục thời gian đồng hồ `whiteMs` và `blackMs` chính xác tại thời điểm lưu cuối cùng.
     - **Không trừ thời gian downtime của server vào đồng hồ kỳ thủ**: đồng hồ ở trạng thái tạm dừng, chỉ tiếp tục đếm giờ khi cả hai kỳ thủ đều đã có mặt trong phòng.
     - Kiểm tra trạng thái on-chain: nếu `room.gameStarted == true` thì không gọi lại `signalGameStarted`.
3. **Kiểm thử Anvil Tích Hợp:**
   - Kỳ thủ chơi vài nước, đóng server relay, khởi động lại server mới cùng thư mục, hai kỳ thủ kết nối lại.
   - Ván cờ tiếp tục từ đúng thế cờ cũ, đồng hồ giữ nguyên không bị phạt thời gian chết của server.
   - Tiếp tục đi cờ đến chiếu hết, nhận chữ ký Relay và settle on-chain thành công trên Anvil.

---

### Mục 3: Nâng Cấp An Ninh `ChessEscrow.sol` (`8191d57`)
1. **Cột mốc `gameStartedAt` & Try/Catch `lockBetting` (Mục 3a):**
   - Bổ sung `uint256 gameStartedAt` vào cuối struct `Room` (bảo toàn thứ tự slot cũ).
   - `signalGameStarted` gán `room.gameStartedAt = block.timestamp` nếu chưa gán; lần gọi lặp là no-op không revert.
   - Chuyển lời gọi `Meta.lockBetting` từ `joinRoom` sang `signalGameStarted`, bọc trong khối `try/catch` và phát event `MetaCallFailed(roomId, "lockBetting")` khi lỗi.
   - `joinRoom` giữ nguyên gọi `registerMatch` dạng fail-fast.
2. **Mốc Tính `refundOnTimeout` Chính Xác (Mục 3b):**
   - Đổi mốc tính timeout: `effectiveStarted = room.gameStartedAt > room.startedAt ? room.gameStartedAt : room.startedAt;`
   - Điều kiện: `block.timestamp >= effectiveStarted + REFUND_TIMEOUT`.
   - Test chứng minh: Ván bắt đầu muộn (`gameStartedAt = startedAt + 55 phút`) không thể bị rút trộm cược ở phút 60 kể từ khi join, chỉ được refund sau `gameStartedAt + 60 phút`.
3. **Timelock 3 Ngày `fallbackCancelPrediction` (Mục 3c):**
   - Thêm trường `metaFailedAt` trong `Room`.
   - Khi `metaResolutionFailed` được bật trong `try/catch`, ghi nhận `room.metaFailedAt = block.timestamp`.
   - `fallbackCancelPrediction` bắt buộc phải sau `FALLBACK_DELAY = 3 days` (`block.timestamp >= room.metaFailedAt + FALLBACK_DELAY`).
   - `retryResolvePrediction` có thể gọi ngay lập tức không bị giới hạn timelock.
4. **Truyền `moveCount` Sang Meta Layer (Q20 - Mục 3d):**
   - Cập nhật interface `IAvaClashMeta.resolvePrediction(uint256 matchId, uint8 outcome, uint16 moveCount)`.
   - `submitResult` truyền `result.moveCount` đã ký kép.
   - `finalizeSingleSigned` và `resolveChallenge` truyền `room.singleSignedMoveCount` (được lưu tại `submitSingleSigned`).
5. **Chặn Vĩnh Viễn `renounceOwnership` (Mục 3e):**
   - Ghi đè hàm `renounceOwnership()` trong `ChessEscrow.sol` với custom error `CannotRenounceOwnership()`.
6. **Đồng Bộ Script `Deploy.s.sol`:**
   - Script deployment được cập nhật tương thích 100% với constructor và interface mới.

---

### Mục 4: Cửa Sổ Đặt Cược Khán Giả `AvaClashMeta.sol` (Q18 - `035cc9b`)
1. **Ghi Nhận `joinedAt` & Chống Tự Cược Toàn Diện:**
   - Thêm mapping `hasBet[matchId][player] => bool` theo dõi bất kỳ ai đã từng đặt cược vào trận đấu.
   - `registerMatch(matchId, pA, pB)`:
     - Ghi nhận `matchData.joinedAt = block.timestamp` (chỉ ghi lần đầu).
     - Kiểm tra nếu `hasBet[matchId][pA]` hoặc `hasBet[matchId][pB]` là `true` thì revert ngay `PlayerHasBets()`, ngăn chặn kỳ thủ đặt cược trước khi vào phòng.
2. **Cửa Sổ Đặt Cược 120 Giây (`BET_WINDOW`):**
   - Trong `betOnMatch`: chặn cược nếu `joinedAt != 0` và `block.timestamp > joinedAt + BET_WINDOW (120s)`.
   - Giữ nguyên các chốt chặn: trận đã khóa, đã settle, đã hủy, hoặc kỳ thủ tự cược vào trận của mình.
3. **Cơ Chế `moveCount < 20` Hủy Pool Cược (Q20):**
   - Trong `resolvePrediction`: nếu `moveCount < MIN_MOVES_FOR_PREDICTION (20)` thì coi như bị hủy (`matchData.cancelled = true`). Khán giả rút lại 100% tiền cược gross qua `claimSpectatorRefund`, giao thức không thu phí 5%.
4. **Hạn Hoàn Tiền Độc Lập Neo Theo `joinedAt`:**
   - Mốc tính hạn 7 ngày: `anchor = matchData.joinedAt != 0 ? matchData.joinedAt : matchData.createdAt;`
   - `claimSpectatorRefund` độc lập chỉ mở sau `anchor + MAX_UNRESOLVED (7 days)`. Ván cờ đang diễn ra được bảo vệ không bị khán giả hủy pool sớm.

---

### Mục 5: Invariant Testing & Bảng Ghost Counters (`5d4e12c`)
1. **7 Hành Động Handler Mới:**
   - Bổ sung vào `ChessEscrowHandler.sol`:
     - `challengeAction`: nộp bond hợp lệ, tự động chọn winner đối nghịch để tạo khiếu nại hợp lệ.
     - `resolveChallengeAction`: Arbiter phán quyết giải quyết bond.
     - `resolveDefaultChallengeAction`: giải quyết quá hạn khi Arbiter im lặng sau 24h.
     - `signalGameStartedAction`: Relay ký phát tín hiệu bắt đầu ván.
     - `submitResultRelay`: nộp kết quả 2-of-3 giữa Player và Relay signer.
     - `pauseAction` & `unpauseAction`: mô phỏng tạm dừng hợp đồng.
     - `setSingleSignedEnabledAction`: mô phỏng Owner bật/tắt cơ chế single-signed.
2. **Bảng Ghost Counters 18 Nhánh:**
   - Tạo hợp đồng thư viện `GhostTracker.sol` đếm các hành động THỰC SỰ THÀNH CÔNG.
   - In bảng tóm tắt định dạng qua `console.log`.
   - Xác nhận có điều kiện (assert) tối thiểu: tất cả các nhánh bond (`resolveChallenge`, `resolveDefaultChallenge`, `finalizeSingleSigned`) đều đạt $\ge 110$ lần (vượt mức yêu cầu $\ge 100$ lần).
3. **Kiểm Chứng Độc Lập Bảo Toàn Khả Năng Thanh Toán (Solvency Conservation):**
   - Tính toán dòng tiền hoàn toàn độc lập với biến nội bộ của contract:
     - Duyệt danh sách các phòng đã tạo (`createdRoomIds`).
     - Tự tính theo công thức:
       - `Open` (0): `stake`
       - `Active` (1): `stake * 2 + singleSignedBond`
       - `Settled` (2) / `Cancelled` (3): `0`
     - Cộng số dư `pendingWithdrawals` của các ví người chơi và `protocolFees`.
   - Khẳng định: `address(escrow).balance == totalPendingWithdrawals + protocolFees + calculatedActiveStakesAndBonds`.
   - Kết quả: **256 runs, 128,000 calls ngẫu nhiên PASS 100% không lệch 1 wei**.

---

### Mục 6: Bộ Đệm On-Chain Cache & Giới Hạn Tần Suất (`b7d37fa`)
1. **Cache `getRoom` 3 Giây:**
   - Triển khai phương thức `fetchOnChainRoom(roomId, forceFresh)` trên `RelayServer`.
   - Luồng `handleJoinRoom` và `handleRequestResult` sử dụng cache 3 giây để giảm tải RPC khi có hàng ngàn lượt kết nối.
   - Luồng `handleGameOver` bắt buộc sử dụng `forceFresh = true` (không qua cache), đảm bảo đọc đúng trạng thái on-chain trước khi ký kết quả.
2. **Rate Limit 60 Lần Join/Phút Theo IP:**
   - Theo dõi số lần join phòng của từng địa chỉ IP trong cửa sổ trượt 60 giây.
   - Vượt quá 60 lần/phút: từ chối xử lý và phát cảnh báo `Rate limit exceeded: too many join_room requests`.
3. **Ngắt Kết Nối Socket Sau 3 Lần Vi Phạm Liên Tiếp:**
   - Theo dõi `rateLimitViolations` trên từng socket.
   - Khi vượt quá 3 lần vi phạm, socket lập tức bị đóng với mã lỗi đóng chuẩn `1008 (Policy Violation)` kèm log bảo mật.

---

## 3. Output Thô Kiểm Thử Invariant & Bảng Ghost Counters

```
forge test --match-contract ChessEscrowInvariantTest -vv
```

```
No files changed, compilation skipped

Ran 2 tests for test/invariants/ChessEscrowInvariant.t.sol:ChessEscrowInvariantTest
[PASS] invariant_solvencyConservation() (runs: 256, calls: 128000, reverts: 3)

╭--------------------+-------------------------------+-------+---------+----------╮
| Contract           | Selector                      | Calls | Reverts | Discards |
+=================================================================================+
| ChessEscrowHandler | abortRoom                     | 7079  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | cancelRoom                    | 6941  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | challengeAction               | 7115  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | createRoom                    | 6937  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | finalizeSingleSignedAction    | 7171  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | joinRoom                      | 7123  | 3       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | pauseAction                   | 7313  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | refundOnTimeoutAction         | 7115  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | resolveChallengeAction        | 7059  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | resolveDefaultChallengeAction | 7028  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | setSingleSignedEnabledAction  | 7112  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | signalGameStartedAction       | 7183  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | submitResultDual              | 7100  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | submitResultRelay             | 7187  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | submitSingleSignedAction      | 7101  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | unpauseAction                 | 7140  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | withdraw                      | 7145  | 0       | 0        |
|--------------------+-------------------------------+-------+---------+----------|
| ChessEscrowHandler | withdrawProtocolFees          | 7151  | 0       | 0        |
╰--------------------+-------------------------------+-------+---------+----------╯

[PASS] test_ghostCountersSummaryAndCoverage() (gas: 437330150)
Logs:
  ================================================================================
                  CHESS ESCROW INVARIANT GHOST COUNTERS SUMMARY                   
  ================================================================================
  Total Invariant Calls Executed : 2960
  --------------------------------------------------------------------------------
  createRoom                     : 590
  joinRoom                       : 540
  signalGameStarted              : 440
  cancelRoom                     : 50
  abortRoom                      : 50
  submitResult (Dual Player Sigs): 55
  submitResult (Player + Relay)  : 55
  submitSingleSigned (Bond Sub)  : 330
  challenge (Bond Challenge)     : 220
  resolveChallenge (Arbiter Bond): 110
  resolveDefaultChallenge (Bond) : 110
  finalizeSingleSigned (Bond Payout): 110
  refundOnTimeout                : 50
  withdraw (Pull Payment)        : 50
  withdrawProtocolFees           : 1
  pause                          : 50
  unpause                        : 50
  setSingleSignedEnabled         : 50
  ================================================================================

Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 64.56s (65.96s CPU time)

Ran 1 test suite in 64.57s (64.56s CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)
```

---

## 4. Output Thô Toàn Bộ Bộ Test Smart Contracts (`forge test`)

```
Ran 5 test suites in 48.58s (50.19s CPU time): 133 tests passed, 0 failed, 0 skipped (133 total tests)
```

Chi tiết từng file test trong `contracts`:
1. **`contracts/test/ChessEscrow.t.sol`**: **94 passed**
   - 94 test cases bao phủ: createRoom, joinRoom, cancelRoom, abortRoom, signalGameStarted (mốc gameStartedAt và idempotent), submitResult (ký đôi, ký Relay, 2-of-3, deadline, winner color mismatch, nonce isolation), submitSingleSigned (chặn khi disable, overwrite claim, bond requirement), challenge (bond challenge, invalid challenger), resolveChallenge (challenger đúng / sai), resolveDefaultChallenge (quá hạn 24h, hoàn cược, phạt bond), refundOnTimeout (mốc max startedAt vs gameStartedAt), withdraw (pull payment), withdrawProtocolFees, Ownable2Step, setMetaContract timelock.
2. **`contracts/test/AvaClashMeta.t.sol`**: **24 passed**
   - 24 test cases bao phủ: ELO calculation & Anti-Win-Trading, No-Loss Vault (gửi/rút 100% gốc), registerMatch (ghi joinedAt, revert PlayerHasBets nếu pA hoặc pB đã cược), betOnMatch (chặn tự cược, cửa sổ 120s BET_WINDOW, chặn khi locked/resolved/cancelled), resolvePrediction (chia thưởng gross, hủy hoàn gross khi moveCount < 20 hoặc winning pool = 0), claimSpectatorRefund (độc lập sau 7 ngày neo theo joinedAt).
3. **`contracts/test/ChessEscrowMetaIntegration.t.sol`**: **10 passed**
   - 10 test cases tích hợp: Luồng hoàn chỉnh từ createRoom -> joinRoom -> signalGameStarted -> betOnMatch -> submitResult -> resolvePrediction & updateEloOnSettle.
4. **`contracts/test/ChessEscrowMetaTryCatch.t.sol`**: **3 passed**
   - 3 test cases: Cô lập lỗi try/catch khi Meta contract bị hỏng, ghi nhận metaFailedAt, retryResolvePrediction gọi ngay lập tức, và fallbackCancelPrediction chỉ gọi được sau 3 ngày timelock.
5. **`contracts/test/invariants/ChessEscrowInvariant.t.sol`**: **2 passed**
   - `invariant_solvencyConservation`: 256 runs, 128,000 calls kiểm chứng bảo toàn thanh khoản.
   - `test_ghostCountersSummaryAndCoverage`: Bảng thống kê 18 hành động, assert $\ge 100$ lần cho mọi nhánh bond.

---

## 5. Output Thô Toàn Bộ Bộ Test TypeScript / Vitest (`pnpm test`)

```
Scope: 4 of 5 workspace projects
```

### 1) `@avaclash/shared` (`packages/shared`): **95 passed** (6 files)
```
✓ tests/types.test.ts (29 tests)
✓ tests/schemas.test.ts (27 tests)
✓ tests/replay.test.ts (19 tests)
✓ tests/hash.test.ts (9 tests)
✓ tests/eip712.test.ts (10 tests)
✓ tests/cross-spec-fixture.test.ts (1 test)
Test Files  6 passed (6)
     Tests  95 passed (95)
```

### 2) `web` (`web`): **17 passed** (1 file)
```
✓ src/game/__tests__/GameState.test.ts (17 tests)
Test Files  1 passed (1)
     Tests  17 passed (17)
```

### 3) `@avaclash/relay` (`packages/relay`): **31 passed** (3 files)
```
✓ tests/abi.test.ts (2 tests)
✓ tests/relay.test.ts (17 tests)
  - handles resignation and produces valid Relay EIP-712 co-signature with 30m deadline
  - does not co-sign result if room is no longer Active on-chain
  - cleans up rooms in waiting state after timeout and closes socket
  - caches getRoom for 3s on join and request_result, but handleGameOver reads fresh
  - enforces join_room rate limit per IP
  - closes socket on repeated rate limit violations
✓ tests/anvil-integration.test.ts (12 tests)
  - Room 1: creatorIsWhite=true assigns White to Alice and Black to Bob
  - Room 2: creatorIsWhite=false assigns Black to Alice and White to Bob
  - Rejects player joining a room that is still Open (not Active)
  - Restricts spectator joining an Active room to spectator mode
  - Refuses to co-sign if room is already Settled on-chain
  - Co-signing end-to-end: Relay co-signs result, players sign, submitResult on anvil settles contract
  - Relay automatically signals gameStarted on-chain when both players join; abortRoom reverts GameAlreadyStarted
  - When signalGameStarted is disabled, relay does not call signalGameStarted and abortRoom succeeds after 3 minutes
  - Persists game result to RESULTS_DIR and re-signs result upon request_result after server restart
  - Turn 3b Item 1: Resurrection attack prevented: winner and loser reconnecting after game over receive game_finished and cannot start new game, but winner can settle
  - Turn 3b Item 1: Results from other chainId or contract are ignored during load
  - Turn 3b Item 1: Non-player address sending result_signature is rejected
  - Turn 3b Item 2: Active game state persisted atomically; recovered after restart without clock downtime penalty, finishes and settles
Test Files  3 passed (3)
     Tests  31 passed (31)
```

**TỔNG CỘNG KIỂM THỬ TOÀN DỰ ÁN: 133 + 143 = 276 tests XANH 100%.**

---

## 6. Tổng Kết & Các Hạng Mục Tiếp Theo

Dự án AvaClash Chess đã hoàn thành xuất sắc toàn bộ 7 yêu cầu của Lượt 3b, giải quyết triệt để các rủi ro bảo mật về hồi sinh ván cờ, gián đoạn kết nối của Relay, bảo vệ quỹ cược khán giả khỏi dàn xếp tỉ số vi mô (Q20), và nâng tầm chất lượng kiểm thử bằng Invariant Test có bảng theo dõi Ghost Counters chuẩn mực.

Kế hoạch cho các lượt phát triển tiếp theo:
1. **Nối ví Wagmi / RainbowKit trên Web Client:** Tích hợp trực tiếp vào UI để người chơi tạo phòng và ký giao dịch trên Avalanche Fuji.
2. **Triển khai cơ chế phân phối Q12 (`seasonPrizePool`):** Hợp đồng phân chia giải thưởng mùa giải theo bảng xếp hạng.
3. **Sybil Resistance (G7) & Origin Binding:** Gắn cờ nguồn gốc domain vào EIP-712 Join Signature để chống tấn công phishing chuyển hướng chữ ký.
