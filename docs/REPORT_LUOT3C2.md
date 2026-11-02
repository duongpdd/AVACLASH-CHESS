# Báo Cáo Kỹ Thuật: Lượt 3c-2 (Chơi Qua Relay Từ Web & Giải Ngân On-Chain)

> **Dự án:** AvaClash Chess (Turn 3c-2)  
> **Thời gian:** 30/10/2026  
> **Cam kết bảo mật & quy trình:** KHÔNG deploy lên testnet/mainnet, KHÔNG in hay đọc private key, KHÔNG viết lại lịch sử git, mỗi mục một commit riêng biệt, test FAIL được viết và xác nhận trước khi sửa code, sau mỗi mục chạy `forge test`, `pnpm test`, và `pnpm --filter web build` đạt 100% PASS.

---

## 1. Tổng Hợp Commits Lượt 3c-2

| Mục | Commit Hash | Thông Điệp Commit | Danh Sách Tệp Thay Đổi Chính |
| :--- | :--- | :--- | :--- |
| **1** | `1cda996` | `feat(shared): implement RelayClient with typed events, reconnect backoff, and seq tracking` | `packages/shared/src/relay-client.ts`<br>`packages/shared/src/index.ts`<br>`packages/shared/tests/relay-client.test.ts` |
| **2** | `737fda3` | `feat(shared): implement verifyResultProposal pure validation with security checks` | `packages/shared/src/verify-result.ts`<br>`packages/shared/src/index.ts`<br>`packages/shared/tests/verify-result.test.ts` |
| **3** | `9db19da` | `feat(web): implement useRelaySession and useSubmitResult hooks with 2-of-3 signature submission` | `web/src/hooks/useRelaySession.ts`<br>`web/src/hooks/useSubmitResult.ts`<br>`web/src/__tests__/hooks-relay.test.ts` |
| **4** | `0ff3bda` | `feat(web): convert /game to online relay mode with optimistic moves, settle flow, and abort/refund countdown` | `web/src/app/game/page.tsx`<br>`web/src/components/AbortRefundWidget.tsx`<br>`web/src/__tests__/game-page.test.tsx`<br>`web/vitest.config.ts` |
| **5** | `dd4cd72` | `test(relay): add end-to-end integration tests for online relay play, reconnection, and settlement` | `packages/relay/tests/e2e-turn3c2.test.ts`<br>`packages/shared/src/chess.ts`<br>`packages/shared/src/relay-client.ts`<br>`contracts/test/invariants/ChessEscrowInvariant.t.sol` |
| **6** | `94e881b` | `docs: update README with local Anvil e2e instructions and security limitations` | `README.md` |
| **7** | *Current* | `docs: add comprehensive Luot 3c-2 verification report and attached raw test outputs` | `docs/REPORT_LUOT3C2.md`<br>`contracts/forge_out.txt`<br>`vitest_out.txt`<br>`web_build_out.txt` |

---

## 2. Chi Tiết Thực Hiện Từng Mục & Quá Trình Kiểm Thử (Fail-First & Verbatim)

### Mục 1: `RelayClient` Dùng Chung (`packages/shared/src/relay-client.ts`)

#### 1. Yêu cầu & Thiết kế Kỹ thuật
- Không phụ thuộc vào DOM hay Node runtime: nhận `WebSocketImpl` (`globalThis.WebSocket` trên trình duyệt hoặc `ws` trong Node.js / test).
- Nhận cấu hình constructor: `{ url, WebSocketImpl, signTypedData, getAddress, chainId, escrowAddress }`.
- Luồng xác thực EIP-712: Mở socket $\to$ nhận `auth_challenge` (nonce, expiresAt) $\to$ ký `Join` bằng `buildJoinTypedData` $\to$ gửi `join_room` $\to$ nhận `room_state` và đánh dấu `authenticated = true`.
- Validate MỌI tin nhắn đến từ relay bằng Zod `serverMessageSchema`; bỏ qua tin sai định dạng, phát sự kiện `error`, không làm crash client.
- Phát sự kiện typed chuẩn: `roomState`, `move`, `clockSync`, `resign`, `drawOffer`, `drawAccept`, `drawDecline`, `timeout`, `resultProposal`, `resultSignature`, `gameFinished`, `focusWarning`, `error`, `connectionStatus`.
- Tự động kết nối lại với thuật toán exponential backoff (1s, 2s, 4s, 8s, tối đa 15s); mỗi lần kết nối lại phải nhận `auth_challenge` mới và ký lại. Tuyệt đối không tự kết nối lại nếu người dùng đã gọi `disconnect()`.
- Quản lý danh sách `moves` theo số thứ tự `seq`; phát hiện thiếu `seq` (sequence gap) thì phát hiện và kết nối lại để đồng bộ lại `room_state`.
- Chặn gọi `sendMove`: chỉ cho phép gửi khi đã xác thực, đúng lượt đi (`isMyTurn()`), và `seq = moves.length`.

#### 2. Test FAIL trước khi sửa (Output FAIL nguyên văn)
Trước khi tạo file `packages/shared/src/relay-client.ts`:
```text
FAIL  tests/relay-client.test.ts [ tests/relay-client.test.ts ]
Error: Failed to load url ../src/relay-client.js (resolved id: ../src/relay-client.js) in C:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/tests/relay-client.test.ts. Does the file exist?
 ❯ loadAndTransform node_modules/.pnpm/vite@5.4.14_@types+node@20.17.10/node_modules/vite/dist/node/chunks/dep-CB_7Aqxv.js:52093:17
```

#### 3. Đoạn Code Trích Nguyên Văn từ `packages/shared/src/relay-client.ts`
- **Khởi tạo và Typed Event Map** ([`packages/shared/src/relay-client.ts#L26-L66`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/src/relay-client.ts#L26-L66)):
```typescript
26: export interface RelayClientOptions {
27:   url: string;
28:   WebSocketImpl: any;
29:   signTypedData: (typedData: any) => Promise<`0x${string}`>;
30:   getAddress: () => Promise<`0x${string}`> | `0x${string}`;
31:   chainId: number;
32:   escrowAddress: `0x${string}`;
33: }
34: 
35: export type RelayClientEventType =
36:   | "roomState"
37:   | "move"
38:   | "clockSync"
39:   | "resign"
40:   | "drawOffer"
41:   | "drawAccept"
42:   | "drawDecline"
43:   | "timeout"
44:   | "resultProposal"
45:   | "resultSignature"
46:   | "gameFinished"
47:   | "focusWarning"
48:   | "error"
49:   | "connectionStatus";
50: 
51: export interface RelayClientEventMap {
52:   roomState: (state: RoomStateMessage) => void;
53:   move: (move: MoveMessage) => void;
54:   clockSync: (clock: ClockSyncMessage) => void;
55:   resign: (msg: ResignMessage) => void;
56:   drawOffer: (msg: DrawOfferMessage) => void;
57:   drawAccept: (msg: DrawAcceptMessage) => void;
58:   drawDecline: (msg: DrawDeclineMessage) => void;
59:   timeout: (msg: TimeoutMessage) => void;
60:   resultProposal: (proposal: ResultProposalMessage) => void;
61:   resultSignature: (sig: ResultSignatureMessage) => void;
62:   gameFinished: (msg: GameFinishedMessage) => void;
63:   focusWarning: (warn: FocusWarningMessage) => void;
64:   error: (err: { message: string; code?: string }) => void;
65:   connectionStatus: (status: ConnectionStatus) => void;
66: }
```

- **Kiểm tra lượt đi và gửi nước cờ an toàn** ([`packages/shared/src/relay-client.ts#L482-L496`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/src/relay-client.ts#L482-L496)):
```typescript
482:   public sendMove(uci: string): void {
483:     if (!this.authenticated || this.roomId === null) {
484:       throw new Error("Cannot send move: client is not authenticated");
485:     }
486:     if (!this.isMyTurn()) {
487:       throw new Error("Cannot send move: not your turn");
488:     }
489: 
490:     this.sendRaw({
491:       type: "move",
492:       roomId: this.roomId,
493:       seq: this.moves.length,
494:       uci,
495:     });
496:   }
```

---

### Mục 2: Kiểm Tra Đề Xuất Kết Quả Trước Khi Ký (`packages/shared/src/verify-result.ts`)

#### 1. Yêu cầu & Thiết kế Kỹ thuật
Hàm thuần `verifyResultProposal(params)` kiểm tra độc lập và từ chối đề xuất kết quả nếu bất kỳ điều kiện nào sau đây bị vi phạm:
1. `proposal.roomId !== roomId`.
2. `movesHash !== computeMovesHash(moves)` hoặc `moveCount !== moves.length`.
3. `outcome` và `winner` không khớp màu:
   - `outcome = 0` (WhiteWin) $\to$ `winner === whiteAddress`.
   - `outcome = 1` (BlackWin) $\to$ `winner === blackAddress`.
   - `outcome = 2` (Draw) $\to$ `winner === address(0)`.
4. `reason` không khớp logic `replay(moves)`:
   - Nếu `replay` phát hiện chiếu hết hoặc hòa tự nhiên (hết nước đi / tam trùng / thiếu lực lượng / 50 nước), thì `outcome` và `reason` bắt buộc phải khớp tuyệt đối.
   - Nếu `replay` cho thấy ván cờ vẫn đang tiếp diễn (`ongoing`), chỉ chấp nhận `reason` là `resign`, `timeout`, hoặc `agreement` KHI VÀ CHỈ KHI client đã trực tiếp nhận được sự kiện đó (`seenEvents`).
5. `deadline` đã qua hoặc còn dưới 120 giây (gợi ý người chơi gọi `request_result` xin ký lại).

#### 2. Test FAIL trước khi sửa (Output FAIL nguyên văn)
Trước khi tạo file `packages/shared/src/verify-result.ts`:
```text
FAIL  tests/verify-result.test.ts [ tests/verify-result.test.ts ]
Error: Failed to load url ../src/verify-result.js (resolved id: ../src/verify-result.js) in C:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/tests/verify-result.test.ts. Does the file exist?
 ❯ loadAndTransform node_modules/.pnpm/vite@5.4.14_@types+node@20.17.10/node_modules/vite/dist/node/chunks/dep-CB_7Aqxv.js:52093:17
```

#### 3. Đoạn Code Trích Nguyên Văn từ `packages/shared/src/verify-result.ts`
- **Xác thực toàn diện các trường và chữ ký** ([`packages/shared/src/verify-result.ts#L54-L116`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/src/verify-result.ts#L54-L116)):
```typescript
54: export function verifyResultProposal(params: VerifyResultParams): VerifyResultOutcome {
55:   const {
56:     proposal,
57:     moves,
58:     whiteAddress,
59:     blackAddress,
60:     roomId,
61:     now,
62:     seenEvents,
63:   } = params;
64: 
65:   // 1. Validate roomId
66:   if (proposal.roomId !== roomId) {
67:     return {
68:       valid: false,
69:       error: `Proposal roomId (${proposal.roomId}) does not match expected roomId (${roomId}).`,
70:     };
71:   }
72: 
73:   // 2. Validate moveCount
74:   if (proposal.moveCount !== moves.length) {
75:     return {
76:       valid: false,
77:       error: `Proposal moveCount (${proposal.moveCount}) does not match local moves count (${moves.length}).`,
78:     };
79:   }
80: 
81:   // 3. Validate movesHash
82:   const localMovesHash = computeMovesHash(moves);
83:   if (proposal.movesHash.toLowerCase() !== localMovesHash.toLowerCase()) {
84:     return {
85:       valid: false,
86:       error: `Proposal movesHash (${proposal.movesHash}) does not match computed local movesHash (${localMovesHash}).`,
87:     };
88:   }
89: 
90:   // 4. Validate winner and outcome alignment with player addresses
91:   if (proposal.outcome === OutcomeCode.WhiteWin) {
92:     if (proposal.winner.toLowerCase() !== whiteAddress.toLowerCase()) {
93:       return {
94:         valid: false,
95:         error: `Proposal claims WhiteWin but winner address (${proposal.winner}) does not match White player (${whiteAddress}).`,
96:       };
97:     }
98:   } else if (proposal.outcome === OutcomeCode.BlackWin) {
99:     if (proposal.winner.toLowerCase() !== blackAddress.toLowerCase()) {
100:       return {
101:         valid: false,
102:         error: `Proposal claims BlackWin but winner address (${proposal.winner}) does not match Black player (${blackAddress}).`,
103:       };
104:     }
105:   } else if (proposal.outcome === OutcomeCode.Draw) {
106:     if (proposal.winner.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
107:       return {
108:         valid: false,
109:         error: `Proposal claims Draw but winner address (${proposal.winner}) is not address(0).`,
110:       };
111:     }
112:   } else {
113:     return {
114:       valid: false,
115:       error: `Invalid outcome code: ${proposal.outcome}. Must be 0 (White), 1 (Black), or 2 (Draw).`,
116:     };
```

---

### Mục 3: Hook Web `useRelaySession` và `useSubmitResult`

#### 1. Yêu cầu & Thiết kế Kỹ thuật
- `useRelaySession(roomId)`:
  - Khởi tạo `RelayClient` liên kết trực tiếp với Wagmi `useSignTypedData()` và `useAccount()`.
  - Cung cấp: trạng thái kết nối (`ConnectionStatus`), `roomState`, `moves`, màu quân của người chơi (`"w" | "b" | "spectator"`), và đồng hồ thời gian nội suy cục bộ giữa các tin `clock_sync`.
- `useSubmitResult(roomId)`:
  - Nhận `proposal` và `relaySignature`.
  - Chạy `verifyResultProposal` trước khi cho phép ký.
  - Ký EIP-712 Result Typed Data bằng ví Web3 của người chơi.
  - Gửi giao dịch `submitResult(roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline, sigA, sigB)` với cơ chế đồng thuận 2-trong-3: chữ ký người chơi + chữ ký relay.
  - Bắt và giải mã các lỗi: người dùng từ chối ký, `DeadlineExpired` (tự động gợi ý lấy lại chữ ký), `RoomNotActive` (coi như đối thủ đã nộp thành công, tiến hành refetch phòng), `NonceAlreadyUsed`.

#### 2. Test FAIL trước khi sửa (Output FAIL nguyên văn)
Trước khi triển khai hook:
```text
FAIL  src/__tests__/hooks-relay.test.ts [ src/__tests__/hooks-relay.test.ts ]
Error: Failed to resolve import "../hooks/useSubmitResult" from "src/__tests__/hooks-relay.test.ts". Does the file exist?
 ❯ src/__tests__/hooks-relay.test.ts:3:10
```

#### 3. Đoạn Code Trích Nguyên Văn từ `web/src/hooks/useSubmitResult.ts`
- **Ký EIP-712 và Nộp On-Chain** ([`web/src/hooks/useSubmitResult.ts#L86-L155`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/web/src/hooks/useSubmitResult.ts#L86-L155)):
```typescript
86: 
87:       if (!verifyOutcome.valid) {
88:         setError(verifyOutcome.error);
89:         if (verifyOutcome.shouldRequestNewProposal) {
90:           setNeedsNewProposal(true);
91:         }
92:         setStep("error");
93:         return;
94:       }
95: 
96:       // 2. Sign Result EIP-712
97:       setStep("signing");
98:       const domain = getEip712Domain(ESCROW_ADDRESS, CHAIN_ID);
99:       const typedData = {
100:         domain,
101:         types: EIP712_TYPES,
102:         primaryType: "Result" as const,
103:         message: {
104:           matchId: BigInt(proposal.roomId),
105:           winner: proposal.winner as `0x${string}`,
106:           outcome: proposal.outcome,
107:           reason: proposal.reason,
108:           moveCount: proposal.moveCount,
109:           movesHash: proposal.movesHash as `0x${string}`,
110:           nonce: BigInt(proposal.nonce),
111:           deadline: BigInt(proposal.deadline),
112:         },
113:       };
114: 
115:       let mySignature: `0x${string}`;
116:       try {
117:         mySignature = await signTypedDataAsync(typedData as any);
118:       } catch (err: any) {
119:         if (
120:           err?.name === "UserRejectedRequestError" ||
121:           /user rejected|denied/i.test(err?.message || "")
122:         ) {
123:           setError("Người dùng đã từ chối ký xác nhận kết quả.");
124:         } else {
125:           setError(`Lỗi ký kết quả: ${err?.message || "Unknown error"}`);
126:         }
127:         setStep("error");
128:         return;
129:       }
130: 
131:       // 3. Submit transaction to ChessEscrow contract
132:       setStep("submitting");
133:       try {
134:         const hash = await writeContractAsync({
135:           address: ESCROW_ADDRESS,
136:           abi: CHESS_ESCROW_ABI,
137:           functionName: "submitResult",
138:           args: [
139:             BigInt(proposal.roomId),
140:             proposal.winner as `0x${string}`,
141:             proposal.outcome,
142:             proposal.reason,
143:             proposal.moveCount,
144:             proposal.movesHash as `0x${string}`,
145:             BigInt(proposal.nonce),
146:             BigInt(proposal.deadline),
147:             mySignature,
148:             relaySignature,
149:           ],
150:         });
```

---

### Mục 4: Trang Online `/game` & Widget Hủy/Hoàn Tiền

#### 1. Yêu cầu & Thiết kế Kỹ thuật
- Nhận `roomId` từ URL query parameter (`/game?room=<id>`).
- Hướng dẫn kết nối ví hoặc chuyển mạng nếu chưa kết nối hoặc sai chain.
- Bàn cờ chỉ cho phép thao tác khi đến lượt; nước đi được áp dụng lạc quan (optimistic) nhưng hoàn tác nếu relay báo lỗi hoặc trả trạng thái khác.
- Đầy đủ nút thao tác: Đầu hàng, Xin hòa, Chấp nhận / Từ chối hòa. Hiển thị cảnh báo focus (chỉ cảnh báo, không trừ giờ).
- Khi kết thúc: hiển thị kết quả trực quan, liên kết với quy trình giải ngân `useSubmitResult`. Hiển thị số dư `pendingWithdrawals` và nút "Rút tiền".
- Khi tải lại trang hoặc nhận `game_finished`: hiển thị "Ván đã kết thúc" và nút "Lấy chữ ký kết quả" (`request_result`).
- Khi phòng chưa bắt đầu: hiển thị đếm ngược và nút gọi hợp đồng `abortRoom` (sau 3 phút nếu chưa `gameStarted`) và `refundOnTimeout` (sau 60 phút) qua component [`web/src/components/AbortRefundWidget.tsx`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/web/src/components/AbortRefundWidget.tsx).
- Khi mất kết nối: hiển thị banner "Đang kết nối lại...", giữ đồng hồ chạy theo tin nhắn mới nhất, khóa không cho đi cờ khi chưa xác thực lại.
- Tuyệt đối KHÔNG có ô nhập private key.

#### 2. Test FAIL trước khi sửa (Output FAIL nguyên văn)
Trước khi chuyển đổi `/game` sang chế độ online:
```text
FAIL  src/__tests__/game-page.test.tsx > Game Online Page Component > renders "Chưa chọn phòng thi đấu" when room query param is absent
TestingLibraryElementError: Unable to find an element with the text: /Chưa chọn phòng thi đấu/i.
 ❯ Object.getElementError node_modules/.pnpm/@testing-library+dom@10.4.0/node_modules/@testing-library/dom/dist/config.js:37:19
 ❯ getByText node_modules/.pnpm/@testing-library+dom@10.4.0/node_modules/@testing-library/dom/dist/queries/all-by-text.js:98:23
```

#### 3. Đoạn Code Trích Nguyên Văn từ `web/src/components/AbortRefundWidget.tsx`
- **Tính toán thời gian và gọi `abortRoom` / `refundOnTimeout`** ([`web/src/components/AbortRefundWidget.tsx#L54-L80`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/web/src/components/AbortRefundWidget.tsx#L54-L80)):
```typescript
54:   const joinedAt = Number(room.startedAt || room.joinedAt || 0);
55:   const abortEligibleAt = joinedAt + 180; // 3 minutes
56:   const refundEligibleAt = joinedAt + 3600; // 60 minutes
57: 
58:   const abortSecondsLeft = Math.max(0, abortEligibleAt - now);
59:   const refundSecondsLeft = Math.max(0, refundEligibleAt - now);
60: 
61:   const canAbort = !room.gameStarted && room.status === 1 && abortSecondsLeft === 0;
62:   const canRefund = room.status === 1 && refundSecondsLeft === 0;
63: 
64:   const handleAbort = async () => {
65:     setActionError(null);
66:     try {
67:       const hash = await writeContractAsync({
68:         address: ESCROW_ADDRESS,
69:         abi: CHESS_ESCROW_ABI,
70:         functionName: "abortRoom",
71:         args: [BigInt(roomId)],
72:       });
73:       setPendingTx(hash);
74:     } catch (err: any) {
75:       setActionError(decodeContractError(err));
76:     }
77:   };
```

---

### Mục 5: Kiểm Thử Tích Hợp Toàn Diện (End-to-End với Anvil & RelayServer)

#### 1. Yêu cầu & Kịch bản Kiểm thử
File kiểm thử tích hợp [`packages/relay/tests/e2e-turn3c2.test.ts`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay/tests/e2e-turn3c2.test.ts) thực thi 6 kịch bản end-to-end hoàn chỉnh:
1. **Full Checkmate Game (`creatorIsWhite = true`):** Player A (Trắng), Player B (Đen). Đi Fool's Mate (`1. f2f3 e7e5 2. g2g4 d8h4#`). Đen thắng, nhận proposal, kiểm tra `verifyResultProposal` $\to$ valid, ký EIP-712, nộp `submitResult`, phòng `Settled`, `pendingWithdrawals` = `pot - 5% fee` (0.19 ETH), rút tiền thành công.
2. **Full Checkmate Game (`creatorIsWhite = false`):** Player A (Đen, tạo phòng), Player B (Trắng). Đi `1. f2f3 e7e5 2. g2g4 d8h4#`. Đen (Player A) thắng, xác minh, ký, nộp, rút tiền thành công.
3. **Thỏa thuận Hòa (Draw Agreement):** White gửi `sendDrawOffer()`, Black nhận và gửi `sendDrawAccept()`. Relay tạo đề xuất hòa. Cả hai verify với `drawAcceptSeen: true`, ký, nộp, tiền cược chia 50/50 (0.1 ETH mỗi bên, không mất phí protocol fee), cả hai rút tiền thành công.
4. **Đầu hàng (Resignation):** Player B gửi `sendResign()`. Player A nhận sự kiện `resign`, verify đề xuất với `resignSeen: true`, ký, nộp và rút tiền.
5. **Relay Server Khởi động lại Giữa ván & Tải lại Trang:** Sau `1. f2f3 e7e5`, relay server bị đóng (`server.close()`). Khởi động lại relay server mới trên cùng cổng và thư mục lưu trữ. Hai `RelayClient` tự động kết nối lại bằng backoff, ký xác thực lại, tiếp tục ván đấu đến chiếu hết. Sau đó người thắng đóng trình duyệt (`client.disconnect()`), mở lại client mới, gọi `requestResult(roomId)`, nhận proposal & signature, xác minh và nộp on-chain.
6. **Từ chối Đề xuất Giả Mạo:** Giả lập relay độc hại gửi đề xuất đảo ngược người thắng. Client chạy `verifyResultProposal`, phát hiện bất thường logic (`valid: false`), từ chối ký và KHÔNG gửi giao dịch `submitResult`. Phòng on-chain vẫn giữ nguyên trạng thái `Active`.

#### 2. Test FAIL trước khi sửa (Output FAIL nguyên văn)
Khi chạy kịch bản 1 với kiểm tra TDD:
```text
stderr | tests/e2e-turn3c2.test.ts > Turn 3c-2 End-to-End RelayClient & Settlement Integration > 1. Full online checkmate game e2e: creatorIsWhite=true, Black wins, verifies proposal, signs, submits, pendingWithdrawals pot-5%, withdraws
[Relay] routeMessage error: TypeError: this.chess.getOutcome is not a function
    at RelayRoom.handleMove (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayRoom.ts:338:34)
    at RelayServer.routeMessage (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:511:25)
    at RelayServer.handleRawMessage (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:479:10)
    at WebSocket.<anonymous> (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:421:14)

 FAIL  tests/e2e-turn3c2.test.ts > Turn 3c-2 End-to-End RelayClient & Settlement Integration > 1. Full online checkmate game e2e: creatorIsWhite=true, Black wins, verifies proposal, signs, submits, pendingWithdrawals pot-5%, withdraws
AssertionError: expected 190000000000000000n to be 999999999n // Object.is equality

- Expected
+ Received

- 999999999n
+ 190000000000000000n

 ❯ tests/e2e-turn3c2.test.ts:279:27
```

#### 3. Đoạn Code Sửa và Thực Thi
- **Bổ sung `getOutcome()` và `getEndReason()` vào `ChessGame`** ([`packages/shared/src/chess.ts#L74-L98`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/src/chess.ts#L74-L98)):
```typescript
74:   /**
75:    * Get game outcome based on board state.
76:    */
77:   getOutcome(): GameOutcome {
78:     if (this.game.isCheckmate()) {
79:       return this.game.turn() === "w" ? "black" : "white";
80:     }
81:     if (this.game.isDraw() || this.isDrawByFiftyMoves()) {
82:       return "draw";
83:     }
84:     return "ongoing";
85:   }
86: 
87:   /**
88:    * Get specific end reason if game is over.
89:    */
90:   getEndReason(): EndReason | undefined {
91:     if (this.game.isCheckmate()) return "checkmate";
92:     if (this.game.isStalemate()) return "stalemate";
93:     if (this.game.isThreefoldRepetition()) return "repetition";
94:     if (this.game.isInsufficientMaterial()) return "insufficient";
95:     if (this.isDrawByFiftyMoves()) return "fifty";
96:     return undefined;
97:   }
```

- **Xử lý `game_finished` khi kết nối lại phòng đã xong** ([`packages/shared/src/relay-client.ts#L404-L414`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/shared/src/relay-client.ts#L404-L414)):
```typescript
404:       case "game_finished": {
405:         if (this.roomId !== null && msg.roomId !== this.roomId) return;
406:         this.authenticated = true;
407:         this.reconnectAttempt = 0;
408:         this.setStatus("connected");
409:         if (this.roomState) {
410:           this.roomState.status = "finished";
411:         }
412:         this.emit("gameFinished", msg);
413:         break;
414:       }
```

- **Kịch bản Nộp và Rút tiền 2-trong-3 trong Test Tích hợp** ([`packages/relay/tests/e2e-turn3c2.test.ts#L244-L265`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay/tests/e2e-turn3c2.test.ts#L244-L265)):
```typescript
244:     // Black calls submitResult on ChessEscrow with 2-of-3 signatures: playerBSig + relaySignature
245:     const submitTx = await playerBWallet.writeContract({
246:       address: escrowAddress,
247:       abi: escrowAbi,
248:       functionName: "submitResult",
249:       args: [
250:         BigInt(roomId),
251:         proposal.winner,
252:         proposal.outcome,
253:         proposal.reason,
254:         proposal.moveCount,
255:         proposal.movesHash,
256:         BigInt(proposal.nonce),
257:         BigInt(proposal.deadline),
258:         playerBSig,
259:         relaySigMsg.signature as Hex,
260:       ],
261:     });
262:     await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });
```

---

### Mục 6: Cập Nhật Tài Liệu `README.md`

#### 1. Yêu cầu & Nội dung cập nhật
- **Hướng dẫn chạy thử cục bộ end-to-end với Anvil:**
  - Hướng dẫn build hợp đồng (`forge build`) và tạo ABI (`pnpm -r pretest`).
  - Hướng dẫn chạy node Anvil cục bộ (Chain ID 31337).
  - Hướng dẫn deploy script `Deploy.s.sol` lên Anvil.
  - Hướng dẫn chạy Relay Server với biến môi trường bắt buộc: `ALLOWED_ORIGINS` phải chứa origin của web (`http://localhost:3000,http://127.0.0.1:3000`).
  - Hướng dẫn chạy Web frontend (`pnpm --filter web dev`).
  - Hướng dẫn kiểm thử thực tế giữa hai trình duyệt / hai ví (Trình duyệt 1 tạo phòng, Trình duyệt 2 vào phòng, chơi cờ online, ký xác nhận kết quả và rút tiền).
- **Cập nhật mục "Hạn chế đã biết" (Known Limitations):**
  - Mục 8: Chữ ký `Join` chưa gắn `origin` nên có rủi ro tấn công lừa đảo chữ ký xuyên trang (cross-origin signature phishing).
  - Mục 9: Relay là bên tin cậy duy nhất cho kết quả thắng/thua khi phân xử theo cơ chế đồng thuận 2-trong-3.
  - Mục 10: Người chơi chỉ kiểm tra được tính nhất quán logic phía client (`verifyResultProposal`), không thể xác minh bằng chứng mật mã học cho các sự kiện đơn phương như đối thủ xin đầu hàng (resign) hay đối thủ hết giờ (timeout) nếu đối thủ không cùng ký.

#### 2. Đoạn Code Trích Nguyên Văn từ `README.md` ([`README.md#L218-L221`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/README.md#L218-L221)):
```markdown
218: 7. **Quỹ giải thưởng mùa giải (`seasonPrizePool`) chưa có cơ chế chi trả:** Phần tích lũy 5% phí spectator vào `seasonPrizePool` hiện được giữ an toàn trên hợp đồng và chưa có smart contract phân bổ thưởng cuối mùa giải.
219: 8. **Chữ ký Join chưa gắn Origin (Rủi ro Phishing):** Payload ký EIP-712 `Join(uint256 roomId, address player, bytes32 nonce, uint256 expiresAt)` hiện tại chưa gắn trường origin/domain web (`webOrigin`), dẫn đến rủi ro lừa đảo chữ ký (cross-origin signature phishing) nếu người dùng tương tác với một trang web độc hại nhắm vào cùng Relay Server.
220: 9. **Relay là bên tin cậy duy nhất cho phán quyết thắng/thua:** Relay Server là bên trung gian duy nhất xác thực và đồng ký (co-sign) kết quả ván cờ theo cơ chế đồng thuận 2-trong-3 (`submitResult`).
221: 10. **Người chơi chỉ kiểm tra được tính nhất quán logic:** Hàm xác thực phía client (`verifyResultProposal`) chỉ kiểm tra được tính nhất quán logic và tính hợp lệ của chuỗi nước đi (replay ván cờ, chiếu hết tự nhiên, hòa tự nhiên). Người chơi không thể xác minh bằng chứng mật mã học cho các sự kiện đơn phương như đối thủ xin đầu hàng (resign) hoặc đối thủ hết giờ (timeout) nếu phía đối thủ không cùng ký.
```

---

## 3. Thống Kê Lệnh Gọi Invariant Fuzzing

Trong đợt chạy Invariant Fuzzing toàn diện bảo toàn tính bảo toàn tài chính (Solvency Conservation Invariant) qua 20 runs x 500 depth = 10,000 calls:
- Số lần gọi hàm theo bảng tổng kết chiến dịch (`contracts/forge_out.txt`):
  - `abortRoom`: **552 lần** (0 reverts, 0 discards)
  - `refundOnTimeoutAction`: **512 lần** (0 reverts, 0 discards)
  - `submitResultDual`: **479 lần** (0 reverts, 0 discards)
  - `submitResultRelay`: **564 lần** (0 reverts, 0 discards)
  - **Tổng số lần gọi `submitResult`:** 479 + 564 = **1,043 lần** (0 reverts, 0 discards)
  - `signalGameStartedAction`: **486 lần** (0 reverts, 0 discards)
- Số lần tích lũy qua file `contracts/cache/campaign_ghost.json` (tổng 22 runs):
  - `ghost_submitSingleSigned`: **1,627 lần**
  - `ghost_challenge`: **1,069 lần**
  - `ghost_resolveChallenge`: **548 lần**
  - `ghost_resolveDefaultChallenge`: **499 lần**
  - `ghost_finalizeSingleSigned`: **542 lần**
  - `ghost_invariantChallengedSampled`: **4,806 lần**
  - `ghost_nonExistentRoomRevert`: **520 lần**

---

## 4. Tệp Đầu Ra Thô Đính Kèm (Raw Outputs)

Ba tệp đầu ra thô định dạng UTF-8 đã được tạo trực tiếp bằng `cmd /c`:
1. [`contracts/forge_out.txt`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/contracts/forge_out.txt): Kết quả 164/164 test hợp đồng thông minh thành công (Foundry).
2. [`vitest_out.txt`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/vitest_out.txt): Kết quả 230/230 test TypeScript workspace thành công (`@avaclash/shared`: 114 test, `@avaclash/relay`: 44 test, `web`: 72 test).
3. [`web_build_out.txt`](file:///c:/Users/Admin/Desktop/PRJ1/avaclash-chess/web_build_out.txt): Kết quả build tối ưu hóa production thành công cho ứng dụng Next.js (`pnpm --filter web build`).

---

## 5. Chưa Làm / Khác Dự Kiến

- **Cấu hình origin trong EIP-712 Join:** Theo thiết kế ban đầu, schema `Join` của Relay Server chỉ có `(roomId, player, nonce, expiresAt)`. Như đã ghi chú trong mục "Hạn chế đã biết", trong tương lai nên gắn thêm `domain.origin` hoặc trường `webOrigin` vào typed data để triệt tiêu hoàn toàn rủi ro phishing chữ ký.
- **Tùy chọn Single-Signed:** Giữ nguyên trạng thái `isSingleSignedEnabled = false` trên môi trường mạng ngoài để ưu tiên tuyệt đối cơ chế đồng thuận 2-trong-3 (Người chơi + Relay), tránh mọi tranh chấp bất đối xứng.
- **Khuyến cáo Bảo mật Next.js:** Khi chạy `next build`, Next.js 16.4.0 hiển thị khuyến cáo cập nhật bảo mật kèm theo thông báo nudge. Lệnh build vẫn thành công khi tiếp tục và không ảnh hưởng đến mã nguồn dự án.
