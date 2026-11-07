# Output FAIL Thật - Tái Hiện Các Mục 4, 5, 6 Lượt 3b-fix

Báo cáo tái hiện lỗi chạy trên commit ngay trước mỗi commit sửa (checkout code cũ, giữ lại test mới).

---

## 1. Mục 4 (Commit sửa: b28214a -> Checkout commit trước: 70b5f55)

Tên test: `Item 4: mid-game disconnection does NOT stop the clock; timeout signs loss for disconnected player`
File test: `packages/relay/tests/relay.test.ts`
Lệnh chạy: `npx vitest run tests/relay.test.ts -t "Item 4: mid-game disconnection does NOT stop the clock"`

Output FAIL nguyên văn:
```
 RUN  v2.1.9 C:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay

 ❯ tests/relay.test.ts (22 tests | 1 failed | 21 skipped) 5028ms
   × RelayServer WebSocket Daemon (Turn 2c) > Item 4: mid-game disconnection does NOT stop the clock; timeout signs loss for disconnected player 5022ms
     → Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/relay.test.ts > RelayServer WebSocket Daemon (Turn 2c) > Item 4: mid-game disconnection does NOT stop the clock; timeout signs loss for disconnected player
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 21 skipped (22)
   Start at  10:11:53
   Duration  5.99s (transform 149ms, setup 0ms, collect 546ms, tests 5.03s, environment 0ms, prepare 153ms)
```

---

## 2. Mục 5 (Commit sửa: 4febbca -> Checkout commit trước: b28214a)

### Test A: Turn 3b Item 5 (handleGameOver saves result before RPC/signing)
Tên test: `Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement`
File test: `packages/relay/tests/anvil-integration.test.ts`
Lệnh chạy: `npx vitest run tests/anvil-integration.test.ts -t "Turn 3b Item 5"`

Output FAIL nguyên văn:
```
 RUN  v2.1.9 C:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay

(node:28160) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated.
(Use `node --trace-deprecation ...` to show where the warning was created)
stdout | tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement
[Relay] Calling signalGameStarted for room 0 (attempt 1)...

stdout | tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement
[Relay] signalGameStarted tx sent for room 0: 0x1e7a5e212618cd3da15f01f4bd6eb63648f4b60440b27c74ef732aebf78dcfc5. Waiting receipt...

stderr | tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement
[Relay] Failed to query on-chain room before signing room 0: Error: Simulated RPC Network Glitch (503 Service Unavailable)
    at Object.readContract (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\tests\anvil-integration.test.ts:1317:17)
    at RelayServer.fetchOnChainRoom (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:130:42)
    at RelayServer.handleGameOver (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:843:31)
    at RelayRoom.onGameOver (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:777:16)
    at RelayRoom.handleResign (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayRoom.ts:377:10)
    at RelayServer.routeMessage (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:467:14)
    at RelayServer.handleRawMessage (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:418:10)
    at WebSocket.<anonymous> (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\packages\relay\src\RelayServer.ts:360:14)
    at WebSocket.emit (node:events:508:28)
    at Receiver.receiverOnMessage (C:\Users\Admin\Desktop\PRJ1\avaclash-chess\node_modules\.pnpm\ws@8.21.0\node_modules\ws\lib\websocket.js:1239:20)

stdout | tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement
[Relay] Removed active game file for room 0

stdout | tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement
[Relay] signalGameStarted confirmed on-chain for room 0 in tx 0x1e7a5e212618cd3da15f01f4bd6eb63648f4b60440b27c74ef732aebf78dcfc5

 ❯ tests/anvil-integration.test.ts (14 tests | 1 failed | 13 skipped) 1471ms
   × RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement 698ms
     → expected 'No saved result found for room 0' to be undefined

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement
AssertionError: expected 'No saved result found for room 0' to be undefined

- Expected: 
undefined

+ Received: 
"No saved result found for room 0"

 ❯ tests/anvil-integration.test.ts:1434:35
    1432| 
    1433|       // On unpatched code, this will fail with an error because handl…
    1434|       expect(resultResp.errorMsg).toBeUndefined();
       |                                   ^
    1435|       expect(resultResp.proposal).toBeDefined();
    1436|       expect(resultResp.signatureMsg).toBeDefined();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 13 skipped (14)
   Start at  10:12:53
   Duration  2.74s (transform 138ms, setup 0ms, collect 870ms, tests 1.47s, environment 0ms, prepare 145ms)
```

### Test B: Turn 3b-verify Item 8 (readContract always throws, disk write within 200ms)
Tên test: `Turn 3b-verify Item 8: save-before-read-chain ensures result file exists on disk within 200ms when readContract always throws, then settles after RPC recovery`
File test: `packages/relay/tests/anvil-integration.test.ts`
Lệnh chạy: `npx vitest run tests/anvil-integration.test.ts -t "Item 8: save-before-read-chain"`

Output FAIL nguyên văn:
```
 FAIL  tests/anvil-integration.test.ts > RelayServer Anvil End-to-End Integration > Turn 3b-verify Item 8: save-before-read-chain ensures result file exists on disk within 200ms when readContract always throws, then settles after RPC recovery
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ tests/anvil-integration.test.ts:1607:49
    1605|         `31337_${escrowAddress.toLowerCase()}_${roomId}.json`
    1606|       );
    1607|       expect(fs.existsSync(expectedResultFile)).toBe(true);
       |                                                 ^
    1608| 
    1609|       const fileData = JSON.parse(fs.readFileSync(expectedResultFile, …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 13 skipped (14)
   Start at  10:08:08
   Duration  2.27s (transform 134ms, setup 0ms, collect 805ms, tests 1.09s, environment 0ms, prepare 124ms)
```

---

## 3. Mục 6 (Commit sửa: c917f65 -> Checkout commit trước: 4febbca)

Tên test: `Item 6: Origin verification rejects disallowed origin with 403, accepts allowed origin, and enforces allowNoOrigin`
File test: `packages/relay/tests/relay.test.ts`
Lệnh chạy: `npx vitest run tests/relay.test.ts -t "Item 6: Origin verification"`

Output FAIL nguyên văn:
```
 RUN  v2.1.9 C:/Users/Admin/Desktop/PRJ1/avaclash-chess/packages/relay

 ❯ tests/relay.test.ts (22 tests | 1 failed | 21 skipped) 46ms
   × RelayServer WebSocket Daemon (Turn 2c) > Item 6: Origin verification rejects disallowed origin with 403, accepts allowed origin, and enforces allowNoOrigin 18ms
     → expected true to be false // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/relay.test.ts > RelayServer WebSocket Daemon (Turn 2c) > Item 6: Origin verification rejects disallowed origin with 403, accepts allowed origin, and enforces allowNoOrigin
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/relay.test.ts:1057:30
    1055|       // 1. Rejected when Origin is not allowed
    1056|       const evilRes = await connectWithHeaders({ Origin: "https://evil…
    1057|       expect(evilRes.opened).toBe(false);
       |                              ^
    1058|       expect(evilRes.error?.message).toContain("403");
    1059|       evilRes.ws.close();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 21 skipped (22)
   Start at  10:13:58
   Duration  936ms (transform 124ms, setup 0ms, collect 499ms, tests 46ms, environment 0ms, prepare 141ms)
```

