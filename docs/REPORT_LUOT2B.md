# Báo cáo Rà soát Kỹ thuật & An ninh Lượt 2B — AvaClash Chess

> **Ngày lập báo cáo:** 25/10/2026  
> **Căn cứ yêu cầu:** Mục 7 trong yêu cầu Lượt 2B (Kiểm tra Relay Server, quét lịch sử git, đối chiếu commit gộp).  
> **Quy tắc tuân thủ:** CHỈ BÁO CÁO, KHÔNG SỬA CODE, KHÔNG IN GIÁ TRỊ CÁC CHUỖI GIỐNG PRIVATE KEY.

---

## 1. Phân Tích Hiện Trạng Mã Nguồn Relay (`RelayServer.ts` & `RelayRoom.ts`)

Khảo sát trực tiếp trên file hiện tại (không dùng diff):

### 1.1. Hàm xử lý `join` có xác thực địa chỉ bằng chữ ký không?
- **Kết luận:** **KHÔNG CÓ XÁC THỰC BẰNG CHỮ KÝ**.
- **Dẫn chứng mã nguồn:**
  - Trong [`packages/relay/src/RelayServer.ts:109-112`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay/src/RelayServer.ts#L109-L112):
    ```typescript
    case "join_room": {
      this.handleJoinRoom(ws, msg.roomId, msg.address as `0x${string}`);
      break;
    }
    ```
  - Trong [`packages/relay/src/RelayServer.ts:187-202`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay/src/RelayServer.ts#L187-L202):
    ```typescript
    public handleJoinRoom(ws: WebSocket, roomId: number, address: `0x${string}`): void {
      let room = this.rooms.get(roomId);
      if (!room) {
        room = new RelayRoom({
          roomId,
          initialTimeMs: this.initialTimeMs,
          onGameOver: (r, outcome, reason, winner) => {
            this.handleGameOver(r, outcome, reason, winner);
          },
        });
        this.rooms.set(roomId, room);
      }

      room.addPlayer(address, ws);
      room.broadcastRoomState();
    }
    ```
  - Schema validate trong [`packages/shared/src/schemas.ts:31-36`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/src/schemas.ts#L31-L36) chỉ kiểm tra chuỗi `address` có đúng định dạng hex 42 ký tự (`0x...`).
  - **Hệ quả an ninh:** Client chỉ gửi chuỗi địa chỉ trần mà không có chữ ký mật mã (EIP-4361 SIWE hay cryptographic challenge-response). Bất kỳ kẻ tấn công nào kết nối WebSocket đều có thể giả mạo địa chỉ của người khác khi gửi gói tin `join_room`.

---

### 1.2. Có kiểm tra `roomId` và địa chỉ với on-chain (`playerA`/`playerB`, trạng thái `Active`) không?
- **Kết luận:** **HOÀN TOÀN KHÔNG CÓ BẤT KỲ KIỂM TRA ON-CHAIN NÀO**.
- **Dẫn chứng mã nguồn:**
  - Trong toàn bộ [`packages/relay/src/RelayServer.ts`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay/src/RelayServer.ts): Không hề import `createPublicClient` từ `viem` hay khởi tạo bất kỳ RPC Provider nào kết nối tới Avalanche Fuji RPC.
  - Biến `contractAddress` và `chainId` chỉ được lưu trong instance (`RelayServer.ts:32-33`) để phục vụ việc bọc domain EIP-712 khi ký kết quả cuối ván (`handleGameOver`, dòng 228), hoàn toàn không có hàm đọc hợp đồng.
  - Khi client gửi `join_room`, server không hề gọi `ChessEscrow.getRoom(roomId)` để đối chiếu:
    1. Phòng có tồn tại trên blockchain hay không.
    2. Địa chỉ `msg.address` có trùng với `room.playerA` hoặc `room.playerB` đã stake tiền hay không.
    3. Trạng thái phòng có phải là `RoomStatus.Active` (đã nạp cược) hay không.
  - Phòng chỉ được khởi tạo cục bộ trong bộ nhớ RAM (`this.rooms: Map<number, RelayRoom>`).

---

### 1.3. Seed chọn màu quân (Q3) nằm ở đâu?
- **Kết luận:** **HOÀN TOÀN CHƯA CÓ SEED CHỌN MÀU QUÂN (Q3 CHƯA ĐƯỢC TRIỂN KHAI TRONG MÃ NGUỒN)**.
- **Dẫn chứng mã nguồn:**
  - Trong [`packages/relay/src/RelayRoom.ts:80-89`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay/src/RelayRoom.ts#L80-L89):
    ```typescript
    if (!this.whitePlayer) {
      this.whitePlayer = { address, ws, color: "w", warnings: 0 };
      return "w";
    }

    if (!this.blackPlayer) {
      this.blackPlayer = { address, ws, color: "b", warnings: 0 };
      this.startGame();
      return "b";
    }
    ```
  - Màu quân đang được gán cứng theo nguyên tắc **đến trước nhận trước (First-Come First-Served)**: Socket đầu tiên gửi `join_room` tự động nhận quân Trắng (`"w"`), socket thứ hai nhận quân Đen (`"b"`), socket thứ ba trở đi thành khán giả (`"spectator"`).
  - Không tồn tại biến seed, hash seed hay hàm PRNG nào giữa Relay và On-chain theo đặc tả ADR Q3.

---

### 1.4. Ai gọi `signalGameStarted`?
- **Kết luận:** **KHÔNG CÓ AI (KHÔNG CÓ DAEMON HAY SERVER NÀO) GỌI `signalGameStarted` NGOẠI TRỪ UNIT TEST**.
- **Dẫn chứng mã nguồn:**
  - Hàm `signalGameStarted(uint256 roomId)` được định nghĩa tại [`contracts/src/ChessEscrow.sol:307-313`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/contracts/src/ChessEscrow.sol#L307-L313):
    ```solidity
    function signalGameStarted(uint256 roomId) external {
        if (msg.sender != relaySigner) revert InvalidSignature();
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        room.gameStarted = true;
        emit GameStarted(roomId);
    }
    ```
  - Trong toàn bộ codebase (`packages/relay`, `packages/shared`, `web`): **Không có bất kỳ dòng code nào gọi hàm này lên blockchain**.
  - Các vị trí duy nhất trong repo gọi `signalGameStarted` là trong test suite Foundry tại [`contracts/test/ChessEscrow.t.sol:216, 228, 238`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/contracts/test/ChessEscrow.t.sol#L216).
  - **Hệ quả thực tế:** Trên hợp đồng thông minh, biến `room.gameStarted` luôn luôn có giá trị mặc định là `false`. Bất kỳ người chơi nào sau 3 phút đều có thể gọi `abortRoom(roomId)` để rút 100% tiền cược (vấn đề G2 trong `AUDIT_NOTES.md`).

---

## 2. Quét An Ninh Toàn Bộ Lịch Sử Git & Giải Thích Commit `fda0f5e`

### 2.1. Danh sách Commit và Đường dẫn Chứa Chuỗi Giống Khóa Bí Mật (Không in giá trị)

Kết quả quét lịch sử git bằng pattern nhận diện entropy và chuỗi 64 ký tự hex:

| Commit Hash | Đường dẫn tệp | Loại chuỗi nhận diện | Bản chất thực tế |
| :--- | :--- | :--- | :--- |
| **`3caa90b`** | `packages/shared/tests/eip712.test.ts`<br/>`packages/shared/tests/schemas.test.ts` | Hex 64 ký tự (`0x...`) | Dữ liệu mẫu (mock `movesHash` và mock signature) trong unit test |
| **`fda0f5e`** | `packages/relay/src/RelayServer.ts`<br/>`packages/relay/tests/relay.test.ts` | Hex 64 ký tự (`0x...`) | **Test private key mặc định được hardcode** khi lần đầu đưa mã nguồn Relay vào Git |
| **`26e184a`** | `packages/relay/src/RelayServer.ts`<br/>`packages/relay/tests/relay.test.ts` | Hex 64 ký tự (Diff xóa) | **Diff xóa hoàn toàn** test private key hardcode, chuyển sang `process.env.RELAY_PRIVATE_KEY` |
| **`8c362dc`** | `packages/shared/tests/schemas.test.ts` | Hex 64 ký tự (`0x...`) | Dữ liệu kiểm thử schema `bytes32` |
| **`2f0eda9`** | `contracts/test/fixtures/cross_spec_result.json` | Hex 64 ký tự (`0x...`) | Dữ liệu chữ ký EIP-712 công khai (`digest`, `movesHash`, `sigA`, `sigB`) sinh từ TypeScript |

*(Xác nhận: Không có private key thực tế của ví giữ tiền nào bị rò rỉ; các chuỗi khóa test cũ trong lịch sử git tuyệt đối không được dùng cho ví mainnet/testnet thật).*

---

### 2.2. Giải thích vì sao commit `fda0f5e` bị tính hai lần trong `REPORT_LUOT2.md`

Trong báo cáo `REPORT_LUOT2.md`, commit `fda0f5e` xuất hiện tại 2 mục độc lập:
1. **Tại Mục 1.3 (Dòng 52):** Được ghi nhận là commit hoàn thành **Mục 3 (G4 — Telemetry chỉ cảnh báo, không trừ giờ, không xử thua)** cho gói `@avaclash/relay`.
2. **Tại Mục 4.2 (Dòng 183):** Được ghi nhận trong bảng **Danh sách chuỗi giống private key trong lịch sử Git**.

**Nguyên nhân kỹ thuật:**
- Trước commit `fda0f5e`, toàn bộ thư mục `packages/relay` là mã nguồn mới phát triển ở Phase 4 nhưng **chưa từng được commit vào Git** (nằm ở trạng thái untracked).
- Khi thực hiện Mục 3 (G4 Telemetry), lệnh commit đã vô tình thêm mới cả 3 tệp (`RelayRoom.ts`, `RelayServer.ts`, `relay.test.ts`) vào git tree. Tại thời điểm đó, trong `RelayServer.ts` vẫn còn chứa chuỗi hardcode test key ban đầu của Phase 4.
- Do đó, commit `fda0f5e` vừa là commit tính năng của G4, vừa là commit đầu tiên đưa chuỗi test key vào lịch sử Git (trước khi được sửa triệt để bởi commit `26e184a` ở Mục 4). Báo cáo `REPORT_LUOT2.md` đã liệt kê chính xác theo 2 góc nhìn (tính năng và an ninh), dẫn đến commit này được nhắc lại 2 lần.

---

## 3. Danh Sách Các Thay Đổi Chưa Commit Trước Lượt 2 Bị Gộp

Trước khi Lượt 2 bắt đầu (điểm gốc `c404574^` tức commit `f681e0e`), cây làm việc có nhiều tệp của Phase 4 chưa được commit riêng rẽ. Cụ thể:

1. **Bị gộp vào commit `c404574` (`feat(escrow): G8a isolate Escrow calls to Meta`):**
   - File [`contracts/src/ChessEscrow.sol`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/contracts/src/ChessEscrow.sol) có tới 528 dòng thêm mới và 81 dòng xóa. Phần lớn các thay đổi này là code của Phase 4 (các hàm tích hợp Meta, cấu trúc single-signed, challenge window) chưa từng được commit trước đó.

2. **Bị gộp vào commit `fda0f5e` (`feat(relay): G4 telemetry warning-only`):**
   - Toàn bộ 3 tệp nguồn và test của Relay chưa từng được đưa vào git:
     - `packages/relay/src/RelayRoom.ts` (378 dòng)
     - `packages/relay/src/RelayServer.ts` (266 dòng)
     - `packages/relay/tests/relay.test.ts` (236 dòng)

3. **Bị gộp vào commit `26e184a` (`feat(relay): G14 remove hardcoded private keys`):**
   - Hai tệp cấu hình và khởi chạy relay untracked từ Phase 4:
     - `packages/relay/src/index.ts` (53 dòng)
     - `packages/relay/.env.example` (21 dòng)

4. **Các tệp Phase 4 bị bỏ quên chưa commit qua Lượt 2 (đã được dọn dẹp và commit ở đầu Lượt 2B qua commit `8c362dc`):**
   - `contracts/src/AvaClashMeta.sol` (Hợp đồng ELO, No-Loss Vault, Spectator Pool — 363 dòng)
   - `contracts/test/AvaClashMeta.t.sol` (Unit test của Meta — 203 dòng)
   - `contracts/test/ChessEscrowMetaIntegration.t.sol` (Integration test Escrow-Meta — 177 dòng)
   - `contracts/script/Deploy.s.sol` (Script deploy liên kết 2 hợp đồng)
   - `packages/relay/package.json`, `packages/relay/tsconfig.json`, `packages/relay/vitest.config.ts`
   - `web/src/components/SpectatorPoolWidget.tsx` (Widget đặt cược khán giả)
   - `pnpm-workspace.yaml`, `.gitmodules`, `packages/shared/tests/schemas.test.ts`
