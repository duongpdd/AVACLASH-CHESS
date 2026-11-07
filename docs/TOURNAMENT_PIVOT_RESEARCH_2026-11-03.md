# Nghiên cứu và đề xuất sửa AvaClash cho giải cờ online

Ngày nghiên cứu: 03/11/2026. Trạng thái: đề xuất sản phẩm, chưa triển khai vào ứng dụng hoặc hợp đồng đang chạy.

## Điều chỉnh phạm vi cho 30 Days to Build on Avalanche

Sau khi đối chiếu [trang Team1 Vietnam – UniHack trên Avalanche Builder Hub](https://build.avax.network/events/596c0b2d-63aa-4cf0-a0ad-a7e34ddbfdc0), tiêu chí công khai là value proposition, technical complexity và usage of Avalanche technologies. Trang không công bố trọng số tại thời điểm đọc. [Luma của BTC](https://luma.com/jubv690p) mô tả hành trình 30 ngày, demo và bảo vệ ý tưởng. Không dùng tiêu chí của cuộc thi Solana UniHackfest hoặc dữ liệu AI/x402 trên trang hub thử nghiệm để suy ra yêu cầu của cuộc thi này.

**Khuyến nghị cho bài thi:** AvaClash là đấu trường cờ miễn phí tham dự, có quỹ giải tài trợ được cấp trước trên Fuji, công bố điều kiện, duyệt kết quả rồi nhận thưởng đúng phân bổ. Phần quản trị giải chỉ đủ để hoàn thành luồng này. Các chức năng SaaS rộng hơn bên dưới là hướng phát triển sau hackathon.

Mức độ phù hợp là đánh giá của nhóm, không phải xác nhận dự án được BTC chấp nhận:

| Hướng | Đánh giá cho bài thi |
| --- | --- |
| Cược 1v1 như hiện tại | Có cơ chế on-chain rõ, nhưng giữ rủi ro pháp lý và vấn đề Fair Play của mô hình cược |
| Website quản lý giải, chỉ ghi hash | Có thể hữu ích nhưng giá trị tăng thêm của blockchain yếu nếu cùng tin một BTC |
| Quỹ thưởng tài trợ on-chain + cờ miễn phí | Hướng nên chọn: có dòng tài sản, điều kiện giải ngân và bằng chứng demo cụ thể; vẫn cần thẩm định pháp lý trước tiền thật |

Một kịch bản demo: sponsor nạp token Fuji vào quỹ riêng → công khai ngân sách/cơ cấu thưởng → giải 8 người tham dự miễn phí → kết quả tạm và bước duyệt → phát hành phân bổ cuối → người thắng claim, có giao dịch kiểm tra được. Không yêu cầu toàn bộ hệ thống quản trị đa giải, thuê bao hoặc chống engine mới trong 30 ngày. Không tự giải ngân chỉ vì hết thời gian chờ khi còn khiếu nại chưa được xử lý.

Độ sâu kỹ thuật cần thể hiện bằng hành vi có thể kiểm tra: tách quyền cấp quỹ và duyệt, ràng buộc ngân sách, phân bổ cuối không bị sửa tùy tiện, chống claim trùng, xử lý hủy/quá hạn và danh sách claim có thể tải/kiểm chứng. Không thêm token, NFT hoặc Avalanche L1 riêng chỉ để tăng số công nghệ.

Kế hoạch dự kiến, chưa phải cam kết tiến độ: tuần 1 chốt luật và contract; tuần 2 nối phòng không cược, bàn cờ và quỹ; tuần 3 chạy giải pilot/test/review; chừa thời gian cuối cho video, pitch và sửa lỗi. Tiến độ phụ thuộc việc xác nhận thể lệ và hoàn thành kiểm thử, không mặc định có đủ 30 ngày để code trước hạn nộp.

Lưu ý tổ chức: Luma hiện nêu final submission 21/11/2026, còn agenda Builder Hub nêu 24/11 và mục Deadline nêu 25/11 lúc 05:59 Asia/Bangkok. Các nguồn đang không đồng nhất; lập kế hoạch nội bộ sẵn sàng trước 21/11 và xác nhận hạn chính thức với BTC. Chưa xác minh được quy tắc sử dụng mã đã có trước cuộc thi: cần khai rõ phần AvaClash có sẵn và các phần được xây/nâng cấp trong kỳ thi, không mô tả toàn bộ nền tảng là mã mới trong 30 ngày.

## Quyết định đề xuất

Chuyển từ cược 1v1 sang phần mềm vận hành giải cờ online miễn phí tham dự, có hồ sơ kết quả, khiếu nại và trao thưởng kiểm tra được. Khách hàng là ban tổ chức (BTC): cộng đồng, streamer, trường đại học, doanh nghiệp hoặc CLB. Nhà tài trợ là bên cấp ngân sách giải, không nhất thiết là bên mua phần mềm.

Giá trị cần kiểm chứng: BTC giảm thời gian đối soát; kỳ thủ biết kết quả đang ở bước nào; nhà tài trợ đối chiếu được việc phân phối ngân sách. Không định vị là công nghệ phát hiện engine hoặc thay thế trọng tài.

Nguồn dưới đây chứng minh các yêu cầu vận hành tồn tại. Chúng chưa chứng minh mức độ phổ biến tại Việt Nam, số khách hàng sẵn sàng trả tiền hoặc blockchain cần thiết cho mọi giải. Chưa phỏng vấn BTC trong nghiên cứu này.

## Bằng chứng và giới hạn

| Vấn đề | Bằng chứng sơ cấp | Hàm ý cho AvaClash |
| --- | --- | --- |
| Dùng engine, cần rà soát thủ công | [Chess.com: Cheating And Fair Play](https://www.chess.com/cheating), cập nhật 25/08/2026, mô tả thuật toán, chuyên viên và giám sát | Gắn trạng thái kiểm tra và hồ sơ riêng tư; không gọi hash nước đi là bằng chứng không gian lận |
| Kết quả còn có thể bị khiếu nại; mất mạng cần quy tắc | [FIDE Online Chess Regulations](https://handbook.fide.com/chapter/OnlineChessRegulations), Điều 11 và Phụ lục I | Lưu điều lệ có phiên bản; phân biệt kết quả tạm và kết quả được duyệt; ghi sự cố và quyết định |
| Tài khoản chưa phản ánh đúng trình độ; trao thưởng ngoài nền tảng | [Lichess Events Tips](https://lichess.org/page/event-tips) khuyên yêu cầu lịch sử chơi, chờ 72 giờ và nêu không chịu trách nhiệm trả thưởng cho giải không chính thức | Xác thực quyền sở hữu tài khoản, theo dõi điều kiện dự giải và trách nhiệm trả thưởng; không suy ra mọi giải đều quỵt tiền |
| Trao thưởng có bước liên hệ và kiểm tra | [World Chess: When and how will I get my prize?](https://support.worldchess.com/en/articles/6829443-when-and-how-will-i-get-my-prize), bài ngày 08/10/2024, mô tả liên hệ email trong 72 giờ và thu thập thông tin nhận giải | Checklist và trạng thái trao thưởng hữu ích; thời gian rà soát không đồng nghĩa chậm trả bất hợp lý |
| Đã có công cụ tổ chức giải miễn phí | [Lichess features](https://lichess.org/features) có Arena và Swiss miễn phí; [API chính thức](https://lichess-org.github.io/api/) cung cấp dữ liệu giải/kết quả | Không bán riêng bảng xếp hạng hay bàn cờ như lợi thế mới. Cân nhắc tích hợp thay vì xây lại toàn bộ |

FIDE khuyến nghị hoàn tất kiểm tra Fair Play trước khi trao giải và công bố quy trình kháng nghị. Cơ chế giải ngân tức thì sau mỗi ván không phù hợp để mặc định áp dụng cho mô hình đề xuất. Thời gian chờ phải gắn với việc duyệt; hết 72 giờ không tự chứng minh một kỳ thủ hợp lệ. [Nguồn FIDE](https://handbook.fide.com/chapter/OnlineChessRegulations).

Đã có sản phẩm tự mô tả việc tách bàn cờ và lớp quản lý giải: [Chess4prize FAQ](https://chess4prize.com/faq) nói họ xử lý đăng ký, điều kiện, kết quả và thưởng trên nền Lichess. Đây là mô tả của nhà cung cấp, không phải xác nhận độc lập về chất lượng, doanh thu hay tính hợp pháp tại Việt Nam. Không dùng mô hình thu phí dự giải của họ làm căn cứ pháp lý cho AvaClash.

## Pháp lý Việt Nam: cần đổi dòng tiền thật sự

[Bộ luật Hình sự, VBHN 135/VBHN-VPQH ngày 25/09/2025](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/135-vbhn-vpqh.pdf), Điều 321 và 322, quy định về đánh bạc trái phép và tổ chức đánh bạc/gá bạc. Thiết kế hai người nộp tài sản, thắng nhận phần của người thua, nền tảng thu phí có rủi ro đáng kể. Việc áp dụng vào tài sản mã hóa và cấu hình cụ thể cần tư vấn pháp lý; nghiên cứu này không kết luận tội danh của dự án. Không dùng mốc tiền truy cứu hình sự làm giới hạn sản phẩm được phép hoạt động.

Không thể chỉ đổi chữ “cược” thành “phí tham gia”, “ký quỹ” hoặc “giải đấu” trong khi tiền người thua vẫn chuyển sang người thắng.

Hướng sửa là bỏ tiền cược, không yêu cầu nạp Vault để đủ điều kiện dự giải hoặc nhận thưởng, không cược khán giả, không bán token để có quyền tranh giải. Ngân sách thưởng đến từ BTC/nhà tài trợ và được tách khỏi phí phần mềm.

Miễn phí tham dự và có tài trợ **không tự bảo đảm hợp pháp**. Cần phân loại hoạt động cung cấp game, tổ chức giải, tài trợ/khuyến mại, thanh toán, thuế và dữ liệu cá nhân. [Giải thích của Chính phủ về Nghị định 147/2024/NĐ-CP](https://xaydungchinhsach.chinhphu.vn/nghi-dinh-147-2024-nd-cp-khong-mua-ban-vat-pham-ao-giua-nhung-nguoi-choi-tro-choi-dien-tu-voi-nhau-119241113161443995.htm) nêu giới hạn với vật phẩm/điểm thưởng và khuyến mại có thưởng gắn vào game. Phải xem đúng phạm vi áp dụng, không đồng nhất mọi giải thể thao có thưởng với chương trình khuyến mại trong game.

Nghị định 147 đã có sửa đổi: [CSDL quốc gia về VBPL](https://vbpl.moj.gov.vn/bothongtin/Pages/vbpq-lichsu.aspx?ItemID=171689&Keyword=) và [Nghị định 116/2026/NĐ-CP](https://congbao.cdnchinhphu.vn/180507251028987904/2026/4/20/469315-1776647256_v1_1776647889_signed.pdf). Trước vận hành thương mại cần rà soát văn bản có hiệu lực tại thời điểm đó; không dựa riêng bài giải thích năm 2024 hoặc dự thảo chưa ban hành.

Demo hackathon giữ tài sản không có giá trị trên Fuji. Phương án thương mại trong nước cần được thẩm định riêng: có thể chỉ bán phần mềm, còn khoản thưởng bằng VND do BTC xử lý qua kênh hợp lệ. Việc ghi hash lên chain không thay thế giấy phép hoặc kiểm tra thanh toán.

## Phạm vi sản phẩm nên chọn

### Luồng của người dùng

1. BTC tạo giải, công bố điều lệ, điều kiện dự giải, cách xếp hạng, cơ cấu thưởng, người có thẩm quyền và các hạn xử lý.
2. Người chơi đăng ký miễn phí bằng tài khoản; chưa cần ví. Nếu liên kết Lichess, xác minh quyền kiểm soát bằng OAuth, không chỉ nhập username. Một tài khoản liên kết không chứng minh một người duy nhất.
3. Thi đấu; hệ thống lưu kết quả tạm, PGN, thời gian và sự cố. Có thể nhập kết quả từ nền tảng ngoài bằng API/CSV với nguồn gốc rõ ràng.
4. BTC/trọng tài rà soát, nhận và xử lý khiếu nại; lưu quyết định, người duyệt và thời điểm.
5. Chốt bảng kết quả cuối; công bố danh sách phân bổ thưởng và bằng chứng cam kết phiên bản.
6. Trả thưởng/nhận thưởng theo phương thức đã được phép, theo dõi trạng thái và xuất báo cáo đối soát.

Trọng tâm đầu tiên là khâu 4–6 và hồ sơ điều lệ, không phải tự xây hệ thống chống engine. Trong demo có thể dùng giải vòng tròn 8 người, một thể thức, một cơ cấu thưởng; không cần lập tức viết Swiss đầy đủ.

### Blockchain nên làm phần nào

- Ghi cam kết hash cho điều lệ, kết quả cuối và danh sách phân bổ, kèm mã giải và phiên bản. Công bố bản gốc có thể tải và công cụ kiểm hash. Hash không làm một quyết định sai trở thành đúng; cũng không bảo đảm dữ liệu luôn còn truy cập được.
- Nếu có sửa sai, ghi bản kế tiếp và quan hệ thay thế, không giả vờ lịch sử cũ chưa tồn tại. Đồng thuận về kết quả vẫn thuộc BTC/trọng tài theo điều lệ.
- Trên Fuji: minh họa quỹ thưởng do nhà tài trợ nạp trước và khả năng claim đúng danh sách đã duyệt. Cam kết ngân sách chỉ áp dụng đúng tài sản/đơn vị được nạp, không bảo đảm giá trị quy đổi VND.
- Nếu chỉ chuyển VND ngoài chain: chỉ báo cáo “BTC đã xác nhận thanh toán” hoặc “người nhận đã xác nhận”, không gọi hash biên lai là chứng minh ngân hàng đã trả tiền hoặc quỹ đã được bảo đảm.
- Giữ thông tin định danh, email, video và hồ sơ tố cáo ngoài chain, phân quyền và có chính sách lưu/xóa phù hợp. Chỉ công khai dữ liệu tối thiểu; hash/ví vẫn có thể liên kết ngược tới cá nhân.

Blockchain có ích hơn khi nhiều bên độc lập cần đối chiếu cùng hồ sơ hoặc khi quỹ thực sự bị ràng buộc bởi hợp đồng. Nếu một BTC và các bên đều tin cùng database/ngân hàng, công cụ thông thường có thể đủ. Cần đo lợi ích tăng thêm trước khi bắt người dùng chịu thao tác ví và gas.

## Đối chiếu mã hiện tại và thay đổi cần làm

Đã đọc README, ARCHITECTURE, SEASON_REWARDS, ChessEscrow.sol, AvaClashMeta.sol và RelayServer.ts. Đây là đối chiếu mã, không phải audit hoặc xác nhận các luồng mới hoạt động.

| Thành phần | Hiện tại | Phương án sửa |
| --- | --- | --- |
| Web/đăng nhập | Ví và giao dịch tạo/join phòng cược | Thêm tài khoản, đăng ký/check-in giải miễn phí, trang điều lệ; ví chỉ ở phần bằng chứng/nhận tài sản demo |
| Bàn cờ | chess.js, WebSocket, đồng hồ, replay | Tận dụng cho demo; tạo phòng không cần ký quỹ. Với giải thực, cân nhắc tích hợp nền tảng đã có Fair Play |
| Relay | Đọc `ChessEscrow.getRoom`, xác minh hai ví và đồng ký kết quả | Tách nguồn cấp phòng giải khỏi phòng on-chain; xác thực người chơi theo danh sách; kết quả relay là kết quả tạm, không tự ra lệnh chi thưởng |
| Database | Snapshot và kết quả phòng; terminal result bất biến | Thêm tournaments, entrants, rounds/matches, rules versions, appeals, decisions, allocations, payout status và nhật ký. Giữ kết quả ván gốc; quyết định xử lý giải là bản ghi riêng |
| ChessEscrow | `MIN_STAKE=0.01`, join cùng tiền, phí 5% | Không dùng cho luồng giải mới. Không thể chỉ cho UI nhập 0. Tạo phiên bản riêng; không sửa tưởng rằng bytecode cũ đổi theo |
| AvaClashMeta | Quỹ mùa, sponsor funding, Merkle claim sau 2 ngày; ELO/điểm có liên hệ Vault | Tận dụng ý tưởng/primitive claim cho demo, tách quyền dự giải khỏi Vault. Pool mùa chung chưa có quỹ riêng mỗi giải và quy trình kháng nghị |
| ELO | Theo ví, chưa chống nhiều ví | Không dùng làm chứng nhận trình độ hoặc tiêu chuẩn nhận tiền duy nhất; kiểm điều kiện dự giải riêng |
| Spectator/Vault | Spectator đang tắt; Vault giữ gốc | Loại khỏi trải nghiệm giải mới; không tạo nguồn thu bằng cược khán giả hoặc hứa lợi suất |

### Hợp đồng đề xuất, nếu cần demo quỹ riêng

`TournamentPrizePool` mới, chỉ thử Anvil/Fuji trước: mỗi giải có ngân sách, nhà tài trợ, điều lệ, quyền duyệt và hạn riêng; người chơi không nạp tiền. Không chi thưởng chỉ dựa vào chữ ký hai đối thủ.

Vòng đời dự kiến: `Draft → Funded → Running → Reviewing → Finalized → Claiming → Closed`; nhánh `Cancelled` theo điều kiện công bố trước. Bảng kết quả có thể mang trạng thái disputed trước khi final. Hết thời gian chờ không được tự chi khi vụ việc chưa được xử lý.

Trước khi viết contract phải chốt: ai duyệt kết quả/phân bổ, ai xử lý bất đồng, hạn duyệt cuối và cách xử lý khi không đạt đồng thuận, hủy giải trả lại ai, phần dư/quá hạn nhận đi đâu. Không tự hoàn toàn bộ cho sponsor khi nghĩa vụ thưởng đã được chốt. Vai trò độc lập hoặc multisig giảm rủi ro một khóa nhưng vẫn cần công bố giả định tin cậy; chưa có cơ chế này trong bản hiện tại.

Phân bổ khi final phải nằm trong ngân sách; không chi trùng; claim chỉ mở khi danh sách đã duyệt và kiểm tra đủ điều kiện; pause không được tùy tiện chặn quyền thoát/nhận đã có. Công cụ kiểm proof và bản phân bổ phải luôn sẵn cho người nhận. Đây là yêu cầu thiết kế mới, chưa phải tính năng sẵn có.

## Câu 3: ai trả tiền, nhận giá trị gì

Khách hàng trả phí là BTC cần quản lý nhiều giải, hồ sơ quyết định và báo cáo tài trợ. Nhà tài trợ mua quyền lợi truyền thông qua hợp đồng riêng với BTC; không mặc định họ sẽ mua AvaClash. Không bắt người chơi mua quyền tranh giải.

Doanh thu dự kiến: phí phần mềm cố định theo giải; sau khi có khách dùng lặp lại mới thử thuê bao cho nhiều giải/thành viên quản trị. Không thu 5% tiền thua. Không xem toàn bộ quỹ tài trợ là doanh thu của nền tảng.

Ví dụ minh họa, chưa kiểm chứng giá: BTC có 10 triệu đồng tiền thưởng và trả riêng 1 triệu đồng cho công cụ vận hành. Doanh thu AvaClash là 1 triệu đồng trước chi phí hỗ trợ, hạ tầng, gas demo và nghĩa vụ thuế; 10 triệu thuộc ngân sách thưởng. Phải bán được giá trị vượt Google Sheets + ngân hàng + nền tảng chơi miễn phí.

Không có yield; không cần phát hành token. Nếu BTC không cần báo cáo/đối soát hoặc không sẵn sàng trả phí thì mô hình này chưa có bằng chứng khả thi, dù demo blockchain chạy tốt.

## Lộ trình và tiêu chí nghiệm thu

1. **Kiểm chứng nhu cầu:** phỏng vấn 3–5 BTC về ba giải gần nhất; hỏi số giờ đối soát, hồ sơ khiếu nại, lý do chờ thưởng, công cụ hiện dùng và ngân sách. Xin dữ liệu đã ẩn danh. Không liên hệ hoặc gửi tin thay người dùng trong tác vụ nghiên cứu này.
2. **MVP không cược:** giải 8 người miễn phí, tạo giải/check-in/kết quả tạm/duyệt/kháng nghị và báo cáo; dùng lại bàn cờ hoặc nhập dữ liệu ngoài. Demo blockchain lưu hash, quỹ thưởng bằng token Fuji nếu cần.
3. **Kiểm thử có ý nghĩa:** không thể dự giải bằng cách nạp tiền; người không đủ quyền không chốt kết quả; khiếu nại đang mở chặn phát hành thưởng; kết quả gốc và quyết định được giữ riêng; ngân sách không vượt quỹ; không claim trùng; hủy/quá hạn xử lý đúng điều lệ; hash khớp dữ liệu tải về; phục hồi sau restart.
4. **Chạy pilot:** đo thời gian vận hành so với giải tương đương trước đó, thời gian từ duyệt đến nhận thưởng, số lần phải sửa tay, mức hoàn thành đăng ký và chi phí hỗ trợ. Mục tiêu thương mại: ít nhất một BTC chấp nhận thử trả phí; đây là mục tiêu kiểm chứng, chưa phải traction.
5. **Trước tiền thật:** có ý kiến pháp lý cho đúng hoạt động tại Việt Nam, rà soát hợp đồng và bảo mật độc lập theo phạm vi, xác định quy trình thanh toán/thuế/dữ liệu. Không mặc định Fuji thành công là đủ chuyển mainnet.

## Câu định vị cho pitch

“AvaClash giúp ban tổ chức giải cờ online công bố điều lệ, xử lý hồ sơ kết quả và đối soát trao thưởng. Người chơi tham gia miễn phí; doanh thu dự kiến đến từ phí phần mềm của ban tổ chức. Avalanche lưu các cam kết có thể kiểm tra và minh họa phân phối quỹ tài trợ trên testnet; quyết định Fair Play vẫn cần nền tảng thi đấu và trọng tài.”

Chỉ mô tả phần đã có là hiện có; các luồng quản lý giải, kháng nghị, danh tính và quỹ riêng trong tài liệu này đều là đề xuất. Tác vụ này chỉ tạo tài liệu nghiên cứu, không thay đổi website, cấu hình hosting, hợp đồng hoặc tiền của người dùng.
