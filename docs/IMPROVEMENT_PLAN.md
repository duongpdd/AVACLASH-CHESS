# Kế hoạch Cải tiến Kinh tế & An ninh On-chain — AvaClash Chess

> **Phiên bản:** 2.1 | **Cập nhật:** 26/10/2026 | **Căn cứ:** `PROGRESS.md` v26/10, `ARCHITECTURE.md` v1.3.0, `DECISIONS.md`
> **Trạng thái:** Toàn bộ hạng mục P0 của Lượt 2c đã triển khai và kiểm thử (235/235 tests xanh). Còn **G2 (`abortRoom` thiếu `signalGameStarted`)** và **G3/B3 (cửa sổ cược khán giả)** cần xử lý trước khi deploy Fuji.
> **CẢNH BÁO DEPLOY:** Hệ thống **KHÔNG ĐƯỢC DEPLOY** lên Fuji/Mainnet cho đến khi thiết kế và cơ chế GameStart (G2) hoàn tất.

---

## 1. Mục tiêu

1. Vá các lỗ hổng thiết kế của `ChessEscrow.sol` và `AvaClashMeta.sol` **trước khi deploy lên Fuji**.
2. Giữ nguyên triết lý **"Pure FIDE Core + Web3 Meta Layer"**: không sửa luật cờ, mọi thay đổi nằm ở tầng hợp đồng, relay và meta.
3. Chuẩn bị nền tảng sạch cho audit ở Phase 6.

**Ưu tiên:** `P0` = bắt buộc trước khi deploy Fuji | `P1` = nên làm trước audit | `P2` = cải tiến sau.
**Kích thước:** `S` ≤ 1 ngày | `M` 2-4 ngày | `L` > 4 ngày (ước lượng thô).
**Trạng thái:** ✅ Xong | 🟡 Xong một phần / có sai lệch | ⬜ Chưa làm | 🆕 Mới phát hiện.

> **Quy ước mã:** mã hạng mục kế hoạch (A1, B3, G1...) khác với mã quyết định trong `DECISIONS.md` (Q1-Q14, D1-D14). Bảng ở mục 6 ánh xạ giữa hai bên.

---

## 2. Bảng trạng thái tổng hợp

| Mã | Hạng mục | Ưu tiên | Trạng thái | Ghi chú |
| :-- | :-- | :-: | :-: | :-- |
| A1 | Mở rộng struct `Result` | P0 | ✅ | ADR D7. Domain EIP-712 nâng lên `version="2"` đồng bộ (G12). Test chéo Viem ↔ Foundry sinh ngẫu nhiên |
| A2 | Chữ ký 2-trong-3 (A, B, Relay) | P0 | ✅ | Khóa Relay & Arbiter tách rời, cô lập claim đơn lẻ và nonce theo người nộp `usedNonces[roomId][msg.sender][nonce]` |
| A3 | Challenge có bond + arbiter | P0 | ✅ | Q11: Submitter nộp bond bằng bond challenge; resolveChallenge xử lý slashing/refund đầy đủ; nhánh mặc định 24h hoàn 100% bond người nộp, chia 50/50 bond challenger (Q8 - residual risk) |
| A4 | `abortRoom` + timeout đầu ván | P0 | 🟡 | Đã chặn khi `singleSignedAt != 0`. Tuy nhiên vẫn thiếu `signalGameStarted` (G2) - **Chặn Deploy** |
| A5 | Chọn màu công bằng | P1 | ✅ | Q13: Người tạo chọn `creatorIsWhite`, lưu on-chain, Relay đọc chain gán màu, UI hiển thị trước khi stake (Q3/D5 superseded) |
| B1 | Tách Spectator Pool | P0 | ✅ | 1 market (Trắng/Đen/Hòa). Cược gross, phí 5% vào `seasonPrizePool` khi resolve. Hoàn 100% gross khi hủy/pool thắng = 0 |
| B2 | Chống tự cược | P1 | 🟡 | `registerMatch` và `lockBetting` chạy tại `joinRoom` (Fail-Fast: revert nếu Meta lỗi). Khán giả chưa cược được trước |
| B3 | Khóa cược sớm | P0 | 🟡 | Đã khóa ở `joinRoom` (Fail-Fast D14), nhưng làm yếu giá trị thị trường (G3) |
| B4 | Cửa "Under 40 moves" | P1 | ✅ | Bỏ hẳn ở Fuji (Q5) |
| B5 | Hoàn tiền cược khi hòa/hủy | P0 | ✅ | `cancelPrediction`, `claimSpectatorRefund` (kể cả nhánh thắng có pool = 0 và độc lập sau 7 ngày) |
| C1 | Chống Sybil ELO | P1 | 🟡 | Đã bắt buộc `MIN_STAKE = 0.01 ether` (Q14) và `pairId` theo cặp ví. Chưa có provisional, trần ngày (G7) |
| C2 | Giới hạn chênh ELO khi bắt cặp | P2 | ⬜ | |
| D1 | Gasless | P2 | ⬜ | |
| D2 | Bậc cược cố định, phòng riêng | P1 | ⬜ | Chưa thấy trong tài liệu |
| D3 | USDC | P2 | ⬜ | |
| D4 | Phí giao thức | P1 | ✅ | 5% tích lũy on-chain tại `protocolFees`, rút về treasury qua `withdrawProtocolFees` (Q6) |
| D5 | Vault có yield | P2 | ⬜ | |
| E1-E3 | Hash-chain, ZK, ELO SBT | P2 | ⬜ | |
| F1 | Đồng bộ tài liệu, nối Escrow ↔ Meta | P0 | ✅ | Đã nối trong `Deploy.s.sol` (hỗ trợ Keystore). Try/catch cô lập Escrow -> Meta hậu kỳ, fail-fast tại joinRoom |
| F2 | Rà soát pháp lý | P1 | ⬜ | |
| G1 | Challenge nhánh mặc định | P0 | ✅ | Q11 + Q8 (residual risk): Submitter bond bảo vệ claim; số liệu payoff đã đo lường và ghi vào DECISIONS.md |
| G4 | Telemetry chỉ cảnh báo | P0 | ✅ | Bỏ trừ giờ & forfeit, chỉ broadcast cảnh báo (Q10/D10) |
| G5 | Tách Arbiter & Pausable | P0 | ✅ | Constructor & Deployer tách riêng 3 địa chỉ, Timelock 2 ngày riêng biệt, Pausable không kẹt tiền (D11) |
| G8 | Cô lập Meta & Winner consistency | P0 | ✅ | Fail-Fast tại `joinRoom`; G8a Try/catch hậu kỳ + spectator recovery; G8b outcome/winner match theo màu (Q13) |
| G10 | Test cho Relay | P1 | ✅ | 11 tests Vitest: EIP-712 join auth, on-chain check fail-closed, single socket/seat, rate limit, maxPayload |
| G12 | Đồng bộ tài liệu & EIP-712 v2 | P0 | ✅ | Domain version "2", ADR Q1-Q14, D1-D14 |
| G14 | Xóa khóa hardcode | P0 | ✅ | Bắt buộc đọc từ biến môi trường, sinh ngẫu nhiên khi test |

---

## 3. Hạng mục đã triển khai (tóm tắt, cần xác nhận bằng code)

- **A1:** Struct `Result(matchId, winner, outcome, reason, moveCount, movesHash, nonce, deadline)`; enum `OutcomeCode` 0-2, `ReasonCode` 0-7; hòa hoàn 100% cho cả hai (Q1); EIP-712 domain `version="2"`. Bộ test chéo chữ ký sinh ngẫu nhiên từ Viem TypeScript và nạp xác thực trong Foundry.
- **A2:** `submitResult` chấp nhận 2-trong-3 (A+B hoặc Winner+Relay); không dùng nonce toàn phòng. `submitSingleSigned` + cửa sổ 10 phút làm đường dự phòng: chỉ chấp nhận claim đầu tiên (`singleSignedAt == 0`), claim sau revert, chặn gọi sau khi hết hạn; nonce cô lập theo `usedNonces[roomId][msg.sender][nonce]`.
- **A3:** Bond challenge 20% (tối thiểu 0.01 AVAX), arbiter truyền riêng trong constructor tách khỏi RelaySigner với timelock 2 ngày, kết cục mặc định 24h phạt 50% bond bên khiếu nại chuyển cho bên nộp đơn (Q8).
- **A4:** `abortRoom` sau 3 phút nếu chưa bắt đầu; `refundOnTimeout` 60 phút.
- **B (Spectator):** 1 market 3 cửa; khóa tại `joinRoom` (Fail-Fast nếu Meta lỗi); cược lưu gross; trích 5% phí khi resolve nạp `seasonPrizePool`; tự động hủy hoàn 100% gross nếu pool cửa thắng = 0; đường hoàn tiền độc lập sau 7 ngày (`claimSpectatorRefund`).
- **C & D12:** Bắt buộc `MIN_STAKE = 0.01 ether` tại `createRoom` (revert `StakeTooLow`); chỉ tính ELO và Season Points cho các ván đấu cược $\ge 0.01$ AVAX.
- **D4:** Phí 5% trên pot khi có người thắng tích lũy tại `protocolFees`, rút về treasury qua `withdrawProtocolFees`; miễn khi hòa/hoàn tiền (Q6).
- **F1:** `Deploy.s.sol` đọc bắt buộc 3 địa chỉ riêng biệt `RELAY_SIGNER_ADDRESS`, `ARBITER_ADDRESS`, `TREASURY_ADDRESS`, hỗ trợ deploy an toàn qua Foundry Keystore (`--account`).
- **Relay (`packages/relay`):** đồng hồ, đồng ký 2-trong-3, telemetry chỉ cảnh báo không phạt giờ (Q10), không còn khóa hardcode (G14).
- **Kiểm thử:** 224 test xanh 100% (95 shared, 7 relay, 17 web, 76 escrow, 18 meta, 3 tích hợp, 8 try/catch).

---

## 4. Nhóm G — Lỗ hổng & việc còn tồn (🆕)

### G1. Challenge: nhánh mặc định cho phép "hòa vốn" — P0, M — ✅ Đã xử lý (a89ef44)

**Vấn đề:** Khi Relay offline, bên thua chỉ cần từ chối ký, `challenge`, rồi chờ arbiter không phản hồi 24h. Nhánh `resolveDefaultChallenge` hoàn 100% cược **và hoàn bond**, nên bên thua biến "thua" thành "hòa vốn" mà không mất gì (ngoài gas). Bảng an ninh cũng tự mâu thuẫn: một dòng ghi "bond bị tịch thu", dòng khác ghi "hoàn bond".

**Công việc:**
- [x] Chốt quyết định Q8 (mục 6): phạt 50% bond của bên khiếu nại chuyển cho bên nộp đơn, 50% còn lại hoàn cho bên khiếu nại.
- [x] Sửa Escrow và bảng an ninh trong `ARCHITECTURE.md` cho nhất quán.
- [x] Test: bên thua challenge + arbiter im lặng → bên thua chịu phạt ròng 10% tiền cược (50% bond) và bên nộp đơn nhận bồi thường. Test bảo toàn 100% tổng quỹ on-chain.

### G2. `abortRoom` có thể bị dùng để thoát ván đang thua — P0, M

**Vấn đề:** Contract không thấy nước đi. Nếu điều kiện `abortRoom` chỉ là thời gian kể từ `joinRoom`, người sắp thua ván 5+0 có thể hủy giữa ván và lấy lại tiền.

**Công việc:**
- [ ] Relay ký một tín hiệu EIP-712 "ván đã bắt đầu" (gồm `roomId`, thời điểm bắt đầu), người chơi nộp `confirmStart` (hoặc Relay nộp hộ) khi nước đi đầu tiên được thực hiện.
- [ ] Sau `confirmStart`, `abortRoom` bị cấm; trước đó vẫn cho phép sau 3 phút.
- [ ] Nếu Relay offline và không ai xác nhận được: giữ `refundOnTimeout` 60 phút làm lưới an toàn, ghi rõ đánh đổi trong ADR.
- [ ] Test: abort sau `confirmStart` bị từ chối; abort khi chưa ai đi nước nào thành công.

### G3. Khóa cược sớm làm thị trường mất ý nghĩa + lỗ hổng tự cược — P0, M

**Vấn đề:**
- Khóa tại `joinRoom` (Q4) khiến khán giả phải cược khi chưa biết đối thủ, và màu quân do Relay quyết định sau đó (Q3), nên "Trắng thắng" gần như cược theo màu ngẫu nhiên.
- `registerMatch` và `lockBetting` chạy cùng lúc nên người chơi cược trước khi vào phòng không bị chặn.

**Công việc:**
- [ ] Gọi `registerMatch` **ngay tại `joinRoom`**; khóa cược sau một **cửa sổ ngắn** (đề xuất 60-120 giây hoặc khi `confirmStart`), lúc khán giả đã thấy đối thủ, màu và ELO nhưng chưa có thế cờ để chạy engine.
- [ ] Khi `claim`, vô hiệu (hoàn tiền) mọi cược của địa chỉ trùng với hai người chơi.
- [ ] Cân nhắc trần tổng cược khán giả theo tiền cược của hai người chơi.
- [ ] Cập nhật Q4 thành quyết định mới (D13 trong `DECISIONS.md`), sửa UI đếm ngược.

### G4. Phạt đồng hồ theo telemetry — P0, S — ✅ Đã xử lý (fda0f5e)

**Vấn đề:** Relay trừ giờ khi người chơi vi phạm telemetry (theo `PROGRESS.md`/sơ đồ Relay), trong khi `ARCHITECTURE.md` mục 7 mô tả telemetry chỉ là cảnh báo. Telemetry do client tự báo (kẻ gian không gửi, người ngay có thể bị phạt oan do popup), và hết giờ quyết định thắng thua có tiền thật. Cơ chế này cũng đi ngược nguyên lý "Pure FIDE Core".

**Công việc:**
- [x] Ở bản Fuji: chỉ **hiển thị cảnh báo**, tắt việc trừ giờ và tắt xử thua kỹ thuật (quyết định D10/Q10).
- [x] Giữ broadcast gói tin cảnh báo và đếm vi phạm cho đối thủ xem.
- [x] Đồng bộ mục 7 `ARCHITECTURE.md` và kiểm thử Relay.

### G5. An ninh khóa Relay & vận hành — P0, M — ✅ Đã xử lý (f925d42, 26e184a)

**Vấn đề:** Lộ khóa Relay cho phép tạo chữ ký "thắng" giả cho các phòng đang chạy. Relay còn vừa ký kết quả vừa là arbiter.

**Công việc:**
- [x] Tách khóa `relaySigner` và `arbiter` trong `ChessEscrow.sol`; mỗi bên có timelock 2 ngày riêng biệt.
- [x] Xóa hoàn toàn khóa hardcode trong mã nguồn Relay; đọc từ biến môi trường, báo lỗi nếu thiếu (G14).
- [x] Thêm `Pausable` (khi tạm dừng vẫn cho phép hoàn tiền/rút tiền/abort/claim, chỉ chặn `createRoom`/`joinRoom`).
- [x] Giữ trần cược thấp (1 AVAX) trong giai đoạn testnet.
- [x] Viết test kiểm tra arbiter độc lập và pause không gây kẹt tiền.

### G6. Thông đồng qua cửa Hòa — P1, S

**Vấn đề:** Hai người chơi hẹn hòa ngay (`reason=Agreement`, 0 phí), ví phụ cược cửa Hòa. Bỏ "Under 40" không chặn được kiểu này (resign sớm cũng tương tự). Mục "Hai kỳ thủ bắt tay" trong bảng an ninh đang nói quá.

**Công việc:**
- [ ] Vì `moveCount` đã nằm trong chữ ký, Meta hủy dự đoán và hoàn tiền nếu `moveCount` dưới ngưỡng (đề xuất 20 half-moves).
- [ ] Giới hạn tổng cược khán giả theo tiền cược hai người chơi.
- [ ] Sửa lại câu chữ trong bảng an ninh cho đúng mức độ bảo vệ.

### G7. Chống Sybil chưa đủ & Season Points — P1, M

**Vấn đề:** `pairId` chỉ chặn cùng một cặp ví. `Season Points +15` cố định chưa có giảm dần, trong khi quỹ mùa giải là tiền thật. `Δ = 24 >> n` là mức cố định, chưa phụ thuộc chênh lệch ELO. Tài liệu viết "triệt tiêu động lực" là quá lời.

**Công việc:**
- [ ] Áp dụng decay `pairId` cho cả Season Points.
- [ ] Trần Season Points/ELO tối đa mỗi ngày cho mỗi ví.
- [ ] Mức cược tối thiểu để được tính ELO/điểm mùa (ván cược quá nhỏ không được tính).
- [ ] Giai đoạn provisional cho ví mới.
- [ ] Cân nhắc công thức ELO có xét chênh lệch điểm.
- [ ] Sửa câu chữ "triệt tiêu" trong `ARCHITECTURE.md`.

### G8. Escrow gọi Meta không được làm kẹt tiền — P0, S — ✅ Đã xử lý (c404574, 2c163c0)

**Công việc:**
- [x] Các lời gọi Escrow → Meta (`updateEloOnSettle`, `resolvePrediction`, `cancelPrediction`, `registerMatch`, `lockBetting`) bọc `try/catch`, phát event `MetaCallFailed(roomId, selector)` để Meta revert **không** chặn thanh toán/hoàn tiền (G8a).
- [x] Thêm cơ chế bảo vệ tiền khán giả: `retryResolvePrediction(roomId)` và `fallbackCancelPrediction(roomId)`.
- [x] Test với một Meta mock luôn revert: settle, abort, refund của người chơi vẫn thành công (5 tests passing).
- [x] Ràng buộc tính nhất quán winner/outcome (G8b): Outcome Draw <=> winner == address(0); Winner phải thuộc {playerA, playerB} khi không hòa (5 tests negative passing).

### G9. Checklist trước khi deploy Fuji — P0, S

- [ ] Dùng ví testnet riêng (faucet), **không gửi private key qua chat**; nạp qua biến môi trường hoặc `cast wallet import`.
- [ ] Sau deploy: kiểm tra `owner`, `relaySigner` ≠ `arbiter`, `treasury`, liên kết hai chiều Escrow ↔ Meta.
- [ ] Relay và client dùng domain EIP-712 với địa chỉ Escrow mới và `chainId` 43113.
- [ ] Verify source trên Snowtrace.
- [ ] Chạy thử end-to-end 1 ván thật: tạo phòng, vào phòng, chơi, ký, rút tiền; thử riêng nhánh hòa, abort, challenge.

### G10. Bổ sung test cho Relay — P1, M

Relay giữ khóa ký, đồng hồ và seed màu:
- [ ] Relay khởi động lại giữa ván.
- [ ] Ký sai `chainId`/`verifyingContract` bị Escrow từ chối.
- [ ] Ký kết quả hòa (không có "người thắng" cho cơ chế Winner + Relay).
- [ ] Một ví mở hai kết nối; ngắt kết nối rồi vào lại.
- [ ] Invariant: tổng tiền vào = tổng ra + số dư chờ rút + phí.

### G11. Hoàn thiện kết nối ví & sơ đồ — P1, M

- [ ] Nối nút "Create Room"/"Join Room" với contract bằng Wagmi hooks.
- [ ] Ghi rõ tình trạng Wagmi/RainbowKit Connector (đã làm hay bỏ): hiện biến mất khỏi cả danh sách đã xong lẫn còn lại.
- [ ] Sửa sơ đồ 4.1: A không mặc định là White ngay từ `createRoom`; màu do seed Relay ký (Q3).
- [ ] Hạ trạng thái Phase 5 về mức thực tế (chưa deploy, chưa nối ví, chưa chạy end-to-end) và bỏ cụm "Phase 5 Completed" khỏi tiêu đề kiến trúc.

### G12. Đồng bộ tài liệu & EIP-712 v2 — P0, S — ✅ Đã xử lý (c679b5f)

- [x] `Q6`: thống nhất phí 5% đi vào `treasury` thông qua `withdrawProtocolFees`, sau đó Treasury cấp vốn cho quỹ mùa giải.
- [x] Nâng domain EIP-712 lên `version="2"` đồng bộ trong `ChessEscrow.sol`, `packages/shared`, Relay và Web. Thêm test chéo TS <-> Solidity.
- [x] Mục 7 `ARCHITECTURE.md` khớp với quyết định D10/Q10 (chỉ cảnh báo, không trừ giờ).
- [x] Cập nhật `ARCHITECTURE.md` trích dẫn bộ ADR hoàn chỉnh "Q1-Q10, D1-D14".
- [x] Cập nhật bảng test trong `PROGRESS.md` đạt mốc chuẩn 211 tests xanh 100%.

### G14. Loại bỏ khóa hardcode trong repo — P0, S — ✅ Đã xử lý (26e184a)

- [x] Xóa private key mặc định trong `packages/relay/src/RelayServer.ts` và `index.ts`.
- [x] Bắt buộc nạp qua biến môi trường `RELAY_PRIVATE_KEY`; ném lỗi và dừng server nếu thiếu.
- [x] Cập nhật test relay tự sinh khóa ngẫu nhiên bằng `generatePrivateKey()`.
- [x] Tạo file `.env.example` mẫu không chứa khóa thật.

---

## 5. Hạng mục còn lại (không đổi so với kế hoạch trước)

- **C1/G7:** chống Sybil ELO. **C2:** giới hạn chênh ELO khi bắt cặp (P2).
- **D2 (P1):** bậc cược cố định 0.01 / 0.05 / 0.1 / 0.5 / 1 AVAX, phòng riêng bằng link mời.
- **D1, D3, D5 (P2):** gasless, USDC, Vault có yield. D5 cần khảo sát giao thức và thông số hiện tại trước khi quyết định (chưa xác minh).
- **E1-E3 (P2):** chuỗi nước đi ký từng bước, ZK proof của replay, ELO soulbound token.
- **F2 (P1):** tham khảo ý kiến pháp lý về cược tiền trong game (quy định khác nhau theo quốc gia, kể cả Việt Nam), cân nhắc chặn theo vùng.

---

## 6. Quyết định & ánh xạ với `DECISIONS.md`

| Quyết định | Nội dung | Trạng thái | ADR |
| :-- | :-- | :-: | :-- |
| Q1 | Hòa hoàn 100% cả hai | ✅ Đã chốt | Q1 |
| Q2 | Arbiter/Relay có timelock, mặc định hoàn tiền sau 24h | ✅ Đã chốt | Q2 |
| Q3 | Màu do seed Relay ký | ❌ Superseded | Superseded bởi Q13 |
| Q4 | Khóa cược tại `joinRoom` | 🟡 Đề xuất sửa: khóa sau cửa sổ ngắn | Q4 → D13 |
| Q5 | Bỏ "Under 40 moves" ở Fuji | ✅ Đã chốt | Q5 |
| Q6 | Phí 5% vào Treasury | ✅ Đã chốt | Q6 |
| Q7 | Bond 20%, tối thiểu 0.01 AVAX | ✅ Đã chốt | Q7 |
| Q8 | Xử lý bond ở nhánh mặc định 24h: phạt 50% chuyển bên nộp đơn | ✅ Accepted with residual risk | Q8 |
| Q9 | Tín hiệu `confirmStart` do Relay ký | ⬜ **Cần chốt (G2 - Chặn Deploy)** | Q9 (hiện trạng: D9) |
| Q10 | Telemetry chỉ cảnh báo, không trừ giờ ở Fuji | ✅ Accepted | Q10 (chi tiết: D10) |
| Q11 | Submitter Bond bằng Challenge Bond, hoàn/phạt theo kết quả arbiter | ✅ Accepted & đã triển khai | Q11 |
| Q12 | Cơ chế chi trả `seasonPrizePool` | ⬜ Open (chưa làm ở lượt này) | Q12 |
| Q13 | Màu do người tạo chọn qua `createRoom(bool)`, lưu on-chain | ✅ Accepted & đã triển khai | Q13 (thay Q3/D5) |
| Q14 | `MIN_STAKE = 0.01 ether` trong `createRoom` | ✅ Accepted & đã triển khai | Q14 |
| — | Khóa Relay/Arbiter tách rời, `Pausable` | ✅ Đã chốt | D11 |
| — | Escrow độc lập với Meta (Fail-fast joinRoom, try/catch hậu kỳ, Spectator recovery) | 🟡 Đề xuất, đã triển khai | D14 |

> [!WARNING]
> **Rủi ro còn lại của Q8 (Payoff comparison):** Sau khi có Submitter Bond (Q11), bên thua challenge và arbiter im lặng vẫn thu hồi được 90% cược (chỉ mất 10% phạt bond ròng). Đây là rủi ro tồn đọng được chấp nhận cho Fuji, sẽ giải quyết triệt để ở Mainnet bằng chuỗi nước đi có chữ ký (E1).

---

## 7. Lộ trình cập nhật

### Giai đoạn A — Trước khi deploy Fuji (P0)
1. Chốt Q8, Q9, Q10 và sửa Q4 → viết/cập nhật ADR.
2. G1, G2, G3, G4, G5, G8 (sửa contract/relay, thêm test).
3. G12 (đồng bộ tài liệu), G9 (checklist deploy).

### Giai đoạn B — Deploy & kiểm thử thực tế
1. G11: nối ví, chạy end-to-end trên Fuji.
2. G10: bổ sung test cho Relay, invariant test.

### Giai đoạn C — Trước audit
1. G6, G7, D2, F2.
2. Đóng băng thiết kế, gửi audit (Phase 6).

### Giai đoạn D — Sau audit
- C2, D1, D3, D5, E1-E3.

---

## 8. Yêu cầu kiểm thử bổ sung

- **Invariant (Foundry):** tổng tiền vào = tổng tiền ra + số dư chờ rút + phí, ở mọi trạng thái Escrow và các pool.
- **Test chéo TS ↔ Solidity** cho struct `Result` và `movesHash` (kể cả domain `version`).
- **Fuzz** thời gian (abort, timeout, challenge window) và mức cược.
- **Kịch bản tấn công:** reentrancy qua `withdraw`/`claim*`, replay chữ ký giữa các phòng, Relay ký sai, challenge spam, tự cược qua ví phụ, abort giữa ván, Meta revert, thông đồng hòa.
- Cập nhật bảng Metrics trong `PROGRESS.md` sau mỗi nhóm.

---

## 9. Rủi ro & ghi chú

- **Phụ thuộc Relay:** 2-trong-3 tăng tốc độ nhưng thêm điểm tin cậy; phải giữ đường dự phòng không cần Relay và quy trình bảo vệ khóa (G5).
- **Độ tin cậy của trạng thái:** cột trạng thái ở mục 2 chưa được kiểm chứng bằng code. Nên chạy lại bộ test và review contract trước khi coi là hoàn tất.
- **Audit:** nên đóng băng các thay đổi ở mục 4 trước khi gửi audit.
- **Chưa xác minh:** các nhận định về giao thức staking/lending (D5) và quy định pháp lý (F2).