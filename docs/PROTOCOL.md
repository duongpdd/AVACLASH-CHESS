# Giao thức WebSocket AvaClash

Cập nhật 01/11/2026. Schema chuẩn nằm tại `packages/shared/src/schemas.ts`; client dùng `RelayClient`, server dùng `RelayServer` và `RelayRoom`.

## Kết nối và xác thực

Relay kiểm tra `Origin` theo `ALLOWED_ORIGINS`, giới hạn payload 4096 byte, tối đa 20 kết nối/IP, 25 message/giây/socket và 60 lần join/phút/IP theo cấu hình mặc định. Header proxy chỉ được tin khi `TRUST_PROXY=true` và proxy đã ghi đè header từ client.

1. Relay gửi `auth_challenge { nonce, expiresAt, chainId, escrowAddress, origin }`: nonce bytes32, hiệu lực 60 giây. Socket chưa xác thực được chờ đủ 60 giây để người dùng mở ví ký. Client hiển thị `awaiting_signature` trong bước này; nếu hết hạn hoặc từ chối ký thì dừng retry tự động và cho người dùng chủ động kết nối lại. Socket bị thay bởi tab khác (4000) cũng dừng retry để tránh hai tab tranh cùng ghế.
2. Người chơi ký EIP-712 `Join(uint256 roomId,address player,bytes32 nonce,uint256 expiresAt,string origin)`, domain `AvaClashRelay`, version `2`, chain ID mục tiêu và `verifyingContract=Escrow`. Client đối chiếu chain/contract/origin với cấu hình và `location.origin` trước khi mở yêu cầu ký.
3. Client gửi `join_room { roomId, role:"player", address, signature, nonce }`.
4. Server thu hồi địa chỉ từ chữ ký, tiêu thụ nonce đúng một lần và kiểm tra người ký là playerA/playerB của phòng Active on-chain. Màu được đọc từ `creatorIsWhite`.
5. Relay gửi `room_state`. Nếu ván đã kết thúc nhưng phòng on-chain còn Active, relay gửi `game_finished` chứa toàn bộ lịch sử để người chơi xin lại chữ ký.

Khán giả có thể gửi `join_room { roomId, role:"spectator" }` mà không ký; không được gửi lệnh thi đấu hoặc xin kết quả ký. Web hiện chỉ tích hợp luồng người chơi. Join v2 ràng buộc origin đúng header đã nhận và địa chỉ Escrow. Helper Join v1 còn được export để tương thích mã thư viện cũ nhưng server không chấp nhận chữ ký v1. Node test client không có Origin chỉ dùng khi cấu hình cho phép và ký origin chuỗi rỗng.

## Message hai chiều

Mọi message là JSON có trường `type`. `roomId`, `seq`, `nonce` và deadline được truyền bằng số nguyên an toàn JavaScript; roomId bắt đầu từ 0. UCI có dạng `e2e4` hoặc `e7e8q`.

| Hướng           | type               | Trường và hành vi                                                                                   |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| Server → client | `room_state`       | `roomId, white, black?, moves[], whiteMs, blackMs, status` (`waiting/active/finished`)              |
| Hai chiều       | `move`             | `roomId, seq, uci`; seq bằng số half-move đã được relay chấp nhận, bắt đầu 0                        |
| Hai chiều       | `resign`           | `roomId`; server thêm `player` (`w/b`)                                                              |
| Hai chiều       | `draw_offer`       | `roomId`; chỉ gửi lời mời tới đối thủ                                                               |
| Hai chiều       | `draw_accept`      | `roomId`; chỉ đối thủ của người đề nghị được chấp nhận                                              |
| Hai chiều       | `draw_decline`     | `roomId`; chỉ đối thủ được từ chối                                                                  |
| Server → client | `clock_sync`       | `roomId, whiteMs, blackMs`; client nội suy để hiển thị                                              |
| Hai chiều       | `timeout`          | `roomId, player?`; relay dùng đồng hồ của mình, không tin tuyên bố client                           |
| Hai chiều       | `focus_warning`    | `player, warningCount, penaltyMs`; server xác định màu từ socket và luôn phát `penaltyMs:0`         |
| Client → server | `ping`             | Không có trường bổ sung                                                                             |
| Server → client | `pong`             | Phản hồi ping                                                                                       |
| Server → client | `error`            | `message, code?`                                                                                    |
| Client → server | `request_result`   | `roomId`; chỉ kỳ thủ đã xác thực, phòng còn Active                                                  |
| Server → client | `result_proposal`  | `roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline`                            |
| Hai chiều       | `result_signature` | `roomId, signature`; relay kiểm tra người ký khi nhận từ client                                     |
| Server → client | `game_finished`    | `roomId, outcome?, reason?, winner?, moveCount?, moves?`; server hiện gửi đầy đủ moves              |
| Server → client | `spectator_pool`   | Schema dự phòng: `whitePoolAvax, blackPoolAvax, drawPoolAvax, isLocked`; chưa có luồng UI giao dịch |

Client chỉ di chuyển quân sau echo của relay. Message lặp seq cũ bị bỏ qua; thiếu seq dẫn tới kết nối lại để nhận toàn bộ state. Nước đi mới xóa đề nghị hòa đang chờ.

## Thời gian và phục hồi

Mặc định 5 phút mỗi bên, không cộng giây. Relay chạy luật chess.js và trừ thời gian trước khi chấp nhận nước đi, đầu hàng hoặc chấp nhận hòa; không phụ thuộc riêng vào tick 200ms. Thay socket không đặt lại mốc thời gian.

Ngắt kết nối client không dừng đồng hồ relay. Sau restart, snapshot được phục hồi và có ân hạn tối đa 120 giây hoặc tới lúc cả hai kỳ thủ quay lại. Thời gian server tắt không bị trừ. Snapshot chỉ được lưu lúc bắt đầu và sau mỗi nước đi; lỗi toàn bộ thiết bị lưu trữ vẫn có thể gây mất dữ liệu.

Reconnect dùng backoff 1/2/4/8/15 giây và một challenge mới. Client không gửi chữ ký của socket cũ sang socket mới. Đổi phòng/ví xóa trạng thái phiên cũ. Web lưu lịch sử nước đã xác nhận trong localStorage theo chain/contract/room/ví; dữ liệu relay vẫn là nguồn chuẩn.

## Result EIP-712

Domain: `name="AvaClashChess"`, `version="2"`, chain ID và `verifyingContract=ChessEscrow`.

```text
Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)
```

`matchId=roomId`, `moveCount` đếm half-move (tối đa uint16), `movesHash=keccak256(UTF8(moves.join(" ")))`. `outcome`: 0 Trắng thắng, 1 Đen thắng, 2 Hòa; hòa dùng địa chỉ 0. `reason`: 0 chiếu hết, 1 đầu hàng, 2 hết giờ, 3 stalemate, 4 lặp cờ, 5 luật 50 nước, 6 thiếu quân, 7 thỏa thuận hòa.

Client replay và đối chiếu hash, số nước, màu, winner, reason trước khi ký; yêu cầu chữ ký mới nếu deadline còn dưới 120 giây. Relay phát chữ ký hiệu lực 30 phút. Timeout/đầu hàng/thỏa thuận dựa vào sự kiện relay, không có bằng chứng độc lập on-chain.

Hợp đồng chấp nhận hai địa chỉ khác nhau thuộc `{playerA, playerB, relaySigner}`. Điều này bao gồm cặp hai người chơi cùng ký; hợp đồng không replay cờ và không chứng minh kết quả cho khán giả. Sau khi settle, tiền nằm trong `pendingWithdrawals` tới khi gọi `withdraw()`.
