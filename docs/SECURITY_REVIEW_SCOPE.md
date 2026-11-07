# Phạm vi bàn giao đánh giá bảo mật độc lập

Đây là hồ sơ chuẩn bị đánh giá, không phải chứng nhận audit. Mã nguồn đang ở worktree chưa commit; hash tệp trong `benchmarks/security-source-manifest.json` xác định chính xác các tệp được rà soát nội bộ. Trước khi thuê audit, tạo commit/tag bất biến và chạy lại manifest/kiểm thử trên bản đó.

## Phạm vi kỹ thuật

- `ChessEscrow.sol`: các nhánh create/join/settle/cancel/abort/refund, 2-of-3, nonce/deadline, pull payment, phí, pause và role timelock.
- `AvaClashMeta.sol`: nghĩa vụ principal, cược spectator và rewards; reserved budgets; rounding; malicious recipients; root/leaf/proof; quyền owner và liên kết Escrow một lần.
- Shared/relay: verify replay/hash/Result v2, Join v2 ràng buộc origin/chain/contract, nonce một lần, phiên socket và phát hành kết quả sau khi lưu bền vững.
- Web: ký đúng payload/chain, receipt reverted, đổi ví/phòng, stale state/signatures, các luồng thoát tiền và hiển thị dữ liệu thật.
- Vận hành: RPC bất ổn, ổ đĩa đầy/hỏng, restore snapshot cũ, terminal checkpoint, khóa relay/trọng tài, backup ngoài máy và nâng cấp Meta.

## Kiểm chứng nội bộ đã có

510 kiểm thử chính/công cụ đạt ở lượt này; contract unit/fuzz/invariant 175, Foundry fuzz 256, invariant 1 run/depth 1500 theo cấu hình hiện tại. Chiến dịch 20 trận local có receipt/số dư; không thay thế kiểm thử adversarial hoặc audit độc lập. Các PoC lịch sử git-ignore trong thư mục audit không bị xóa/sửa và không được tính vào số test chính; xem ghi chú của báo cáo rà soát ban đầu.

## Rủi ro cần chuyên gia và chủ dự án chấp nhận/giải quyết

1. Relay là nguồn đồng hồ và sự kiện ngoài bàn cờ, không có chứng minh timeout on-chain; downtime/chìa khóa bị lộ ảnh hưởng liveness/trust.
2. Hai kỳ thủ có thể cùng ký kết quả giả; thậm chí có relay kiểm luật vẫn có thể chủ ý dàn xếp. Spectator tắt mặc định, chưa đủ điều kiện mở sản phẩm cược công khai.
3. Single-signed tắt mặc định; bật lên có rủi ro claim giả, kinh tế challenge và trọng tài không phản hồi theo Q8/Q15. Không có fraud proof.
4. Owner được tin cậy khi phân bổ Merkle rewards. Root bất biến và khóa ngân sách không chứng minh tính công bằng hoặc chính xác của snapshot. Không có cơ chế cộng đồng phủ quyết trong thời gian notice.
5. ELO/season points theo ví chưa chống Sybil; telemetry không phát hiện engine đáng tin cậy.
6. Abort phòng chưa signal vẫn có thể do bên ngoài gọi sau timeout theo API hiện tại; start signal là giao dịch relay có thể chậm/thất bại. Chưa thay đổi ngữ nghĩa này âm thầm.
7. Hỏng toàn bộ đĩa/bản sao cũ hoặc nâng cấp Meta sai quy trình vẫn có thể làm mất dữ liệu/khả năng truy cập nghĩa vụ. Timelock không tự migration.
8. Yield chưa tích hợp. Mọi đề xuất lending/staking mới cần threat model, đặc tả rút tiền và kiểm toán riêng trước khi gửi principal vào bên thứ ba.

Chưa gửi mã nguồn, log, khóa hay dữ liệu người dùng cho tổ chức audit; chưa mua dịch vụ hoặc triển khai mainnet. Người đánh giá độc lập cần báo cáo findings, reproducer, mức độ, trạng thái khắc phục và kiểm chứng lại trên commit cuối.
