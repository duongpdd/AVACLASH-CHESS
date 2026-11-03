# AvaClash Cup — chạy demo và triển khai Fuji

Phiên bản giải đấu dành cho 2–8 kỳ thủ. Người chơi không gửi tiền cược, không nạp Vault và không trả phí nền tảng để tham dự. Phiên bản này dùng ví để đăng ký và xác thực; giao dịch có phí mạng thử nghiệm. Nhà tài trợ cấp ngân sách bằng tài sản testnet. Bản hiện tại không có doanh thu, lợi suất, cược khán giả hoặc giao dịch tiền thật.

## Chạy cục bộ

Trong thư mục monorepo, với Foundry, Node và dependencies đã cài:

```powershell
node scripts/dev-tournament.mjs --seed
```

Mở `http://127.0.0.1:13000/tournaments`. Lệnh trên dựng một Anvil mới tại `http://127.0.0.1:18545` (chain 31337), deploy contract, tạo một giải tám người với 0,1 ETH local, đăng ký đủ kỳ thủ, tạo 28 cặp rồi chạy relay cổng 18080. Bỏ `--seed` để tự tạo và đăng ký qua UI. Dữ liệu relay lưu trong thư mục riêng dưới `.local/`; script không sửa tệp `.env.local` hay Anvil cũ. Phiên Anvil demo này tạm thời; lần chạy tiếp theo tạo chain mới. Dừng cả bộ bằng Ctrl+C.

Trong ví, thêm/chọn mạng thử nghiệm trỏ đúng RPC cổng 18545. Có thể dùng các tài khoản Anvil công khai: index 0 là BTC kiêm tài trợ demo, index 1 là trọng tài, index 2–9 là kỳ thủ. Dùng hai profile trình duyệt riêng cho hai kỳ thủ; chỉ dùng các khóa công khai này trên Anvil. Lệnh in địa chỉ công khai, không in khóa relay sinh ngẫu nhiên.

## Kịch bản demo

1. BTC tạo giải: điều lệ, số kỳ thủ, ví trọng tài khác ví BTC, hạn đăng ký, hạn hoàn tất và cửa sổ khiếu nại.
2. Nhà tài trợ nạp quỹ; các ví kỳ thủ không được nạp vào quỹ của giải mình tham gia. Khi đủ chỗ, BTC tạo các cặp vòng tròn. Mỗi cặp chơi 5+0 một ván; BTC sắp lịch, mở lần lượt các ván.
3. Hai kỳ thủ mở cùng mã ván, ký xác thực relay và chơi. Nước đi và đồng hồ xử lý ngoài chain. Sau khi ván kết thúc, một kỳ thủ bấm **Gửi kết quả tạm**; hợp đồng kiểm chữ ký relay và hash nước đi. Có thể tải lại chữ ký khi phiên ký hết hạn. Người xem mở biên bản và kiểm hash.
4. Trọng tài mở **Hồ sơ**, xem biên bản và duyệt. Nếu kết quả relay chưa có vì bỏ cuộc hoặc lỗi hạ tầng, trọng tài có thể ghi phán quyết theo điều lệ. Kỳ thủ có thể gửi mã hồ sơ khiếu nại; bằng chứng gốc trao đổi riêng với BTC, chỉ gửi hash lên chain.
5. Khi đủ ván đã duyệt, hết thời gian khiếu nại và không còn khiếu nại mở, một ví bất kỳ bấm **Chốt bảng thưởng**. Contract tự tính theo điểm đã duyệt. Người nhận bấm **Nhận thưởng** trong 30 ngày.

Điểm: thắng 1, hòa ½, thua 0. Hai kỳ thủ: 70/30; ba đến tám kỳ thủ: 60/30/10. Đồng điểm chia đều tổng giải của các hạng liên quan; số nguyên wei được làm tròn xuống. Nhà tài trợ nhận lại phần chưa được trao theo tỷ lệ góp quỹ sau hạn claim. Hủy trước khi bắt đầu do BTC quyết định; sau khi bắt đầu cần cả BTC và trọng tài, hoặc hết hạn hoàn tất mà chưa đủ điều kiện chốt. Nhà tài trợ không thể tự rút khi giải đang hoạt động. Việc giữ quỹ không xác minh danh tính thật hoặc tự phát hiện engine; quyền phán quyết vẫn thuộc trọng tài theo điều lệ.

Chỉ với Anvil, có thể tăng thời gian blockchain để demo cửa sổ khiếu nại bằng `cast rpc evm_increaseTime 3601 --rpc-url http://127.0.0.1:18545`, rồi `cast rpc evm_mine --rpc-url http://127.0.0.1:18545`. Trên Fuji phải chờ cửa sổ thật.

## Kiểm thử

```powershell
forge test --root contracts --match-path test/TournamentPrizePool.t.sol
pnpm test:tournament
```

Kiểm thử Solidity bao phủ 28 cặp, phân bổ, chữ ký, khiếu nại, quyền hủy, nạp quỹ tách kỳ thủ và hoàn tiền. Kiểm thử tích hợp dùng Anvil và WebSocket thực với tám ví test; không gửi giao dịch Fuji. `pnpm test:tournament` yêu cầu artifact từ Foundry và binary Anvil.

Kết quả kiểm chứng cục bộ: 180 bài Solidity (ngoài PoC audit), 133 bài shared, 89 bài relay và 143 bài web đạt. Ba bài relay cần PostgreSQL kiểm thử riêng được bỏ qua trong lượt này. Bài tích hợp giải chạy cả 28 ván qua WebSocket, lưu chữ ký/kết quả, xử lý khiếu nại, chốt và nhận thưởng. Trình duyệt đã hiển thị giải đủ 8 kỳ thủ và biên bản 4 nước của ván mẫu khớp mã trên Anvil. API biên bản trả 200 cho origin web và 403 cho origin ngoài danh sách.

## Chuẩn bị phiên Fuji

Đây là cấu hình để chuyển bản demo khi đã triển khai hợp đồng mới. Các địa chỉ và cấu hình của bản 1v1 cũ không được ghi đè trong lúc kiểm thử.

1. Từ thư mục monorepo, kiểm tra địa chỉ công khai trong `.env.fuji.local` rồi chạy mô phỏng. Sau khi mô phỏng thành công, chạy lệnh thứ hai và nhập mật khẩu keystore trong terminal. Script xác minh ví ký khớp `DEPLOYER_ADDRESS` và chặn gửi lại nếu đã có biên nhận triển khai.

   ```powershell
   powershell.exe -NoProfile -File .\scripts\fuji-deploy.ps1 -Tournament
   powershell.exe -NoProfile -File .\scripts\fuji-deploy.ps1 -Tournament -Broadcast
   ```

2. Lấy địa chỉ hợp đồng từ receipt tại `contracts/broadcast/DeployTournament.s.sol/43113/run-latest.json`. Thêm địa chỉ vào `.env.fuji.local` dưới tên `NEXT_PUBLIC_TOURNAMENT_ADDRESS`, rồi chạy `node scripts/fuji-preflight.mjs .env.fuji.local --deployed`. Lệnh kiểm bytecode, giao diện giải đấu và `relaySigner()`. Khi phát hành mã, lưu ABI đã sinh trong `packages/shared/src/abi/TournamentPrizePool.ts`.
3. Trên Render, đặt `TOURNAMENT_ADDRESS` bằng địa chỉ contract mới. Giữ `CHAIN_ID=43113`, relay key, `DATABASE_URL`, CORS và `/healthz` như cấu hình hosting đã kiểm tra. Relay chọn chế độ giải mới khi biến này có giá trị. Cấu trúc PostgreSQL cũ dùng khóa gồm chain và địa chỉ contract, nên không cần sửa schema hay chuyển dữ liệu phòng. Kiểm `/readyz` trước khi chuyển web.
4. Trên Vercel, thêm `NEXT_PUBLIC_TOURNAMENT_ADDRESS` cùng địa chỉ và build lại; giữ `NEXT_PUBLIC_RELAY_URL`, chain ID và RPC. Trang chủ chuyển tới `/tournaments`. Không nhập khóa riêng hoặc URL database vào web.
5. Chạy `node scripts/check-online.mjs .env.fuji.local` để kiểm trang chủ chuyển tới giải đấu, các trang Cup trả 200 và thử thách WSS của relay dùng đúng hợp đồng Fuji. Sau đó thử giải hai kỳ thủ trên Fuji và đối chiếu nạp quỹ, đăng ký, kết quả tạm, khiếu nại, chốt thưởng, nhận thưởng và biên bản.

Nếu cần quay lại bản cũ, đồng bộ cấu hình cả hai phía bằng cách bỏ hai biến địa chỉ tournament và deploy lại. Các luồng rút tiền cũ và dữ liệu cũ vẫn nằm ở địa chỉ hợp đồng cũ; không gửi tiền từ quỹ mới sang hợp đồng cũ.
