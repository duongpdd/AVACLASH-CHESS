# Nghiệm thu bổ sung — 01/11/2026

Thực hiện theo yêu cầu kiểm tra và làm các bước sau rà soát. Có nhiều thay đổi từ lượt trước trong cùng worktree; không reset hoặc ghi nhận chúng là thay đổi riêng của lượt này. Báo cáo này cập nhật trạng thái hiện tại, thay cho các mục tương ứng còn thiếu trong REVIEW_2026-11-01.md.

## Đã thực hiện

| Nhóm             | Kết quả và bằng chứng                                                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PvP hai ví local | Chiến dịch 20 trận Node/Anvil riêng, WebSocket thật, cả hai màu, chiếu hết/đầu hàng/hòa; kiểm tra payout và số dư thực sau gas. Reconnect nhận lại transcript. [Receipt, hash và số đo](benchmarks/local-campaign.json).            |
| Gián đoạn        | Các test relay/web kiểm reload sau kết thúc, timeout, mất mạng, restart, RPC hỏng, từ chối ký, tab thay ghế, đổi phòng/ví, hoàn tiền và terminal durability.                                                                        |
| Ví / chain       | Đồng bộ ETH trên Anvil, AVAX trên Fuji, lỗi và số dư theo chain mục tiêu; hướng dẫn RPC dùng cấu hình thực, nút rút chặn sai mạng.                                                                                                  |
| Join             | V2 bind chain, Escrow và origin; client từ chối cấu hình sai trước ký, server chỉ xác minh v2. Hạn ký 60 giây, ngừng retry khi từ chối/hết hạn/trùng tab. Result v2 và lõi cờ không đổi.                                            |
| Hot-seat         | Trang /hotseat 5+0 không cần ví, đi cả hai bên, SAN, hòa/đầu hàng, ván mới, promotion qua Phaser. Đồng hồ cập nhật trước nước đi để không nhận nước sau hết giờ giữa hai tick. Đã dùng UI trình duyệt đi e4/e5 và thấy đổi lượt.    |
| Vault / rewards  | UI gửi/rút principal, đọc điểm; chi thưởng Merkle Q30, quỹ tài trợ, reserve, notice, proof, một lần/ví, hết hạn trả pool; UI kiểm file và root/hash on-chain. Không hứa sinh lãi.                                                   |
| Spectator        | Thêm gate hợp đồng mặc định tắt; không chặn claim/refund khoản cũ. Không mở UI cược khi rủi ro thông đồng còn tồn tại.                                                                                                              |
| Vận hành         | /healthz, /readyz, kiểm phụ thuộc trước khi listen, snapshot khi shutdown; script backup/restore hash; Anvil state 5 giây và thư mục relay riêng cho chain mới.                                                                     |
| Đo lường         | [Gas](benchmarks/gas-summary.md), [bảng Foundry](benchmarks/contracts-gas.txt), latency local 106 mẫu, [FPS trình duyệt](benchmarks/browser-fps.json), [môi trường](benchmarks/environment.json). Không quy số local thành số Fuji. |
| Triển khai / CI  | Script preflight Fuji, dry-run/deploy guard Anvil/Fuji, env mẫu công khai, hướng dẫn keystore/WSS/roles, workflow CI. Chưa xác nhận workflow trên GitHub.                                                                           |
| Chuẩn bị audit   | [Phạm vi và rủi ro còn lại](SECURITY_REVIEW_SCOPE.md), manifest hash source. Đây là rà soát nội bộ, chưa phải audit độc lập.                                                                                                        |

Trong chiến dịch nhiều trận, đã tái hiện Anvil ngừng phản hồi do pipe stdout/stderr của helper không được đọc và đầy buffer; đổi helper sang stdio ignore rồi 20/20 trận hoàn tất. Không tăng timeout để tuyên bố đạt; receipt hiện có giới hạn chờ rõ ràng. Test/benchmark chạy bằng ví kiểm thử riêng, không ký thay hai ví MetaMask của người dùng.

## Kiểm tra cuối

| Bộ                                  |     Kết quả |
| ----------------------------------- | ----------: |
| Shared                              |     133 đạt |
| Relay chính, gồm campaign/readiness |      64 đạt |
| Web, gồm Hot-seat/Vault/claims      |     136 đạt |
| Foundry unit/fuzz/invariant         |     175 đạt |
| Công cụ rewards/backup              |       2 đạt |
| Tổng                                | **510 đạt** |

TypeScript shared/relay/web, ESLint web, diff whitespace và Next production build đạt. Route build có `/`, `/game`, `/hotseat`. Các lỗi RPC/ghi đĩa được mô phỏng có log cảnh báo theo test; không bỏ qua test chính thất bại. Hợp đồng được đo gas với Solidity 0.8.24, optimizer 200, via_ir. Các PoC audit cục bộ vẫn được giữ riêng như ghi chú báo cáo trước.

## Cần tiếp tục khi đủ điều kiện

- **Fuji:** [preflight](benchmarks/fuji-preflight.json) xác nhận RPC chain 43113, thiếu các địa chỉ vai trò/keystore và gas testnet. Người dùng xác nhận chưa có; chưa broadcast hoặc chơi 20 trận Fuji. Làm theo [FUJI_DEPLOY.md](FUJI_DEPLOY.md).
- **Hai ví trình duyệt:** chủ ví vẫn cần tự ký Join/Result và xác nhận giao dịch trên hai profile. Chiến dịch Node không thay thế nghiệm thu MetaMask thật.
- **Yield:** chưa có nhà cung cấp/đặc tả rủi ro được chọn; Vault chỉ giữ principal. Không tự gửi principal sang giao thức bên thứ ba.
- **Bảo mật / kinh tế:** audit độc lập, chống Sybil/thông đồng, chính sách phân bổ thưởng thật và hạ tầng backup ngoài máy chưa hoàn tất. Giới hạn được ghi trong SECURITY_REVIEW_SCOPE.md.

## Phiên local đang chạy

Web production `http://127.0.0.1:3000`, relay ở cổng 8080, Anvil cổng 8545. Khi bắt đầu lượt này, các listener cũ đã dừng và không có state dump cũ, nên đã dựng phiên Anvil mới; **không phục hồi được phòng #6 cũ từ log relay**. Từ phiên này đã bật lưu state để chạy lại. Hai địa chỉ người dùng đã cung cấp được cấp lại 10 ETH local nếu số dư bằng 0; không gửi tài sản trên mạng công khai. Các trận benchmark nằm trên Anvil riêng và không xuất hiện trong lobby của phiên này.

Thông số mạng/nội dung hướng dẫn Fuji đối chiếu nguồn chính thức trong FUJI_DEPLOY.md. Chưa deploy Fuji/mainnet, chưa trả phí cho bên thứ ba và chưa liên hệ người khác thay người dùng.
