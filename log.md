## [2026-11-11] chore | Dọn báo cáo cũ và công cụ trùng

- Xóa 25 báo cáo/ảnh/đầu ra lịch sử trong docs/archive, 10 tệp gói review tháng 10 và hai wrapper generate-abi.ts không được gọi; giữ generator generate-abi.mjs đang dùng.
- Giữ tài liệu nguồn gốc 1v1, chi thưởng mùa và phát hiện bảo mật lịch sử; cập nhật danh mục và liên kết sau khi dọn.
- Đưa review_pack vào .gitignore chung và loại review_pack/hồ sơ Edge khỏi Docker build context.
- Giữ nguyên mã tính năng, cấu hình môi trường, dependency, dữ liệu chạy local và các thay đổi UI đang làm.
- Kiểm tra: TypeScript toàn workspace qua; 2 test công cụ và 7 test cấu hình triển khai qua; 27 tệp Markdown không có liên kết nội bộ hỏng; git diff --check qua. Dùng pnpm 9.15.0 đã lưu trong .local/corepack để khớp packageManager.

## [2026-11-11] docs | Lập kế hoạch nộp BK Fintech và UniHack

- Thêm kế hoạch hai hồ sơ, lịch nội bộ nộp BK ngày 18/11 và UniHack ngày 20/11; đối chiếu nguồn công bố và ghi rõ các điểm cần BTC xác nhận.
- Cá nhân hóa cho chủ dự án là sinh viên HUST, hiện một người, tìm thêm đồng đội và có thể tới TP.HCM ngày 30/11.
- Thêm bảng theo dõi nghiệm thu Fuji, slide/video, quyền truy cập và bằng chứng tiếp nhận riêng từng cổng; chưa đánh dấu đã nộp hoặc đã kiểm lại demo.
- Chỉ thay đổi tài liệu; chưa chạy nghiệm thu, đăng ký, phát hành hay gửi hồ sơ.

## [2026-11-11] style | Chuẩn hóa UI Cup và giữ thiết kế hero tím

- Đồng bộ token bo góc 8/8/6px, padding panel 16px, PageHeader 24px và main trang công khai chức năng 768px; giữ ngoại lệ landing 1120px.
- Chuyển CSS onboarding sang mobile-first, một cột dưới md; thu gọn logo workspace trong header 56px.
- Bảng Elo rỗng đi qua DataWithStatus, giữ ưu tiên lỗi/tải/rỗng; thêm kiểm thử hồi quy cho layout trạng thái tùy chỉnh.
- Ghi quy chuẩn hiện có và ngoại lệ thiết kế vào docs/design/FRONTEND_STANDARDS.md; giữ Next.js 16.4.5, không hạ phiên bản.
- Khôi phục demo Anvil riêng với giải đang đấu và giải mở đăng ký; không thay env thật hoặc mã hợp đồng/packages/cosmetics.
- Kiểm tra: typecheck, lint, production build và 241/241 test qua; 52 trường hợp UI vi/en, sáng/tối không tràn ngang. Đăng nhập bằng ví Anvil test, đo logo 44px trong header 56px, kiểm tra drawer và form tạo giải.

## [2026-11-07] chore | Dọn repo và xác minh hợp đồng

- Xác minh mã nguồn `TournamentPrizePool` trên Routescan, bytecode khớp giao dịch deploy.
- Bỏ cấu hình Railway và VPS, code và dependency không dùng; sắp xếp `docs/` thành guides, design, benchmarks, archive.

## [2026-11-07] deploy | Phát hành bản vá bảo mật lên production

- Phát hành commit `d369fdd`: Vercel deployment `dpl_3WPC1K2QYgKRzHR8cetty9kcxuJ3` đạt READY trên avaclash-chess.vercel.app.
- Bản trước để rollback: `dpl_HhwzX8DCkei3ti2kVz1aXaweWL5d`.

## [2026-11-07] fix | Vá bảo mật frontend, thêm trang lỗi và hoàn tất bản dịch cosmetics

- Nâng Next.js và eslint-config-next lên 16.4.5, zod của web lên 4.6.7.
- Thêm CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy và Permissions-Policy.
- Thêm trang 404, trang lỗi và global-error theo giao diện ứng dụng.
- Chuyển chuỗi cosmetics viết cứng vào locale VI/EN, dịch nhãn thua trong hồ sơ.
- Kiểm tra ví trọng tài trùng ví tạo giải hoặc ví relay ngay trên form; giải mã lỗi hợp đồng thay cho "unknown reason".
- Còn lại: audit báo 1 lỗi high ở zod 3 của relay/shared.

## [2026-11-05] style | Căn chỉnh thẻ chế độ, điều hướng mobile, panel trang chủ và thống kê hồ sơ

- Thống nhất thứ bậc tiêu đề, khoảng cách, icon và trạng thái tương tác của các thẻ chọn chế độ.
- Căn cùng hàng tiêu đề và panel giải đấu/Elo; bổ sung trạng thái rỗng có icon.
- Giữ điều hướng gọn trên điện thoại; đưa nút phụ xuống dưới tiêu đề ở màn nhỏ để mô tả dùng đủ chiều rộng.
- Rút gọn thông báo mạng trên tablet, giữ nhãn mạng liền dòng và chỉ hiện mô tả đầy đủ từ màn desktop.
- Chia thống kê hồ sơ thành các ô rõ ràng, co giãn theo màn hình và giao diện sáng/tối.
- Kiểm tra: lint, TypeScript, production build và 184/184 bài kiểm thử đạt; trình duyệt production đạt ở 375/768/1280 px, VI/EN, sáng/tối và luồng đăng nhập/đăng xuất ví.
- Phát hành production `dpl_FFLhnDXMaLhhXm7krTqqw83EvCaW` đạt READY trên avaclash-chess.vercel.app; kiểm tra bổ sung banner ở 375/768/1024/1280 px.

## [2026-11-05] fix | Bỏ mục Vault khỏi menu hồ sơ trên desktop và mobile

## [2026-11-05] deploy | Phát hành frontend lên production

- Cập nhật avaclash-chess.vercel.app từ mã cục bộ đã kiểm thử.
- Cấu hình khóa ký phiên máy chủ cho môi trường production.
- Sửa cột bàn cờ cùng thiết bị để co giãn theo khung desktop.
- Vercel deployment `dpl_89u6t8i96xPF8DMiPFuyY4iazJYN` đạt READY.

## [2026-11-05] fix | Sửa điều hướng bàn phím, bản dịch thế cờ và link giải sai mã

## [2026-11-05] fix | Xác minh phiên ví và hoàn tất bản địa hóa VI/EN

- Xác minh chữ ký đăng nhập trên máy chủ trước khi cấp phiên. Lưu token và địa chỉ ví phía trình duyệt, đối chiếu phiên với cookie HttpOnly và giữ đường dẫn đích khi đăng nhập.
- Đưa chữ trên bàn cờ, màn giao dịch, trạng thái giải và thông báo lỗi vào hai tệp locale.

## [2026-11-05] feat | Chuẩn hóa giao diện, kiến trúc web và cấu hình công nghệ theo bộ quy định UI/Tech

- Tách trang công khai và workspace có cổng kết nối ví, bổ sung điều hướng cố định, drawer, lựa chọn giao diện và locale.
- Chuyển UI vào views, áp dụng token, component dùng chung, React Hook Form, debounce và lớp dịch vụ HTTP.
- Đồng bộ phiên bản dependency và bổ sung metadata, robots, sitemap, ảnh Open Graph và icon.
