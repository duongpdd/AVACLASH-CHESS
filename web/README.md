# AvaClash Web

Next.js 16 + React 19 + Tailwind + Phaser 3, kết nối ví injected qua Wagmi/Viem. Luồng chính là AvaClash Cup trên Fuji; có thể chạy bằng Anvil khi phát triển.

Từ thư mục monorepo, thực hiện hướng dẫn ở [README dự án](../README.md). Build `@avaclash/shared` và cấu hình `web/.env.local` theo [.env.example](.env.example) trước khi chạy `pnpm --filter web dev`.

- `/tournaments`: danh sách và chi tiết giải; `/tournaments/new`: tạo giải; `/tournaments/play`: phòng thi đấu.
- `/ranking`, `/practice`, `/hotseat`, `/guide`: bảng Elo, giải thế cờ, chơi cùng thiết bị và hướng dẫn.
- `/game`, `/vault`: luồng 1v1 cũ, không có trong menu khi đã cấu hình hợp đồng giải.
- Font Be Vietnam Pro đi kèm trong `public/fonts`; build không cần tải Google Fonts.
- Phaser tải động ở client với `ssr:false`, luật và transcript tách khỏi render.

Kiểm tra: `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web check:build`.
