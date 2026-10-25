# Quyết định thiết kế — AvaClash Chess

> **Cập nhật:** 25/10/2026
> **Quy ước mã:** `D1-D14` và `Q1-Q10` là mã quyết định trong file này. Mã hạng mục `A1-G12` thuộc `IMPROVEMENT_PLAN.md` và là hệ mã khác (ví dụ `D4` ở đây là tooling monorepo, còn `D4` trong kế hoạch cũ là phí giao thức; phí giao thức nay là **Q6**).
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

### D5: Màu quân — `Superseded` bởi Q3
- ~~Người tạo phòng luôn là Trắng (đơn giản cho MVP).~~
- Màu hiện do seed Relay ký (xem Q3). Sơ đồ vòng đời trong `ARCHITECTURE.md` mục 4.1 cần sửa theo.

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

### Q2: Phân xử challenge — `Accepted` (chi tiết bond xem Q8)
- **Quyết định:** Arbiter/Relay có timelock, kèm kết cục mặc định (hoàn tiền cả hai) khi quá hạn phân xử.
- **Lý do:** Giải quyết vấn đề "ai quyết định" trong challenge, đảm bảo luôn có kết cục dù arbiter bất hợp tác.
- **Chi tiết:**
  - `relaySigner` / `arbiter` là địa chỉ được đăng ký trong contract, có timelock khi đổi khóa.
  - Nếu arbiter không ra phán quyết trong thời hạn (ví dụ 24h), mặc định hoàn tiền cả hai.
  - Bond bên sai: **chưa thống nhất** bên nhận (bên đúng hay quỹ mùa giải). Xem Q8.
- **Đánh đổi cần thừa nhận:** nhánh mặc định hoàn cả bond cho phép bên thua "hòa vốn" bằng cách challenge rồi chờ arbiter im lặng. Xem Q8.

### Q3: Chọn màu công bằng — `Accepted`
- **Quyết định:** Seed do Relay ký, ít vòng tương tác hơn.
- **Lý do:** Commit-reveal cần 2 vòng tương tác thêm, tốn gas. Seed Relay đơn giản hơn cho testnet.
- **Đánh đổi:** Relay trở thành bên tin cậy cho việc chọn màu (chấp nhận được vì ít ảnh hưởng tài chính).
- **Hệ quả:** màu quân chỉ biết sau khi seed được ký, nên ảnh hưởng đến thời điểm khóa cược (xem D13).

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
- **Ghi chú:** chỉ bên challenge đặt bond; bên nộp `submitSingleSigned` chưa đặt bond (xem Q8).

### Q8: Bond ở nhánh mặc định 24h — `Accepted`
- **Vấn đề trước đây:** khi arbiter quá hạn, `resolveDefaultChallenge` hoàn 100% cược và hoàn bond cho cả hai. Bên thua có thể từ chối ký, challenge, chờ 24h và hòa vốn mà không mất gì.
- **Giải pháp triển khai (a89ef44):**
  - Hoàn trả 100% tiền cược gốc cho cả hai bên.
  - Phạt 50% bond của bên khiếu nại chuyển cho bên nộp đơn (bù đắp chi phí thời gian và cơ hội), 50% bond còn lại hoàn trả cho bên khiếu nại.
  - Bên khiếu nại gian lận chịu tổn thất ròng 10% tiền cược, triệt tiêu động lực trì hoãn để "hòa vốn". Bảo toàn 100% tổng tiền on-chain.

### Q9: Tín hiệu bắt đầu ván (`confirmStart`) — `Proposed`
- **Vấn đề:** `abortRoom` chỉ dựa thời gian có thể bị dùng để thoát ván đang thua.
- **Đề xuất:** Relay ký tín hiệu EIP-712 "ván đã bắt đầu" khi có nước đi đầu tiên; sau khi được xác nhận trên chain, `abortRoom` bị cấm. Chưa xác nhận thì vẫn dùng `refundOnTimeout` 60 phút làm lưới an toàn.
- **Đánh đổi:** thêm một lời gọi on-chain và thêm phụ thuộc Relay; nếu Relay offline thì ván không xác nhận được, người chơi dùng đường refund dài.

### Q10: Telemetry chỉ cảnh báo ở Fuji — `Accepted` (chi tiết D10)
- Xem D10.

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
- Hạn chế: chỉ chặn được cặp ví cố định, chưa chống Sybil nhiều ví; mức thay đổi cố định, chưa phụ thuộc chênh lệch ELO; Season Points chưa có giảm dần. Xem kế hoạch G7.

### D13: Khóa cược Spectator theo cửa sổ ngắn — `Proposed` (đề xuất sửa Q4)
- Gọi `registerMatch` ngay tại `joinRoom`; khóa cược sau một cửa sổ ngắn (đề xuất 60-120 giây hoặc khi `confirmStart`), khi khán giả đã biết đối thủ, màu quân và ELO nhưng chưa có thế cờ để chạy engine.
- Khi `claim`, cược của địa chỉ trùng với hai người chơi bị vô hiệu và hoàn tiền.
- Cân nhắc trần tổng cược khán giả theo tiền cược của hai người chơi.
- **Đánh đổi:** cửa sổ ngắn vẫn có khe hở rất nhỏ; đổi lại thị trường có ý nghĩa hơn và chặn được tự cược.

### D14: Thanh toán Escrow độc lập với Meta — `Accepted`
- **Mục tiêu:** Các lời gọi Escrow → Meta (`updateEloOnSettle`, `resolvePrediction`, `cancelPrediction`, `registerMatch`, `lockBetting`) không được làm revert thanh toán hay hoàn tiền cược của người chơi (G8a).
- **Giải pháp triển khai:**
  - Toàn bộ lời gọi từ `ChessEscrow` sang `IAvaClashMeta` được bọc `try/catch`. Khi xảy ra lỗi hoặc Meta revert, Escrow phát sự kiện `MetaCallFailed(roomId, selector)` để giám sát.
  - Settle, abort, refund, cancel, và join room của người chơi luôn hoàn thành độc lập và không bao giờ bị kẹt tiền bởi Meta.
- **Bảo vệ quyền lợi khán giả khi `resolvePrediction` thất bại:**
  - Escrow ghi nhận trạng thái thất bại: `metaResolutionFailed[roomId] = true` và `metaWinningOption[roomId] = option`.
  - Hỗ trợ 2 đường hoàn tiền/gọi lại:
    1. `retryResolvePrediction(roomId)`: Cho phép gọi lại để giải ngân phần thưởng theo đúng kết quả trận đấu khi Meta hoạt động lại bình thường.
    2. `fallbackCancelPrediction(roomId)`: Nếu Meta vĩnh viễn không thể giải ngân kết quả, kích hoạt hủy pool dự đoán (`cancelPrediction`) để 100% khán giả có thể rút lại toàn bộ tiền cược gốc qua `claimSpectatorRefund(roomId)`.