# Báo Cáo Nghiệm Thu Toàn Diện: Lượt 3b-verify

**Dự án:** AvaClash Chess – Decentralized Competitive Chess Platform on Avalanche  
**Thời gian hoàn thành:** 29-10-2026  
**Trạng thái kiểm thử:** 100% Pass trên toàn bộ hệ thống (154 Smart Contract Tests trên Foundry, 150 Tests TypeScript trên Vitest/Anvil).

---

## 1. Đính Kèm Tệp Output Kiểm Thử Thô (UTF-8 via CMD)

Hai tệp log kiểm thử thô đã được chuyển hướng đầu ra bằng lệnh `cmd /c` (không dùng PowerShell 5 redirection để bảo toàn UTF-8 byte stream):

1. **Foundry Smart Contract Test Output (`forge test -vv`):**  
   [contracts/forge_out.txt](../../contracts/forge_out.txt)  
   - Kết quả: **154 tests passed, 0 failed, 0 skipped**.  
   - Toàn bộ 5 test suites (`ChessEscrowTest`, `AvaClashMetaTest`, `ChessEscrowMetaIntegrationTest`, `ChessEscrowMetaTryCatchTest`, `ChessEscrowInvariantTest`) đều thành công 100%.

2. **TypeScript Monorepo Test Output (`pnpm test`):**  
   [vitest_out.txt](../../vitest_out.txt)  
   - Kết quả: **150 tests passed, 0 failed** (6 suites trong `packages/shared`, 3 suites trong `packages/relay`, 1 suite trong `web`).  
   - Toàn bộ các kiểm thử WebSocket daemon, Anvil local fork, EIP-712 hashing/signing, và GameState đều thành công 100%. Cảnh báo `[DEP0190]` đã bị loại bỏ hoàn toàn.

---

## 2. Chi Tiết Thực Hiện 10 Mục Của Lượt 3b-verify

### Mục 1: Ánh Xạ Cửa Cược Theo DECISIONS Q13 (Không Phụ Thuộc creatorIsWhite)
- **Quy định Q13:**
  - Cửa 1 = Trắng thắng
  - Cửa 2 = Đen thắng
  - Cửa 3 = Hòa
  - Ánh xạ tuyệt đối theo màu cờ bàn cờ, **hoàn toàn không phụ thuộc** vào việc người tạo phòng (`creator`) chọn cầm quân Trắng hay Đen.
- **Bằng chứng mã nguồn hiện tại đã chuẩn xác theo Q13:**
  - File: dòng trong [`ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol#L890-L891):
    ```solidity
                address whitePlayer = room.creatorIsWhite ? room.playerA : room.playerB;
                uint8 winningOption = (winner == whitePlayer) ? 1 : 2;
    ```
  - Khi hòa trận ([`ChessEscrow.sol:868`](../../contracts/src/ChessEscrow.sol#L868)):
    ```solidity
                try IAvaClashMeta(metaContract).resolvePrediction(roomId, 3, moveCount) {}
    ```
  - File: dòng trong [`ChessEscrowMetaIntegration.t.sol`](../../contracts/test/ChessEscrowMetaIntegration.t.sol#L227-L295):
    - Khi `creatorIsWhite = false` và Trắng thắng (Trắng là joiner `bob`):
      `ChessEscrowMetaIntegration.t.sol:258-294` (`test_Matrix_CreatorBlack_WhiteWin_MovesGE20`): Khán giả cược cửa 1 nhận thưởng đầy đủ, cửa 2 và 3 thua.
    - Khi `creatorIsWhite = false` và Đen thắng (Đen là creator `alice`):
      `ChessEscrowMetaIntegration.t.sol:322-336` (`test_Matrix_CreatorBlack_BlackWin_MovesGE20`): Khán giả cược cửa 2 nhận thưởng đầy đủ, cửa 1 và 3 thua.
  - Toàn bộ 12 ca kiểm thử ma trận (`test_Matrix_*`) đều khẳng định nguyên tắc này độc lập với người tạo phòng.

---

### Mục 7: Cô Lập Trạng Thái Giữa Các Lần Chạy & Bảo Vệ File Active Cũ
- **Commit:** `43401e2` (*feat(relay): isolate test state with activeDir, validate restored active file against chain, and delete stale files on mismatch*)
- **Giải pháp thực hiện:**
  1. Bổ sung tham số `activeDir` độc lập vào [`RelayServerOptions`](../../packages/relay/src/RelayServer.ts#L41), tách biệt với `resultsDir`.
  2. Mọi test suite (`tests/relay.test.ts`, `tests/anvil-integration.test.ts`) đều sử dụng thư mục tạm riêng thông qua `fs.mkdtempSync` và dọn dẹp sạch sẽ trong `afterAll`.
  3. Thêm kiểm tra cuối mỗi bộ test khẳng định tuyệt đối không có thư mục `./results` hoặc `./active` nào xuất hiện trong thư mục làm việc.
  4. Cơ chế khôi phục từ file active đối chiếu trực tiếp với blockchain:
     - Phòng phải ở trạng thái `Active` (`roomData.status === 1`).
     - Địa chỉ người chơi `whitePlayer` và `blackPlayer` phải khớp chính xác giữa file active và on-chain.
     - Thuộc tính `creatorIsWhite` phải khớp chính xác.
     - Nếu phát hiện bất kỳ sai lệch nào, server lập tức xóa file active bị mồ côi/cũ và ghi log cảnh báo.
  5. Test xác thực: Thêm ca kiểm thử `Item 7: active game file from previous run with different players is rejected, deleted, and NOT recovered` trong `packages/relay/tests/relay.test.ts`.

---

### Mục 8: Test Lưu-Trước-Khi-Đọc-Chain (Save-Before-Read-Chain)
- **Commit:** `547b909` (*test(relay): add save-before-read-chain test verifying disk write within 200ms on RPC error followed by settlement*)
- **Phương pháp kiểm thử:**
  - Mô phỏng RPC node bị treo/lỗi hoàn toàn (`readContract` luôn throw exception).
  - Kết thúc ván cờ bằng chiếu hết / hết giờ / xin thua.
  - Xác nhận trong vòng 200 ms, tệp kết quả JSON đã được ghi thành công xuống đĩa với đầy đủ chữ ký của Relay và người chơi.
  - Sau đó phục hồi RPC node, người chơi gửi `request_result`, nhận chữ ký Relay hợp lệ và thực hiện `submitResult` thanh toán thành công 100% trên Anvil.
- **Tái hiện FAIL trên mã nguồn cũ (trước commit `4febbca` / commit `b28214a`):**
  - Khi chưa lưu file trước khi đọc chain, hàm `handleGameOver` cố đọc on-chain trước khi ghi file, dẫn đến việc crash do RPC lỗi và tệp kết quả không tồn tại trên đĩa.
  - Output lỗi nguyên văn được lưu tại tài liệu đối chiếu [`docs/LUOT3B_VERIFY_ITEM2_FAIL_OUTPUTS.md`](../../docs/LUOT3B_VERIFY_ITEM2_FAIL_OUTPUTS.md).

---

### Mục 2: Output FAIL Thật Của Các Mục 4, 5, 6 Lượt 3b-fix
- **Commit:** `84e13f8` (*docs: document verbatim FAIL outputs reproducing Items 4, 5, and 6 of Luot 3b-fix*)
- Toàn bộ output FAIL nguyên văn không chen giải thích được lưu trữ đầy đủ tại:  
  [docs/LUOT3B_VERIFY_ITEM2_FAIL_OUTPUTS.md](../../docs/LUOT3B_VERIFY_ITEM2_FAIL_OUTPUTS.md)
  1. **Item 4 (Disconnection Timeout):** Tái hiện trên commit `70b5f55`. Lỗi: `Test timed out in 5000ms` do đồng hồ cờ bị ngắt khi người chơi mất kết nối thay vì tiếp tục chạy.
  2. **Item 5 (Save Result Before RPC Query):** Tái hiện trên commit `b28214a`. Lỗi: `AssertionError: expected 'No saved result found for room 0' to be undefined` do kết quả ván đấu chưa được lưu trước khi gọi RPC.
  3. **Item 6 (Origin Verification & DNS Rebinding Protection):** Tái hiện trên commit `4febbca`. Lỗi: `AssertionError: expected true to be false` tại dòng 1057 do server chấp nhận WebSocket handshake từ unauthorized Origin.

---

### Mục 3: Bảng Đối Chiếu Test Từ Lượt 3a Đến Hiện Tại
- **Commit:** `753c859` (*docs: add real test mapping table from Luot 3a commit 2441952 to current locations*)
- Trích xuất từ commit `2441952:contracts/test/ChessEscrowMetaTryCatch.t.sol`:
  - Toàn bộ 8 bài test gốc của Lượt 3a được đối chiếu chi tiết sang vị trí hiện tại trong [`contracts/test/ChessEscrowMetaTryCatch.t.sol`](../../contracts/test/ChessEscrowMetaTryCatch.t.sol).
  - Bổ sung 5 test mở rộng bảo vệ lỗi revert của Meta (nâng tổng số lên 13 test).
  - Chi tiết lưu tại: [docs/LUOT3B_VERIFY_ITEM3_TEST_MAPPING.md](../../docs/LUOT3B_VERIFY_ITEM3_TEST_MAPPING.md).

---

### Mục 4: Cấu Hình Invariant Test & Khẳng Định Ghost Counters Trên Tổng Campaign
- **Commit:** `5140245` (*test(invariants): configure runs=20 depth=500 in foundry.toml, add profile ci, assert >=20 ghost counters across campaign, and update proof wording*)
- **Điều chỉnh cấu hình [`contracts/foundry.toml`](../../contracts/foundry.toml):**
  - Mặc định: `runs = 20`, `depth = 500`, `fail_on_revert = false`.
  - Profile CI (`FOUNDRY_PROFILE=ci`): `runs = 256`, `depth = 500`, `fail_on_revert = true`.
- **Hiệu đính tài liệu:** Đã sửa cụm từ "chứng minh bằng toán học" thành "fuzz không tìm thấy phản ví dụ" trong [`docs/REPORT_LUOT3B_FIX.md`](../../docs/REPORT_LUOT3B_FIX.md#L394).
- **Cơ chế Ghost Counters `afterInvariant()` trên tổng campaign:**
  - Hook [`afterInvariant()`](../../contracts/test/invariants/ChessEscrowInvariant.t.sol#L217) trong `ChessEscrowInvariant.t.sol` tích lũy chính xác dữ liệu của toàn bộ chiến dịch fuzz (20 runs hoặc 256 runs) thông qua bộ lưu trữ campaign không biến đổi giữa các lượt reset EVM snapshot.
  - Khẳng định tối thiểu $\ge 20$ lần cho toàn bộ 6 nhánh bond cốt lõi. Trong lần chạy mặc định (20 runs = 10,000 calls), mỗi nhánh đều vượt xa yêu cầu (từ 482 đến 1,593 lần).

---

### Mục 5: Cố Định Fixture `cross_spec_result.json` & Ghi Đè Có Điều Kiện
- **Commit:** `736f8fa` (*test(fixture): lock cross_spec_result.json fixture and only overwrite when UPDATE_FIXTURE=1*)
- **Giải pháp:**
  - Tệp [`contracts/test/fixtures/cross_spec_result.json`](../../contracts/test/fixtures/cross_spec_result.json) được cố định giá trị và commit vào git.
  - Trong [`packages/shared/tests/cross-spec-fixture.test.ts`](../../packages/shared/tests/cross-spec-fixture.test.ts), kiểm thử chỉ đọc và xác minh tính toàn vẹn EIP-712 của chữ ký Viem với digest fixture mà tuyệt đối **không ghi đè** lên file.
  - Tệp chỉ được phép ghi đè khi và chỉ khi có biến môi trường `UPDATE_FIXTURE=1`.

---

### Mục 9: Loại Bỏ `shell: true` Khi Khởi Động Anvil Helper
- **Commit:** `c9fa954` (*fix(test): remove shell: true from spawn anvil helper to eliminate DEP0190 warning*)
- **Giải pháp:**
  - Trong [`packages/relay/tests/helpers/anvil.ts`](../../packages/relay/tests/helpers/anvil.ts#L41), đã loại bỏ tùy chọn `{ shell: true }` khi gọi hàm `spawn("anvil", ...)`.
  - Khởi chạy trực tiếp binary `anvil` mà không qua shell trung gian giúp tránh các lỗ hổng shell injection tiềm ẩn trên Windows.
  - Cảnh báo Node.js deprecation:
    `[DEP0190] DeprecationWarning: Passing args to a child process with shell option true...`
    đã biến mất hoàn toàn 100% trong toàn bộ chu trình chạy `pnpm test`.

---

### Mục 10: Điều Tra & Khắc Phục Nguyên Nhân Revert Ở `submitSingleSignedAction`
- **Commit:** `a775989` (*fix(invariants): prevent arithmetic overflow in handler player indexing on boundary inputs*)
- **Nguyên nhân cốt lõi phát hiện:**
  - Khi Foundry fuzzer sinh giá trị biên cực đại cho tham số `outcomeSeed` (kiểu `uint8`), cụ thể là `outcomeSeed = 255`:
    Biểu thức `players[(outcomeSeed + 1) % 3]` trong Solidity 0.8+ đã thực hiện phép cộng trên `uint8`: `uint8(255) + 1 = 256` $\rightarrow$ gây ra lỗi `panic: arithmetic underflow or overflow (0x11)` ngay trong handler trước khi tương tác với contract!
  - Tương tự, tại các điểm xử lý seed biên `type(uint256).max`, phép tính `(seed + 1) % 3` cũng có thể tràn số `uint256`.
- **Khắc phục:**
  - Đổi công thức tính chỉ mục sang modular arithmetic an toàn:
    `players[(uint256(outcomeSeed) % 3 + 1) % 3]` và `players[(seed % 3 + 1) % 3]`.
  - Phép tính `seed % 3` luôn cho kết quả trong khoảng $[0, 2]$, cộng thêm 1 tối đa là 3, tuyệt đối không thể tràn số ở bất kỳ giá trị đầu vào nào.
- **Xác minh với `FOUNDRY_PROFILE=ci` (`fail_on_revert = true`):**
  - Đã chạy toàn bộ chiến dịch CI: **256 runs, 128,000 calls**.
  - **Kết quả:** `reverts: 0` trên 100% tất cả 18 selectors (bao gồm 7,140 lần gọi `submitSingleSignedAction` không có bất kỳ revert nào).

---

## 3. Chưa Làm / Khác Dự Kiến

Căn cứ theo nguyên tắc minh bạch kỹ thuật, dưới đây là các điểm ghi nhận chưa thực hiện hoặc khác biệt so với dự kiến ban đầu:

1. **Thời gian thực thi của Invariant Test CI (256 runs $\times$ 500 depth):**
   - *Thực tế:* Chạy trọn vẹn 128,000 calls trên Windows với Solidity IR optimizer (`via_ir = true`) mất khoảng 4 phút. Để tối ưu hóa tốc độ chạy local hàng ngày, cấu hình mặc định trong `foundry.toml` giữ ở mức `runs = 20, depth = 500` (mất ~20 giây, kiểm tra 10,000 calls). Profile CI với 128,000 calls (`runs = 256`) được tách riêng và kích hoạt qua `FOUNDRY_PROFILE=ci`.
2. **Yêu cầu `BypassSandbox: true` cho `pnpm test` trên Windows:**
   - *Hiện tượng:* Các test suite tích hợp Relay Server và Anvil RPC (`relay.test.ts`, `anvil-integration.test.ts`) cần khởi tạo WebSocket local (`ws://127.0.0.1:<port>`) và HTTP JSON-RPC local. Môi trường sandbox Windows mặc định chặn bind/connect local TCP port nếu không mở quyền mạng unsandboxed. Do đó, các lệnh chạy kiểm thử Relay cần được thực thi với `BypassSandbox: true`. Các lệnh Foundry (`forge test`) vẫn thực thi hoàn toàn trong chế độ sandbox mặc định.
3. **Phase 5 – Tích hợp Web Frontend với Wagmi / RainbowKit:**
   - Chưa tích hợp ví Web3 trực tiếp vào trang web (vẫn giữ nguyên game board canvas mock từ Phase 4). Giao tiếp backend và Relay daemon đã hoàn thiện 100%.

---

## 4. Bảng Tổng Hợp Commit Lượt 3b-verify

| Mục | Commit SHA | Thông Điệp Commit |
| :---: | :---: | :--- |
| **1** | *(Đã có)* | Code đã tuân thủ chuẩn Q13; kiểm chứng bằng 12 test ma trận (`ChessEscrowMetaIntegration.t.sol`). |
| **7** | `43401e2` | `feat(relay): isolate test state with activeDir, validate restored active file against chain, and delete stale files on mismatch` |
| **8** | `547b909` | `test(relay): add save-before-read-chain test verifying disk write within 200ms on RPC error followed by settlement` |
| **2** | `84e13f8` | `docs: document verbatim FAIL outputs reproducing Items 4, 5, and 6 of Luot 3b-fix` |
| **3** | `753c859` | `docs: add real test mapping table from Luot 3a commit 2441952 to current locations` |
| **4** | `5140245` | `test(invariants): configure runs=20 depth=500 in foundry.toml, add profile ci, assert >=20 ghost counters across campaign, and update proof wording` |
| **5** | `736f8fa` | `test(fixture): lock cross_spec_result.json fixture and only overwrite when UPDATE_FIXTURE=1` |
| **9** | `c9fa954` | `fix(test): remove shell: true from spawn anvil helper to eliminate DEP0190 warning` |
| **10** | `a775989` | `fix(invariants): prevent arithmetic overflow in handler player indexing on boundary inputs` |
| **6** | *(Commit này)* | `docs(verify): add comprehensive Luot 3b-verify report and attached raw test logs` |

