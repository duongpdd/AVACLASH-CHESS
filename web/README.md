# AvaClash Web

Next.js 16 + React 19 + Tailwind + Phaser 3, kết nối ví injected qua Wagmi/Viem. Luồng hiện mở là PvP trên Fuji hoặc Anvil.

Từ thư mục monorepo, thực hiện hướng dẫn ở [README dự án](../README.md). Build `@avaclash/shared` và cấu hình `web/.env.local` theo [.env.example](.env.example) trước khi chạy `pnpm --filter web dev`.

- `/`: kết nối ví, tạo/vào phòng, tra cứu phòng và withdraw.
- `/game?room=0`: phòng thi đấu; room ID bắt đầu từ 0.
- Font dùng hệ thống; build không cần tải Google Fonts.
- Phaser tải động ở client với `ssr:false`, luật và transcript tách khỏi render.
- Có Hot-seat, gửi/rút Vault và nhận thưởng mùa; giao dịch spectator mặc định đóng. Telemetry chỉ cảnh báo, không phạt đồng hồ.

Kiểm tra: `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web check:build`.

Có thêm `/hotseat` không cần ví, tab Vault gửi/rút tiền gốc và nhận thưởng theo danh sách công khai. Nhãn tiền lấy từ chain mục tiêu (Anvil ETH/Fuji AVAX). Xem [hướng dẫn thưởng](../docs/SEASON_REWARDS.md) và [nghiệm thu](../docs/IMPLEMENTATION_2026-11-01.md). Không có tính năng yield hoặc cược spectator mở mặc định.
