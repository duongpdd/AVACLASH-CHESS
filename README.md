# AvaClash Cup

Giải cờ vua online miễn phí tham dự. Quỹ thưởng do nhà tài trợ nạp trước vào hợp đồng trên Avalanche, và chỉ được chi khi kết quả đã được trọng tài duyệt và hết thời gian khiếu nại. Kỳ thủ tự nhận thưởng về ví, ban tổ chức không giữ tiền.

> **English summary.** Free-entry chess tournaments with sponsor-funded prize pools on Avalanche Fuji C-Chain. Sponsors lock funds in `TournamentPrizePool`; a relay signs game results (EIP-712); an independent referee approves them; after the appeal window the contract splits the pool and winners claim directly. Built for Team1 Vietnam UniHack and BK Fintech Hackday S15.

## Dành cho giám khảo

| | |
| --- | --- |
| **Video demo (2:21)** | Cập nhật trước khi nộp |
| **Slide** | Cập nhật trước khi nộp |
| **Dùng thử** | [avaclash-chess.vercel.app](https://avaclash-chess.vercel.app) |
| **Xem giải đã hoàn tất, không cần ví** | [Giải #4 AVACLASH DEMO CUP](https://avaclash-chess.vercel.app/tournaments?id=4): mở các tab **Bảng điểm**, **Lịch ván**, **Lịch sử** |
| **Hợp đồng** | [`TournamentPrizePool` `0x268F…B9F9`](https://explorer-test.avax.network/c-chain/address/0x268F6034175750791AAaA20FD04F658BDDAcB9F9?tab=code) trên Fuji C-Chain (43113), mã nguồn đã xác minh trên [Sourcify](https://repo.sourcify.dev/43113/0x268F6034175750791AAaA20FD04F658BDDAcB9F9) |
| **Kiểm thử** | 189/189 test hợp đồng đạt (Foundry, chạy lại ngày 16/11/2026) |

> **Lưu ý về ví:** MetaMask hiện có thể cảnh báo nhầm tên miền `vercel.app` của dự án. Nhóm đã gửi yêu cầu gỡ. Mọi trang xem giải, bảng điểm và biên bản đều mở được mà không cần kết nối ví.

### Bằng chứng trên chuỗi: một giải từ đầu đến cuối

Giải #4 được chạy thật trên Fuji ngày 15–16/11/2026, đúng như trong video demo. Bấm vào từng bước để xem giao dịch trên explorer.

| Bước | Hàm hợp đồng | Giao dịch |
| --- | --- | --- |
| 1. Ban tổ chức tạo giải, chỉ định trọng tài | `createTournament` | [0x81a0…c9f6](https://explorer-test.avax.network/c-chain/tx/0x81a0336f83b7762e2b8ead7a6125ff8d0a95f5677e640f858ce720a70dc9c8f6) |
| 2. Nhà tài trợ nạp **1 AVAX** | `fund` | [0xf04b…2229](https://explorer-test.avax.network/c-chain/tx/0xf04b35634deb08f08d6401727eeee8560e4d59e601dc2f14be6495d39edb2229) |
| 3. Kỳ thủ 1 đăng ký miễn phí | `register` | [0xe1c7…36d1](https://explorer-test.avax.network/c-chain/tx/0xe1c7cf149ed2493b1f8d4e37112221ac961aec26becc6ba12fc9706767e136d1) |
| 4. Kỳ thủ 2 đăng ký miễn phí | `register` | [0x961d…f412](https://explorer-test.avax.network/c-chain/tx/0x961d18ca39924b8cd4b9aaebdc1b0d29a7811de3d8c32ae9450dde1f903f3412) |
| 5. Bắt đầu giải, tạo lịch vòng tròn | `start` | [0xae01…fc2a](https://explorer-test.avax.network/c-chain/tx/0xae01e3069f96590ecdd4bbfc0de1db5940768c462ccfe64df6a97eccffa2fc2a) |
| 6. Gửi biên bản ván đã được relay ký EIP-712 | `reportResult` | [0x994c…f400](https://explorer-test.avax.network/c-chain/tx/0x994c94946762bd59bb93e9b036881322c4819d7f447bb96b3d71b843756af400) |
| 7. Trọng tài duyệt kết quả | `review` | [0x5d09…6103](https://explorer-test.avax.network/c-chain/tx/0x5d09a4cea9cf9d57d06d05498330410cda99345198bf7f837b9d009e9fbf6103) |
| 8. Hết thời gian khiếu nại, chốt bảng thưởng 70/30 | `finalize` | [0x97b4…5cdd](https://explorer-test.avax.network/c-chain/tx/0x97b41b8bb16a09e753a94349e555cd84c6c549299cab8146c2bb4470ff6a5cdd) |
| 9. Kỳ thủ thắng tự nhận **0,7 AVAX** | `claim` | [0x7e96…ae5a](https://explorer-test.avax.network/c-chain/tx/0x7e96a28d199f1514f39a9882b88d0809c9d607ed0b5761d210a689667b84ae5a) |

Cả 9 giao dịch đều tốn phí mạng rất nhỏ (dưới 0,0001 AVAX mỗi giao dịch). Hợp đồng còn các giải khác đã chạy thật: [giải #1](https://avaclash-chess.vercel.app/tournaments?id=1) đã trao thưởng, và [giải #2](https://avaclash-chess.vercel.app/tournaments?id=2) có [khiếu nại](https://explorer-test.avax.network/c-chain/tx/0x86fd3319d11dce4728707c8afbdf6ae2a3dd4ad0f6fe704232b057107ee55aac) và [phán quyết của trọng tài](https://explorer-test.avax.network/c-chain/tx/0x1a575a36f98abb2ad06dc0c09434facceeb1b3272092a5c8de14c6b26a9b3c52).

Dự án tham gia [Team1 Vietnam UniHack: 30 days to build on Avalanche](https://team1vn.xyz) và BK Fintech Hackday Season 15.

## Vấn đề và giải pháp

Giải cờ online nhỏ thường do một người giữ tiền thưởng và tự đối soát kết quả. Nhà tài trợ khó kiểm tra tiền đã đi đâu, còn kỳ thủ chỉ biết tin vào lời hứa của ban tổ chức.

AvaClash Cup tách các quyền đó ra và ghi lại trên chuỗi:

- **Nhà tài trợ** nạp quỹ vào hợp đồng trước khi giải mở đăng ký.
- **Kỳ thủ** tham dự miễn phí, không đặt cược. Người thua không mất tiền cho người thắng.
- **Relay** kiểm luật cờ và ký biên bản ván, nên kỳ thủ không thể tự khai kết quả.
- **Trọng tài** duyệt kết quả và giải quyết khiếu nại, là ví riêng khác ban tổ chức.
- **Hợp đồng** tính bảng thưởng theo điểm đã duyệt. Người được thưởng tự nhận trong 30 ngày, phần chưa dùng được hoàn lại nhà tài trợ.

## Luồng một giải

```mermaid
flowchart LR
  A[Ban tổ chức tạo giải] --> B[Nhà tài trợ nạp quỹ]
  B --> C[Kỳ thủ đăng ký miễn phí]
  C --> D[Bắt đầu giải, tạo lịch vòng tròn]
  D --> E[Chơi 5+0 qua relay]
  E --> F[Kỳ thủ gửi biên bản relay đã ký]
  F --> G[Trọng tài duyệt]
  G --> H{Có khiếu nại?}
  H -- Có --> I[Trọng tài giải quyết, mở lại thời gian khiếu nại]
  I --> H
  H -- Hết hạn, không còn khiếu nại --> J[Chốt bảng thưởng]
  J --> K[Người thắng nhận thưởng]
```

Điểm: thắng 1, hòa ½, thua 0. Giải 2 kỳ thủ chia 70/30; giải 3 đến 8 kỳ thủ chia 60/30/10. Đồng điểm thì chia đều phần thưởng của các hạng liên quan.

## Dùng Avalanche ở đâu

Toàn bộ dòng tiền và trạng thái giải nằm trong hợp đồng [`TournamentPrizePool`](contracts/src/TournamentPrizePool.sol) trên Fuji C-Chain:

| Thành phần         | Cách hoạt động                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Quỹ thưởng         | `fund` nhận AVAX test vào quỹ riêng của từng giải, ví kỳ thủ và trọng tài không được nạp                                 |
| Tách quyền         | Ban tổ chức, trọng tài, relay và kỳ thủ phải là các ví khác nhau, hợp đồng kiểm tra khi tạo giải và đăng ký              |
| Biên bản ván       | Chữ ký EIP-712 của relay gồm người thắng, lý do, số nước và hash nước đi; `reportResult` khôi phục chữ ký trước khi nhận |
| Duyệt và khiếu nại | `review`, `appeal`, `resolveAppeal` lưu mã kiểm chứng và phát sự kiện công khai                                          |
| Giải ngân          | `finalize` tính theo điểm đã duyệt, chặn khi còn khiếu nại mở; `claim` chống nhận trùng                                  |
| Đăng nhập          | Ký thông điệp bằng ví, máy chủ xác minh chữ ký trước khi cấp phiên                                                       |

## Kiến trúc

```mermaid
flowchart TB
  W[Web: Next.js, Phaser, Wagmi] -- WebSocket, chữ ký ví --> R[Relay: Node.js]
  W -- Giao dịch, đọc dữ liệu --> C[TournamentPrizePool trên Fuji]
  R -- signalGameStarted --> C
  R -- Lưu ván --> D[(PostgreSQL)]
  S[packages/shared: luật cờ, schema, ABI] --> W
  S --> R
```

| Thư mục                              | Nội dung                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| [`contracts`](contracts)             | Solidity 0.8.24, OpenZeppelin, kiểm thử bằng Foundry       |
| [`packages/relay`](packages/relay)   | Xác thực ví, kiểm luật và thứ tự nước, đồng hồ, ký kết quả |
| [`packages/shared`](packages/shared) | Luật cờ, replay, hash nước đi, schema Zod, ABI             |
| [`web`](web)                         | Giao diện tiếng Việt và tiếng Anh                          |

## Dùng thử

**Không cần ví:** [giải thế cờ](https://avaclash-chess.vercel.app/practice) và [chơi cùng thiết bị](https://avaclash-chess.vercel.app/hotseat).

**Xem kết quả có sẵn:** mở [giải #4](https://avaclash-chess.vercel.app/tournaments?id=4), vào **Lịch ván** để xem biên bản, hash đối chiếu và tải PGN, hoặc **Lịch sử** để xem các giao dịch nạp quỹ, duyệt, chốt và nhận thưởng.

**Chạy trọn một giải** cần 4 ví MetaMask hoặc Core trên Fuji, lấy AVAX test tại [faucet](https://build.avax.network/console/primary-network/faucet):

1. Ví ban tổ chức [tạo giải](https://avaclash-chess.vercel.app/tournaments/new) 2 kỳ thủ, nhập ví trọng tài khác ví của mình, rồi nạp quỹ.
2. Hai ví kỳ thủ mở link giải và bấm **Đăng ký miễn phí**.
3. Ví ban tổ chức bấm **Bắt đầu giải**.
4. Hai kỳ thủ bấm **Vào trận**, ký xác thực và chơi. Hết ván, một người gửi biên bản lên chuỗi.
5. Ví trọng tài mở ván, chọn kết quả và bấm **Duyệt ván**.
6. Hết thời gian khiếu nại (ít nhất 1 giờ), bấm **Chốt bảng thưởng** rồi **Nhận thưởng**.

## Chạy cục bộ

Cần Node.js 20.12 trở lên, pnpm 9.15 và [Foundry](https://getfoundry.sh).

```bash
git clone --recurse-submodules https://github.com/duongpdd/AVACLASH-CHESS.git
cd AVACLASH-CHESS
pnpm install --frozen-lockfile
node scripts/dev-tournament.mjs --seed
```

Mở `http://127.0.0.1:13000/tournaments`. Lệnh này dựng Anvil, deploy hợp đồng, tạo giải 8 kỳ thủ đã có lịch và chạy relay. Xem chi tiết tài khoản thử nghiệm và cách triển khai Fuji tại [hướng dẫn demo](docs/guides/TOURNAMENT_DEMO.md).

## Kiểm thử

```bash
forge test --root contracts --no-match-path "test/audit/**"
pnpm test
pnpm test:tournament
pnpm typecheck
pnpm lint
```

Số bài kiểm thử gần nhất (hợp đồng chạy lại ngày 16/11/2026, các phần khác ngày 07/11/2026):

| Phần                                   | Kết quả                                        |
| -------------------------------------- | ---------------------------------------------- |
| Hợp đồng                               | 189 đạt, 0 lỗi                                 |
| Web                                    | 213 đạt                                        |
| Shared                                 | 133 đạt                                        |
| Relay                                  | 89 đạt, 3 bài cần PostgreSQL riêng được bỏ qua |
| Trọn giải trên Anvil và WebSocket thật | Đạt                                            |

CI chạy trên mỗi lần push: [GitHub Actions](https://github.com/duongpdd/AVACLASH-CHESS/actions).

## Phần có sẵn và phần xây trong cuộc thi

Thể lệ cho phép dùng dự án có sẵn, nên nhóm khai rõ:

- **Có từ trước (từ 10/2026):** bản cờ 1v1 có cược gồm `ChessEscrow`, `AvaClashMeta`, relay, bàn cờ và ví. Xem [tài liệu bản cũ](docs/archive/LEGACY_1V1.md).
- **Xây trong kỳ thi (từ 02/11/2026):** chuyển sang mô hình miễn phí tham dự và có tài trợ, gồm hợp đồng `TournamentPrizePool`, luồng trọng tài và khiếu nại, giao diện giải đấu, bảng Elo, giải thế cờ. Lý do chuyển hướng nằm trong [nghiên cứu sản phẩm](docs/design/TOURNAMENT_PIVOT_RESEARCH_2026-11-03.md).

## Giới hạn hiện tại

- Chỉ chạy trên testnet, hợp đồng chưa qua audit độc lập.
- Hash nước đi chứng minh biên bản không bị sửa, không chứng minh kỳ thủ không dùng engine. Việc này thuộc về trọng tài.
- Relay và trọng tài là các bên được tin cậy. Hợp đồng không tự kiểm luật cờ.
- Relay chạy trên gói miễn phí của Render nên lần kết nối đầu có thể chậm.
- Bản thương mại với tiền thật cần thẩm định pháp lý riêng, xem [nghiên cứu sản phẩm](docs/design/TOURNAMENT_PIVOT_RESEARCH_2026-11-03.md).

## Tài liệu

[Danh mục tài liệu](docs/README.md) · [Kiến trúc](docs/design/ARCHITECTURE.md) · [Giao thức relay](docs/design/PROTOCOL.md) · [Hướng dẫn demo](docs/guides/TOURNAMENT_DEMO.md) · [Triển khai Render](docs/guides/RENDER_DEPLOY.md) · [Vận hành](docs/guides/OPERATIONS.md)
