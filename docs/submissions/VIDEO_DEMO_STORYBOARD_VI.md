# Kịch bản phân cảnh: video demo AvaClash Cup (UniHack)

Soạn ngày 15/11/2026. Video quay toàn bộ vòng đời một giải mới trên Avalanche Fuji, từ tạo giải đến nhận thưởng. Mục tiêu sau khi dựng: **2:45** (giới hạn UniHack 2–3 phút).

Tên nút trong bảng lấy từ `web/src/messages/vi.json`. Nếu giao diện hiển thị khác, quay theo giao diện thật.

## 1. Vai trò và trình duyệt

Hợp đồng yêu cầu: ví trọng tài khác ví ban tổ chức và kỳ thủ; kỳ thủ không được tài trợ giải mình thi. Ban tổ chức được kiêm nhà tài trợ.

| Mã | Vai trò | Trình duyệt | AVAX test cần có |
| --- | --- | --- | --- |
| 🅰 | Ban tổ chức kiêm nhà tài trợ | Chrome (tài khoản 1 trong ví) | Quỹ thưởng (ví dụ 0,3) + phí |
| 🅱 | Trọng tài | Chrome (tài khoản 2 trong ví) | ~0,05 cho phí |
| 🅲 | Kỳ thủ 1 | Chrome (tài khoản 3 trong ví) | ~0,05 cho phí |
| 🅳 | Kỳ thủ 2 | **Edge** (ví riêng) | ~0,05 cho phí |

Chỉ hai kỳ thủ cần mở cùng lúc, nên chỉ cần hai trình duyệt. Trong Chrome, chuyển tài khoản trong ví giữa các bước và kiểm tra địa chỉ ví hiển thị trên web đã đổi theo.

## 2. Thông số khi tạo giải

| Ô trong form | Giá trị đề xuất | Lý do |
| --- | --- | --- |
| Tên giải | `AvaClash Demo Cup` | |
| Ví trọng tài | Địa chỉ 🅱 | |
| Điều lệ công khai | 2–3 câu: thể thức 5+0, xử lý mất kết nối, kênh gửi bằng chứng | |
| Số kỳ thủ | 2 | Một ván duy nhất, chia 70/30 |
| Đăng ký (giờ) | 1 | Ngắn để bắt đầu sớm |
| Khiếu nại (giờ) | 1 | Mức tối thiểu; phải chờ thật trên Fuji |
| Hoàn tất (ngày) | 1 | Phải dài hơn tổng đăng ký + khiếu nại |

## 3. Phân cảnh

Cột "Giữ lại" là thời lượng sau khi dựng. Cắt các đoạn chờ ví và chờ tải trang, trừ cảnh 11.

| # | Ví | Thao tác trên màn hình | Lời thoại | Giữ lại |
| --- | --- | --- | --- | --- |
| 1 | — | Trang chủ AvaClash Cup | "AvaClash Cup là nền tảng tổ chức giải cờ miễn phí tham dự, quỹ thưởng được giữ trong hợp đồng trên Avalanche Fuji. Đây là một giải từ lúc tạo đến lúc trao thưởng." | 0:10 |
| 2 | 🅰 | **Tổ chức giải** → điền form: tên, **ví trọng tài**, điều lệ, số kỳ thủ, các mốc giờ → **Tạo giải** → xác nhận ví | "Ban tổ chức công bố điều lệ, chọn một trọng tài độc lập và đặt thời gian khiếu nại. Điều lệ được ghi mã lên hợp đồng." | 0:20 |
| 3 | 🅰 | Trang giải mới → **Tài trợ quỹ** → nhập 0,3 → **Nạp quỹ** → xác nhận | "Nhà tài trợ nạp 0,3 AVAX vào hợp đồng. Có quỹ thì giải mới mở đăng ký." | 0:15 |
| 4 | 🅲 + 🅳 | Chrome và Edge đặt **cạnh nhau**: mỗi bên **Đăng ký miễn phí** → xác nhận ví | "Kỳ thủ đăng ký miễn phí, không đặt cược. Mỗi người chỉ trả phí mạng." | 0:15 |
| 5 | 🅰 | **Quản lý giải** → **Bắt đầu giải** → tab **Lịch ván** → chọn cặp → **Mở ván** | "Đủ kỳ thủ, ban tổ chức bắt đầu giải và mở ván theo lịch vòng tròn." | 0:12 |
| 6 | 🅲 + 🅳 | Hai bên **Vào trận** → ký xác nhận (không tốn phí) → **Bắt đầu** → đi vài nước | "Hai kỳ thủ ký xác nhận rồi vào bàn. Nước đi và đồng hồ chạy ngoài chuỗi nên không tốn phí và rất mượt." | 0:25 |
| 7 | 🅲 hoặc 🅳 | Ván kết thúc (ví dụ một bên đầu hàng) → **Gửi kết quả tạm** → xác nhận | "Ván kết thúc. Kết quả được máy chủ ván đấu ký theo chuẩn EIP-712, hợp đồng kiểm chữ ký trước khi ghi nhận." | 0:12 |
| 8 | 🅱 | Chuyển sang ví trọng tài → **Hồ sơ** của ván → xem biên bản → **Duyệt ván** → xác nhận | "Trọng tài xem biên bản và duyệt. Kết quả chỉ có hiệu lực sau bước này." | 0:15 |
| 9 | — | Dòng "Có thể chốt thưởng sau…" → chèn chữ **"1 giờ sau"** | "Sau đó là thời gian khiếu nại. Khi còn khiếu nại mở, hợp đồng không cho chốt thưởng." | 0:08 |
| 10 | ví bất kỳ | Dòng "Đã đủ điều kiện chốt bảng thưởng." → **Chốt bảng thưởng** → xác nhận | "Đủ điều kiện, bất kỳ ai cũng có thể chốt. Hợp đồng tự chia 70/30 theo điểm đã duyệt." | 0:10 |
| 11 ⭐ | Người thắng | **Nhận thưởng** → xác nhận ví → ô **Đã trao** tăng | "Kỳ thủ tự nhận thưởng. Tiền đi thẳng từ hợp đồng về ví, không qua tay ban tổ chức." **Không cắt đoạn chờ.** | 0:15 |
| 12 | — | Tab **Lịch sử** → bấm giao dịch nhận thưởng → explorer: Success, số tiền, phí | "Mọi bước đều tra được trên explorer: nạp quỹ, duyệt, chốt, nhận thưởng. Phí chỉ khoảng [X] AVAX." | 0:15 |
| 13 | — | Trang hợp đồng trên explorer, tab Code (đã verify) → về trang chủ, hiện link | "Hợp đồng đã verify mã nguồn. AvaClash Cup: avaclash-chess.vercel.app." | 0:08 |

Tổng sau dựng: khoảng **3:00**. Nếu lố, rút cảnh 2 (chỉ quay form đã điền sẵn) và cảnh 6 (đi ít nước hơn).

Người thua cũng nhận được 30%. Có thể quay thêm vài giây ở cảnh 11 nếu còn thời lượng, không bắt buộc.

## 4. Lịch quay

Cần khoảng **2–2,5 giờ liên tục** vì thời gian khiếu nại phải chờ thật.

| Thời điểm | Việc |
| --- | --- |
| T−1 ngày | Tạo 4 tài khoản, xin faucet cho 🅰 rồi chuyển phí sang 🅱 🅲 🅳. Tập thao tác, không quay |
| T+0:00 | Quay cảnh 1–8 |
| T+0:30 → T+1:30 | Chờ hết thời gian khiếu nại. Thu lời thoại trong lúc chờ |
| T+1:30 | Quay cảnh 10–13 |
| Sau đó | Dựng trong Clipchamp, xuất 1080p, kiểm độ dài 2:00–3:00 |

## 5. Lưu ý

- Không để lộ cụm từ khôi phục hay khóa riêng trong khung hình.
- Giữ nhãn `Fuji testnet` ở góc video suốt thời lượng.
- Nếu một bước lỗi: không giả lập. Quay lại bước đó, hoặc dùng giải #1 đã hoàn tất làm cảnh dự phòng và nói rõ.
- Sau khi quay, cập nhật slide 5 nếu muốn dùng số liệu giải mới.
