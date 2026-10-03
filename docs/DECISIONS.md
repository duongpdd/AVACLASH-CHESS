# Quyết định thiết kế — AvaClash Chess

## Phase 1

### D1: Biểu diễn nước đi — UCI
- Dùng UCI (`e2e4`, `e7e8q`) thay vì SAN vì đơn giản, không phụ thuộc trạng thái bàn cờ khi parse.
- SAN chỉ dùng để hiển thị trong UI.

### D2: Hash nước đi
- `movesHash = keccak256(abi.encodePacked(uciMoves.join(" ")))`.
- Ván 0 nước → hash chuỗi rỗng.
- Dùng `viem/utils` `keccak256` + `toHex` ở TypeScript, `abi.encodePacked` ở Solidity → kết quả phải khớp.

### D3: EIP-712 Typed Data
- Domain: `name="AvaClashChess"`, `version="1"`, `chainId`, `verifyingContract`.
- Struct: `Result(uint256 matchId, address winner, bytes32 movesHash, uint256 nonce)`.
- `matchId` = `roomId` từ contract.
- Dùng chung type definition giữa TypeScript (viem) và Solidity (OpenZeppelin EIP712).

### D4: Monorepo tooling
- pnpm workspaces (nhẹ, nhanh, hỗ trợ tốt).
- Vitest cho test TypeScript (nhanh, ESM native).
- Prettier cho format (không dùng ESLint trong Phase 1 để giữ đơn giản).

### D5: Màu quân
- Người tạo phòng luôn là Trắng (đơn giản cho MVP).

### D6: Đồng hồ
- Mặc định 5 phút + 0 giây increment.
- Relay là nguồn thời gian tham chiếu. Client đếm ngược cục bộ.
- Hạn chế: đồng hồ không kiểm chứng được hoàn toàn off-chain.
