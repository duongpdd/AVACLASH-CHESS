# Chạy thử trên Avalanche Fuji

Cập nhật 01/11/2026, 23:09 giờ Việt Nam. **Đã triển khai hợp đồng lên Fuji (43113)** bằng keystore của người dùng. Đã đối chiếu trực tiếp RPC: 4/4 receipt thành công ở các block 60358129, 60358130, 60358132 và 60358134; 14 kiểm tra chain/gas/bytecode/owner/vai trò/liên kết/chế độ mặc định đạt. Deployer còn khoảng 0.35 AVAX testnet, relay có 0.15. [Bằng chứng giao dịch và kiểm tra](benchmarks/fuji-deployment.json).

| Hợp đồng | Địa chỉ Fuji |
| --- | --- |
| ChessEscrow | `0x638135fA831A000DD438c6F6EFa7e75BC36aC78F` |
| AvaClashMeta | `0x188FA04D5959164Ca8823ca32C89A73D62BEbF78` |

Địa chỉ đã lưu trong `.env.fuji.local`. Relay WSS/domain và web Vercel **chưa triển khai**; endpoint relay trong tệp vẫn là placeholder, nên preflight toàn bộ cấu hình public vẫn báo chưa sẵn sàng. Không lấy kết quả triển khai hợp đồng thay cho nghiệm thu PvP Fuji. Các hướng dẫn deploy dưới đây phục vụ tái lập trên phiên bản mới; không chạy lại `-Broadcast` cho bản này. Báo cáo `benchmarks/fuji-preflight.json` cũ chỉ phản ánh thời điểm chưa có ví/gas.

## Chuẩn bị tài khoản

Tạo các tài khoản testnet do bạn quản lý: deployer, relay, arbiter và treasury, địa chỉ khác nhau. Deployer/relay và hai ví chơi cần AVAX testnet. Trọng tài và treasury cần gas nếu thực hiện giao dịch quản trị. Không dùng private key công khai của Anvil trên Fuji.

MetaMask/Core: chain ID **43113**, RPC `https://api.avax-test.network/ext/bc/C/rpc`, symbol **AVAX**. Thông số đối chiếu [Avalanche Support](https://support.avax.network/en/articles/6224787-how-to-connect-to-the-fuji-testnet). Lấy AVAX thử nghiệm theo liên kết Console Faucet trong [hướng dẫn chính thức](https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/02-network-setup). Chủ ví tự nối ví/ký/xử lý CAPTCHA nếu có; không gửi seed phrase/private key qua chat.

Tạo `.env.fuji.local` ở gốc repository (đã git-ignore) chứa các địa chỉ công khai và RPC, theo `deploy/fuji.env.example`. Khóa relay chỉ đặt trong secret manager hoặc `.env.local` riêng của daemon, không trong web `NEXT_PUBLIC_*`.

```powershell
node scripts/fuji-preflight.mjs .env.fuji.local
```

Script chỉ đọc RPC, kiểm tra chain, các địa chỉ khác nhau và số dư deployer/relay; sau deploy có thể kiểm tra bytecode qua các biến `NEXT_PUBLIC_*_ADDRESS`. Số dư khác 0 không phải bảo đảm đủ gas cho mọi thao tác.

## Deploy bằng keystore của chủ ví

Trên Windows đã có cấu hình `.env.fuji.local`, có thể dùng helper từ thư mục PRJ1:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\avaclash-chess\scripts\fuji-deploy.ps1
```

Lệnh trên chỉ mô phỏng, không cần khóa. Thêm `-Broadcast` để triển khai thật trên Fuji; helper kiểm RPC/gas, yêu cầu mật khẩu để xác minh keystore khớp `DEPLOYER_ADDRESS`, rồi Forge yêu cầu mật khẩu lần nữa để ký. Không nhập mật khẩu/private key vào chat hoặc tham số lệnh. `ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình PowerShell này. Helper từ chối broadcast nếu đã có `contracts/broadcast/Deploy.s.sol/43113/run-latest.json`; nếu có giao dịch thất bại một phần, rà soát receipt trước khi quyết định resume, không chạy lại deploy tùy ý.

Từ `contracts/`, chủ ví nhập keystore tương tác bằng `cast wallet import avaclash-deployer --interactive`. Không đưa private key vào command line/history. Nạp các biến công khai từ `.env.fuji.local` vào môi trường shell (Foundry không tự đọc tên tệp này).

```powershell
forge script script/Deploy.s.sol:DeployScript --rpc-url https://api.avax-test.network/ext/bc/C/rpc --account avaclash-deployer
```

Đây là dry run. Sau khi kiểm tra địa chỉ vai trò và kết quả mô phỏng, chủ ví chạy cùng lệnh có `--broadcast`. Script từ chối chain ngoài 31337/43113. Giữ artifact broadcast và tx hashes; không công bố thư mục cache chứa dữ liệu nhạy cảm.

Deploy mới liên kết Meta/Escrow hai chiều; single-signed và cược khán giả mặc định tắt. Không bật cược khán giả chỉ để điền trạng thái “hoàn thành”: hai người chơi vẫn có thể chủ ý dàn xếp kết quả.

## Cấu hình sau deploy

Web `.env.local`: `NEXT_PUBLIC_CHAIN_ID=43113`, RPC Fuji, địa chỉ Escrow/Meta mới và relay `wss://` khi dùng HTTPS. Relay: `CHAIN_ID=43113`, `RPC_URL`, `ESCROW_ADDRESS`, khóa của đúng `relaySigner`, `ALLOWED_ORIGINS` là origin web chính xác, `ALLOW_NO_ORIGIN=false`, `SIGNAL_GAME_STARTED_ENABLED=true`, thư mục dữ liệu bền vững. Không chép nguyên env Anvil sang Fuji.

Chạy build shared rồi web/relay; khởi động relay, xác nhận `/readyz` trả 200, sau đó mở hai profile trình duyệt, mỗi profile một ví, cùng Fuji. Xem `OPERATIONS.md` để cấu hình reverse proxy, giám sát và sao lưu.

## Nghiệm thu 20 trận Fuji còn phải thực hiện

Mỗi trận ghi room ID, hai địa chỉ, màu, stake, create/join tx, thời điểm ký Join, transcript UCI, lý do kết thúc, settle/withdraw tx, gas và số dư trước/sau trừ gas. Có thắng bằng chiếu hết, đầu hàng, hòa; thử refresh, ngắt mạng, đổi ví, trùng tab, hết giờ, hủy phòng Open và hoàn tiền khi hết hạn. Chỉ công bố số liệu Fuji từ receipt Fuji.

Chiến dịch `pnpm test:campaign` hiện chỉ tạo Anvil riêng và ví Node kiểm thử, không tự ký MetaMask hoặc chạy 20 trận trên Fuji. Đánh giá độc lập và tích hợp yield cũng chưa được thay thế bằng kết quả local này.
