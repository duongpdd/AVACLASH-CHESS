# Quyết định thiết kế — AvaClash Chess

> **Cập nhật:** 26/10/2026 (Lượt 3a)
> **Quy ước mã:** `D1-D14` và `Q1-Q16` là mã quyết định trong file này. Mã hạng mục `A1-G12` thuộc `IMPROVEMENT_PLAN.md` và là hệ mã khác (ví dụ `D4` ở đây là tooling monorepo, còn `D4` trong kế hoạch cũ là phí giao thức; phí giao thức nay là **Q6**).
> **Trạng thái:** `Accepted` = đang áp dụng | `Superseded` = đã bị thay thế | `Proposed` = đề xuất, chờ chốt | `Open` = còn mâu thuẫn cần xử lý.
> **Lưu ý:** trạng thái `Accepted` dựa trên `PROGRESS.md`/`ARCHITECTURE.md`, chưa đối chiếu với code.

---

## Phase 1

### D1: Biểu diễn nước đi — UCI — `Accepted`
- Dùng UCI (`e2e4`, `e7e8q`) thay vì SAN vì đơn giản, không phụ thuộc trạng thái bàn cờ khi parse.
- SAN chỉ dùng để hiển thị trong UI.

### D2: Hash nước đi — `Accepted`
- `movesHash = keccak256(abi.encodePacked(uciMoves.join(" ")))`.
- Ván 0 nước → hash chuỗi rỗng.
- Dùng `viem/utils` `keccak256` + `toHex` ở TypeScript, `abi.encodePacked` ở Solidity → kết quả phải khớp.

### D3: EIP-712 Typed Data — `Superseded` bởi D7
- Domain: `name="AvaClashChess"`, `version="1"`, `chainId`, `verifyingContract`.
- ~~Struct: `Result(uint256 matchId, address winner, bytes32 movesHash, uint256 nonce)`~~ → struct mới xem **D7**.
- `matchId` = `roomId` từ contract.
- Dùng chung type definition giữa TypeScript (viem) và Solidity (OpenZeppelin EIP712).
- **Còn mở:** struct đã đổi (typehash khác, chữ ký cũ không dùng được) nhưng domain vẫn `version="1"`. Đề xuất nâng lên `"2"` để tránh nhầm lẫn giữa hai thế hệ chữ ký; nếu giữ `"1"` thì ghi rõ lý do. Client, Relay và contract phải dùng cùng giá trị.

### D4: Monorepo tooling — `Accepted`
- pnpm workspaces (nhẹ, nhanh, hỗ trợ tốt).
- Vitest cho test TypeScript (nhanh, ESM native).
- Prettier cho format (không dùng ESLint trong Phase 1 để giữ đơn giản).

### D5: Màu quân — `Superseded` bởi Q13
- ~~Người tạo phòng luôn là Trắng (đơn giản cho MVP).~~
- ~~Màu hiện do seed Relay ký (xem Q3).~~
- Thay thế bởi **Q13**: Người tạo phòng chọn màu quân trực tiếp qua tham số `creatorIsWhite` của `createRoom` và được lưu on-chain.

### D6: Đồng hồ — `Accepted` (kèm ràng buộc từ D10)
- Mặc định 5 phút + 0 giây increment.
- Relay là nguồn thời gian tham chiếu. Client đếm ngược cục bộ.
- Hạn chế: đồng hồ không kiểm chứng được hoàn toàn off-chain.
- Việc Relay trừ giờ theo telemetry là một cơ chế riêng, xem **D10**.

---

## Phase 5 — Improvement Plan (25/10/2026)

### Q1: Xử lý hòa — `Accepted`
- **Quyết định:** Hoàn tiền 100% cho cả hai bên khi ván hòa.
- **Lý do:** Đơn giản, ít tranh cãi, không tạo thêm biến phức tạp cho escrow.

### Q2: Phân xử challenge — `Accepted` (chi tiết bond xem Q8, Q11)
- **Quyết định:** Arbiter/Relay có timelock, kèm kết cục mặc định (hoàn tiền cả hai) khi quá hạn phân xử.
- **Lý do:** Giải quyết vấn đề "ai quyết định" trong challenge, đảm bảo luôn có kết cục dù arbiter bất hợp tác.
- **Chi tiết:**
  - `relaySigner` / `arbiter` là địa chỉ được đăng ký trong contract, có timelock khi đổi khóa.
  - Nếu arbiter không ra phán quyết trong thời hạn (ví dụ 24h), mặc định hoàn tiền cả hai.
  - Cơ chế bond của cả hai bên submitter và challenger được chuẩn hóa tại **Q11**.
- **Đánh đổi cần thừa nhận:** nhánh mặc định hoàn cả bond cho phép bên thua "hòa vốn" bằng cách challenge rồi chờ arbiter im lặng. Xem Q8.

### Q3: Chọn màu công bằng — `Superseded` bởi Q13
- ~~**Quyết định:** Seed do Relay ký, ít vòng tương tác hơn.~~
- **Thay thế bởi Q13:** Người tạo phòng chọn màu qua `creatorIsWhite` trong `createRoom`, lưu on-chain. Relay không quyết định màu mà đọc trực tiếp từ chain.

### Q4: Thời điểm khóa cược Spectator — `Accepted`, đề xuất sửa bởi D13
- **Quyết định hiện tại:** Khóa khi `joinRoom`.
- **Lý do:** An toàn nhất chống gian lận bằng engine phân tích thế cờ.
- **Vấn đề đã biết:** khán giả cược khi chưa biết đối thủ và màu; `registerMatch` chạy cùng lúc nên không chặn được cược của người chơi trước `joinRoom`. Xem D13.

### Q5: Cửa "Under 40 moves" — `Accepted`
- **Quyết định:** Bỏ hẳn ở bản Fuji Testnet, xem lại sau mainnet.
- **Lý do:** Hai người chơi có thể thỏa thuận kết thúc nhanh để lợi dụng cược khán giả. Chưa có cơ chế chống hiệu quả.
- **Lưu ý:** bỏ cửa này không chặn được thông đồng qua cửa Hòa hoặc resign sớm (xem kế hoạch G6).

### Q6: Phí giao thức — `Accepted`
- **Quyết định:** 5% trên Escrow khi có người thắng (0% khi hòa hoặc refund).
- **Đích tiền:** Phí được tích lũy on-chain tại `ChessEscrow` và chuyển về địa chỉ `treasury` thông qua hàm `withdrawProtocolFees`. Treasury (multisig quản trị) sau đó trích một phần hoặc toàn bộ để cấp vốn nuôi Quỹ giải thưởng mùa giải (`seasonPrizePool`) theo kế hoạch công khai.

### Q7: Bond challenge — `Accepted`
- **Quyết định:** 20% tiền cược (tối thiểu 0.01 AVAX).
- **Lý do:** Đủ cao để ngăn challenge bừa, đủ thấp để không cản trở khiếu nại hợp lệ.
- **Ghi chú:** bên nộp đơn `submitSingleSigned` cũng phải đặt bond đối ứng bằng đúng bond của challenge (xem Q11).

### Q8: Bond ở nhánh mặc định 24h — `Accepted with residual risk` (Lý do tắt mặc định single-signed tại Q15)
- **Quyết định:** Cơ chế bond chỉ làm giảm lợi ích của việc challenge-rồi-chờ-arbiter-im, không loại bỏ hoàn toàn; xử lý triệt để ở mainnet bằng chuỗi nước đi có chữ ký (E1) và arbiter có cam kết hoạt động.
- **Bảng so sánh Payoff cả hai hướng thực nghiệm (Stake = 0.1 AVAX, Bond = 0.02 AVAX = 20%):**

| Chiều kịch bản | Hành vi của Submitter | Hành vi của Challenger | Kết quả nếu Arbiter im lặng 24h (`resolveDefaultChallenge`) | Payoff Bên Thắng | Payoff Bên Thua |
|---|---|---|---|---|---|
| **Hướng 1** (Test `test_G1_payoffComparison_loserSignsVsChallengeWithSilentArbiter`) | Bên THẮNG nộp claim (`submitSingleSigned`) | Bên THUA khiếu nại (`challenge`) rồi chờ | - Bên thắng được hoàn 0.1 AVAX stake + 0.02 AVAX bond + 0.01 AVAX (50% challenger bond).<br>- Bên thua được hoàn 0.1 AVAX stake + 0.01 AVAX (50% challenger bond). | **+0.01 AVAX** (lãi giảm từ +0.09) | **-0.01 AVAX** (thu hồi 0.09 AVAX lẽ ra mất trắng) |
| **Hướng 2 (Đối xứng G1)** (Test `test_G1_payoffComparison_symmetric_loserSubmitsSingleSigned`) | Bên THUA gian lận nộp claim trước (`submitSingleSigned`) | Bên THẮNG chân chính buộc phải `challenge` | - Bên thua (submitter) được hoàn 0.1 AVAX stake + 0.02 AVAX bond + 0.01 AVAX (50% challenger bond) = 0.13 AVAX.<br>- Bên thắng (challenger) nhận 0.1 AVAX stake + 0.01 AVAX = 0.11 AVAX. | **-0.01 AVAX (LỖ ròng 10% stake)** | **+0.01 AVAX (LÃI ròng 10% stake!)** |

- **Đánh giá rủi ro đối xứng nghiêm trọng:**
  - Ở Hướng 2, kẻ thua cuộc chủ động nộp claim sai lệch trước. Nếu bên thắng challenge và Arbiter gặp sự cố không phân xử trong 24h, kẻ thua cuộc không những không mất tiền cược mà còn **kiếm lời ròng +0.01 AVAX**, trong khi người chiến thắng thực sự lại bị **lỗ -0.01 AVAX**.
  - Đây là lỗ hổng động cơ kinh tế chết người của cơ chế giải quyết mặc định khi thiếu E1. **Đây chính là lý do trực tiếp khiến `singleSignedEnabled` mặc định bị TẮT ở Q15.**

### Q9: Tín hiệu bắt đầu ván (`confirmStart`) — `Superseded` bởi Q16
- ~~**Đề xuất:** Relay ký tín hiệu EIP-712 "ván đã bắt đầu" khi có nước đi đầu tiên; sau khi được xác nhận trên chain, `abortRoom` bị cấm.~~
- **Thay thế bởi Q16:** Relay trực tiếp gửi giao dịch `signalGameStarted(roomId)` ngay khi phòng cờ chuyển sang trạng thái "active" trên Relay (cả hai kỳ thủ vào ghế), khóa ngay hàm `abortRoom` on-chain.

### Q10: Telemetry chỉ cảnh báo ở Fuji — `Accepted` (chi tiết D10)
- **Quyết định:** Client hook `useFairPlayGuard` phát hiện rời màn hình quá 2 giây và gửi cảnh báo; Relay broadcast cảnh báo và đếm vi phạm cho đối thủ thấy, **tuyệt đối không trừ giờ đồng hồ và không xử thua kỹ thuật**.
- **Lý do:** Tuân thủ triệt để nguyên lý "Pure FIDE Core", tránh xử phạt oan do dữ liệu telemetry client không thể kiểm chứng mật mã học off-chain.

### Q11: Submitter Bond cho Single-Signed Submission — `Accepted`
- **Quyết định:** Người nộp đơn `submitSingleSigned` phải đặt bond bằng đúng bond của challenge (`_computeChallengeBond(stake)`).
- **Quy tắc hoàn trả và phạt:**
  - Hoàn 100% bond người nộp khi `finalizeSingleSigned` kết thúc mà không bị challenge.
  - Khi bị challenge:
    - Nếu Arbiter xác nhận người nộp đúng (`resolveChallenge`): người nộp được hoàn lại bond của mình và nhận thêm toàn bộ bond của bên challenge.
    - Nếu Arbiter xác nhận người nộp sai: bond của người nộp bị tịch thu và chuyển toàn bộ cho bên challenge (bên challenge nhận lại bond của mình + bond người nộp).
    - Nhánh mặc định 24h (`resolveDefaultChallenge`): hoàn 100% bond người nộp; bond của bên challenge chia 50/50 (50% bồi thường người nộp, 50% hoàn trả challenger).
- **Bảo toàn tiền:** Tổng số tiền giải ngân bằng chính xác tổng số tiền nạp vào hợp đồng ở mọi nhánh rẽ.

### Q12: Cơ chế chi trả Quỹ Giải Thưởng Mùa Giải (`seasonPrizePool`) — `Open`
- **Tình trạng:** Cách thức phân phối và chi trả `seasonPrizePool` (tích lũy từ 5% phí cược khán giả trong `AvaClashMeta.sol`) chưa có thiết kế đặc tả chi tiết.
- **Quyết định:** Tạm hoãn, KHÔNG triển khai ở lượt này; bảo toàn quỹ trên hợp đồng cho đến khi có ADR phê duyệt cơ chế phân phối cuối mùa giải.

### Q13: Người tạo phòng chọn màu quân — `Accepted`
- **Quyết định:** Người tạo phòng chọn màu quân thông qua tham số `creatorIsWhite` trong hàm `createRoom(bool creatorIsWhite)`, lưu trữ trực tiếp on-chain; người vào phòng quan sát thấy màu trước khi stake cược.
- **Thay thế:** Q3 (seed Relay ký) và D5 chính thức chuyển sang trạng thái `Superseded` bởi Q13.
- **Vai trò Relay:** Relay đọc cấu hình màu trực tiếp từ chain, không quyết định màu.
- **Cửa cược khán giả:** Suy ra trực tiếp từ `outcome` của trận đấu:
  - Outcome 0 (Trắng thắng) $\to$ Cửa 1 (Trắng).
  - Outcome 1 (Đen thắng) $\to$ Cửa 2 (Đen).
  - Outcome 2 (Hòa) $\to$ Cửa 3 (Hòa).

### Q14: Tiền cược tối thiểu `MIN_STAKE = 0.01 ether` — `Accepted`
- **Quyết định:** Áp đặt `MIN_STAKE = 0.01 ether` trong `createRoom` (revert `StakeTooLow` nếu `msg.value < MIN_STAKE`).
- **Ghi chú:** Ở bậc cược thấp nhất (0.01 AVAX), bond tối thiểu (0.01 AVAX) bằng 100% tiền cược; đây là mức chấp nhận được cho mạng thử nghiệm Fuji Testnet để chống spam và cày điểm ELO, sẽ xem lại trước khi triển khai mainnet.

### Q15: Tắt mặc định cơ chế Single-Signed (`singleSignedEnabled = false`) trên Fuji — `Accepted`
- **Quyết định:** Thêm biến công khai `singleSignedEnabled` (mặc định `false`) và hàm `setSingleSignedEnabled(bool)` chỉ `owner` có quyền gọi. Khi tắt, hàm `submitSingleSigned` lập tức revert lỗi custom `SingleSignedDisabled()`.
- **Lý do:** Khai thác rủi ro đối xứng của G1 (phân tích chi tiết tại Q8): Nếu kẻ thua cuộc chủ động nộp claim trước và Arbiter im lặng sau 24h, kẻ thua cuộc sẽ thu lời ròng (+0.01 AVAX) từ 50% bond của người thắng chân chính.
- **Điều kiện bật lại trên Mainnet:** Bắt buộc phải triển khai giải pháp E1 (chuỗi nước đi có chữ ký từng nước hoặc fraud-proof/zk-proof cho nước đi hợp lệ) và cơ chế staking/slashing ràng buộc trách nhiệm của Arbiter trước khi kích hoạt lại tính năng này.

### Q16: Relay tự động gửi `signalGameStarted(roomId)` on-chain — `Accepted` (Thay thế Q9)
- **Quyết định:** `RelayServer` được trang bị `walletClient` (từ relay account). Ngay khi `RelayRoom` chuyển sang trạng thái "active" (cả hai kỳ thủ đã hiện diện và nhận ghế trên WebSocket relay), Relay sẽ tự động gửi giao dịch gọi `signalGameStarted(roomId)` trên `ChessEscrow`.
- **Cơ chế retry & logging:** Chờ receipt giao dịch, retry với exponential backoff tối đa trong 150 giây (hoàn tất trước mốc `ABORT_TIMEOUT = 180s`). Việc gửi giao dịch diễn ra hoàn toàn bất đồng bộ trong background, tuyệt đối không làm nghẽn hoặc chặn luồng nước đi của ván cờ.
- **Kiểm tra số dư khi khởi động:** Relay kiểm tra số dư ví AVAX của relay account khi khởi động, ghi cảnh báo rõ ràng nếu số dư thấp hơn ngưỡng cấu hình `RELAY_MIN_BALANCE` (mặc định 0.1 AVAX).
- **Tác dụng:** Trên hợp đồng, cờ `room.gameStarted` chuyển thành `true`. Kỳ thủ không thể lợi dụng hàm `abortRoom` sau 3 phút để thoát ván cờ đang thua. Nếu Relay tắt tính năng này (`SIGNAL_GAME_STARTED_ENABLED=false`), `abortRoom` vẫn hoạt động sau 3 phút như cũ.

---

### D7: Struct Result mở rộng — `Accepted` (thay thế D3)
- **Cũ:** `Result(uint256 matchId, address winner, bytes32 movesHash, uint256 nonce)`
- **Mới:** `Result(uint256 matchId, address winner, uint8 outcome, uint8 reason, uint16 moveCount, bytes32 movesHash, uint256 nonce, uint256 deadline)`
- `outcome`: 0 = WhiteWin, 1 = BlackWin, 2 = Draw
- `reason`: 0 = Checkmate, 1 = Resign, 2 = Timeout, 3 = Stalemate, 4 = Repetition, 5 = FiftyMove, 6 = InsufficientMaterial, 7 = Agreement
- `moveCount`: tổng số nước đi (half-moves)
- `deadline`: timestamp chữ ký hết hạn (chống chữ ký cũ bị giữ lại dùng muộn)

### D8: Spectator Pool — 1 market (B1, B4, B5) — `Accepted`
- Bỏ "Under 40 moves" (Q5) nên chỉ còn **một market**: Kết quả (White / Black / Draw). *(Tiêu đề cũ ghi "2 market", đã sửa cho khớp nội dung.)*
- Khóa trước khi ván bắt đầu (Q4, có đề xuất sửa ở D13).
- Hòa → cửa "Draw" thắng. Ván bị abort/refund → hoàn tiền tất cả spectator (pull pattern).

---

## Quyết định bổ sung (ghi lại từ tài liệu, chưa có ADR trước đó)

### D9: `abortRoom` và timeout đầu ván — `Accepted` (hiện trạng), đề xuất sửa bởi Q9
- `abortRoom` hủy phòng và hoàn 100% tiền cược nếu quá 3 phút mà ván chưa bắt đầu; `refundOnTimeout` sau 60 phút làm lưới an toàn.
- Khác với kế hoạch ban đầu (có trừ phí nhỏ chống spam): hiện hoàn 100% không phí. Cần quyết định có thêm phí hay không (rủi ro spam tạo phòng).
- Hạn chế đã biết: điều kiện chỉ dựa thời gian, xem Q9.

### D10: Telemetry và đồng hồ — `Accepted` (Q10)
- **Hiện trạng cập nhật (fda0f5e):** `useFairPlayGuard` phát hiện rời màn hình quá 2 giây và gửi cảnh báo; Relay broadcast cảnh báo và đếm vi phạm cho đối thủ thấy, **tuyệt đối không trừ giờ đồng hồ và không xử thua kỹ thuật**.
- **Lý do:** Tuân thủ triệt để nguyên lý "Pure FIDE Core", tránh việc phạt oan do telemetry client không thể kiểm chứng mật mã học, và đảm bảo ván cờ FIDE diễn ra thuần túy theo kỹ năng trên bàn cờ.

### D11: Khóa Relay và Arbiter, Pausable — `Accepted` (f925d42, 26e184a)
- Đã tách riêng biến `arbiter` khỏi `relaySigner` trong `ChessEscrow.sol`. Cả hai đều thay đổi qua timelock 2 ngày và phát event.
- Xóa hoàn toàn private key hardcode trong mã nguồn Relay; bắt buộc nạp qua biến môi trường `RELAY_PRIVATE_KEY` hoặc dừng server với lỗi rõ ràng.
- Tích hợp OpenZeppelin `Pausable` vào `ChessEscrow.sol`: khi tạm dừng chỉ chặn `createRoom`/`joinRoom`; các luồng rút tiền, hoàn tiền, abort, claim hoàn toàn không bị ảnh hưởng, đảm bảo không bao giờ kẹt tiền người chơi.
- Giữ trần cược 1 AVAX trong giai đoạn testnet.

### D12: Quy tắc ELO và Season Points — `Accepted` (hiện trạng) với hạn chế
- ELO khởi đầu 1200. `Δ = 24 >> min(matchesToday, 4)`, với `matchesToday` tính theo `pairId = keccak256(min(A,B), max(A,B), currentDay)`.
- Season Points: +15/ván thắng cho người tham gia Vault.
- **Ràng buộc cược tối thiểu (MIN_STAKE):** Chỉ tính ELO và Season Points cho các ván đấu có mức cược $\ge 0.01$ AVAX (`MIN_STAKE = 0.01 ether`). Điều kiện này được bảo đảm trực tiếp và triệt để bởi `ChessEscrow.createRoom` (revert `StakeTooLow` nếu stake < MIN_STAKE), triệt tiêu hành vi tạo phòng cược 0 đồng hoặc cược vi mô để cày điểm.
- Hạn chế: chỉ chặn được cặp ví cố định, chưa chống Sybil nhiều ví; mức thay đổi cố định, chưa phụ thuộc chênh lệch ELO; Season Points chưa có giảm dần. Xem kế hoạch G7.

### D13: Khóa cược Spectator theo cửa sổ ngắn — `Proposed` (đề xuất sửa Q4)
- Gọi `registerMatch` ngay tại `joinRoom`; khóa cược sau một cửa sổ ngắn (đề xuất 60-120 giây hoặc khi `confirmStart`), khi khán giả đã biết đối thủ, màu quân và ELO nhưng chưa có thế cờ để chạy engine.
- Khi `claim`, cược của địa chỉ trùng với hai người chơi bị vô hiệu và hoàn tiền.
- Cân nhắc trần tổng cược khán giả theo tiền cược của hai người chơi.
- **Đánh đổi:** cửa sổ ngắn vẫn có khe hở rất nhỏ; đổi lại thị trường có ý nghĩa hơn và chặn được tự cược.

### D14: Thanh toán Escrow và Meta — Đề xuất, đã triển khai
- **Mục tiêu:** Phân định rõ ràng trách nhiệm giữa việc xác lập điều kiện thi đấu và quá trình thanh toán sau trận.
- **Giải pháp triển khai thực tế (Lượt 2B):**
  - **Fail-Fast tại `joinRoom`:** `registerMatch` và `lockBetting` KHÔNG được nuốt lỗi; nếu Meta lỗi hoặc revert thì `joinRoom` phải revert ngay lập tức (khi `metaContract != address(0)`), bảo đảm tuyệt đối rằng trận đấu không bao giờ kích hoạt khi chưa đăng ký kỳ thủ hoặc chưa khóa thị trường cược khán giả.
  - **Cô lập lỗi tại các hàm hậu kỳ:** Tại các hàm phân phối/hủy ván đấu (`submitResult`, `finalizeSingleSigned`, `resolveChallenge`, `resolveDefaultChallenge`, `abortRoom`, `refundOnTimeout`), các lời gọi sang Meta (`updateEloOnSettle`, `resolvePrediction`, `cancelPrediction`) được bọc `try/catch`. Khi Meta revert, Escrow phát sự kiện `MetaCallFailed(roomId, selector)` để giám sát nhưng giải ngân/hoàn cược cho hai kỳ thủ vẫn thành công 100%.
- **Bảo vệ quyền lợi khán giả khi `resolvePrediction` thất bại:**
  - Escrow ghi nhận trạng thái lỗi: `metaResolutionFailed[roomId] = true` và `metaWinningOption[roomId] = option`.
  - Hỗ trợ các lối thoát an toàn:
    1. `retryResolvePrediction(roomId)`: Cho phép gọi lại giải ngân phần thưởng theo đúng kết quả khi Meta hoạt động lại bình thường.
    2. `fallbackCancelPrediction(roomId)`: Hủy pool dự đoán để 100% khán giả rút lại tiền cược gốc qua `claimSpectatorRefund(roomId)`.
    3. **Hoàn tiền độc lập sau 7 ngày (`MAX_UNRESOLVED`):** Khán giả có thể tự gọi `claimSpectatorRefund(roomId)` trên `AvaClashMeta.sol` sau 7 ngày nếu pool chưa được xử lý mà không cần phụ thuộc vào Escrow.