# Hero và quân minh họa — 11/11/2026

Đã sửa đúng ba khóa `home.cupTitle`, `home.cupTitleAccent`, `home.cupDescription` ở cả vi/en, giữ nguyên “token thử nghiệm” và hàng thông số 5 + 0. Tiêu đề vẫn dùng hai màu, được điều chỉnh cỡ chữ để đáp ứng giới hạn dòng ở cả hai ngôn ngữ.

Playwright chạy Edge headless với **deviceScaleFactor = 2**, viewport 1440×1000 và 390×1000. Kết quả đo DOM:

| Ngôn ngữ | 1440px | 390px | Cuộn ngang |
| --- | ---: | ---: | --- |
| Việt | 2 dòng | 3 dòng | Không |
| Anh | 2 dòng | 4 dòng | Không |

Hai bên dùng cùng glyph đặc ♚︎♛︎♜︎♝︎♞︎♟︎, có variation selector text U+FE0E. Trắng ruột `#F5EFFF`, viền `#160D2B` dày 1,4px; Đen đảo hai màu, viền mỏng 0,65px. Glyph co theo chiều rộng bàn cờ, lưới cố định tám hàng để không bị tràn ô. FEN và cách dựng qua chess.js giữ nguyên.

Tính theo WCAG sRGB:

| Cặp | Giá trị |
| --- | ---: |
| Ruột Trắng / ruột Đen | 16,58:1 |
| Mỗi quân / ô sáng, lấy max(ruột, viền) | 12,79:1 |
| Mỗi quân / ô tối, lấy max(ruột, viền) | 4,83:1 |
| Mỗi quân / ô đánh dấu | 8,78:1 |

Typecheck, lint và **237/237 test** đều qua. Sửa test `home-cup.test.tsx` để khớp tiêu đề mới; thêm hai test trong `hero-contrast.test.ts` cho công thức tham chiếu (21:1, đối xứng, 1:1) và màu thực tế lấy từ stylesheet. Test thế cờ `home-preview.test.ts` và i18n parity giữ xanh. Không sửa hợp đồng, packages, hook giao dịch hay cosmetics/skin.

Ảnh Playwright: [Việt 1440](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/hero-glyph/home-vi-1440.png), [Việt 390](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/hero-glyph/home-vi-390.png), [Anh 1440](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/hero-glyph/home-en-1440.png), [Anh 390](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/hero-glyph/home-en-390.png). [Số đo DOM](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/hero-glyph/metrics.json).

Preview hiện chỉ chạy web từ env sẵn có; hợp đồng giải chưa cấu hình trong env này. Không tạo hoặc nạp quỹ giải để chụp ảnh.

![Bàn cờ chụp trực tiếp ở deviceScaleFactor 2](C:/Users/Admin/Desktop/PRJ1/avaclash-chess/.local/ui-redesign/hero-glyph/board-dsf2.png)
