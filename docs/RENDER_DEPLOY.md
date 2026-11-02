# Render Free + Neon Free + Vercel

Phương án người dùng chọn ngày 02/11/2026 cho bản thử nghiệm Fuji. Không yêu cầu VPS hoặc domain riêng. Giữ repository GitHub Private.

## Trạng thái thực tế

- Neon: project `avaclash-chess` (`gentle-sound-48456305`), PostgreSQL 17, Singapore, tổ chức Free, compute giới hạn 0.25 CU. Branch production `br-patient-violet-b36wfxfq`, branch kiểm thử `relay-storage-validation` (`br-cold-bonus-b34dlql9`). Đã chạy migration `001-relay-games.sql` trên nhánh kiểm thử rồi production.
- Vercel: project `avaclash-chess`, Node 22, root `web`, **READY** ở https://avaclash-chess.vercel.app. Deployment `dpl_ES82SJP18t6CuaW1wbgz9cvPGsCq` dùng commit `a3976ff47ec8973f40c45b8551611faa98dc938a`, đã gắn URL relay thật.
- Render: service `srv-dbkb5h8473hc7385uhpg`, Free, Singapore, một instance; **live** tại https://avaclash-chess-relay.onrender.com. Deploy `dep-dbkba1dg1s2s739ru5cg`, cùng commit với Vercel. Đã xác minh HTTP health path `/healthz` và signer đúng ví relay. Người dùng tự nhập relay key trên Render; database URL production đã được lưu sau khi người dùng đồng ý rõ ràng.
- GitHub: source đã tải lên repo **Private** `duongpdd/AVACLASH-CHESS`. Local đã gắn `origin`; snapshot phát hành được tạo qua API, không đẩy lịch sử local lên GitHub. Không force-push nhánh local để thay lịch sử remote; khi cập nhật phải giữ remote head làm parent.
- Hợp đồng Fuji đã triển khai; xem [receipt và địa chỉ](FUJI_DEPLOY.md). Không deploy lại hợp đồng cho thay đổi storage này.

Đã đạt 9/9 kiểm tra kết nối HTTP/health/WSS, 14/14 kiểm tra chain/contract/vai trò/gas, xác minh bundle public dùng đúng relay/contract/RPC, và kiểm tra trình duyệt thấy trang chủ cùng bàn cờ hot-seat tải đúng. Chưa chơi ván PvP hai ví hoặc gửi giao dịch settlement/withdraw thực tế trên Fuji. Xem [bằng chứng online](benchmarks/online-deployment.json).

Service hiện được tạo và cấu hình trực tiếp qua Render MCP; `render.yaml` là cấu hình tái lập, chưa liên kết Blueprint tự đồng bộ. File đã đạt JSON Schema 2020-12 chính thức; thay đổi YAML cục bộ không tự sửa service hiện có.

## Dữ liệu được giữ như thế nào

Render Free dùng filesystem tạm: relay bắt buộc PostgreSQL, không tự chuyển về file khi thiếu database. Local Anvil vẫn dùng file như trước.

Relay lưu snapshot và kết quả cuối ván vào Neon. Nước đi, đồng hồ và thông báo kết thúc được gửi sau khi commit thành công. Kết quả không bị thay thế bằng ván mới; sau restart, người chơi ký challenge mới rồi có thể yêu cầu relay ký lại cùng kết quả với deadline mới. Khôi phục ván giữ đồng hồ đã lưu, không tính thời gian server ngừng chạy, với khoảng chờ kết nối lại hiện tại 120 giây.

Lease từng phòng dùng giờ của PostgreSQL, hết hạn sau 45 giây; revision và owner được kiểm tra trong cùng câu UPDATE. Khi hai phiên bản Render chồng nhau, chỉ một phiên có thể ghi ván. Phiên mới có thể yêu cầu thử lại trong tối đa 45 giây. Gia hạn chỉ khi có phòng chờ/đang chơi, dừng khi kết thúc; không tạo ping giữ server Free thức. Nếu không lưu được hoặc mất lease, relay ngừng xử lý ván và đóng kết nối; không phát chữ ký cho kết quả chưa lưu bền vững.

`/healthz` kiểm tra tiến trình và trạng thái lỗi storage, không gọi Neon/RPC mỗi lần Render probe. Startup và `/readyz` kiểm tra schema, RPC, signer, gas. Không dùng `/readyz` làm uptime ping định kỳ.

## Đưa relay lên Render

1. Cấp quyền repo private qua [GitHub Apps](https://github.com/settings/installations). Nếu chưa cài Render, dùng [trang cài Render](https://github.com/apps/render/installations/new). Source phải được kiểm tra secret trước khi push.
2. Dùng Blueprint `render.yaml`, hoặc tạo Web Service Docker với context `.`, Dockerfile `deploy/relay/Dockerfile`, region Singapore, plan **Free**, một instance, health path `/healthz`. Không tạo Render Postgres hoặc disk trả phí.
3. Đặt `DATABASE_URL` thành URL **pooled production** từ Neon, có `sslmode=verify-full`. Không dùng branch kiểm thử. Đặt `RELAY_PRIVATE_KEY` chỉ trong Render Environment; key phải thuộc signer `0x39d8Ba81d73D22eD18c2Cf9E1136758942e082bF`. Không đưa key vào chat, GitHub hay Vercel.
4. Các biến công khai đã có trong Blueprint: Fuji 43113, RPC Fuji, Escrow thật, `ALLOWED_ORIGINS=https://avaclash-chess.vercel.app`, `ALLOW_NO_ORIGIN=false`, bind `0.0.0.0`, port 10000. Startup xác minh key khớp `relaySigner` trên chain và số dư tối thiểu 0.1 AVAX testnet.
5. Sau deploy, kiểm tra `/healthz` và `/readyz`, rồi ghi **URL thật** `wss://<domain Render được cấp>` vào `NEXT_PUBLIC_RELAY_URL` của Vercel. Không build web bằng URL giả.
6. Deploy Vercel từ cùng source: install `corepack pnpm@9.15.0 install --frozen-lockfile`, build `node scripts/build-vercel.mjs`, Node 22, root `web`.
7. Kiểm tra web → WebSocket → xác thực ví → ván đấu → lưu/khôi phục → kết quả ký → settlement/withdraw trên Fuji. Chưa gọi bản triển khai hoàn tất trước khi kiểm tra này đạt.

Env generator (chỉ sau khi `.env.fuji.local` có domain thật):

```powershell
node scripts/prepare-deploy.mjs .env.fuji.local --target render
```

Output nằm trong `.local/deploy-render/`, đã git-ignore. Generator luôn để trống database URL và relay key, không sao chép secret từ môi trường. Local Anvil env được giữ riêng.

## Migration và kiểm thử storage

Migration được quản lý tại `packages/relay/migrations/001-relay-games.sql`; chỉ thêm bảng, không xóa dữ liệu. Với migration mới, kiểm thử branch trước rồi áp dụng production bằng URL **direct**. Không chạy migration với URL `-pooler`.

```powershell
node node_modules/typescript/bin/tsc -p packages/relay/tsconfig.json
node --env-file=.env.neon.validation.local packages/relay/dist/migrate.js
node --env-file=.env.neon.validation.local packages/relay/node_modules/vitest/vitest.mjs run packages/relay/tests/postgres-storage.test.ts
node --env-file=.env.neon.prod.local packages/relay/dist/migrate.js
```

Các env file Neon được tạo cục bộ và git-ignore; không in hoặc commit nội dung. Nhánh kiểm thử giữ các fixture nhỏ phục vụ xác minh; không dùng để host production. Bài kiểm thử database tự skip khi thiếu `TEST_DATABASE_URL`; unit test chặn acknowledge trước commit vẫn chạy trong CI. Xem [bằng chứng storage](benchmarks/neon-storage-validation.json) để phân biệt database thật và chain mô phỏng.

## Giới hạn Free

[Render Free](https://render.com/docs/free) có thể ngủ sau 15 phút không nhận traffic; khởi động lại mất khoảng một phút, filesystem bị mất. Neon giữ dữ liệu trong giới hạn gói Free; vượt quota có thể làm gián đoạn. Đây là cấu hình thử nghiệm Fuji, chưa phải bảo đảm hoạt động liên tục cho ván cược tiền thật. Không thêm uptime ping để né sleep; chuyển gói khi cần vận hành liên tục.
