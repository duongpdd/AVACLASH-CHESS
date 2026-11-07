# Đưa web lên Vercel và chạy relay Fuji

**Phương án đã chọn hiện tại: [Railway cho relay, Vercel cho giao diện](RAILWAY_DEPLOY.md).** Các bước Docker/Caddy bên dưới dành cho VPS riêng; không cần mua domain hoặc chạy Caddy nếu dùng Railway.

Bộ triển khai chuẩn bị ngày 01/11/2026. Hợp đồng Fuji đã deploy và kiểm tra trực tiếp RPC thành công: 4 receipt, 14 kiểm tra trạng thái; xem [địa chỉ và bằng chứng Fuji](FUJI_DEPLOY.md). Địa chỉ thực tế đã lưu trong `.env.fuji.local`. Chưa có máy chủ/domain relay hoặc bản deploy Vercel. Cấu hình local hiện có được giữ trong các tệp env riêng.

## Kiểm chứng bộ triển khai

- Production build local và lệnh `web/scripts/build-vercel.mjs` với env fixture đều đạt; fixture chỉ phục vụ kiểm tra build, không phải địa chỉ hợp đồng/relay đang hoạt động.
- 4 kiểm thử deploy đạt: cấu hình public, địa chỉ vai trò, preflight sau deploy với các lỗi phụ thuộc, và chặn build khi thiếu env.
- 6 kiểm thử readiness relay đạt; TypeScript shared/relay đạt.
- Đóng gói production bằng pnpm 9.15.0 đạt, nạp được `RelayServer` từ gói độc lập; phiên bản trực tiếp viem/ws/zod khớp bản đang dùng.
- RPC Fuji trả chain 43113; env mẫu với địa chỉ 0x0 báo chưa sẵn sàng. Cấu hình thực tế đã có bốn vai trò, gas và hai hợp đồng; endpoint relay WSS vẫn là placeholder.
- Máy hiện chưa có Docker: **chưa chạy build/start container hoặc TLS/WSS thật**. CI đã thêm job build image nhưng chưa chạy trên GitHub. Chưa có URL web/relay online hoặc nghiệm thu PvP Fuji; giao dịch triển khai hợp đồng đã được xác nhận trong báo cáo Fuji.

## 1. Chuẩn bị các đầu vào

- Tài khoản Vercel, repository chứa **nội dung thư mục `avaclash-chess`**. Repository local hiện chưa có remote; tạo repository trên tài khoản của bạn rồi push mã nguồn trước khi Import Project. Giữ các tệp mới trong bộ triển khai và ABI tại `packages/shared/src/abi` trong commit.
- Bốn tài khoản testnet khác nhau: deployer, relay, arbiter, treasury. Deployer, relay và hai ví chơi có AVAX testnet; relay cần ít nhất 0.1 AVAX để đạt readiness mặc định. Số dư deployer khác 0 chưa bảo đảm đủ gas; dry run sẽ ước tính gas thực tế.
- Một máy chủ Linux có Docker Engine và Compose v2, cùng domain relay trỏ DNS trực tiếp tới IP công khai của máy. Mở TCP 80/443. Bản này chạy **một replica relay**, dữ liệu phòng trên volume của máy đó; chưa hỗ trợ chia phòng giữa nhiều replica.
- Origin web ổn định, ví dụ `https://TEN-DU-AN.vercel.app`; domain relay riêng, ví dụ `wss://relay.TEN-MIEN-CUA-BAN.vn`. Thay các giá trị ví dụ bằng tên thực tế. Không đưa máy Anvil hoặc khóa Anvil lên mạng công khai.

Sao chép `deploy/fuji.env.example` thành `.env.fuji.local` tại gốc monorepo, điền bốn địa chỉ ví và origin/domain thực. Chỉ chứa cấu hình công khai; không thêm private key vào tệp này.

## 2. Deploy hợp đồng Fuji

Làm theo [FUJI_DEPLOY.md](FUJI_DEPLOY.md) để tạo keystore tương tác và nạp biến công khai vào shell. Preflight trước deploy kiểm RPC, bốn địa chỉ vai trò và gas; địa chỉ hợp đồng placeholder được bỏ qua cho tới khi có địa chỉ deploy thật. Cờ `--deployed` bắt buộc kiểm cả hai hợp đồng.

```powershell
node scripts/fuji-preflight.mjs .env.fuji.local
```

Từ `contracts`, mô phỏng trước:

```powershell
forge script script/Deploy.s.sol:DeployScript --rpc-url https://api.avax-test.network/ext/bc/C/rpc --account avaclash-deployer
```

Sau khi xem mô phỏng, chủ ví chạy lại với `--broadcast`. Deployer phải là người gửi và owner của cả hai hợp đồng. Lưu hai địa chỉ trả về vào `NEXT_PUBLIC_ESCROW_ADDRESS` và `NEXT_PUBLIC_META_ADDRESS` trong `.env.fuji.local`.

```powershell
node scripts/fuji-preflight.mjs .env.fuji.local --deployed
node scripts/prepare-deploy.mjs .env.fuji.local
```

Preflight sau deploy kiểm chain, gas, bytecode, owner, ba vai trò, liên kết Escrow/Meta hai chiều và hai chế độ single-signed/spectator mặc định tắt. Nó không chứng minh bytecode đã được audit. Công cụ tạo `.local/deploy/web.env` và `.local/deploy/relay.env`; từ chối ghi đè thư mục đã có. Khóa relay luôn để trống. Không ghi đè env của phiên Anvil đang chạy.

## 3. Khởi động relay và WSS

Đưa source lên máy Linux, gồm lockfile, packages và thư mục deploy. Trên máy chủ, từ gốc repository:

```bash
cp .local/deploy/relay.env deploy/relay/.env
chmod 600 deploy/relay/.env
```

Nếu không chuyển thư mục `.local`, chuyển riêng `relay.env` vào `deploy/relay/.env`. Đặt `RELAY_PRIVATE_KEY` trực tiếp trên máy chủ bằng trình soạn thảo/kho bí mật; địa chỉ của khóa phải khớp `RELAY_SIGNER_ADDRESS` đã deploy. Không đặt khóa vào lệnh shell, Git, chat hay Vercel. Có thể dùng `deploy/relay/.env.example` để đối chiếu.

```bash
cd deploy/relay
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build
docker compose ps
docker compose logs --tail=100 relay caddy
```

Không chạy `docker compose config` thiếu `--quiet` khi chia sẻ output: bản đầy đủ chứa env và khóa. Relay tự kiểm RPC/signer/gas/storage trước khi listen. Caddy chỉ khởi động sau khi relay healthy, cấp TLS tự động và proxy cả HTTP/WebSocket. `TRUST_PROXY=true` chỉ phù hợp với topology này: cổng 8080 không publish ra ngoài, Caddy ghi đè `X-Forwarded-For`. Không để CDN/proxy khác trước Caddy khi chưa cấu hình lại trust/IP.

`relay-data` lưu `/data/results` và snapshots active; `caddy-data` lưu chứng chỉ. Không dùng `docker compose down -v` khi cần giữ dữ liệu. Docker đánh dấu unhealthy khi readiness hỏng nhưng không tự restart chỉ vì unhealthy; cần theo dõi `/readyz` và xử lý sự cố. Restart tự động áp dụng khi process thoát.

Backup nhất quán: dừng relay, sao chép `/data/results` ra nơi khác, khởi động lại; sau đó dùng `scripts/relay-storage.mjs` để tạo manifest/kiểm toàn vẹn theo [OPERATIONS.md](OPERATIONS.md). Bản sao phải nằm ngoài volume/máy chủ để chịu được mất máy. Chưa tự cấu hình dịch vụ backup hoặc cảnh báo trả phí.

## 4. Tạo dự án Vercel

Import repository rồi đặt:

| Thiết lập                                   | Giá trị                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Root Directory                              | `web` nếu repo gốc là avaclash-chess; `avaclash-chess/web` nếu repo chứa thêm PRJ1 |
| Include source files outside Root Directory | Bật                                                                                |
| Framework                                   | Next.js                                                                            |
| Node.js                                     | 22.x                                                                               |
| Install Command                             | Từ `web/vercel.json`: `corepack pnpm@9.15.0 install --frozen-lockfile`             |
| Build Command                               | Từ `web/vercel.json`: `node scripts/build-vercel.mjs`                              |
| Output Directory                            | `.next`                                                                            |

Import các biến trong `.local/deploy/web.env` vào môi trường **Production** của Vercel. Không upload `.env.local` của Anvil. Có thể đặt `ENABLE_EXPERIMENTAL_COREPACK=1` theo hướng dẫn Vercel. Các `NEXT_PUBLIC_*` được chốt lúc build; thay biến phải build/deploy lại.

Đặt riêng `AUTH_SESSION_SECRET` trong biến môi trường máy chủ của Vercel. Dùng giá trị ngẫu nhiên ít nhất 32 byte và giữ cùng một giá trị giữa các instance trong cùng môi trường. Khi thiếu biến này, trang công khai vẫn mở và máy chủ từ chối cấp phiên ví.

Build riêng cho Vercel chặn chain Anvil, địa chỉ thiếu/0x0, RPC không HTTPS, relay không WSS và hostname local. Nó build shared bằng TypeScript, dùng ABI đã commit nếu không có Foundry artifact, rồi build Next bằng webpack; không chạy `forge build` trên Vercel. `outputFileTracingRoot` bao gồm package shared trong monorepo.

`ALLOWED_ORIGINS` của relay phải đúng origin production (không path, không dấu `/` cuối). Nếu Vercel cấp tên khác với dự kiến, sửa `.env` relay rồi chạy `docker compose --env-file .env up -d --force-recreate relay`. Preview URL chỉ dùng được khi thêm **từng origin cụ thể**; không dùng wildcard `*.vercel.app`. Phiên preview nên có relay/hợp đồng test riêng nếu cần chơi, tránh làm gián đoạn phòng production.

## 5. Kiểm tra sau triển khai

Cập nhật `WEB_ORIGIN` nếu cần rồi chạy từ monorepo trên máy có dependency:

```powershell
node scripts/fuji-preflight.mjs .env.fuji.local --deployed
node scripts/check-online.mjs .env.fuji.local
```

`check-online` kiểm 5 route trả 200, health/readiness relay, WSS chấp nhận origin web và trả 403 cho origin khác. Nó không ký, tạo phòng hoặc chi tiền. Nếu Vercel bật bảo vệ truy cập, kiểm tra sẽ thất bại tới khi có thể truy cập bằng trình duyệt/người chơi theo cấu hình mong muốn.

Sau đó hai profile, mỗi profile một ví Fuji, tự ký và kiểm trọn luồng tạo phòng → join → Join v2 → đi cờ → kết thúc → settle → withdraw. Thử reload/reconnect, từ chối ký, đầu hàng, hòa, hết giờ và hủy phòng. Ghi tx hash và số dư; chiến dịch local không thay thế kiểm chứng Fuji. Chỉ gọi là deploy online hoàn tất khi có URL, relay ready và giao dịch Fuji thực tế.

## Nguồn cấu hình

- [Vercel monorepo và quyền đọc source ngoài Root Directory](https://vercel.com/docs/monorepos/monorepo-faq).
- [Vercel package managers/Corepack](https://vercel.com/docs/package-managers).
- [Caddy reverse proxy và WebSocket](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Vercel hiện có WebSocket Functions, nhưng [kết nối có thời hạn và trạng thái phải chia sẻ ngoài instance](https://vercel.com/docs/functions/websockets). Relay hiện giữ phòng/đồng hồ trong process và lưu snapshots trên đĩa, nên bộ này dùng dịch vụ Docker riêng; chưa chuyển relay sang Functions.
