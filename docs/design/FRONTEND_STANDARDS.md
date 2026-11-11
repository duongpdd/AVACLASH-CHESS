# Quy chuẩn frontend AvaClash Cup

Áp dụng cho cây `web/`. Tài liệu này đồng bộ ba bản tham chiếu `ui.md`, `technologies.md`, `rules.md` với kiến trúc hiện có. Các yêu cầu cụ thể của người dùng được ưu tiên.

## UI

- Nút/thẻ/dropdown dùng token bo góc **8/8/6px** trong `src/styles/theme.css`. Panel chức năng dùng `CardCustom`, padding 16px. `Button` dùng token chung, chữ 14px, vùng bấm tối thiểu 44px.
- `PageHeader` chức năng dùng h1 24px; h2 dùng `text-description`, có thể thêm `font-semibold text-foreground` khi cần phân biệt rõ tiêu đề với mô tả. `text-data` 16px, `text-label` và `text-description` 14px. Màu lấy từ theme, không dán mã màu vào view.
- Bảng dùng `Table` trong `CardCustom` và `DataWithStatus`. Ưu tiên lỗi → tải → rỗng → nội dung. `noDataLayout="custom"` cho phép khung rỗng có bảng minh họa và CTA; vẫn đi qua cùng bộ điều phối trạng thái.
- Trang chức năng công khai có main tối đa 768px, padding ngang 16px và dọc 24px. Workspace tối đa 1024px. Header công khai và footer dùng khung chung tối đa 1120px để đủ bốn mục điều hướng và hành động.
- **Ngoại lệ landing đã được chọn:** giữ hero tím, headline lớn hai màu, khung 1120px, bàn cờ nghiêng và khoảng đệm trang trí riêng. Hero/hình minh họa có thể dùng bo góc lớn; card dữ liệu và nút vẫn dùng token. Glyph minh họa co theo ô bàn cờ. Nội dung chữ và FEN không thay đổi khi chuẩn hóa layout.
- CSS mới mặc định cho mobile; nới layout bằng `min-width: 768px` và `1024px`. Landing một cột dưới md. Không mở rộng việc chuẩn hóa sang mã cosmetics hay engine bàn cờ trong các vòng sửa UI công khai.
- Workspace dùng header cố định 56px, sidebar 240px, drawer dưới md. Logo workspace cao tối đa 44px, biểu tượng 32px; nhãn Testnet gộp trên dòng phụ. Giữ các điều khiển ngôn ngữ/theme 44px để đáp ứng vùng chạm, thay vì thu về ô 36px.
- Đo tại 375, 390, 640, 767, 768, 1280 và 1440px; kiểm tra Việt/Anh, sáng/tối. Hàng nút được xuống dòng, toàn trang không cuộn ngang.

## Công nghệ và kiến trúc

Nguồn phiên bản chính xác là `web/package.json` và lockfile. Hiện dùng Next.js **16.4.5**, eslint-config-next **16.4.5**, React **19.2.4**, TypeScript 5, Tailwind 4, next-intl 4.13, React Query 5, react-hook-form 7 và Zod **4.6.7**. Không hạ phiên bản để khớp tài liệu tham chiếu cũ.

- Next App Router, route mỏng trong `src/app`, UI trong `src/views`, tên file kebab-case. Đọc hướng dẫn Next đã cài theo `web/AGENTS.md` trước sửa API framework.
- Provider: Query → Theme → Wagmi → Auth → nội dung và Toast. Session qua auth provider; không thêm Redux cho auth.
- i18n: vi/en cùng tập khóa, mặc định vi, cookie `NEXT_LOCALE`, URL không prefix, múi giờ duy nhất `Asia/Ho_Chi_Minh`. Mọi copy mới qua next-intl.
- Service tổ chức theo chức năng; hook query/mutation gọi service, view không fetch trực tiếp. Hai API Elo/profile hiện tại tự tổng hợp dữ liệu chuỗi ở server, không phải mirror một backend khác; giữ nguyên ranh giới này.
- Form dùng react-hook-form, lỗi field inline, lỗi API qua `showApiError`. Dropdown giá trị dùng `DropdownSelect`. Chỉ áp dụng debounce cho ô tìm kiếm thực sự phát query/filter; form mở giải bằng mã là hành động submit, không phải live search.
- Trang công khai ngoài `AppShell`; route riêng qua gate và server session. Không giả session để vượt gate khi kiểm tra. Test trình duyệt local có thể dùng ví Anvil thử nghiệm ký đăng nhập thật trong context kiểm thử riêng.
- SEO giữ canonical/OG/Twitter cho trang công khai; login và workspace noindex; sitemap chỉ chứa URL công khai.

## Quy tắc làm việc

Repo hiện có `web/AGENTS.md` cho hướng dẫn Next, chưa có bộ 13 file `.cursor/rules/` được nhắc trong bản tham chiếu. Tài liệu này ghi quy định đang áp dụng; không tuyên bố các rule Cursor đã được cài khi chúng chưa tồn tại.

Giữ diff tối thiểu, không thêm tính năng ngoài phạm vi; helper thuần đặt trong utils. Không sửa contracts, packages, hook giao dịch hoặc cosmetics trong vòng chuẩn hóa này. Nhật ký chỉ ghi **`log.md` ở root**, mục mới trên cùng. Không tạo `CHANGELOG.md`.

Kiểm tra hoàn tất: `pnpm --filter web typecheck`, `lint`, `test`, bản build phù hợp và kiểm tra browser theo luồng. Chạy demo bằng `node scripts/dev-tournament.mjs --seed` trên Anvil riêng; không ghi đè env thật hay gửi giao dịch lên Fuji/production để kiểm tra giao diện.
