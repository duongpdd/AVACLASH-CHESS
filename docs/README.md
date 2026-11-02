# Tài liệu dự án

Giao diện cập nhật: [bố cục, điều hướng và kiểm chứng UI](UI_2026-11-01.md).

Triển khai đã chọn: [Render Free + Neon Free + Vercel](RENDER_DEPLOY.md). Phương án khác: [Railway](RAILWAY_DEPLOY.md), [Vercel + relay Docker/Caddy trên VPS](VERCEL_DEPLOY.md).

Cập nhật ngày 01/11/2026. Dự án hiện hướng tới **Avalanche Fuji Testnet** và Anvil cục bộ.

Đọc theo thứ tự:

1. [`../README.md`](../README.md): cài đặt, chạy và cấu hình.
2. [`DECISIONS.md`](DECISIONS.md): các quyết định được chấp nhận; mục có ghi “Superseded” chỉ là lịch sử.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md): kiến trúc hiện tại và ranh giới tin cậy.
4. [`PROTOCOL.md`](PROTOCOL.md): giao thức WebSocket và định dạng chữ ký.
5. [`PROGRESS.md`](PROGRESS.md): những gì đã có và phần chưa hoàn thành.
6. [`REVIEW_2026-11-01.md`](REVIEW_2026-11-01.md): kết quả rà soát, thay đổi và kiểm chứng đợt này.
7. [`BENCHMARK.md`](BENCHMARK.md): trạng thái đo hiệu năng, không dùng số ước lượng.

Các tệp `REPORT_LUOT*.md`, `LUOT3B_VERIFY_*.md`, `AUDIT_NOTES.md` và phần cũ của `IMPROVEMENT_PLAN.md` ghi lại từng thời điểm triển khai. Số test và tuyên bố hoàn thành trong đó không đại diện cho phiên bản hiện tại.

Các bản đề bài, kiến trúc và mẫu giao diện trong thư mục cha là tài liệu đầu vào. Khi khác với ADR mới hơn, áp dụng ADR mới: Result v2, người tạo chọn màu, telemetry chỉ cảnh báo, thị trường Trắng/Đen/Hòa và single-signed tắt mặc định. Mã giao diện mẫu cần được điều chỉnh theo các luồng thực tế.

Tài liệu bổ sung sau rà soát: [nghiệm thu](IMPLEMENTATION_2026-11-01.md), [Fuji](FUJI_DEPLOY.md), [vận hành](OPERATIONS.md), [thưởng mùa](SEASON_REWARDS.md). Các giới hạn trong báo cáo rà soát ban đầu về Join v1, UI Hot-seat/Vault và Q12 được thay bởi Q30–Q32; audit độc lập/Fuji thực tế vẫn chưa hoàn tất.
