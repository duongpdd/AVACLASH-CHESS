# AvaClash Cup: nội dung slide thuyết trình

Ngày soạn: 07/11/2026. AvaClash Cup là phiên bản giải đấu của dự án AvaClash Chess.

## Cơ sở bám tiêu chí

[Trang Team1 Vietnam UniHack trên Avalanche Builder Hub](https://build.avax.network/events/596c0b2d-63aa-4cf0-a0ad-a7e34ddbfdc0) công bố ba tiêu chí: value proposition, technical complexity và usage of Avalanche technologies. Khi kiểm tra ngày 07/11/2026, nội dung trang chưa nêu trọng số, thang điểm chi tiết hoặc giới hạn thời lượng video. Vì vậy, bản này bám ba tiêu chí công khai, không tự đặt điểm hay xem ba tiêu chí có trọng số bằng nhau.

Giả định biên tập: 10 slide, video khoảng 5 phút. Nội dung dưới đây là bản chữ để đưa vào PowerPoint/Canva, chưa phải tệp trình chiếu. Kịch bản lời đọc và cảnh quay nằm trong [VIDEO_SCRIPT_VI.md](VIDEO_SCRIPT_VI.md).

| Tiêu chí công khai | Slide trực tiếp trả lời | Bằng chứng cần xuất hiện trong bài |
| --- | --- | --- |
| Giá trị giải pháp | 1, 2, 3, 9, 10 | Người dùng cụ thể, vấn đề quỹ thưởng, quy trình giải quyết, kế hoạch kiểm chứng nhu cầu |
| Độ phức tạp kỹ thuật | 4, 5, 6, 7, 8 | Phân chia on-chain/off-chain, chữ ký kết quả, phân quyền, khiếu nại, điều kiện chi thưởng và kiểm thử |
| Sử dụng công nghệ Avalanche | 4, 5, 6, 7, 10 | Hợp đồng Fuji, giao dịch nạp quỹ/nhận thưởng, sự kiện và dữ liệu đối chiếu trên explorer |

## Slide 1. AvaClash Cup công khai quỹ thưởng cho giải cờ online

**Chữ trên slide**

- Giải cờ miễn phí tham dự, quỹ thưởng do nhà tài trợ cấp trước.
- Công khai kết quả đã duyệt và phân bổ thưởng trên Avalanche Fuji.
- [Tên nhóm] · Team1 Vietnam UniHack 2026.

**Hình đề xuất:** ảnh giao diện giải đấu, logo dự án và nhãn nhỏ “Fuji testnet”.

**Điểm cần nói:** người xem phải hiểu ngay ai cấp quỹ, ai thi đấu và blockchain quản lý phần nào.

## Slide 2. Ba bên cần đối chiếu cùng một quỹ thưởng

**Chữ trên slide**

- Kỳ thủ cần biết quỹ đã được cấp và khi nào có thể nhận thưởng.
- Nhà tài trợ cần đối chiếu ngân sách với số tiền đã phân phối.
- Ban tổ chức cần theo dõi kết quả, khiếu nại và trạng thái trao thưởng.

**Hình đề xuất:** ba cột Kỳ thủ / Nhà tài trợ / Ban tổ chức, đặt quỹ thưởng ở giữa.

**Điểm cần nói:** đây là vấn đề sản phẩm nhóm chọn giải quyết. Chưa có dữ liệu phỏng vấn để khẳng định mức độ phổ biến hoặc thiệt hại trung bình.

## Slide 3. Quỹ được nạp trước, kết quả được duyệt trước khi chi

**Chữ trên slide**

1. Nhà tài trợ nạp quỹ vào hợp đồng.
2. Kỳ thủ đăng ký miễn phí và thi đấu.
3. Relay ký biên bản, trọng tài duyệt và xử lý khiếu nại.
4. Hợp đồng chốt phân bổ, người được thưởng tự nhận.

**Chú thích nhỏ:** miễn phí tham dự, giao dịch vẫn có phí mạng thử nghiệm.

**Hình đề xuất:** bốn khối theo thứ tự, mỗi khối dùng một ảnh giao diện tương ứng.

**Điểm cần nói:** mỗi giải có quỹ và hồ sơ riêng. Người chơi không phải đóng tiền cược để giành thưởng.

## Slide 4. Avalanche giữ quỹ và thực thi điều kiện giải ngân

**Chữ trên slide**

- `TournamentPrizePool` chạy trên Fuji C-Chain, chain ID 43113.
- Hợp đồng ghi nhận tài trợ, đăng ký, kết quả duyệt và phân bổ.
- Chưa đủ điều kiện chốt hoặc còn khiếu nại mở thì chưa thể chốt thưởng.
- Explorer cho phép đối chiếu giao dịch và sự kiện.

**Hình đề xuất:** ảnh giao dịch nạp quỹ cạnh ảnh trạng thái giải. Chân trang dẫn tới địa chỉ hợp đồng.

**Điểm cần nói:** giá trị của blockchain nằm ở việc giữ tài sản và kiểm tra điều kiện chi, bên cạnh hồ sơ công khai. Bản này sử dụng C-Chain và Solidity/EVM, không có Avalanche L1 riêng.

## Slide 5. Nước đi xử lý ngoài chuỗi, quỹ thưởng xử lý trên chuỗi

**Chữ trên slide**

- Web: bàn cờ, ví, lịch ván và hồ sơ giải.
- Relay: xác thực kỳ thủ, kiểm luật, đồng hồ và ký kết quả EIP-712.
- PostgreSQL: lưu dữ liệu ván phục vụ truy xuất biên bản.
- Hợp đồng: xác minh chữ ký, quản lý quyền, khiếu nại và thưởng.

**Hình đề xuất:** sơ đồ Web kết nối Relay và Hợp đồng Fuji. PostgreSQL nối với Relay. Ghi rõ “nước đi, đồng hồ” ở nhánh relay và “quỹ, phán quyết, nhận thưởng” ở nhánh Fuji.

**Điểm cần nói:** không gửi giao dịch cho từng nước cờ. Relay là thành phần được tin cậy, hợp đồng không tự chạy luật cờ hoặc phát hiện engine.

## Slide 6. Demo: từ quỹ tài trợ đến biên bản có thể đối chiếu

**Chữ trên slide**

- Quỹ tài trợ và danh sách kỳ thủ hiện ngay trên trang giải.
- Hai kỳ thủ chơi trực tiếp qua relay.
- Biên bản cung cấp nước đi, PGN và hash đối chiếu.
- Kết quả relay là kết quả tạm, cần trọng tài duyệt.

**Hình đề xuất:** ưu tiên quay màn hình sản phẩm thay cho slide tĩnh. Lần lượt mở tổng quan giải, bàn cờ và hồ sơ một ván.

**Điểm cần nói:** cảnh thi đấu có thể quay trước, sau đó mở lại đúng giải và đúng mã ván. Hash hỗ trợ kiểm tra tính toàn vẹn của biên bản, không chứng minh kỳ thủ chơi trung thực.

## Slide 7. Khiếu nại đang mở sẽ chặn chốt thưởng

**Chữ trên slide**

- Ban tổ chức, trọng tài, relay và kỳ thủ có các quyền riêng.
- Trọng tài xử lý khiếu nại, quyết định sửa mở lại thời gian phản hồi.
- Hợp đồng tính thưởng theo điểm đã duyệt và chia đều khi đồng điểm.
- Người được thưởng nhận trong 30 ngày, hợp đồng chặn nhận trùng.

**Hình đề xuất:** ba ảnh liên tiếp: hồ sơ khiếu nại / bảng thưởng đã chốt / giao dịch nhận thưởng.

**Điểm cần nói:** trên Fuji phải chờ cửa sổ khiếu nại thật, tối thiểu một giờ. Video có thể ghép các thời điểm và ghi chú rõ. Với giải hai người, tỷ lệ theo hạng là 70/30. Với 3–8 người, tỷ lệ là 60/30/10. Đồng điểm thì chia tổng phần thưởng của những hạng liên quan.

## Slide 8. Bộ kiểm thử bao phủ cả đường thành công và tình huống lỗi

**Chữ trên slide**

- Giải 8 kỳ thủ, 28 ván qua Anvil và WebSocket thật.
- Khiếu nại mở chặn chốt thưởng, nhận thưởng lặp bị từ chối.
- Kiểm tra đồng điểm, quyền hủy và hoàn phần quỹ chưa chi.
- Bản hiện tại chạy testnet, chưa qua audit độc lập.

**Hình đề xuất:** ảnh kết quả kiểm thử có tên bài kiểm thử và môi trường. Không dùng một con số tổng thay cho việc giải thích hành vi đã kiểm tra.

**Điểm cần nói:** bằng chứng 28 ván thuộc kiểm thử tích hợp cục bộ. Không gọi đó là 28 ván trên Fuji hoặc số người dùng thật.

## Slide 9. Khách hàng đầu tiên dự kiến là đơn vị tổ chức giải nhỏ

**Chữ trên slide**

- Nhóm tiếp cận dự kiến: CLB, trường học và cộng đồng cờ.
- Hướng doanh thu: phí phần mềm theo giải do đơn vị tổ chức trả.
- Kế hoạch: phỏng vấn 3–5 đơn vị và tìm đối tác chạy thử.
- Đo thời gian đối soát, thời gian nhận thưởng và ý định tiếp tục sử dụng.

**Chú thích nhỏ:** giả thuyết kinh doanh, chưa có doanh thu hoặc nhu cầu trả phí được xác thực.

**Hình đề xuất:** ba mốc Phỏng vấn / Chạy thử / Đo kết quả. Chỉ ghi trạng thái kế hoạch.

**Điểm cần nói:** quỹ tài trợ thuộc ngân sách thưởng, không tính là doanh thu nền tảng. Giá trị cần kiểm chứng là lợi ích vận hành so với công cụ ban tổ chức đang dùng.

## Slide 10. MVP đã có luồng giải, bước tiếp theo là kiểm chứng sử dụng

**Chữ trên slide**

- Kế thừa: bàn cờ, relay và kết nối ví từ phiên bản trước cuộc thi.
- Xây trong kỳ thi: quỹ giải tài trợ, duyệt/khiếu nại và giao diện giải đấu.
- Tiếp theo: chạy thử với đơn vị tổ chức và rà soát bảo mật độc lập.
- Mời trải nghiệm AvaClash Cup và góp ý quy trình tổ chức giải.

**Chân trang**

- Demo: https://avaclash-chess.vercel.app/tournaments
- Mã nguồn: https://github.com/duongpdd/AVACLASH-CHESS

**Hình đề xuất:** ảnh tổng quan giải và hai mã QR dẫn tới demo, mã nguồn. Thêm tên thành viên/vai trò sau khi chủ dự án cung cấp, không tự điền tên.

**Câu kết:** “AvaClash Cup giúp các bên đối chiếu từ quỹ tài trợ đến kết quả duyệt và phần thưởng đã nhận.”

## Câu trả lời ngắn cho phần bảo vệ

**Vì sao cần blockchain?**

Hợp đồng giữ quỹ và thực thi điều kiện giải ngân để các bên cùng đối chiếu. Lợi ích rõ nhất khi nhà tài trợ, người chơi và ban tổ chức cần kiểm tra cùng một dòng tiền. Pilot sẽ kiểm chứng lợi ích đó có đáng với thao tác ví và phí mạng hay không.

**Nhóm đã dùng gì của Avalanche?**

Fuji C-Chain, giao dịch AVAX thử nghiệm và hợp đồng Solidity/EVM để giữ quỹ, ghi trạng thái và giải ngân. EIP-712 là chuẩn chữ ký Ethereum dùng trong thiết kế, không phải công nghệ riêng của Avalanche.

**Có chống engine không?**

Relay kiểm tính hợp lệ của nước cờ và ký biên bản. Đánh giá dùng engine và phán quyết Fair Play vẫn cần trọng tài. Hash biên bản không chứng minh người chơi không gian lận.

**Ví trọng tài riêng có bảo đảm trọng tài độc lập không?**

Hợp đồng tách quyền theo địa chỉ ví. Việc các ví có thuộc những người thực sự độc lập hay không cần quy trình tổ chức ngoài chuỗi. Trọng tài vẫn là bên được tin cậy.

**Có phải toàn bộ dự án được viết trong kỳ thi không?**

Nhóm có bàn cờ, relay và kết nối ví từ trước. Phần xây trong kỳ thi tập trung vào giải miễn phí tham dự, quỹ tài trợ, duyệt kết quả, khiếu nại và giao diện giải đấu.

**Đã sẵn sàng dùng tiền thật chưa?**

Bản này chỉ phục vụ testnet. Kế hoạch trước khi dùng tài sản thật cần hoàn thành đánh giá bảo mật độc lập và thẩm định mô hình vận hành phù hợp.

## Nguồn và giới hạn dùng số liệu

- [Tiêu chí công khai của cuộc thi](https://build.avax.network/events/596c0b2d-63aa-4cf0-a0ad-a7e34ddbfdc0), kiểm tra ngày 07/11/2026.
- [README hiện tại](../README.md): định vị Cup, địa chỉ hợp đồng, giải mẫu ASTAR, phạm vi tính năng và phần mã có trước cuộc thi.
- [Hợp đồng TournamentPrizePool](../contracts/src/TournamentPrizePool.sol): đối chiếu quyền, điều kiện chốt, chữ ký, đồng điểm, claim 30 ngày và hoàn quỹ.
- [Kiểm thử hợp đồng](../contracts/test/TournamentPrizePool.t.sol): các tình huống giải 8 người, khiếu nại, hủy, tài trợ và hoàn quỹ.
- [Hướng dẫn demo](guides/TOURNAMENT_DEMO.md): cách chạy giải và bằng chứng kiểm thử tích hợp trên Anvil. Một số số lượng test/trạng thái Fuji trong tài liệu này cũ hơn README.
- [Nghiên cứu chuyển hướng sản phẩm](design/TOURNAMENT_PIVOT_RESEARCH_2026-11-03.md): khách hàng và doanh thu là giả thuyết cần kiểm chứng, không phải traction đã có.

Lượt soạn này đọc tài liệu và mã nguồn, không chạy lại bộ kiểm thử hoặc xác minh giao dịch Fuji mới. Công cụ web không đọc được trang giải công khai và explorer trong lượt này. Vì vậy, phần quay phải dùng dữ liệu thực hiển thị khi ghi hình, không suy diễn số tiền, tx hash hay trạng thái claim từ tài liệu. README ghi có giải mẫu #1 ASTAR, còn hướng dẫn demo cũ vẫn ghi cần nghiệm thu Fuji. Chỉ dùng lời khẳng định giao dịch cụ thể khi cảnh quay và receipt xác nhận.
