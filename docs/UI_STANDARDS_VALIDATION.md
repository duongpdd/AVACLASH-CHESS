# Chuẩn hóa UI sau rà soát — 11/11/2026

Đã thực hiện các việc thống nhất sau khi đối chiếu ba tài liệu người dùng gửi. Chuẩn hiện hành và ngoại lệ thiết kế nằm tại [FRONTEND_STANDARDS.md](design/FRONTEND_STANDARDS.md), được liên kết từ `web/AGENTS.md` và chỉ mục tài liệu. Không hạ phiên bản framework hoặc tạo giả bộ rule Cursor chưa có trong repo.

| Việc                     | Kết quả                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khôi phục local          | Chạy demo được hỗ trợ trên Anvil 31337/RPC 18545, relay 18080, web 13000. Có giải đang thi đấu 8 người/28 ván và giải đang mở đăng ký 2/8, quỹ 0,25 ETH test. Env thật giữ nguyên.    |
| Header workspace         | Logo mobile cao 44px trong header cố định 56px, biểu tượng 32px. Desktop ẩn logo trên header, giữ logo ở sidebar. Drawer mở tại x=0, rộng 240px và đóng bằng Escape.                  |
| Token và trang chức năng | Bo góc 8/8/6px, panel mặc định 16px, PageHeader 24px; main công khai chức năng tối đa 768px. Landing và chrome chung giữ khung 1120px theo ngoại lệ đã thống nhất.                    |
| Responsive               | Onboarding dùng mặc định một cột; nới bằng min-width từ md. Giữ hero tím, chữ, glyph và FEN. Mốc 640–767px không còn hero hai cột.                                                    |
| Trạng thái bảng          | Elo rỗng đi qua DataWithStatus, có layout rỗng tùy chỉnh nhưng giữ thứ tự lỗi → tải → rỗng → nội dung. Không thông báo bảng rỗng khi query còn đang tải. Compact rỗng vẫn ẩn toàn bộ. |
| Tài liệu                 | Đồng bộ chuẩn UI/công nghệ/rule thực tế trong repo; ghi rõ ngoại lệ landing, Next 16.4.5 và kiến trúc API tổng hợp dữ liệu chuỗi. Nhật ký cập nhật duy nhất tại log.md.               |

## Kiểm tra

- TypeScript, ESLint và Next production build qua; đủ 23 trang.
- **241 test / 42 file qua**, trước vòng này là 237 test. Không xóa test cũ.
- Thêm `data-status-layout.test.tsx`: 3 test cho thứ tự lỗi/tải/rỗng và việc giữ layout mặc định khi thêm layout rỗng tùy chỉnh.
- Thêm 1 test trong `cup-onboarding-ui.test.tsx`: không hiện thông báo rỗng hoặc bảng giả trước khi query hoàn tất.
- Ma trận Playwright cuối: **52 trường hợp, không tràn ngang, không page error**. Trang chủ kiểm tra tại 375, 390, 640, 767, 768, 1280 và 1440px; danh sách giải, ranking và guide tại 375/1280px. Mỗi trường hợp chạy cả vi/en và sáng/tối. H1 chức năng đo được 24px; main chức năng không vượt 768px; hero giữ giới hạn số dòng trước đó.
- Đăng nhập thực tế bằng chữ ký của tài khoản Anvil thử nghiệm, đi qua server session và WalletGate. Đã mở hồ sơ có dữ liệu, kiểm tra header/drawer và form tạo giải. Browser kiểm tra chặn gửi giao dịch; fixture tạo/nạp quỹ/đăng ký được dựng bằng script local có sẵn. Không chạy một giải hoàn chỉnh đến bước nhận thưởng trong vòng UI này.
- Một lượt ma trận rộng ban đầu gặp timeout khi dev server tải nhiều phiên; đã chạy lại tuần tự và hoàn tất ma trận cuối. Kết quả cuối được lưu riêng, không tính lượt lỗi là đã qua.
- Diff nguồn contracts, packages, hook giao dịch và cosmetics không phát sinh; các thay đổi palette engine từ vòng trước được giữ nguyên.

Số đo: [trang công khai](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/public-metrics.json), [workspace](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/workspace-metrics.json).

## Ảnh

| Trang     | 375px                                                                                                    | 1280px                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Trang chủ | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/home-375.png)        | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/home-1280.png)        |
| Giải đấu  | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/tournaments-375.png) | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/tournaments-1280.png) |
| Xếp hạng  | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/ranking-375.png)     | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/ranking-1280.png)     |
| Hướng dẫn | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/guide-375.png)       | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/guide-1280.png)       |
| Workspace | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/workspace-375.png)   | [Ảnh](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/workspace-1280.png)   |

[Drawer mobile](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/workspace-drawer-375.png) · [Form tạo giải](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/standards-final/organize-form-375.png).
