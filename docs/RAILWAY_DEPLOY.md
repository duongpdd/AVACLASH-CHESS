# Relay trên Railway, giao diện trên Vercel

Đây là phương án cũ ngày 01/11/2026, giữ để tham khảo. Người dùng đã chuyển sang [Render Free + Neon Free + Vercel](RENDER_DEPLOY.md) ngày 02/11/2026. Hợp đồng Fuji đã triển khai và xác minh; xem [FUJI_DEPLOY.md](FUJI_DEPLOY.md). Trạng thái hosting hiện tại được ghi trong hướng dẫn Render.

## Đã chuẩn bị trong source

- `railway.json`: Dockerfile `deploy/relay/Dockerfile`, một replica, không sleep, `/readyz`, timeout 120 giây, tối đa 10 lần restart khi lỗi, thời gian shutdown 15 giây, overlap 0.
- Guard khởi động Railway: phải có volume `/data`, đường dẫn kết quả/snapshot nằm trong volume, chain Fuji và danh sách origin HTTPS chính xác. Các phiên Anvil local vẫn dùng cấu hình riêng.
- `deploy/railway/.env.example`: biến Railway, dùng Escrow Fuji hiện tại; khóa relay và origin web để trống tới khi cấu hình trên tài khoản thật.
- `prepare-deploy.mjs --target railway`: sinh riêng env Railway/Vercel, không đưa private key vào output và không ghi đè thư mục đã có.

Kiểm chứng: 78 kiểm thử relay đạt (gồm 14 kiểm thử guard Railway), 5 kiểm thử deploy đạt, TypeScript relay đạt, các trường trong `railway.json` tương thích schema chính thức tải ngày 01/11/2026. Chưa chạy Docker hoặc deploy Railway/Vercel trong đợt này vì chưa có phiên tài khoản được kết nối.

## 1. Kết nối và đưa source lên GitHub

Đăng nhập Railway và Vercel bằng tài khoản của người dùng. Khi thao tác qua Codex, cài/kết nối Railway, Vercel và GitHub để truy cập đúng tài khoản. Không gửi token đăng nhập trong chat.

Repository nên để **private**. Gốc repository là nội dung `avaclash-chess`, nơi có `pnpm-workspace.yaml`, `railway.json` và `web/`. Hiện local chưa có remote; cần tạo/link repository rồi commit/push source hiện tại. Không push `.env.fuji.local`, `web/.env.local`, `packages/relay/.env.local`, `.local/`, keystore hoặc Foundry cache/broadcast. Giữ ABI trong `packages/shared/src/abi`.

## 2. Tạo hai project và lấy origin web

Trên Vercel, tạo project từ repository với Root Directory `web`, bật **Include source files outside Root Directory**, Node 22.x. Dùng các lệnh trong `web/vercel.json`; không chạy build contracts trên Vercel.

Lấy **origin production thực tế** tại Settings → Domains, ví dụ `https://TEN-THUC-TE.vercel.app`. Origin không có dấu `/` cuối. Chưa thể hoàn tất build web khi chưa có relay URL; nếu lần build đầu báo thiếu env thì cấu hình ở bước 4 rồi deploy lại. Không coi domain `avaclash.vercel.app` trong tệp mẫu là domain đã sở hữu.

## 3. Tạo relay Railway

Tạo project/service từ cùng repository. Đặt Root Directory `/`, để Railway đọc `railway.json` ở gốc. Đây chỉ là service relay; frontend được build trên Vercel. Nếu repository chứa cả PRJ1, cần chỉnh root/config path tương ứng hoặc dùng repository gốc đúng cấu trúc trên.

Trước khi đưa service vào sử dụng:

1. Gắn một volume vào service, mount path **`/data`**. Một replica, một region; không nhân bản relay hoặc bật sleep.
2. Trong Variables, nhập các biến công khai từ `deploy/railway/.env.example`. `ALLOWED_ORIGINS` là origin web thật vừa lấy. Đặt `RAILWAY_RUN_UID=0` để ghi được volume do Railway mount với owner root. Biến `RAILWAY_VOLUME_MOUNT_PATH` do nền tảng cấp; không tự điền biến này để vượt guard.
3. Đặt `RELAY_PRIVATE_KEY` trực tiếp trong Variables/kho bí mật Railway. Đây là khóa riêng của ví **Relay `0x39d8Ba81d73D22eD18c2Cf9E1136758942e082bF`**, khác khóa Deployer. Không đưa vào Git, chat hoặc biến Vercel. Relay tự đối chiếu signer on-chain trước khi listen.
4. Deploy. Startup phải đạt readiness: Fuji chain 43113, Escrow có bytecode, signer đúng, relay có ít nhất 0.1 AVAX testnet và ghi/atomic rename thành công trên volume.
5. Settings → Networking → Public Networking → **Generate Domain**, target port **8080** (hoặc giá trị PORT thực tế). Chỉ dùng HTTP public edge, không thêm TCP Proxy cho relay.

Railway cấp HTTPS và hỗ trợ WebSocket trên domain này. Ví dụ URL HTTP `https://TEN-THUC-TE.up.railway.app` tương ứng relay URL **`wss://TEN-THUC-TE.up.railway.app`**. Phương án này không dùng Caddy hay yêu cầu mua domain riêng.

`TRUST_PROXY=true` trong env Railway giả định mọi kết nối public đi qua Railway HTTP edge, nơi header IP được kiểm soát. Không dùng env này nguyên trạng với mạng nội bộ hoặc TCP Proxy có thể nhận header trực tiếp từ bên gọi. Tách service khỏi các workload không tin cậy.

## 4. Điền URL thực tế và build web

Trong `.env.fuji.local`, giữ hai địa chỉ hợp đồng đã deploy, sửa:

```dotenv
NEXT_PUBLIC_RELAY_URL=wss://TEN-THUC-TE.up.railway.app
WEB_ORIGIN=https://TEN-THUC-TE.vercel.app
```

Từ monorepo:

```powershell
node scripts/fuji-preflight.mjs .env.fuji.local --deployed
node scripts/prepare-deploy.mjs .env.fuji.local --target railway
```

Output:

- `.local/deploy-railway/web.env`: import vào Vercel Production rồi deploy/redeploy. Không có private key.
- `.local/deploy-railway/relay.env`: đối chiếu/import biến công khai vào Railway. **Không import lại dòng `RELAY_PRIVATE_KEY=` để làm trống khóa đã đặt.** Khóa được cấu hình riêng trong Railway; file sinh mới luôn để trống.

Công cụ từ chối ghi đè output có sẵn. Khi đổi URL, chuyển thư mục output cũ sang vị trí sao lưu rồi sinh lại. Thay biến `NEXT_PUBLIC_*` cần build web lại. Origin Vercel cuối cùng phải khớp `ALLOWED_ORIGINS` của relay; chỉ thêm preview origin cụ thể khi cần, không dùng wildcard.

## 5. Nghiệm thu và vận hành

```powershell
node scripts/check-online.mjs .env.fuji.local
```

Kiểm tra 5 route web, `/healthz`, `/readyz`, WebSocket đúng origin và từ chối origin khác. Sau đó hai profile/ví Fuji tự ký chơi trọn ván, settle/withdraw, reload/reconnect. Giao dịch deploy đã thành công không thay thế nghiệm thu một ván online.

Giữ volume qua redeploy. Thiết lập backup từ Railway và kiểm tra khả năng khôi phục; xem thêm [OPERATIONS.md](OPERATIONS.md). Nền tảng kiểm health khi deploy, không thay thế dịch vụ theo dõi readiness liên tục. Theo dõi thêm gas ví relay và dung lượng volume. Chưa tạo dịch vụ cảnh báo/backup trả phí trong đợt chuẩn bị.

Railway có giới hạn trial và tính phí tài nguyên; dùng đúng workspace/gói của người dùng, theo dõi Usage. Không nâng gói trả phí chỉ để bỏ qua lỗi build hoặc cấu hình.

## Nguồn chính thức

- [Railway config as code](https://docs.railway.com/config-as-code/reference).
- [Railway volume: mount path, quyền và backup](https://docs.railway.com/volumes).
- [Railway HTTP/WebSocket và header](https://docs.railway.com/networking/public-networking/specs-and-limits).
- [Railway xác nhận overwrite header IP tại public edge](https://station.railway.com/questions/need-authoritative-client-ip-proxy-tru-090eac86).
- [Railway trial](https://docs.railway.com/pricing/free-trial), [giá](https://docs.railway.com/pricing/plans).

Hướng dẫn Docker/Caddy trên VPS tại [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) là phương án thay thế, không cần thực hiện đồng thời với Railway.
