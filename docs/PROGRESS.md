# Tiến độ AvaClash Chess

Cập nhật 01/11/2026 sau lượt hoàn thiện; xem IMPLEMENTATION_2026-11-01.md và Q30–Q32.

| Hạng mục      | Hiện trạng                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| PvP           | Có create/join, relay, SAN, đồng hồ, hòa/đầu hàng, ký/nộp Result và withdraw. Chiến dịch 20 trận Node/Anvil đã đối chiếu receipt và số dư.          |
| Relay         | Join v2 bind origin/chain/Escrow, hạn 60 giây; reconnect, recovery, terminal checkpoint; startup/readiness và lưu snapshot khi shutdown.            |
| Ví / mạng     | Nhãn ETH trên Anvil, AVAX trên Fuji; số dư theo chain mục tiêu và refresh; hiển thị lỗi nối/đổi mạng/rút tiền.                                      |
| Hot-seat      | Mở /hotseat, hai người cùng thiết bị, 5+0, SAN, promotion qua bàn cờ, hòa/đầu hàng/ván mới; kiểm tra UI trực tiếp đã đi cả hai màu.                 |
| Vault         | UI gửi/rút principal và điểm mùa. Không tích hợp yield.                                                                                             |
| Thưởng mùa    | Q12 thay bởi Q30: sponsor/pool funding, root bất biến, notice 2 ngày, claim 90 ngày, mỗi ví một lần, phần dư trả về pool; UI nhận theo claims.json. |
| Spectator     | Hợp đồng có gate mặc định tắt; giao diện đặt cược chưa mở. Chưa giải quyết triệt để thông đồng hai người chơi.                                      |
| Vận hành      | Anvil state dump, thư mục relay riêng theo chain mới, backup/restore có SHA-256; hướng dẫn nâng cấp và off-host backup.                             |
| CI            | Đã thêm workflow kiểm thử/typecheck/lint/build, chưa xác nhận chạy trên GitHub.                                                                     |
| Fuji          | RPC công khai đạt; chưa deploy/chơi 20 trận do chưa có địa chỉ vai trò, keystore và AVAX testnet.                                                   |
| Audit độc lập | Chưa thực hiện; bộ test và rà soát nội bộ không phải chứng nhận audit.                                                                              |

Việc cần chủ dự án/ngoại lực: thiết lập và cấp AVAX testnet cho các ví Fuji, tự ký các bước cần ví, nghiệm thu hai profile trình duyệt trên Fuji; chọn chính sách chia thưởng thật, nhà cung cấp yield nếu muốn mở rộng, vận hành sao lưu ngoài máy và thuê đánh giá bảo mật độc lập. Các phần này không được ghi là hoàn tất chỉ vì local đạt.
