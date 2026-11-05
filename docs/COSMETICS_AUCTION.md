# Skin cúp và chợ AvaClash

Tài sản thử nghiệm trên Avalanche Fuji và Anvil Local, không có giá trị quy đổi. Hai hợp đồng giới hạn triển khai ở chain ID 43113 và 31337. Tính năng chưa được audit.

## Cúp, trang bị và đấu giá

- Chủ sở hữu `AvaClashCosmetics` đánh dấu tối đa một cúp cho mỗi giải tồn tại, trong giai đoạn đăng ký hoặc thi đấu và trước khi mở thời hạn duyệt cuối. Sau khi giải chốt, mọi kỳ thủ đồng hạng nhất theo `standings` được nhận một NFT, kể cả khi giải chia tròn tiền thưởng về 0. Tên UTF-8, màu, loại, số bản và ảnh SVG tối giản nằm trong dữ liệu on-chain. Chủ sở hữu hợp đồng cúp chỉ có quyền đánh dấu giải, không có quyền chuyển NFT của người chơi.
- Ví được trang bị một bàn và một bộ quân. Chuyển nhượng hoặc ký gửi xóa trang bị của chủ cũ. Bộ sưu tập phân trang các NFT và cúp theo lô 12 mục.
- Chợ ký gửi NFT sau khi người bán phê duyệt riêng cho token đó. Lượt đầu phải đạt giá khởi điểm. Các lượt sau tăng ít nhất 5% làm tròn lên theo wei hoặc 0,0001 đơn vị native, lấy mức lớn hơn. Phiên Fuji có thời lượng 1 giờ đến 7 ngày, cửa sổ gia hạn 10 phút và trần gia hạn 24 giờ. Demo Anvil dùng tối thiểu 60 giây, cửa sổ 15 giây và trần 60 giây.
- Giá bị vượt và tiền dành cho người bán đều vào số dư chờ rút của từng ví. Bất kỳ ai cũng có thể kết toán khi hết giờ. Người bán được hủy nếu chưa có giá. Chợ không có quản trị viên, phí hay royalty. Tab **Của tôi** lọc các phiên đã rao và các phiên mà ví đang giữ giá cao nhất.

## Hiển thị trong ván

Bàn của Trắng được ưu tiên, tiếp theo là bàn của Đen rồi bàn mặc định. Mỗi kỳ thủ dùng màu quân tương ứng với bên mình cầm. Ký tự quân cờ giữ nguyên. Điều khiển **Tắt skin của đối thủ** chỉ thay đổi cách hiển thị trên thiết bị của kỳ thủ và lưu tùy chọn khi trình duyệt cho phép.

Ván trực tiếp và chế độ xem trực tiếp dùng chung dữ liệu trang bị tại khối phát sự kiện `Started` của giải. Kỳ thủ cần trang bị trước khi bắt đầu giải. Cách này giữ kết quả ổn định khi người chơi hoặc khán giả mở ván vào các thời điểm khác nhau. Client đọc một lần, dùng màu mặc định nếu chưa đọc được hoặc RPC thiếu trạng thái lịch sử. Bản phát lại đọc trang bị ở khối mới nhất tại thời điểm mở. Khán giả xem trực tiếp qua vai trò chỉ đọc sẵn có của relay. Hotseat, Tập cờ và phòng 1v1 cũ giữ giao diện hiện tại.

Ngưỡng hiển thị quân là 3:1 trên cả hai ô, ô nước cuối, nền hộp phong cấp và ô có lớp phủ chọn quân hoặc chiếu. Viền dày 0 không được tính. Hai bên phải có tỷ lệ độ sáng giữa màu tô từ 1,5:1 hoặc khoảng cách CIE76 từ 50. Nếu hai bên khó phân biệt, trả Đen về mặc định trước rồi trả cả hai nếu cần. Bàn tùy chỉnh phải có tương phản giữa hai ô từ 1,35:1 để tránh mất caro. Giữ nguyên các tham số vẽ cũ khi dùng mặc định.

Các mẫu tổng hợp dùng để so sánh gồm Mực tàu và Đen mặc định, hai bộ màu sáng gần nhau, và cặp đỏ thẫm với lam có độ sáng gần nhau. Hai mẫu đầu kích hoạt dự phòng. Mẫu đỏ–lam được giữ theo khoảng cách màu. Chưa kiểm với người dùng mù màu đỏ–lục. Công tắc tắt skin vẫn khả dụng cho kỳ thủ.

![Ba cặp màu trước và sau khi áp dụng quy tắc hiển thị](cosmetics/palette-comparison.png)

## Demo Anvil

Chạy ở thư mục gốc repo. Tạo phiên Anvil cục bộ mới cho demo.

```powershell
forge build --root contracts
anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --quiet
```

Ở terminal khác, chạy script. Script chỉ kết nối loopback, kiểm tra Anvil và dùng tài khoản mở khóa qua RPC. Script dựng một giải chính thức hai người đồng hạng đã chốt.

```powershell
node scripts/dev-cosmetics.mjs 8545
```

Dùng các biến `NEXT_PUBLIC_*` script in ra để chạy web. Ví dụ có sẵn trong `web/.env.example`. Cần đủ địa chỉ giải, bộ sưu tập và chợ trên cùng mạng thử nghiệm. Mở `/collection` và `/market` sau khi chạy `pnpm --filter web dev`. Một trong hai ví vô địch có thể nhận cúp, trang bị rồi phê duyệt và rao. Ví khác có thể đặt giá và kết toán. Để tiến thời gian trong demo, dùng `cast rpc evm_increaseTime 180` rồi `cast rpc evm_mine` với RPC Anvil cục bộ. Sau kết toán, người bán và người bị vượt giá có thể tự rút số dư.

Cũng có thể thao tác bằng các tài khoản mở khóa Anvil nếu chưa có tiện ích ví. Điền các địa chỉ in ra trước khi chạy.

```powershell
$rpc = "http://127.0.0.1:8545"
cast send --rpc-url $rpc --unlocked --from $winner $skins "claimTrophy(uint256)" 0
cast send --rpc-url $rpc --unlocked --from $winner $skins "equip(uint256)" 1
cast send --rpc-url $rpc --unlocked --from $winner $skins "approve(address,uint256)" $market 1
cast send --rpc-url $rpc --unlocked --from $winner $market "create(uint256,uint256,uint64)" 1 10000000000000000 60
cast send --rpc-url $rpc --unlocked --from $bidder --value 10000000000000000 $market "bid(uint256)" 0
cast rpc --rpc-url $rpc evm_increaseTime 180
cast rpc --rpc-url $rpc evm_mine
cast send --rpc-url $rpc --unlocked --from $bidder $market "settle(uint256)" 0
cast send --rpc-url $rpc --unlocked --from $winner $market "withdraw()"
```

`contracts/script/DeployCosmetics.s.sol` là script triển khai cho người vận hành, nhận `TOURNAMENT_ADDRESS` và `COSMETICS_OWNER_ADDRESS`. Hai hợp đồng chưa được triển khai lên Fuji trong công việc này.

## Rà soát và giới hạn

- **Reentrancy.** Hàm ghi của chợ dùng guard. Rút xóa số dư trước khi chuyển native token. Mint và giao NFT qua đường không gọi callback của người nhận.
- **Quyền truy cập.** Giải chính thức chỉ được đánh dấu một lần. Nhận cúp yêu cầu đồng hạng nhất và chưa nhận. Rao yêu cầu chủ NFT và phê duyệt. Người bán không thể đặt giá bằng chính địa chỉ đã rao. Chợ không có đường rút thay người nhận.
- **Khả năng chặn dịch vụ.** Người nhận có thể tự chặn khoản rút của họ nếu contract từ chối native token, nhưng không làm hỏng kết toán hay giao dịch của ví khác. Không gửi NFT trực tiếp tới chợ bằng `transferFrom`, vì chỉ `create` mới ghi phiên và cho phép nhận lại. Hợp đồng không duyệt danh sách phiên khi xử lý giao dịch.
- **Kế toán.** Invariant kiểm tra số dư chợ bằng tổng giá cao nhất của phiên đang mở cộng tổng số dư chờ rút trong luồng hợp lệ. EVM cho phép đẩy native token vào địa chỉ theo cách bỏ qua các hàm của chợ. Khoản dư bị ép gửi không thuộc về ví nào và không có đường rút.
- **Điểm tin cậy.** Chủ sở hữu cúp chọn giải chính thức và màu giải. Nhiều ví cùng chủ, giao dịch tự thân, độ hiếm thấp khi ít người chơi và sai cấu hình RPC vẫn có thể xảy ra. Frontend chỉ nhận địa chỉ hợp đồng từ cấu hình triển khai. Studio, mainnet, ảnh tải lên và IPFS nằm ngoài phiên bản này.

## Kết quả kiểm tra

OpenZeppelin 5.7.0 theo `package.json` của submodule tại `cab19933c33c2ad1d4c7a84864a3601dddfd16f3`. Solc 0.8.24, pnpm 9.15.0, Next.js 16.2.9 và React 19.2.4 theo lockfile của checkout.

| Pha | Tệp chính | Kết quả |
| --- | --- | --- |
| 0. Baseline | Submodules và lockfile hiện có | Forge build ban đầu qua. Chạy lại bộ hợp đồng gốc qua 180/180. Lượt web ban đầu bị chặn bởi DNS và cache thiếu gói, sau đó đã khôi phục đủ gói từ lockfile. |
| 1. Cúp | `AvaClashCosmetics.sol`, `AvaClashCosmetics.t.sol`, `CosmeticsFixture.sol` | 8 bài mới qua. Có ca đồng hạng, phần thưởng bằng 0 và kiểm tra JSON/SVG. |
| 2. Chợ | `CosmeticAuction.sol`, `CosmeticAuction.t.sol`, `CosmeticAuctionInvariant.t.sol` | 9 bài đơn vị và 1 invariant mới qua. |
| 3. Nối hợp đồng | ABI và export trong shared, `env.ts`, `web/.env.example`, `use-cosmetic-{reads,tx}.ts`, `DeployCosmetics.s.sol`, `dev-cosmetics.mjs` | Shared build và 133 bài qua. `test:tools` qua 2, `test:deploy` qua 7. |
| 4. Theme | `theme.ts`, `chess-scene.ts`, `phaser-game.tsx` và hai tệp test theme | 11 bài mới qua, gồm đối chiếu tham số vẽ mặc định và đổi theme tại chỗ. |
| 5. Giao diện | Routes `collection`, `market`, `components/cosmetics/`, `app-header.tsx`, `tournament-play-view.tsx`, `use-spectator-moves.ts`, `cosmetics-ui.test.tsx` | 6 bài mới qua. Chrome kiểm tra hai trang ở 375×812 và 1280×800. Không tràn ngang. Các vùng bấm mới đo được tối thiểu 44 px. |
| 6. Tổng kiểm tra | Tài liệu này và ảnh đối chiếu màu | 198 bài Foundry, 201 bài web và 89 bài relay qua. Relay có 3 bài bỏ qua theo cấu hình sẵn. Typecheck, lint, web build và check:build qua. |

Demo Anvil đã chạy qua nhận, trang bị, phê duyệt, rao, hai lượt đặt giá, kết toán và rút cho cả ví bị vượt giá lẫn người bán. Đã kiểm tra chủ NFT cuối cùng và số dư chợ về 0. Chrome dùng ví EIP-1193 giả lập. Chưa kiểm chứng ký bằng ví thật hoặc chạy trên Fuji. Chưa chạy job build image relay do môi trường thiếu Docker.

Các commit tính năng giữ riêng phần có thể tách khỏi các thay đổi có sẵn. Phần ghép cờ, Phaser, điều hướng và màn hình ván nằm trong các tệp đã sửa hoặc chưa được Git theo dõi từ trước, nên vẫn ở working tree cùng nền giải đấu hiện có.
