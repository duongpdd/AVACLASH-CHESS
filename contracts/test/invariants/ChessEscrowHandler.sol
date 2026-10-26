// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ChessEscrow } from "../../src/ChessEscrow.sol";

contract ChessEscrowHandler is Test {
    ChessEscrow public immutable escrow;

    // Fixed actors for deterministic fuzz signing
    uint256[3] internal playerPks = [0xA1, 0xB2, 0xC3];
    address[3] public players;

    uint256 internal relayPk = 0xDE1A4;
    address public relay;

    address public arbiter;
    address public treasury;

    // Track active/open/challenged room IDs
    uint256[] public allRoomIds;

    bytes32 internal constant RESULT_TYPEHASH =
        keccak256("Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)");

    constructor(ChessEscrow _escrow) {
        escrow = _escrow;
        for (uint256 i = 0; i < 3; i++) {
            players[i] = vm.addr(playerPks[i]);
            vm.deal(players[i], 1000 ether);
        }
        relay = vm.addr(relayPk);
        arbiter = makeAddr("arbiter");
        treasury = makeAddr("treasury");
        vm.deal(relay, 100 ether);
        vm.deal(arbiter, 100 ether);
    }

    function actorsCount() external pure returns (uint256) {
        return 3;
    }

    function getActor(uint256 idx) external view returns (address) {
        return players[idx % 3];
    }

    // ──────── Action: Create Room ────────
    function createRoom(uint256 actorIdx, uint256 stakeAmount, bool creatorIsWhite) external {
        address creator = players[actorIdx % 3];
        // Stake between MIN_STAKE (0.01 ether) and MAX_STAKE (1 ether)
        uint256 stake = bound(stakeAmount, 0.01 ether, 1 ether);

        vm.prank(creator);
        uint256 roomId = escrow.createRoom{ value: stake }(creatorIsWhite);
        allRoomIds.push(roomId);
    }

    // ──────── Action: Join Room ────────
    function joinRoom(uint256 actorIdx, uint256 roomSeed) external {
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Open) return;

        address joiner = players[actorIdx % 3];
        if (joiner == r.playerA) {
            // Cannot join own room; pick another actor
            joiner = players[(actorIdx + 1) % 3];
        }

        vm.prank(joiner);
        escrow.joinRoom{ value: r.stake }(roomId);
    }

    // ──────── Action: Cancel Room ────────
    function cancelRoom(uint256 roomSeed) external {
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Open) return;

        vm.prank(r.playerA);
        escrow.cancelRoom(roomId);
    }

    // ──────── Action: Abort Room ────────
    function abortRoom(uint256 roomSeed) external {
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active) return;
        if (r.gameStarted || r.singleSignedAt != 0) return;

        vm.warp(block.timestamp + escrow.ABORT_TIMEOUT() + 1);
        escrow.abortRoom(roomId);
    }

    // ──────── Action: Submit Result (Dual Signed) ────────
    function submitResultDual(uint256 roomSeed, uint8 outcomeSeed) external {
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active) return;

        uint8 outcome = outcomeSeed % 3; // 0=White, 1=Black, 2=Draw
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        address winner;
        if (outcome == 0) winner = whitePlayer;
        else if (outcome == 1) winner = blackPlayer;
        else winner = address(0);

        bytes32 movesHash = keccak256(abi.encodePacked("invariant", roomId, outcome));
        uint256 nonce = block.timestamp + 10;
        uint256 deadline = block.timestamp + 1 hours;

        // Player A pk and Player B pk
        uint256 pkA = _getPk(r.playerA);
        uint256 pkB = _getPk(r.playerB);
        if (pkA == 0 || pkB == 0) return;

        bytes memory sigA = _sign(pkA, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);
        bytes memory sigB = _sign(pkB, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);

        escrow.submitResult(roomId, winner, outcome, 0, 30, movesHash, nonce, deadline, sigA, sigB);
    }

    // ──────── Action: Submit Single Signed ────────
    function submitSingleSignedAction(uint256 roomSeed) external {
        if (allRoomIds.length == 0 || !escrow.singleSignedEnabled()) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        uint256 pkWhite = _getPk(whitePlayer);
        if (pkWhite == 0) return;

        bytes32 movesHash = keccak256(abi.encodePacked("single", roomId));
        uint256 nonce = block.timestamp + 20;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 bond = escrow.getChallengeBond(r.stake);

        bytes memory sig = _sign(pkWhite, roomId, whitePlayer, 0, 0, 20, movesHash, nonce, deadline);

        vm.prank(whitePlayer);
        escrow.submitSingleSigned{ value: bond }(roomId, whitePlayer, 0, 0, 20, movesHash, nonce, deadline, sig);
    }

    // ──────── Action: Finalize Single Signed ────────
    function finalizeSingleSignedAction(uint256 roomSeed) external {
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt == 0) return;

        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);
        escrow.finalizeSingleSigned(roomId);
    }

    // ──────── Action: Refund on Timeout ────────
    function refundOnTimeoutAction(uint256 roomSeed) external {
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        vm.warp(block.timestamp + escrow.REFUND_TIMEOUT() + 1);
        escrow.refundOnTimeout(roomId);
    }

    // ──────── Action: Withdraw ────────
    function withdraw(uint256 actorIdx) external {
        address actor = players[actorIdx % 3];
        if (escrow.pendingWithdrawals(actor) > 0) {
            vm.prank(actor);
            escrow.withdraw();
        }
    }

    // ──────── Action: Withdraw Protocol Fees ────────
    function withdrawProtocolFees() external {
        if (escrow.protocolFees() > 0) {
            vm.prank(escrow.owner());
            escrow.withdrawProtocolFees();
        }
    }

    // ──────── Internal Signing Helpers ────────
    function _getPk(address player) internal view returns (uint256) {
        for (uint256 i = 0; i < 3; i++) {
            if (players[i] == player) return playerPks[i];
        }
        return 0;
    }

    function _sign(
        uint256 pk,
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            RESULT_TYPEHASH, roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", escrow.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
