# AvaClash Cup: kịch bản video tiếng Việt khoảng 5 phút

Ngày soạn: 07/11/2026. Dùng cùng [nội dung 10 slide](PITCH_SLIDE_CONTENT_VI.md).

Bản này bám ba tiêu chí công khai của [Team1 Vietnam UniHack](https://build.avax.network/events/596c0b2d-63aa-4cf0-a0ad-a7e34ddbfdc0): giá trị giải pháp, độ phức tạp kỹ thuật và sử dụng Avalanche. Nguồn chưa nêu trọng số hoặc thời lượng video. Mốc 5 phút là giả định biên tập, cần đọc thử để căn tốc độ và chừa thời gian cho thao tác.

## 00:00–00:20 · Slide 1 · Mở đầu

**Hình:** tên AvaClash Cup, sau đó chuyển sang giao diện tổng quan giải. Hiện nhãn “Avalanche Fuji testnet”.

**Lời đọc:**

“Một giải cờ online có thể công bố giải thưởng rất rõ, nhưng người chơi kiểm tra quỹ đã được cấp và đã trả như thế nào? AvaClash Cup giúp các bên theo dõi quỹ tài trợ, kết quả đã duyệt và việc nhận thưởng trên Avalanche Fuji. Người chơi tham dự miễn phí.”

## 00:20–00:45 · Slide 2 · Vấn đề và người dùng

**Hình:** ba nhóm Kỳ thủ, Nhà tài trợ, Ban tổ chức. Làm nổi từng nhóm khi nhắc tới.

**Lời đọc:**

“Nhóm tập trung vào các giải nhỏ của câu lạc bộ, trường học và cộng đồng. Kỳ thủ muốn biết khi nào được nhận thưởng. Nhà tài trợ muốn đối chiếu tiền đã phân phối. Ban tổ chức cần theo dõi cả kết quả và khiếu nại trước khi chốt. Đó là quy trình AvaClash lựa chọn giải quyết, và nhóm sẽ kiểm chứng nhu cầu qua các đợt chạy thử.”

## 00:45–01:10 · Slide 3 · Giải pháp

**Hình:** lần lượt hiển thị bốn bước trong slide 3.

**Lời đọc:**

“Nhà tài trợ nạp quỹ vào hợp đồng trước khi kỳ thủ đăng ký. Sau ván đấu, relay ký biên bản kết quả tạm. Trọng tài duyệt và xử lý khiếu nại. Khi đủ điều kiện, hợp đồng tính phần thưởng để người được thưởng tự nhận. Kỳ thủ không đóng tiền cược hoặc phí nền tảng để tham dự, nhưng các giao dịch vẫn có phí mạng thử nghiệm.”

## 01:10–01:40 · Slide 4 · Vai trò của Avalanche

**Hình:** địa chỉ hợp đồng trên Fuji, ảnh giao dịch nạp quỹ và trạng thái giải. Zoom phần số tiền, trạng thái receipt và sự kiện tương ứng.

**Lời đọc:**

“Phần Avalanche nằm ở hợp đồng TournamentPrizePool trên Fuji C-Chain. Hợp đồng giữ quỹ riêng cho từng giải và kiểm tra các điều kiện giải ngân. Các bên có thể đối chiếu giao dịch nạp quỹ, kết quả duyệt và giao dịch nhận thưởng. Khi còn khiếu nại mở, hệ thống chưa cho chốt bảng thưởng. Đây là phần quy tắc được hợp đồng thực thi bên cạnh hồ sơ công khai.”

## 01:40–02:10 · Slide 5 · Kiến trúc kỹ thuật

**Hình:** sơ đồ Web, Relay, PostgreSQL, Hợp đồng Fuji. Đánh sáng nhánh ngoài chuỗi rồi nhánh trên chuỗi.

**Lời đọc:**

“Bàn cờ và đồng hồ chạy qua WebSocket để người chơi không phải gửi giao dịch cho từng nước. Relay xác thực kỳ thủ, kiểm luật và ký kết quả theo EIP-712. Hợp đồng kiểm chữ ký trước khi nhận biên bản. Dữ liệu ván được lưu để xem lại và tải PGN. Cách chia này giữ trải nghiệm thi đấu trực tiếp, đồng thời đưa quỹ và điều kiện chi thưởng lên chuỗi.”

## 02:10–02:50 · Slide 6 · Demo quỹ, bàn cờ và biên bản

**Hình và thao tác**

1. 02:10–02:20: mở trang giải, chỉ quỹ tài trợ, trạng thái và danh sách kỳ thủ.
2. 02:20–02:30: chèn đoạn ghi hình hai kỳ thủ đi vài nước trong đúng giải đó.
3. 02:30–02:40: mở hồ sơ ván đã kết thúc, hiển thị kết quả tạm và nước đi.
4. 02:40–02:50: mở PGN/hash và giao dịch báo cáo kết quả nếu đã có receipt.

**Lời đọc:**

“Đây là trang giải với quỹ tài trợ và danh sách kỳ thủ. Trong đoạn ghi hình thi đấu, hai người vào cùng một ván và chơi qua relay. Sau khi kết thúc, hồ sơ hiển thị biên bản, nước đi và mã hash đối chiếu. Kỳ thủ gửi biên bản có chữ ký relay lên chuỗi. Kết quả này vẫn cần trọng tài duyệt. Hash giúp kiểm tra biên bản có bị thay đổi, còn đánh giá gian lận vẫn cần quy trình Fair Play.”

**Chữ trên hình:** “Cảnh thi đấu đã ghi trước” khi chuyển sang clip. Nếu dùng Anvil, gắn nhãn “Anvil local” xuyên suốt cảnh đó và nói rõ môi trường.

## 02:50–03:30 · Slide 7 · Demo duyệt và nhận thưởng

**Hình và thao tác**

1. 02:50–03:00: mở bằng ví trọng tài, hiển thị phán quyết và trạng thái duyệt.
2. 03:00–03:10: hiển thị cửa sổ khiếu nại hoặc hồ sơ đang mở. Nếu demo lệnh chốt bị từ chối, dùng môi trường thử nghiệm đã chuẩn bị.
3. 03:10–03:20: chuyển sang thời điểm đủ điều kiện, hiển thị bảng thưởng đã chốt.
4. 03:20–03:30: mở giao dịch nhận thưởng thành công và sự kiện `Claimed` tương ứng.

**Lời đọc:**

“Trọng tài dùng ví có quyền riêng để duyệt và xử lý khiếu nại. Khi vẫn còn hồ sơ mở, hợp đồng chặn chốt thưởng. Sau khi hết thời gian phản hồi và đủ kết quả duyệt, hợp đồng tính phân bổ theo điểm, có xử lý đồng điểm. Người được thưởng tự nhận trong ba mươi ngày và không thể nhận trùng. Đoạn tiếp theo chuyển sang thời điểm đủ điều kiện để minh họa bảng thưởng và giao dịch nhận.”

**Chữ trên hình:** “Sau khi hết cửa sổ khiếu nại” ở điểm chuyển thời gian. Trên Fuji phải chờ thật, tối thiểu một giờ. Nếu chỉ có dữ liệu local cho bước claim, thay câu cuối bằng: “Bước chốt và nhận thưởng sau đây minh họa trên Anvil local.” Đồng thời đổi nhãn môi trường và không ghép explorer Fuji làm bằng chứng cho claim local.

## 03:30–04:00 · Slide 8 · Kiểm chứng kỹ thuật và giới hạn

**Hình:** tên các bài kiểm thử, ảnh báo cáo tích hợp và nhãn “Anvil local”. Dòng “Testnet, chưa audit độc lập” hiện ở cuối cảnh.

**Lời đọc:**

“Bộ kiểm thử tích hợp của dự án bao phủ giải tám kỳ thủ, hai mươi tám ván qua Anvil và WebSocket thật. Các tình huống kiểm tra gồm khiếu nại chặn chốt, nhận thưởng trùng, đồng điểm và hoàn phần quỹ chưa chi. Đây là bằng chứng thử nghiệm cục bộ. Bản hiện tại chạy testnet, chưa audit độc lập và vẫn tin cậy relay cùng trọng tài. Hợp đồng không tự phát hiện người chơi dùng engine.”

## 04:00–04:30 · Slide 9 · Hướng triển khai sản phẩm

**Hình:** kế hoạch phỏng vấn, chạy thử, đo kết quả. Hiện rõ “Kế hoạch kiểm chứng”.

**Lời đọc:**

“Khách hàng dự kiến là đơn vị tổ chức giải. Hướng doanh thu là phí phần mềm theo giải, tách riêng khỏi quỹ thưởng tài trợ. Nhóm chưa xác thực nhu cầu trả phí. Bước tiếp theo là phỏng vấn ba đến năm đơn vị và tìm đối tác chạy thử, đo thời gian đối soát, thời gian nhận thưởng và mức sẵn sàng tiếp tục sử dụng. Kết quả đó sẽ quyết định hướng phát triển sản phẩm.”

## 04:30–05:00 · Slide 10 · Phần đã xây và lời kết

**Hình:** hai dòng “Kế thừa” và “Xây trong kỳ thi”, sau đó hiện liên kết demo, GitHub và tên nhóm.

**Lời đọc:**

“Nhóm kế thừa bàn cờ, relay và kết nối ví từ bản AvaClash Chess trước cuộc thi. Trong kỳ thi, nhóm xây mô hình giải miễn phí với quỹ tài trợ, duyệt kết quả, khiếu nại và giao diện giải đấu. AvaClash Cup giúp các bên đối chiếu từ quỹ tài trợ đến kết quả duyệt và phần thưởng đã nhận. Nhóm mong tìm đối tác chạy thử để tiếp tục hoàn thiện quy trình này. Cảm ơn ban giám khảo.”

## Chuẩn bị cảnh quay

- Dùng một giải xuyên suốt để người xem đối chiếu được mã giải, mã ván, ví và giao dịch. README giới thiệu giải #1 ASTAR, cần kiểm tra dữ liệu hiện tại trước khi chọn làm cảnh quay.
- Chuẩn bị hai hồ sơ trình duyệt kỳ thủ, ví ban tổ chức/nhà tài trợ và ví trọng tài theo vai trò thực. Tránh mất thời gian chuyển ví trong video.
- Trên Fuji, quay các bước ở thời điểm thực tế rồi dựng nối, kèm chú thích nhảy thời gian. Hợp đồng không hỗ trợ bỏ qua thời gian khiếu nại. Chỉ Anvil local mới có thể tăng thời gian để demo.
- Cảnh explorer phải hiện đúng chain, địa chỉ hợp đồng, trạng thái receipt thành công và dữ liệu liên quan. Không chỉ quay thông báo gửi giao dịch hoặc popup ví.
- Nếu chưa có receipt nhận thưởng Fuji, dùng claim local có nhãn rõ theo phương án ở cảnh 7. Không đọc lời khẳng định đã nhận thưởng Fuji khi chưa có bằng chứng.
- Khi dựng, giữ khoảng dừng để người xem đọc số tiền, trạng thái và mã ván. Cắt thời gian tải trang, giữ dấu hiệu chuyển thời điểm. Đọc thử toàn bộ để căn lại độ dài trước khi xuất video.

## Đối chiếu trước khi nộp

| Câu hỏi ban giám khảo cần trả lời được | Cảnh cung cấp bằng chứng |
| --- | --- |
| Dự án giải quyết vấn đề cho ai? | 1–3 và 9 |
| Vì sao dùng blockchain và dùng Avalanche ở đâu? | 4–5, giao dịch thật ở 6–7 |
| Nhóm đã xây được luồng nào? | 6–7 và phần khai rõ mã có trước ở 10 |
| Hệ thống xử lý tình huống khó thế nào? | 7–8, hồ sơ khiếu nại và kiểm thử |
| Phần nào còn cần kiểm chứng? | 8–9, nhãn testnet và kế hoạch chạy thử |

Nguồn tính năng và giới hạn: README, mã `TournamentPrizePool`, hướng dẫn demo và nghiên cứu sản phẩm, dẫn chi tiết trong [tài liệu nội dung slide](PITCH_SLIDE_CONTENT_VI.md). Lượt soạn không chạy lại test hoặc xác minh receipt mới. Chỉ đưa số tiền, địa chỉ ví người nhận và tx hash vào bản quay sau khi đối chiếu dữ liệu thực.
