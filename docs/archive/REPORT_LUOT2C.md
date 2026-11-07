# Báo cáo Kỹ thuật & Kiểm thử Lượt 2C (Bản hợp nhất) — AvaClash Chess

> **Ngày lập báo cáo:** 26/10/2026  
> **Căn cứ yêu cầu:** Lượt 2c (bản hợp nhất) — Kiểm thử từng commit, không deploy, không in private key, không viết lại lịch sử git.  
> **Trạng thái bộ test toàn dự án:** **235/235 tests XANH 100%** (112 Foundry tests, 123 Vitest tests).  
> **CẢNH BÁO AN NINH ĐẶC BIỆT:** Hệ thống **TUYỆT ĐỐI KHÔNG ĐƯỢC DEPLOY** lên Avalanche Fuji hay Mainnet cho đến khi thiết kế và cơ chế xác thực bắt đầu ván cờ (`signalGameStarted` / GameStart) được giải quyết ở lượt tiếp theo.

---

## 1. Tổng quan & Trạng thái Thực hiện

Lượt 2c hợp nhất các yêu cầu kinh tế, an ninh, giao thức Relay EIP-712 và giao diện phòng cược. Mỗi mục được triển khai bằng một commit riêng biệt, chạy toàn bộ bộ kiểm thử `forge test` và `pnpm test` sau mỗi bước và bảo đảm 100% test pass trước khi chuyển sang mục kế tiếp.

### Bảng Ánh Xạ Tiến Độ Theo Commit

| Mục | Nội dung | Commit | Tệp thay đổi chính | Trạng thái |
| :-- | :-- | :-: | :-- | :-: |
| **0** | Kiểm tra hiện trạng & rà soát các mục đã làm ở Lượt 2B | — | `git status`, `git log` | ✅ Xác nhận sạch |
| **1** | Cập nhật `DECISIONS.md` (Q11-Q14, Q3/D5 superseded, Q8/D14) | `4f74e27` | `docs/DECISIONS.md` | ✅ Đã commit |
| **2a** | `createRoom(creatorIsWhite)`, view màu, `MIN_STAKE = 0.01 ether` | `458c5a1` | `contracts/src/ChessEscrow.sol`, `contracts/test/*.sol` | ✅ Đã commit |
| **2b** | `_validateOutcomeAndWinner` theo màu, Meta `winningOption` | `f42940b` | `contracts/src/ChessEscrow.sol`, `contracts/test/*.sol` | ✅ Đã commit |
| **2c** | `submitSingleSigned` payable, submitter bond = challenge bond, nonce theo người nộp | `179b6ea` | `contracts/src/ChessEscrow.sol`, `contracts/test/*.sol` | ✅ Đã commit |
| **2d** | Hoàn/phạt bond ở `finalizeSingleSigned`, `resolveChallenge`, `resolveDefaultChallenge` | `e157747` | `contracts/src/ChessEscrow.sol`, `contracts/test/*.sol` | ✅ Đã commit |
| **2e** | Chặn `refundOnTimeout` và `abortRoom` khi có `singleSigned` đang chờ | `40e8336` | `contracts/src/ChessEscrow.sol`, `contracts/test/*.sol` | ✅ Đã commit |
| **2f** | `joinRoom` revert nếu `registerMatch` hoặc `lockBetting` lỗi (Fail-Fast) | `22c7bd4` *(2B)* | `contracts/src/ChessEscrow.sol` | ✅ Kế thừa Lượt 2B |
| **2g** | Constructor 3 tham số tách biệt, `Deploy.s.sol` đọc bắt buộc và hỗ trợ Keystore | `d3e372a` *(2B)* | `contracts/src/ChessEscrow.sol`, `contracts/script/Deploy.s.sol` | ✅ Kế thừa Lượt 2B |
| **3** | `AvaClashMeta.sol` phí gross 5% khi resolve, cancel khi pool = 0, hoàn độc lập 7 ngày | `697cad7` *(2B)* | `contracts/src/AvaClashMeta.sol`, `contracts/test/*.sol` | ✅ Kế thừa Lượt 2B |
| **4** | Relay: Auth EIP-712 Join, On-chain check fail-closed, cách ly ghế, giới hạn tải | `b1f2cb1` | `packages/shared/src/*`, `packages/relay/src/*`, `tests/*` | ✅ Đã commit |
| **5** | Web: Tạo phòng chọn màu (`creatorIsWhite`), hiển thị màu trước khi stake | `2ddaf0b` | `web/src/components/RoomLobbyWidget.tsx`, `web/src/app/page.tsx` | ✅ Đã commit |
| **6** | Test chéo TS ↔ Foundry sinh khóa ngẫu nhiên, Fuzz test outcome/winner, Payoff G1 | `cb45d34` | `packages/shared/tests/*`, `contracts/test/ChessEscrow.t.sol` | ✅ Đã commit |
| **7** | Tài liệu đồng bộ: `PROGRESS.md`, `ARCHITECTURE.md`, `IMPROVEMENT_PLAN.md`, `REPORT_LUOT2C.md` | *(hiện tại)* | `docs/*` | ✅ Đang hoàn tất |

---

## 2. Chi Tiết Thực Hiện Từng Mục & Hành Vi Mới

### Mục 0: Hiện trạng & Đối chiếu Lượt 2B
- Kiểm tra `git status` trước khi bắt đầu: working directory sạch, không có thay đổi chưa commit.
- Đối chiếu các mục đã làm ở Lượt 2B:
  - **Mục 2f (`joinRoom` Fail-Fast):** Đã làm ở commit `22c7bd4`. Lời gọi `registerMatch` và `lockBetting` không bọc try/catch, nếu Meta revert thì `joinRoom` revert ngay.
  - **Mục 2g (Constructor 3 tham số & Deployer an toàn):** Đã làm ở commit `d3e372a`. Constructor nhận `(relaySigner, arbiter, treasury)` bắt buộc khác nhau và khác `address(0)`. `Deploy.s.sol` kiểm tra biến môi trường nghiêm ngặt và hỗ trợ Foundry Keystore `--account`.
  - **Mục 3 (`AvaClashMeta.sol`):** Đã làm ở commit `697cad7`. Đặt cược gross, trừ phí 5% khi resolve chuyển vào `seasonPrizePool`, hủy nếu pool cửa thắng bằng 0, hoàn tiền độc lập sau 7 ngày qua `claimSpectatorRefund`.
- Các mục trên đã được kiểm chứng hoạt động chính xác qua 112 Foundry tests, không sửa đổi lặp lại.

### Mục 1: `DECISIONS.md`
- Ghi nhận **Q11 (Accepted):** Submitter bond cho đơn phương nộp kết quả (`submitSingleSigned`), cơ chế slashing và hoàn trả khi challenge.
- Ghi nhận **Q13 (Accepted):** Người tạo phòng chọn màu qua `createRoom(creatorIsWhite)`. Đánh dấu Q3 (seed Relay ký) và D5 thành **Superseded**. Relay đọc màu từ chain, không quyết định màu. Cửa cược khán giả suy ra trực tiếp từ outcome (0 -> Cửa 1 Trắng thắng, 1 -> Cửa 2 Đen thắng, 2 -> Cửa 3 Hòa).
- Ghi nhận **Q14 (Accepted):** Bắt buộc `MIN_STAKE = 0.01 ether` tại `createRoom` để chặn spam phòng và Sybil ELO.
- Cập nhật **Q8 thành "Accepted with residual risk":** Lưu giữ phân tích payoff thực tế từ Foundry test (bên thua challenge vẫn thu hồi được 90% cược nếu arbiter im lặng).
- Chuyển **D14** thành "đề xuất, đã triển khai" (thay vì "phê duyệt").
- Ghi nhận **Q12 (Open):** Cách chi trả `seasonPrizePool` chưa có thiết kế, hoãn lại lượt sau.

### Mục 2: Hợp đồng `ChessEscrow.sol`
1. **2a (`458c5a1`):**
   - Thêm tham số `bool creatorIsWhite` vào `createRoom(bool creatorIsWhite)`.
   - Gán `room.whitePlayer` và `room.blackPlayer` ngay khi khởi tạo dựa theo cờ này. Thêm view `getWhitePlayer(roomId)` và `getBlackPlayer(roomId)`.
   - Bắt buộc `msg.value >= MIN_STAKE` (0.01 ether), revert với lỗi custom `StakeTooLow()`.
2. **2b (`f42940b`):**
   - Nâng cấp `_validateOutcomeAndWinner`: Nếu `outcome == OutcomeWhiteWins (0)` thì `winner` bắt buộc phải là `room.whitePlayer`; nếu `outcome == OutcomeBlackWins (1)` thì `winner` bắt buộc phải là `room.blackPlayer`; nếu `outcome == OutcomeDraw (2)` thì `winner == address(0)`.
   - Áp dụng kiểm tra này ở cả 4 vị trí: `submitResult`, `submitSingleSigned`, `challenge`, và `resolveChallenge` (arbiter chỉ được chọn winner hợp lệ đúng màu hoặc address(0)).
   - Trong `_distribute`: Cửa thắng Meta được suy ra theo màu: `outcome == OutcomeWhiteWins ? 1 : (outcome == OutcomeBlackWins ? 2 : 3)`.
3. **2c (`179b6ea`):**
   - `submitSingleSigned` chuyển thành `payable`.
   - Bắt buộc nộp bond `msg.value == _computeChallengeBond(room.stake)`, revert `InsufficientBond()`.
   - Chỉ cho phép nộp claim đầu tiên khi `room.singleSignedAt == 0`.
   - Nonce được cô lập theo từng người nộp: `usedNonces[roomId][msg.sender][result.nonce] = true`, bỏ `usedNonces` toàn phòng ở `submitResult`.
4. **2d (`e157747`):**
   - `finalizeSingleSigned`: Hoàn 100% `singleSignedBond` cho người nộp đơn.
   - `resolveChallenge`:
     - Nếu arbiter phán quyết người nộp đúng (`isSubmitterValid`): Người nộp nhận lại bond của mình + nhận toàn bộ bond của bên challenger.
     - Nếu arbiter phán quyết người nộp sai: Bên challenger nhận lại bond của mình + nhận toàn bộ bond của người nộp.
   - `resolveDefaultChallenge`: Hoàn 100% bond cho người nộp; bond của bên challenger chia 50% cho người nộp (bồi thường trễ) và 50% hoàn trả challenger.
   - **Bảo toàn quỹ:** Tổng tiền ghi có khớp chính xác 100% tổng tiền vào ở mọi nhánh, không có rò rỉ hay kẹt token.
5. **2e (`40e8336`):**
   - `refundOnTimeout` và `abortRoom` đều kiểm tra `if (room.singleSignedAt != 0) revert SingleSignedPending()`. Ngăn chặn bên thua đợi hết 60 phút hoặc 3 phút để hủy phòng khi đối thủ đã nộp claim hợp lệ.

### Mục 4: Relay (`packages/relay` & `packages/shared`) (`b1f2cb1`)
- **Xác thực Join EIP-712:**
  - Server cấp `auth_challenge` gồm nonce 32-byte sinh ngẫu nhiên bằng `crypto.randomBytes(32)` với hạn dùng 60 giây.
  - Client gửi `join_room` kèm chữ ký EIP-712 theo schema `Join(uint256 roomId, address player, bytes32 nonce, uint256 expiresAt)` với domain `{ name: "AvaClashRelay", version: "1", chainId }`.
  - Server phục hồi địa chỉ bằng `recoverTypedDataAddress` của Viem. Nonce dùng một lần và gắn với session, hết hạn sẽ từ chối.
  - Hỗ trợ role riêng `"spectator"`: không cần chữ ký, chỉ nhận dữ liệu broadcast, không có quyền gửi lệnh cờ.
- **Xác thực On-chain Fail-Closed:**
  - `RelayServer` bắt buộc nhận `rpcUrl` và `escrowAddress` hợp lệ khi khởi tạo, dùng `createPublicClient` của Viem đọc `ChessEscrow.getRoom(roomId)`.
  - Chỉ cho phép vào ghế nếu phòng tồn tại trên chain, trạng thái `Active`, và địa chỉ khớp với `whitePlayer` hoặc `blackPlayer`.
  - Màu quân được đọc từ on-chain (theo Q13), không còn gán FCFS theo socket.
  - Khi RPC lỗi, Relay từ chối kết nối (`fail-closed`).
  - Trước khi ký đồng thuận kết thúc ván (`handleGameOver`), Relay đọc lại trạng thái on-chain, nếu không còn `Active` thì từ chối ký.
- **Cách ly ghế & Socket replacement:**
  - Mỗi địa chỉ ví chỉ giữ đúng 1 socket ghế chơi. Socket mới đã xác thực sẽ tự động thay thế và đóng socket cũ.
  - Mọi lệnh cờ (`move`, `resign`, `draw_offer`, `focus_warning`...) chỉ được chấp nhận từ socket đã xác thực của đúng ghế cầm quân.
  - `result_signature` chỉ chấp nhận từ người chơi trong phòng và được recover bằng Viem trước khi broadcast.
- **Giới hạn an ninh & vận hành:**
  - `maxPayload` của WebSocket đặt ở mức 4 KB.
  - Giới hạn tối đa 5 kết nối đồng thời trên mỗi địa chỉ IP và tối đa 1,000 phòng cờ.
  - Rate limit mỗi socket: tối đa 30 tin nhắn trong cửa sổ 5 giây, vi phạm sẽ bị ngắt kết nối.
  - Đóng socket chưa xác thực sau 10 giây; tự động dọn dẹp phòng đã kết thúc sau 10 phút.
  - Hạn dùng chữ ký Relay: `deadline = now + 30 phút`, nonce duy nhất theo phòng.

### Mục 5: Giao diện Web (`web`) (`2ddaf0b`)
- Tạo component `RoomLobbyWidget.tsx`:
  - Cho phép người tạo phòng chọn màu quân Trắng/Đen qua nút bấm trực quan (`creatorIsWhite`).
  - Cho phép người tham gia xem trước màu quân được chỉ định trước khi nhấn xác nhận Stake cược tiền.
  - Hiển thị mức cược tối thiểu 0.01 AVAX theo quy định Q14.
- Tích hợp vào trang chủ `web/src/app/page.tsx` trong chế độ Cược Wager.
- Kiểm tra biên dịch Next.js: `pnpm --filter web build` thành công trong 2.1 giây, 0 lỗi TypeScript.

### Mục 6: Test Chéo, Fuzz Test & Phân Tích Payoff G1 (`cb45d34`)
- **Sinh chữ ký chéo ngẫu nhiên:** File `packages/shared/tests/cross-spec-fixture.test.ts` luôn sinh khóa private ngẫu nhiên qua `generatePrivateKey()`, ký Result bằng Viem và ghi đè fixture `contracts/test/fixtures/cross_spec_result.json`. Foundry nạp fixture và xác thực `submitResult` thành công 100%.
- **Fuzz testing:** Bổ sung `testFuzz_submitResult_invalidOutcomesAndWinners` trong `ChessEscrow.t.sol` kiểm tra với các outcome ngẫu nhiên [3..255] và các địa chỉ winner bất hợp lệ, hợp đồng luôn revert đúng chuẩn.
- **Đổi tên test:** Đổi tên thành `test_resolveDefaultChallenge_conservationAndBondPenalty`.
- **Payoff test & Residual Risk (Q8 / G1):** Kiểm chứng kịch bản kinh tế giữa người thua hợp tác ký ngay và người thua khiếu nại rồi chờ Arbiter im lặng.

---

## 3. Phân Tích Số Liệu Kinh Tế Q8 / G1 (Payoff Analysis)

Từ bài kiểm tra `test_G1_payoffComparison_loserSignsVsChallengeWithSilentArbiter` trên Foundry với kịch bản thực tế:
- Tiền cược mỗi bên: `stake = 0.10 AVAX` (Tổng pot = 0.20 AVAX).
- Challenge Bond (20%): `0.02 AVAX`.
- Submitter Bond (Q11): `0.02 AVAX`.

### Bảng So Sánh Payoff Thực Tế

| Kịch bản | Dòng tiền Bên Thắng (Alice) | Dòng tiền Bên Thua (Bob) | Giao thức (Fee) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Trường hợp A: Ký hợp tác** | **+0.09 AVAX** (Nhận 0.19 pot ròng) | **-0.10 AVAX** (Mất 100% cược) | **+0.01 AVAX** (5% fee) | Kết thúc tức thì qua 2-trong-3 |
| **Trường hợp B: Bob challenge & Arbiter im 24h** | **+0.01 AVAX** (Nhận lại 0.10 cược + 0.01 bồi thường bond) | **-0.01 AVAX** (Nhận lại 0.10 cược, mất 50% bond = 0.01 AVAX) | **0.00 AVAX** (0% fee) | Thu hồi được 0.09 AVAX (90% cược ban đầu) |

### Kết luận Rủi Ro Tồn Đọng (Residual Risk)
1. Cơ chế Submitter Bond (Q11) kết hợp phạt 50% bond challenger (Q8) đã xóa bỏ trạng thái "hòa vốn 0 rủi ro" của bên thua, khiến họ bị phạt ròng 0.01 AVAX.
2. Tuy nhiên, việc thu hồi được 90% số tiền cược (-0.01 AVAX so với -0.10 AVAX) vẫn tạo động lực kinh tế cho bên thua thực hiện challenge ác ý nếu họ tin rằng Arbiter sẽ không hoạt động trong 24 giờ.
3. **Giải pháp dài hạn cho Mainnet:** Cần triển khai chuỗi nước đi có chữ ký từng bước (E1) kết hợp cơ chế slash stake đối với Arbiter offline để loại bỏ hoàn toàn rủi ro này.

---

## 4. Báo Cáo Kết Quả Kiểm Thử Thực Tế

Toàn bộ 235 bài kiểm thử trong codebase đều vượt qua 100%:

### 4.1. Kết Quả Foundry (`contracts/`)
```text
Ran 4 test suites: 112 tests passed, 0 failed, 0 skipped (112 total tests)
- ChessEscrowTest: 83 passed, 0 failed
- AvaClashMetaTest: 18 passed, 0 failed
- ChessEscrowMetaIntegrationTest: 3 passed, 0 failed
- ChessEscrowMetaTryCatchTest: 8 passed, 0 failed
```

### 4.2. Kết Quả Vitest (`pnpm test` tại root)
```text
✓ packages/shared/tests/cross-spec-fixture.test.ts (1 test)
✓ packages/shared/tests/schemas.test.ts (24 tests)
✓ packages/shared/tests/elo.test.ts (22 tests)
✓ packages/shared/tests/eip712.test.ts (48 tests)
✓ packages/relay/tests/relay.test.ts (11 tests)
✓ web/src/hooks/useFairPlayGuard.test.ts (17 tests)

Test Files  6 passed (6)
     Tests  123 passed (123)
  Duration  1.65s
```

---

## 5. Các Việc Chưa Làm & Cảnh Báo An Ninh Khai Thác `abortRoom`

### 5.1. Lỗ hổng khai thác `abortRoom` do thiếu `signalGameStarted`
- **Thực trạng kỹ thuật:**
  - Hợp đồng `ChessEscrow.sol` có cơ chế `abortRoom(roomId)` cho phép hủy phòng sau 3 phút nếu `room.gameStarted == false`.
  - Hiện tại, hàm `signalGameStarted(roomId)` chỉ có thể được gọi bởi `relaySigner`, nhưng **trong toàn bộ hệ thống off-chain (RelayServer, bot, UI) KHÔNG CÓ BẤT KỲ THÀNH PHẦN NÀO GỌI HÀM NÀY**.
  - Do đó, giá trị `room.gameStarted` trên blockchain luôn là `false`.
- **Kịch bản tấn công:**
  - Người chơi B vào phòng cược 1 AVAX. Ván cờ diễn ra trên WebSocket bình thường.
  - Đến phút thứ 4, người chơi B đi sai nước cờ và sắp bị chiếu hết.
  - B gửi giao dịch trực tiếp tới `ChessEscrow.abortRoom(roomId)`.
  - Hợp đồng kiểm tra `block.timestamp >= room.createdAt + 3 minutes` và `gameStarted == false` -> **Hợp đồng chấp thuận hủy phòng và hoàn 100% tiền cược cho cả hai bên**.
  - Kẻ thua cuộc hoàn toàn không mất tiền dù đã đánh cờ thua.
- **Chỉ thị dứt khoát:**
  - Lỗ hổng này phải được xử lý triệt để ở **Lượt thiết kế GameStart** tiếp theo (ví dụ: Relay tự động gửi transaction on-chain hoặc ký chữ ký bắt đầu ván kèm nước đi đầu tiên).
  - **HỆ THỐNG TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP DEPLOY LÊN FUJI HOẶC MAINNET CHO ĐẾN KHI CƠ CHẾ NÀY HOÀN TẤT.**

### 5.2. Các mục hoãn lại chưa làm ở lượt này
1. **Q12 (Season Prize Pool distribution):** Chưa có cơ chế on-chain để phân phối `seasonPrizePool` về các kỳ thủ chiến thắng giải đấu mùa (chờ thiết kế tokenomics và merkle claim).
2. **G3 (Khóa cược khán giả):** Hiện cược khán giả vẫn khóa ngay tại `joinRoom` (Fail-Fast); chưa triển khai cửa sổ đặt cược linh hoạt 60-120 giây sau khi có màu quân.
3. **C1/G7 (Chống Sybil ELO chuyên sâu):** Đã có `MIN_STAKE = 0.01 ether` và trần `pairId`, nhưng chưa có hệ thống provisional rating và trần điểm tích lũy theo ngày.
4. **Wagmi Wallet Integration:** Nút tạo phòng và vào phòng trên giao diện web hiện ở mức component UI & preview logic, chưa nối trực tiếp provider Web3.
