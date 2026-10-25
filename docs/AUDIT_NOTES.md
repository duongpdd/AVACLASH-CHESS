# Báo cáo Đối chiếu & Đánh giá Mã nguồn (Audit Notes) — AvaClash Chess

> **Ngày thực hiện:** 25/10/2026  
> **Căn cứ tài liệu:** `docs/IMPROVEMENT_PLAN.md` (v2.0), `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` (v1.2.0), `docs/PROGRESS.md`  
> **Phạm vi kiểm tra:** Code thực tế trong `contracts/src/`, `contracts/test/`, `packages/relay/src/`, `packages/shared/src/`, `web/src/`  
> **Quy tắc:** Chỉ đối chiếu và báo cáo thực tế, không sửa code hoặc các file tài liệu khác.

---

## 1. Bảng Đánh giá chi tiết các Mục G1 – G8 và G12

| Mục | Đúng/Sai/Một phần | Bằng chứng (file:dòng) | Đề xuất |
| :-- | :---: | :--- | :--- |
| **G1. Challenge: Nhánh mặc định 24h hoàn bond** | **Đúng** | `contracts/src/ChessEscrow.sol:478`<br/>`pendingWithdrawals[room.challenger] += room.challengeBond;` | **Đúng như mô tả.** `resolveDefaultChallenge` hoàn 100% bond cho bên khiếu nại và hoàn 100% cược cho cả 2 bên. Bên thua khi bị `submitSingleSigned` có thể nộp `challenge` rồi đợi 24h arbiter không phản hồi để hòa vốn (không mất gì ngoài gas).<br/>**Đề xuất (Q8):** Tịch thu/chuyển một phần bond (ví dụ 50%) cho bên bị khiếu nại hoặc nạp quỹ mùa giải khi arbiter quá hạn. |
| **G2. `abortRoom` thoát ván cờ đang thua** | **Đúng** | `contracts/src/ChessEscrow.sol:250-258`<br/>`contracts/src/ChessEscrow.sol:272-278`<br/>`packages/relay/src/RelayRoom.ts:167` | **Đúng như mô tả.** Contract có kiểm tra `if (room.gameStarted) revert GameAlreadyStarted()`, nhưng cờ này chỉ được bật bởi `signalGameStarted` từ Relay. Thực tế, `packages/relay` chỉ relay nước đi qua WebSocket mà **không hề gửi tx `signalGameStarted` lên chain**. Do đó, `gameStarted` on-chain luôn bằng `false`. Sau 3 phút, bất kỳ ai (kể cả người sắp thua trong ván 5+0) gọi `abortRoom` đều được hoàn 100% cược (không mất phí).<br/>**Đề xuất (Q9):** Relay ký EIP-712 `confirmStart` khi có nước đi đầu tiên hoặc client nộp bằng chứng; cấm `abortRoom` khi đã có xác nhận. |
| **G3. Khóa cược sớm + Lỗ hổng người chơi tự cược** | **Đúng** | `contracts/src/ChessEscrow.sol:183-195`<br/>`contracts/src/ChessEscrow.sol:218-219`<br/>`contracts/src/AvaClashMeta.sol:207, 234` | **Đúng như mô tả.**<br/>1. `createRoom` trong Escrow không gọi Meta nên `playerA` và `playerB` trong Meta đều là `address(0)`. Do đó, trước khi `joinRoom`, Player A hoặc Player B tự cược vào ván của mình thì điều kiện `msg.sender == p.playerA \|\| msg.sender == p.playerB` không bắt được.<br/>2. Khi `joinRoom`, Escrow gọi đồng thời `registerMatch` và `lockBetting`. Lúc này người chơi mới được gán địa chỉ thì cược đã bị khóa ngay lập tức. Khán giả phải cược từ lúc chưa biết đối thủ và màu quân.<br/>**Đề xuất (D13):** Gọi `registerMatch` khi `joinRoom`, mở cửa sổ cược ngắn 60-120s trước khi khóa; khi claim hủy cược của 2 người chơi. |
| **G4. Relay trừ giờ theo Telemetry** | **Đúng** | `packages/relay/src/RelayRoom.ts:315, 319, 341-347` | **Đúng như mô tả.** Relay thực sự trừ giờ của bên vi phạm (`this.whiteMs = Math.max(0, this.whiteMs - penaltyMs)`) và xử thua kỹ thuật nếu vi phạm > 3 lần (`warningCount > 3`). Điều này mâu thuẫn với `ARCHITECTURE.md` (chỉ ghi là telemetry hiển thị răn đe) và phá vỡ nguyên lý Pure FIDE Core do telemetry hoàn toàn do client tự gửi.<br/>**Đề xuất (Q10/D10):** Tắt trừ giờ và xử thua kỹ thuật ở bản Fuji, chỉ broadcast cảnh báo. |
| **G5. An ninh khóa Relay & Arbiter** | **Đúng** | `contracts/src/ChessEscrow.sol:436`<br/>`packages/relay/src/RelayServer.ts:31-33` | **Đúng như mô tả.** `ChessEscrow.sol:436` chỉ kiểm tra `if (msg.sender != relaySigner) revert InvalidSignature()`, tức Relay Signer và Arbiter dùng chung một địa chỉ. Khóa private key testnet được hardcode làm giá trị mặc định trong `RelayServer.ts`. Chưa có cơ chế `Pausable` khẩn cấp trên Escrow.<br/>**Đề xuất (D11):** Tách `arbiter` thành biến riêng, không hardcode private key, thêm `Pausable` vào Escrow. |
| **G6. Thông đồng qua cửa Hòa (Draw)** | **Đúng** | `contracts/src/ChessEscrow.sol:624-630`<br/>`contracts/src/AvaClashMeta.sol:243-254, 297-308` | **Đúng như mô tả.** Khi kết quả là Hòa (`outcome=2`), Escrow hoàn tiền 100% cược cho 2 người chơi với phí 0%. Trong khi đó, `AvaClashMeta.sol` giải ngân toàn bộ quỹ cược của cửa 1 và 2 cho cửa 3 (Hòa) mà **không kiểm tra số nước đi tối thiểu**. Hai người chơi có thể thỏa thuận hòa ở nước 1 (`reason=Agreement`), ví phụ cược cửa Hòa và ăn trọn tiền khán giả.<br/>**Đề xuất:** Meta kiểm tra `moveCount >= 20` (hoặc ngưỡng an toàn), nếu hòa quá sớm thì hủy pool và hoàn tiền khán giả. |
| **G7. Chống Sybil ELO chưa đủ & Season Points** | **Đúng** | `contracts/src/AvaClashMeta.sol:132-152` | **Đúng như mô tả.** `pairId` dùng `keccak256(min(A,B), max(A,B), currentDay)` chỉ giảm điểm khi cùng 2 ví đấu lặp lại. Nếu dùng ví Sybil mới, `matchesToday = 0` nên nhận trọn `delta = 24`. Đặc biệt, `seasonPoints[winner] += 15` (dòng 148) **không có bất kỳ cơ chế decay nào** (thắng bao nhiêu trận cùng 1 ví phụ đều nhận nguyên +15 điểm mùa giải). Chưa có trần ngày, provisional rating hay mức cược tối thiểu.<br/>**Đề xuất:** Áp dụng decay cho Season Points, đặt trần ngày và cược tối thiểu để tính ELO. |
| **G8. Escrow gọi Meta làm kẹt tiền & Lệch màu quân** | **Đúng** | `contracts/src/ChessEscrow.sol:218-219, 261, 481, 532, 629, 638, 640`<br/>`contracts/src/ChessEscrow.sol:639` | **Đúng như mô tả.**<br/>1. Toàn bộ lời gọi Escrow → Meta đều là external call trực tiếp không bọc `try/catch`. Nếu Meta revert (lỗi state, out-of-gas, v.v.), toàn bộ các hàm `submitResult`, `finalizeSingleSigned`, `abortRoom`, `refundOnTimeout`, `joinRoom` đều revert theo, dẫn đến kẹt tiền của người chơi.<br/>2. Escrow không lưu màu quân on-chain, luôn mặc định `playerA` là White và `playerB` là Black: `uint8 winningOption = (winner == room.playerA) ? 1 : 2;` (dòng 639). Nếu Relay gán màu ngẫu nhiên (Q3) mà `playerB` cầm Trắng thắng thì Meta lại trả thưởng cho cửa Đen!<br/>3. Escrow không kiểm tra `winner` có khớp logic với `outcome` (ví dụ `outcome=2` nhưng truyền `winner != address(0)`).<br/>**Đề xuất (D14):** Bọc các lệnh gọi Meta bằng `try/catch`, lưu màu quân hoặc kiểm tra khớp `outcome` và màu. |
| **G12. Đồng bộ Tài liệu & Domain EIP-712** | **Đúng** | `contracts/src/ChessEscrow.sol:173, 578`<br/>`packages/shared/src/eip712.ts:15`<br/>`docs/ARCHITECTURE.md:250` | **Đúng như mô tả.**<br/>1. Phí 5%: `ChessEscrow.sol:578` chuyển tiền vào `treasury`, trong khi `ARCHITECTURE.md:250` ghi nạp vào `seasonPrizePool`.<br/>2. EIP-712 Domain: Cả contract và client/relay đều đang dùng `version="1"`, dù struct `Result` đã thay đổi từ 4 lên 8 trường.<br/>3. Mục 7 `ARCHITECTURE.md` chưa đồng bộ với cơ chế trừ giờ của `RelayRoom.ts`. |

---

## 2. Kết quả Trả lời Chi tiết các Câu hỏi Kiểm tra

### 1. `resolveDefaultChallenge` có hoàn bond cho bên challenge không?
- **Có, hoàn 100% bond.**
- **Bằng chứng:** `contracts/src/ChessEscrow.sol:478`:
  ```solidity
  // Refund challenge bond
  pendingWithdrawals[room.challenger] += room.challengeBond;
  ```
  Bên challenger nhận lại cả tiền cược lẫn toàn bộ số bond đã nộp nếu arbiter không giải quyết trong 24 giờ.

### 2. `abortRoom` có điều kiện gì ngoài thời gian? Có phân biệt ván đã bắt đầu không?
- **Điều kiện trong code:** Trạng thái phòng phải là `Active` (dòng 251), `!room.gameStarted` (dòng 252), và thời gian đã qua 3 phút kể từ khi đối thủ vào phòng: `block.timestamp >= room.startedAt + ABORT_TIMEOUT` (dòng 253).
- **Thực tế phân biệt ván bắt đầu:** Biến `room.gameStarted` chỉ được đặt thành `true` khi Relay gọi giao dịch on-chain `signalGameStarted(roomId)` (dòng 272-278). Hiện tại, WebSocket Relay Server (`packages/relay`) không gửi giao dịch này lên blockchain khi nhận nước đi. Do đó, trên hợp đồng, **`room.gameStarted` luôn luôn là `false`**.
- **Hệ quả:** Bất kỳ ván đấu nào sau 3 phút đều có thể bị gọi `abortRoom` để hủy và nhận lại 100% tiền cược (dòng 257-258, hoàn không trừ phí).

### 3. `registerMatch` và `lockBetting` được gọi ở hàm nào, thứ tự ra sao? Người chơi có cược được trước khi `joinRoom` không?
- **Vị trí và thứ tự:** Được gọi trong `joinRoom` tại `contracts/src/ChessEscrow.sol:218-219`:
  ```solidity
  IAvaClashMeta(metaContract).registerMatch(roomId, room.playerA, msg.sender);
  IAvaClashMeta(metaContract).lockBetting(roomId);
  ```
  Được gọi liên tiếp nhau ngay khi Player B tham gia phòng.
- **Người chơi có cược được trước khi `joinRoom` không:** **Có, hoàn toàn cược được.** Vì hàm `createRoom()` không gọi `registerMatch`, biến `playerA` và `playerB` trong `AvaClashMeta.sol` vẫn là `address(0)`. Do đó, kiểm tra `if (msg.sender == p.playerA || msg.sender == p.playerB) revert SelfBetNotAllowed();` tại `AvaClashMeta.sol:207` bị vô hiệu hóa đối với mọi lượt cược trước khi Player B gọi `joinRoom`.

### 4. Relay có trừ giờ khi nhận telemetry không (`packages/relay/src/RelayRoom.ts`)?
- **Có, thực sự trừ giờ và thậm chí xử thua.**
- **Bằng chứng:** `packages/relay/src/RelayRoom.ts:315, 319, 341-347`:
  - Dòng 315 / 319: Trừ trực tiếp `penaltyMs` vào `this.whiteMs` hoặc `this.blackMs`.
  - Dòng 333-338: Broadcast `clock_sync` với số giờ đã bị trừ.
  - Dòng 341-347: Nếu `warningCount > 3`, kích hoạt `handleGameOver` với lý do `resign` (xử thua kỹ thuật).

### 5. `relaySigner` và `arbiter` có phải cùng một địa chỉ/khóa không?
- **Cùng một địa chỉ/khóa.**
- **Bằng chứng:** `contracts/src/ChessEscrow.sol:436`:
  ```solidity
  if (msg.sender != relaySigner) revert InvalidSignature(); // relaySigner acts as arbiter
  ```
  Trong hợp đồng không tồn tại biến hay vai trò `arbiter` độc lập; quyền phân xử khiếu nại được cấp trực tiếp cho `relaySigner`.

### 6. Các lời gọi Escrow sang Meta có bọc `try/catch` không? Meta revert thì settle có revert theo không?
- **Không bọc `try/catch`.**
- **Bằng chứng:** Tại các dòng 218-219, 261, 481, 532, 629, 638, 640 của `ChessEscrow.sol`, tất cả đều là lời gọi giao diện Solidity trực tiếp (`IAvaClashMeta(metaContract)...`).
- **Hệ quả:** Nếu `AvaClashMeta` bị revert vì bất kỳ lý do gì, giao dịch của Escrow (`submitResult`, `joinRoom`, `abortRoom`, `refundOnTimeout`) **sẽ lập tức revert theo**, làm kẹt toàn bộ tiền ký quỹ của người chơi.

### 7. `winner` có được kiểm tra khớp `outcome` và màu của người chơi không? Màu lưu ở đâu?
- **Không kiểm tra khớp:** `submitResult` (dòng 309) chỉ kiểm tra `winner != room.playerA && winner != room.playerB && winner != address(0)`. Không có điều kiện kiểm tra nếu `outcome == 2` (Hòa) thì bắt buộc `winner == address(0)`, hoặc ngược lại.
- **Màu lưu ở đâu:** Hợp đồng `ChessEscrow.sol` **không lưu màu của người chơi**.
- **Lỗ hổng:** Tại `ChessEscrow.sol:639`:
  ```solidity
  uint8 winningOption = (winner == room.playerA) ? 1 : 2;
  ```
  Hợp đồng giả định cứng `playerA` luôn là quân Trắng (Option 1) và `playerB` luôn là quân Đen (Option 2). Nếu Relay xếp `playerB` cầm quân Trắng thì cược khán giả trong Meta sẽ bị trả thưởng ngược màu.

### 8. Phí 5% chuyển vào đâu: `treasury` hay `seasonPrizePool`?
- **Thực tế chuyển vào `treasury`.**
- **Bằng chứng:** `contracts/src/ChessEscrow.sol:578-579`:
  ```solidity
  (bool success,) = treasury.call{ value: amount }("");
  require(success, "Transfer failed");
  ```
  Phí 5% được rút về ví `treasury` của Escrow. Chưa có code kết nối tự động từ Escrow sang `seasonPrizePool` của `AvaClashMeta.sol`.

### 9. EIP-712 domain version hiện là gì, và client/relay/contract có dùng cùng giá trị không?
- **Giá trị hiện tại:** `version = "1"`.
- **Bằng chứng:**
  - Contract: `contracts/src/ChessEscrow.sol:173`: `EIP712("AvaClashChess", "1")`
  - Thư viện shared: `packages/shared/src/eip712.ts:15`: `version: "1"`
  - Relay: Dùng `getEip712Domain` từ shared (`version: "1"`).
- **Kết luận:** Cả contract, relay và shared **đang dùng cùng giá trị version "1"**.

### 10. Wagmi/RainbowKit đã được cài và dùng chưa?
- **Chưa được cài và chưa được dùng.**
- **Bằng chứng:** Trong `web/package.json`, danh sách dependencies chỉ gồm: `@avaclash/shared`, `canvas-confetti`, `chess.js`, `next`, `phaser`, `react`, `react-dom`.
- Hoàn toàn không có `wagmi`, `@rainbow-me/rainbowkit`, hay `viem` trong `web/package.json`. Giao diện hiện tại là Local Hot-Seat mô phỏng, chưa kết nối trực tiếp với ví Web3 trên mạng Fuji.

---

## 3. Báo cáo Số liệu Kiểm thử Thực tế

Chạy lại toàn bộ bộ test trên máy:

| Gói / Bộ kiểm thử | Công cụ | Kết quả thực tế | Số liệu trong `PROGRESS.md` | Đánh giá |
| :--- | :---: | :---: | :---: | :---: |
| **`@avaclash/shared`** | Vitest | 93 / 93 passed | 93 | Khớp 100% |
| **`@avaclash/relay`** | Vitest | 6 / 6 passed | 6 | Khớp 100% |
| **`web`** | Vitest | 17 / 17 passed | 17 | Khớp 100% |
| **`ChessEscrow.sol` (unit & fuzz)** | Foundry | 62 / 62 passed | 62 | Khớp 100% |
| **`AvaClashMeta.sol` (unit)** | Foundry | 14 / 14 passed | 14 | Khớp 100% |
| **`ChessEscrowMetaIntegration.t.sol`** | Foundry | 3 / 3 passed | 3 | Khớp 100% |
| **Tổng cộng toàn dự án** | — | **195 / 195 passed** | **195** | **Khớp chính xác 100%** |

---

## 4. Kết luận

Các vấn đề tồn đọng từ **G1 đến G8 và G12** được nêu trong `docs/IMPROVEMENT_PLAN.md` (v2.0) là **chính xác 100% so với code thực tế**. Mặc dù 195/195 unit & integration tests hiện tại đều passed (do test được viết theo hành vi hiện tại của code), các lỗ hổng kinh tế và cơ chế bất hợp lý trên on-chain (như hoàn bond mặc định, abort không tín hiệu, dead-check tự cược, thiếu try/catch, hardcode màu quân) cần được khắc phục trước khi triển khai chính thức lên Fuji Testnet.
