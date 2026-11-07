# Báo Cáo Nghiệm Thu Kỹ Thuật: Lượt 3c-1 (Nối Ví Web3 Cho Frontend)

**Dự án:** AvaClash Chess – Decentralized Competitive Chess on Avalanche  
**Thời gian hoàn thành:** 29-10-2026  
**Trạng thái kiểm thử:** 100% Pass trên toàn bộ hệ thống (156 Foundry Smart Contract Tests, 164 Vitest Tests trên 13 test suites). Production build (`pnpm --filter web build`) hoàn toàn sạch sẽ.

---

## 1. Tệp Log Kiểm Thử Thô Đính Kèm (UTF-8 via CMD)

Toàn bộ quá trình chạy kiểm thử được ghi nhận trực tiếp bằng lệnh `cmd /c` để bảo toàn nguyên vẹn byte stream UTF-8:

1. **Foundry Smart Contract Test Log (`forge test -vv`):**  
   [contracts/forge_out.txt](../../contracts/forge_out.txt)  
   - Kết quả: **156 tests passed, 0 failed, 0 skipped** (Bao gồm 23 tests trong `ChessEscrowMetaIntegrationTest`, 13 tests trong `ChessEscrowMetaTryCatchTest`, 94 tests trong `ChessEscrowTest`, 24 tests trong `AvaClashMetaTest`, và 2 Invariant suites).
2. **Monorepo Vitest Test Log (`pnpm test`):**  
   [vitest_out.txt](../../vitest_out.txt)  
   - Kết quả: **164 tests passed, 0 failed** trên 13 suites:
     - `@avaclash/shared`: 7 suites, 97 tests passed.
     - `@avaclash/relay`: 3 suites, 38 tests passed.
     - `web`: 3 suites (`GameState.test.ts`, `error-decoder.test.ts`, `anvil-web-integration.test.ts`), 29 tests passed.

---

## 2. Bảng Tổng Hợp Commit Và Files Từng Mục

| Mục | Commit SHA | Thông Điệp Commit | Tệp Tin Thay Đổi |
| :---: | :---: | :--- | :--- |
| **0** | `08913cd` | `fix(escrow): guard updateEloOnSettle with MIN_MOVES_FOR_ELO threshold and fix code quotes in verify report` | `contracts/src/Constants.sol`<br>`contracts/src/ChessEscrow.sol`<br>`contracts/src/AvaClashMeta.sol`<br>`contracts/test/ChessEscrowMetaIntegration.t.sol`<br>`contracts/test/ChessEscrowMetaTryCatch.t.sol`<br>`docs/REPORT_LUOT3B_VERIFY.md` |
| **1** | `66df297` | `feat(shared): migrate generated contract ABIs to @avaclash/shared with prebuild sync scripts and tests` | `packages/shared/scripts/generate-abi.mjs`<br>`packages/shared/scripts/generate-abi.ts`<br>`packages/shared/src/abi/ChessEscrow.ts`<br>`packages/shared/src/abi/AvaClashMeta.ts`<br>`packages/shared/src/abi/index.ts`<br>`packages/shared/src/index.ts`<br>`packages/shared/package.json`<br>`packages/shared/tests/abi.test.ts`<br>`packages/relay/package.json`<br>`packages/relay/src/RelayServer.ts`<br>`packages/relay/tests/abi.test.ts`<br>`packages/relay/src/abi/*`<br>`web/package.json` |
| **2** | `0ac7135` | `feat(web): configure wagmi, viem, react-query with fuji and anvil support and env template` | `web/package.json`<br>`pnpm-lock.yaml`<br>`web/.gitignore`<br>`web/.env.example`<br>`web/src/config/env.ts`<br>`web/src/config/wagmi.ts`<br>`web/src/providers/Web3Provider.tsx`<br>`web/src/app/layout.tsx` |
| **3** | `4211a3f` | `feat(web): implement Web3 wallet connection, room hooks, lobby UI, and custom error decoding` | `web/src/utils/errors.ts`<br>`web/src/hooks/useCreateRoom.ts`<br>`web/src/hooks/useJoinRoom.ts`<br>`web/src/hooks/useRoom.ts`<br>`web/src/hooks/useWithdraw.ts`<br>`web/src/hooks/useOpenRooms.ts`<br>`web/src/components/FujiTestnetBanner.tsx`<br>`web/src/components/WalletBar.tsx`<br>`web/src/components/TxStatusAlert.tsx`<br>`web/src/components/RoomLobbyWidget.tsx`<br>`web/src/app/page.tsx`<br>`web/src/app/game/page.tsx`<br>`web/tsconfig.json` |
| **5** | `9ce8078` | `test(web): add vitest error decoding tests, hook logic unit tests, and anvil integration test` | `web/src/__tests__/error-decoder.test.ts`<br>`web/src/__tests__/anvil-web-integration.test.ts` |

---

## 3. Chi Tiết Thực Hiện Từng Mục Của Lượt 3c-1

### Mục 0: Sửa Nhỏ Trước Khi Làm Web
1. **Định nghĩa hằng số ngưỡng dùng chung:**
   - Tạo file [`contracts/src/Constants.sol`](../../contracts/src/Constants.sol#L1-L5):
     ```solidity
     // SPDX-License-Identifier: MIT
     pragma solidity ^0.8.24;

     // Minimum half-moves required for ELO update and spectator prediction settlement (20).
     uint16 constant MIN_MOVES_THRESHOLD = 20;
     ```
   - Trong [`AvaClashMeta.sol`](../../contracts/src/AvaClashMeta.sol#L69-L70):
     ```solidity
         /// @notice Minimum moves required for valid prediction settlement (20). Matches with fewer moves cancel prediction (Q20).
         uint16 public constant MIN_MOVES_FOR_PREDICTION = MIN_MOVES_THRESHOLD;
     ```
   - Trong [`ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol#L57-L58):
     ```solidity
         /// @notice Minimum moves required for ELO update on settlement (20).
         uint16 public constant MIN_MOVES_FOR_ELO = MIN_MOVES_THRESHOLD;
     ```
2. **Cập nhật hàm `ChessEscrow._distribute`:**
   - Trích nguyên văn từ [`contracts/src/ChessEscrow.sol`](../../contracts/src/ChessEscrow.sol#L882-L889):
     ```solidity
                 if (metaContract != address(0)) {
                     if (moveCount >= MIN_MOVES_FOR_ELO) {
                         address loser = (winner == room.playerA) ? room.playerB : room.playerA;
                         try IAvaClashMeta(metaContract).updateEloOnSettle(winner, loser) {}
                         catch {
                             emit MetaCallFailed(roomId, IAvaClashMeta.updateEloOnSettle.selector);
                         }
                     }
     ```
3. **Thêm bài test ELO trong [`ChessEscrowMetaIntegration.t.sol`](../../contracts/test/ChessEscrowMetaIntegration.t.sol#L161-L217):**
   - Ván < 20 nửa nước (`moveCount = 19`): ELO người chơi A và B giữ nguyên 1200 / 1200 (`test_Elo_MovesUnder20_EloUnchanged`).
   - Ván $\ge 20$ nửa nước (`moveCount = 20`): ELO cập nhật thành 1224 / 1176 (`test_Elo_MovesAtLeast20_EloChanged`).
4. **Sửa trích dẫn trong `REPORT_LUOT3B_VERIFY.md`:**
   - Đã thay thế hai đoạn trích cũ bằng mã nguyên văn từ `ChessEscrow.sol:890-891` và `ChessEscrow.sol:868` kèm số dòng chính xác.

---

### Mục 1: ABI Dùng Chung Chuyển Vào `@avaclash/shared`
- **Tập lệnh sinh tự động:** [`packages/shared/scripts/generate-abi.mjs`](../../packages/shared/scripts/generate-abi.mjs) đọc trực tiếp từ `contracts/out/ChessEscrow.sol/ChessEscrow.json` và `contracts/out/AvaClashMeta.sol/AvaClashMeta.json`.
- **Cấu hình lifecycle:** Đã cấu hình `prebuild` và `pretest` trong `packages/shared/package.json`, `packages/relay/package.json`, và `web/package.json` tự động thực thi `node ../packages/shared/scripts/generate-abi.mjs`.
- **Đồng bộ import:**
   - Trong `packages/relay/src/RelayServer.ts`:
     ```typescript
     import { CHESS_ESCROW_ABI } from "@avaclash/shared";
     ```
   - Trong `web/src/hooks/*`:
     ```typescript
     import { CHESS_ESCROW_ABI } from "@avaclash/shared";
     ```
- **Kiểm thử đối chiếu artifact:** [`packages/shared/tests/abi.test.ts`](../../packages/shared/tests/abi.test.ts#L11-L30) và [`packages/relay/tests/abi.test.ts`](../../packages/relay/tests/abi.test.ts#L11-L30) khẳng định ABI đối tượng TypeScript khớp chính xác 100% với JSON artifact của Foundry.

---

### Mục 2: Cấu Hình Wagmi, Viem, React Query và Môi Trường Web
- **Gói phụ thuộc bổ sung vào `web`:** `wagmi@^3.7.9`, `viem@^2.21.0`, `@tanstack/react-query@^5.105.0`.
- **Cấu hình đa mạng [`web/src/config/wagmi.ts`](../../web/src/config/wagmi.ts#L1-L22):**
  - Mạng Avalanche Fuji Testnet (Chain ID 43113) và Anvil Localhost (Chain ID 31337).
  - Chọn mạng mục tiêu thông qua biến môi trường `NEXT_PUBLIC_CHAIN_ID`.
  - Transport HTTP động qua `NEXT_PUBLIC_RPC_URL`.
  - Connector: `injected()` chuẩn (MetaMask, Avalanche Core Wallet). Không sử dụng RainbowKit hay WalletConnect.
- **Biến môi trường mẫu [`web/.env.example`](../../web/.env.example):**
  ```env
  NEXT_PUBLIC_CHAIN_ID=43113
  NEXT_PUBLIC_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
  NEXT_PUBLIC_ESCROW_ADDRESS=0x54101e4a2d3c9071c775efcf4bbbeea8dc5057a1
  NEXT_PUBLIC_META_ADDRESS=0x34d58ba25fae3d1fa82ec9860b73c9f28cb7b093
  NEXT_PUBLIC_RELAY_URL=ws://localhost:8080
  NEXT_PUBLIC_UI_MAX_STAKE=0.1
  ```
- **Web3Provider:** Khởi tạo tại [`web/src/providers/Web3Provider.tsx`](../../web/src/providers/Web3Provider.tsx) và bọc toàn bộ ứng dụng trong [`web/src/app/layout.tsx`](../../web/src/app/layout.tsx).

---

### Mục 3: UI và Hook Tương Tác On-Chain
1. **Biểu ngữ cố định:**
   - Component [`web/src/components/FujiTestnetBanner.tsx`](../../web/src/components/FujiTestnetBanner.tsx):
     Hiển thị cố định đầu trang: `"⚠️ Fuji testnet - tiền thử nghiệm — Chỉ sử dụng mạng Avalanche Fuji Testnet (tiền thử nghiệm, không có giá trị quy đổi tài chính thật)."`.
2. **Thanh kết nối ví [`web/src/components/WalletBar.tsx`](../../web/src/components/WalletBar.tsx):**
   - Kết nối và ngắt kết nối qua injected connector.
   - Hiển thị địa chỉ rút gọn (`0x1234...5678`) và số dư AVAX thời gian thực.
   - Cảnh báo sai mạng: nút bấm `switchChain` chuyển sang mạng cấu hình; cửa sổ modal hướng dẫn thêm mạng thủ công (RPC URL, Chain ID, Symbol, Explorer).
   - Huy hiệu rút tiền tích hợp: tự động hiển thị số dư `pendingWithdrawals` khi có tiền sẵn sàng rút.
3. **Hook `useCreateRoom` ([`web/src/hooks/useCreateRoom.ts`](../../web/src/hooks/useCreateRoom.ts)):**
   - Đọc trực tiếp `MIN_STAKE` và `MAX_STAKE` từ `ChessEscrow` on-chain.
   - Ràng buộc mức cược giao diện tối đa 0.1 AVAX (`NEXT_PUBLIC_UI_MAX_STAKE`).
   - Kiểm soát trạng thái giao dịch (`idle`, `waiting_wallet`, `confirming`, `success`, `error`).
4. **Hook `useJoinRoom` ([`web/src/hooks/useJoinRoom.ts`](../../web/src/hooks/useJoinRoom.ts)):**
   - Tải thông tin phòng qua `getRoom(roomId)`: **hiển thị màu cờ của người tham gia (Trắng/Đen) và mức cược chính xác TRƯỚC khi người chơi bấm nút xác nhận**.
   - Chặn người tạo tự vào phòng của chính mình (`CannotJoinOwnRoom`).
5. **Hook `useRoom` ([`web/src/hooks/useRoom.ts`](../../web/src/hooks/useRoom.ts)):**
   - Đọc trạng thái phòng, theo dõi tự động các event (`RoomJoined`, `ResultSubmitted`, `RoomCancelled`) để cập nhật giao diện.
6. **Hook `useWithdraw` ([`web/src/hooks/useWithdraw.ts`](../../web/src/hooks/useWithdraw.ts)):**
   - Theo dõi số dư `pendingWithdrawals(address)` và thực thi lệnh rút tiền `withdraw()`.
7. **Hook `useOpenRooms` ([`web/src/hooks/useOpenRooms.ts`](../../web/src/hooks/useOpenRooms.ts)):**
   - Đọc `nextRoomId` và quét $N$ phòng gần nhất thông qua multicall `useReadContracts`, lọc danh sách các phòng đang mở (`status === 0`) hiển thị lên bảng sảnh chờ.
8. **Giải mã Custom Error tiếng Việt ([`web/src/utils/errors.ts`](../../web/src/utils/errors.ts)):**
   - Bắt và giải mã toàn bộ lỗi revert của Smart Contract (`StakeTooLow`, `StakeTooHigh`, `RoomNotOpen`, `RoomNotActive`, `CannotJoinOwnRoom`, `WrongStakeAmount`, `NothingToWithdraw`, `UserRejectedRequestError`, thiếu số dư gas...) thành thông báo tiếng Việt rõ ràng, thân thiện.
9. **Bảo mật tuyệt đối:**
   - **Tuyệt đối không có bất kỳ ô input hay biến lưu private key nào trên giao diện.** Toàn bộ thao tác ký và gửi giao dịch được ủy quyền hoàn toàn cho Extension ví bảo mật của trình duyệt.

---

### Mục 4: Quy Tắc Gọi Relay
- Không tích hợp lệnh gọi WebSocket relay nào vào các hook Web3 ở lượt này (tuân thủ 100% yêu cầu đề bài).

---

### Mục 5: Kiểm Thử Vitest Cho Hook & Tích Hợp Anvil
1. **Kiểm thử logic Hook & Giải mã lỗi ([`web/src/__tests__/error-decoder.test.ts`](../../web/src/__tests__/error-decoder.test.ts)):**
   - 11 test cases xác thực giải mã toàn bộ bảng lỗi, kiểm tra biên số tiền cược `validateStake` (0.01 đến 0.1 AVAX), tính toán màu cờ người tham gia, và ánh xạ nhãn trạng thái phòng 0..6.
2. **Kiểm thử tích hợp trên Anvil cục bộ ([`web/src/__tests__/anvil-web-integration.test.ts`](../../web/src/__tests__/anvil-web-integration.test.ts)):**
   - *Tính khả thi:* Hoàn toàn khả thi. Sử dụng module Anvil helper khởi tạo node Anvil port ngẫu nhiên, tự động deploy `AvaClashMeta` và `ChessEscrow`.
   - *Kịch bản kiểm chứng:*
     - Khởi tạo `createRoom` thành công với 0.05 AVAX (`status = 0`).
     - Xác nhận `nextRoomId` tăng từ 0 lên 1.
     - Khẳng định chủ phòng cố tình gọi `joinRoom` bị revert do `CannotJoinOwnRoom()`.
     - Người chơi thứ hai vào phòng nộp đúng 0.05 AVAX &rarr; phòng chuyển sang `Active` (`status = 1`).
     - Thao tác rút tiền khi số dư bằng 0 bị revert do `NothingToWithdraw()`.

---

## 4. Mục "Chưa Làm" (Chuyển Sang Lượt 3c-2)

Căn cứ theo kế hoạch phân chia giữa Lượt 3c-1 và Lượt 3c-2:
1. **Chơi qua Relay WebSocket:** Chưa kết nối WebSocket client từ trình duyệt đến Relay server daemon (`packages/relay`).
2. **Đồng bộ nước đi và đồng hồ Blitz:** Chưa trao đổi bản tin `move`, `clock_sync`, `focus_warning` trực tiếp giữa hai ví qua Relay.
3. **Ký và nộp kết quả 2-of-3:** Chưa tích hợp chức năng ký EIP-712 trên ví người chơi (`eth_signTypedData_v4`) khi ván cờ kết thúc (Checkmate, Resign, Timeout, Draw).
4. **Yêu cầu kết quả (`request_result`):** Chưa gửi yêu cầu lấy chữ ký Relay khi người chơi muốn tự nộp on-chain.
5. **Xử lý mất kết nối & Reconnect:** Chưa triển khai giao diện reconnect và khôi phục trạng thái ván cờ đang chơi dở từ Relay.
6. **Nộp kết quả đơn phương (`submitSingleSigned` / `challenge`):** Chưa đưa các nút ký quỹ khiếu nại lên UI khi đối thủ không ký.

---

## 5. Trích Dẫn NGUYÊN VĂN Mã Nguồn Kèm Số Dòng

### Đoạn 1: Ngưỡng `MIN_MOVES_THRESHOLD` trong `contracts/src/Constants.sol` (dòng 1-5)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimum half-moves required for ELO update and spectator prediction settlement (20).
uint16 constant MIN_MOVES_THRESHOLD = 20;
```

### Đoạn 2: Kiểm tra `moveCount >= MIN_MOVES_FOR_ELO` trong `contracts/src/ChessEscrow.sol` (dòng 882-889)
```solidity
            if (metaContract != address(0)) {
                if (moveCount >= MIN_MOVES_FOR_ELO) {
                    address loser = (winner == room.playerA) ? room.playerB : room.playerA;
                    try IAvaClashMeta(metaContract).updateEloOnSettle(winner, loser) {}
                    catch {
                        emit MetaCallFailed(roomId, IAvaClashMeta.updateEloOnSettle.selector);
                    }
                }
```

### Đoạn 3: Cấu hình đa mạng Wagmi trong `web/src/config/wagmi.ts` (dòng 6-22)
```typescript
export const targetChain = CHAIN_ID === 31337 ? anvil : avalancheFuji;

export const config = createConfig({
  chains: [targetChain, targetChain.id === 31337 ? avalancheFuji : anvil],
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http(
      CHAIN_ID === 43113
        ? RPC_URL
        : "https://api.avax-test.network/ext/bc/C/rpc"
    ),
    [anvil.id]: http(
      CHAIN_ID === 31337 ? RPC_URL : "http://127.0.0.1:8545"
    ),
  },
  ssr: true,
});
```

### Đoạn 4: Biểu ngữ cố định trong `web/src/components/FujiTestnetBanner.tsx` (dòng 5-15)
```typescript
  return (
    <aside
      aria-label="Cảnh báo môi trường thử nghiệm"
      className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm py-2 px-4 text-center shadow-lg flex items-center justify-center gap-2 border-b border-amber-300/40 select-none z-50 sticky top-0"
    >
      <span className="text-base animate-pulse">⚠️</span>
      <span>Fuji testnet - tiền thử nghiệm</span>
      <span className="hidden md:inline font-medium text-slate-900">
        — Chỉ sử dụng mạng Avalanche Fuji Testnet (tiền thử nghiệm, không có giá trị quy đổi tài chính thật).
      </span>
    </aside>
  );
```

### Đoạn 5: Hiển thị màu cờ và mức cược TRƯỚC KHI xác nhận trong `web/src/components/RoomLobbyWidget.tsx` (dòng 315-327)
```typescript
                <div className="flex justify-between items-center bg-indigo-950/40 border border-indigo-500/30 p-2 rounded-lg">
                  <span className="text-indigo-300 font-bold">Màu cờ của BẠN:</span>
                  <span className="font-extrabold text-sm text-indigo-200">
                    {joinerColor === "White" ? "♔ Trắng (Đi trước)" : "♚ Đen (Đi sau)"}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-amber-950/40 border border-amber-500/30 p-2 rounded-lg">
                  <span className="text-amber-300 font-bold">Mức cược cần nạp:</span>
                  <span className="font-mono font-extrabold text-sm text-amber-200">
                    {joinStakeFormatted} AVAX
                  </span>
                </div>
```
