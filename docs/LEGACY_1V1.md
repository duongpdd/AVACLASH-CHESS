# Bản 1v1 ký quỹ cũ

Tài liệu lịch sử của bản 1v1 có cược, được giữ để tham khảo. Bài dự thi hiện là AvaClash Cup, xem [README dự án](../README.md).

Web và relay công khai hiện chạy AvaClash Cup. Phát triển và kiểm thử cục bộ bằng **Anvil (31337)**; hợp đồng Cup chỉ hỗ trợ Anvil và **Avalanche Fuji (43113)**.

## Bắt đầu

Yêu cầu Node.js 20.12 trở lên (hoặc 22/24), pnpm 9.15 và Foundry (`forge`, `anvil`, `cast`). Thư mục monorepo là `avaclash-chess`, không phải thư mục cha PRJ1.

```powershell
cd avaclash-chess
pnpm install --frozen-lockfile
forge build --root contracts
pnpm --filter @avaclash/shared build
```

Các thư viện Foundry nằm trong `contracts/lib`. Nếu checkout chưa có chúng, khôi phục các dependency/submodule của repository trước khi build.

Để dựng môi trường cục bộ:

```powershell
pnpm dev:local
```

Lệnh này mở Anvil trên `127.0.0.1:8545`, deploy hai hợp đồng **chỉ trên Anvil**, tạo và cấp tiền cho ví relay ngẫu nhiên, sinh ABI/build shared, cập nhật `web/.env.local` và `packages/relay/.env.local`. Anvil lưu state vào `.local/anvil-state.json` mỗi 5 giây; lần chạy tiếp theo khôi phục khi state/config khớp. Mỗi chain mới dùng thư mục relay riêng. Anvil chạy tới khi nhấn Ctrl+C. Script không in khóa relay và không gắn khóa mẫu vào mã nguồn.

Mở hai terminal khác tại monorepo:

```powershell
pnpm --filter @avaclash/relay start
```

```powershell
pnpm dev
```

Mở `http://localhost:3000` bằng hai hồ sơ trình duyệt/ví riêng. Thêm mạng RPC `http://127.0.0.1:8545`, chain ID `31337`. Dùng tài khoản Anvil số 4 và 5 cho hai kỳ thủ; các tài khoản Anvil là tài khoản thử nghiệm công khai, không dùng với tài sản thật.

## Luồng PvP

1. Người A kết nối ví, chọn Trắng hoặc Đen, tạo phòng với cược 0.01–0.1 ETH trên Anvil hoặc AVAX trên Fuji theo giới hạn UI mặc định (hợp đồng cho tối đa 1 đơn vị).
2. Người B xem đúng mã phòng, màu và mức cược rồi gửi cùng số tiền để tham gia. Mã phòng bắt đầu từ **0**.
3. Hai người mở phòng, ký challenge Join để xác thực relay. Trong lúc chơi không có giao dịch cho từng nước đi. Relay tự gửi giao dịch `signalGameStarted` khi hai ghế sẵn sàng.
4. Hết ván, client replay lịch sử, ký Result v2 và dùng chữ ký relay để nộp kết quả 2-trong-3.
5. Sau receipt thành công, người thắng rút `95% × tổng cược` qua `withdraw()`. Hòa hoàn mỗi người 100% cược, không thu phí. Hủy phòng Open cũng dùng số dư chờ rút.

Nếu chưa có đối thủ, phòng on-chain vẫn Open và chưa mở kết nối thi đấu relay. Reload hoặc kết nối lại nhận lịch sử từ relay; web lưu thêm bản sao nước đi đã xác nhận trong localStorage.

## Cấu hình Fuji

Web và relay hiện dùng địa chỉ Cup trong [hướng dẫn Fuji](TOURNAMENT_DEMO.md). Cấu hình bên dưới áp dụng cho bản 1v1 cũ; [bằng chứng triển khai 1v1](benchmarks/online-deployment.json) được lưu để tham khảo. Các hướng dẫn [Railway](RAILWAY_DEPLOY.md) và [Docker/Caddy trên VPS](VERCEL_DEPLOY.md) được giữ làm phương án khác.

Sao chép `.env.example` cho cấu hình deploy, `packages/relay/.env.example` thành `.env.local` tại relay, và `web/.env.example` thành `web/.env.local`. Tệp root không tự cấu hình thay cho Next.js; các biến web phải nằm trong `web/.env.local` hoặc môi trường build.

| Thành phần | Biến cần thiết                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy     | `FUJI_RPC_URL`, `RELAY_SIGNER_ADDRESS`, `ARBITER_ADDRESS`, `TREASURY_ADDRESS` (ba địa chỉ khác nhau)                                   |
| Relay      | `RELAY_PRIVATE_KEY`, `ESCROW_ADDRESS`, `RPC_URL`, `CHAIN_ID=43113`, `PORT=8080`, `ALLOWED_ORIGINS`                                     |
| Web        | `NEXT_PUBLIC_ESCROW_ADDRESS`, `NEXT_PUBLIC_META_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID=43113`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_RELAY_URL` |

Relay tự đọc `.env.local`/`.env` của package. `RELAY_PORT` và `CHESS_ESCROW_ADDRESS` chỉ là tên tương thích cũ; ưu tiên `PORT` và `ESCROW_ADDRESS`. Biến `NEXT_PUBLIC_CONTRACT_ADDRESS` cũ không được dùng. Không đưa private key vào biến `NEXT_PUBLIC_*`.

Deploy Fuji bằng keystore, chạy từ `contracts` sau khi export các biến môi trường công khai:

```powershell
cast wallet import avaclash-deployer --interactive
forge script script/Deploy.s.sol:DeployScript --rpc-url $env:FUJI_RPC_URL --account avaclash-deployer
```

Sau khi xem kết quả mô phỏng và sẵn sàng deploy, thêm `--broadcast`. Lưu địa chỉ hai hợp đồng vào web và relay, sinh lại ABI và build shared. Deploy mới có thể cần thiết để sử dụng các sửa đổi hợp đồng; mã nguồn cục bộ không thay đổi bytecode đã triển khai trước đó.

Khi public web qua HTTPS, dùng relay `wss://`, đặt `ALLOWED_ORIGINS` đúng origin của web. Chỉ bật `TRUST_PROXY=true` khi relay nằm sau proxy tin cậy có ghi đè `X-Forwarded-For`. Giữ `ALLOW_NO_ORIGIN=false`. Render bắt buộc `STORAGE_DRIVER=postgres` và `DATABASE_URL` Neon; máy chủ dùng file thì phải mount ổ bền vững cho `RESULTS_DIR`/`ACTIVE_DIR`. Ví relay cần AVAX testnet trả gas cho tín hiệu bắt đầu.

## Kiểm tra

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter web check:build
forge test --root contracts --no-match-path "test/audit/**"
```

Build/test của web và relay build lại shared để ABI trong `dist` khớp artifact mới. Test tích hợp cần mở cổng localhost và tạo/đổi tên tệp tạm; sandbox chặn các thao tác này có thể gây lỗi môi trường. Foundry và node_modules cần được cài trước.

Giữ phiên bản pnpm 9.15 đã khóa trong `packageManager`. Không bỏ qua phiên bản này bằng pnpm mới: một số bản có thể tự cài lại hoặc đổi liên kết dependency khi chạy lệnh. Với môi trường offline, dùng CLI đã cài trong `node_modules` hoặc chuẩn bị pnpm đúng phiên bản từ trước.

## Phạm vi và giới hạn

- Có PvP, Hot-seat tại `/hotseat`, UI gửi/rút Vault và nhận thưởng mùa. Giao dịch spectator vẫn đóng; hợp đồng mặc định tắt cược khán giả.
- Focus telemetry chỉ cảnh báo sau khi rời màn hình quá 2 giây trong lượt đi, không phạt giờ hoặc xử thua và không chứng minh người chơi không dùng engine.
- Result dùng cơ chế hai chữ ký trong `{A, B, relay}`. Hợp đồng không replay cờ; hai kỳ thủ thông đồng vẫn có thể ký kết quả giả ảnh hưởng pool khán giả. Timeout/đầu hàng cần tin relay khi đối thủ không cùng ký.
- Single-signed tắt mặc định. Nếu quản trị bật, cơ chế optimistic challenge vẫn có rủi ro claim giả và trọng tài không phản hồi; đây không phải fraud-proof.
- `seasonPrizePool` có phân phối Merkle theo danh sách công bố, chờ 2 ngày, claim 90 ngày; owner được tin cậy khi phân bổ. Vault chưa tạo lợi suất và không tự tạo quyền nhận giải tuần.
- ELO khởi điểm 1200; chỉ cập nhật khi đủ 20 half-move; giảm điểm tăng theo cặp ví/ngày chưa chống Sybil nhiều ví.
- Dự án chưa qua audit độc lập. Dùng token testnet cho bản Cup trên Fuji; bài kiểm thử trọn giải đã chạy trên Anvil.

Xem [danh mục tài liệu](README.md), [kiến trúc](ARCHITECTURE.md), [giao thức](PROTOCOL.md), [tiến độ](PROGRESS.md) và [báo cáo rà soát](REVIEW_2026-11-01.md).

Hướng dẫn bổ sung: [triển khai Fuji](FUJI_DEPLOY.md), [vận hành/sao lưu](OPERATIONS.md), [thưởng mùa](SEASON_REWARDS.md), [nghiệm thu bổ sung](IMPLEMENTATION_2026-11-01.md). Chạy `pnpm test:campaign` để đo 20 trận Node/Anvil riêng, `pnpm test:tools` để kiểm tra công cụ và `pnpm check:fuji` để kiểm tra điều kiện triển khai.
