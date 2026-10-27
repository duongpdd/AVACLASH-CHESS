// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ChessEscrow } from "../../src/ChessEscrow.sol";
import { GhostTracker } from "./GhostTracker.sol";

contract ChessEscrowHandler is Test {
    ChessEscrow public immutable escrow;
    GhostTracker public immutable tracker;

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

    constructor(ChessEscrow _escrow, GhostTracker _tracker) {
        escrow = _escrow;
        tracker = _tracker;

        for (uint256 i = 0; i < 3; i++) {
            players[i] = vm.addr(playerPks[i]);
            vm.deal(players[i], 10000 ether);
        }
        relay = vm.addr(relayPk);
        arbiter = escrow.arbiter();
        treasury = escrow.treasury();
        vm.deal(relay, 1000 ether);
        vm.deal(arbiter, 1000 ether);
    }

    function actorsCount() external pure returns (uint256) {
        return 3;
    }

    function getActor(uint256 idx) external view returns (address) {
        return players[idx % 3];
    }

    function roomCount() external view returns (uint256) {
        return allRoomIds.length;
    }

    // ──────── Action 1: Create Room ────────
    function createRoom(uint256 actorIdx, uint256 stakeAmount, bool creatorIsWhite) external {
        tracker.incCall();
        if (escrow.paused()) {
            vm.prank(escrow.owner());
            escrow.unpause();
            tracker.inc_unpause();
        }

        address creator = players[actorIdx % 3];
        uint256 stake = bound(stakeAmount, 0.01 ether, 1 ether);

        vm.prank(creator);
        uint256 roomId = escrow.createRoom{ value: stake }(creatorIsWhite);
        allRoomIds.push(roomId);
        tracker.inc_createRoom();
    }

    // ──────── Action 2: Join Room ────────
    function joinRoom(uint256 actorIdx, uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        if (escrow.paused()) {
            vm.prank(escrow.owner());
            escrow.unpause();
            tracker.inc_unpause();
        }

        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];
        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Open) return;

        address joiner = players[actorIdx % 3];
        if (joiner == r.playerA) {
            joiner = players[(actorIdx + 1) % 3];
        }

        vm.prank(joiner);
        escrow.joinRoom{ value: r.stake }(roomId);
        tracker.inc_joinRoom();
    }

    // ──────── Action 3: Signal Game Started ────────
    function signalGameStartedAction(uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.gameStarted) return;

        vm.prank(relay);
        escrow.signalGameStarted(roomId);
        tracker.inc_signalGameStarted();
    }

    // ──────── Action 4: Cancel Room ────────
    function cancelRoom(uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Open) return;

        vm.prank(r.playerA);
        escrow.cancelRoom(roomId);
        tracker.inc_cancelRoom();
    }

    // ──────── Action 5: Abort Room ────────
    function abortRoom(uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active) return;
        if (r.gameStarted || r.singleSignedAt != 0) return;

        vm.warp(block.timestamp + escrow.ABORT_TIMEOUT() + 1);
        escrow.abortRoom(roomId);
        tracker.inc_abortRoom();
    }

    // ──────── Action 6: Submit Result (Dual Player Signatures) ────────
    function submitResultDual(uint256 roomSeed, uint8 outcomeSeed) external {
        tracker.incCall();
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

        bytes32 movesHash = keccak256(abi.encodePacked("invariant-dual", roomId, outcome));
        uint256 nonce = block.timestamp + 10;
        uint256 deadline = block.timestamp + 1 hours;

        uint256 pkA = _getPk(r.playerA);
        uint256 pkB = _getPk(r.playerB);
        if (pkA == 0 || pkB == 0) return;

        bytes memory sigA = _sign(pkA, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);
        bytes memory sigB = _sign(pkB, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);

        escrow.submitResult(roomId, winner, outcome, 0, 30, movesHash, nonce, deadline, sigA, sigB);
        tracker.inc_submitResultDual();
    }

    // ──────── Action 7: Submit Result (Player + Relay Signatures, 2-of-3) ────────
    function submitResultRelay(uint256 roomSeed, uint8 outcomeSeed, uint256 playerChoice) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active) return;

        uint8 outcome = outcomeSeed % 3;
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        address winner;
        if (outcome == 0) winner = whitePlayer;
        else if (outcome == 1) winner = blackPlayer;
        else winner = address(0);

        bytes32 movesHash = keccak256(abi.encodePacked("invariant-relay", roomId, outcome));
        uint256 nonce = block.timestamp + 15;
        uint256 deadline = block.timestamp + 1 hours;

        address player = (playerChoice % 2 == 0) ? r.playerA : r.playerB;
        uint256 pkPlayer = _getPk(player);
        if (pkPlayer == 0) return;

        bytes memory sigPlayer = _sign(pkPlayer, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);
        bytes memory sigRelay = _sign(relayPk, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);

        escrow.submitResult(roomId, winner, outcome, 0, 30, movesHash, nonce, deadline, sigPlayer, sigRelay);
        tracker.inc_submitResultRelay();
    }

    // ──────── Action 8: Submit Single Signed (Submitter Bond Branch) ────────
    function submitSingleSignedAction(uint256 roomSeed, uint8 outcomeSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        if (!escrow.singleSignedEnabled()) {
            vm.prank(escrow.owner());
            escrow.setSingleSignedEnabled(true);
            tracker.inc_setSingleSignedEnabled();
        }

        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];
        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        uint8 outcome = (outcomeSeed % 2 == 0) ? 0 : 1;
        address winner = (outcome == 0) ? whitePlayer : blackPlayer;
        uint256 pkWinner = _getPk(winner);
        if (pkWinner == 0) return;

        bytes32 movesHash = keccak256(abi.encodePacked("single", roomId, outcome));
        uint256 nonce = block.timestamp + 20;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 bond = escrow.getChallengeBond(r.stake);

        bytes memory sig = _sign(pkWinner, roomId, winner, outcome, 0, 20, movesHash, nonce, deadline);

        vm.prank(winner);
        escrow.submitSingleSigned{ value: bond }(roomId, winner, outcome, 0, 20, movesHash, nonce, deadline, sig);
        tracker.inc_submitSingleSigned();
    }

    // ──────── Action 9: Challenge (Challenger Bond Branch) ────────
    function challengeAction(uint256 roomSeed, uint8 outcomeSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt == 0) return;

        address opponent = (r.singleSignedWinner == r.playerA) ? r.playerB : r.playerA;
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;

        uint8 outcome;
        address counterWinner;
        if (outcomeSeed % 2 == 0) {
            counterWinner = opponent;
            outcome = (opponent == whitePlayer) ? 0 : 1;
        } else {
            counterWinner = address(0);
            outcome = 2;
        }

        // Challenge within window
        vm.warp(r.singleSignedAt + 60);
        uint256 bond = escrow.getChallengeBond(r.stake);

        bytes32 movesHash = keccak256(abi.encodePacked("challenge", roomId, outcome));
        uint256 nonce = block.timestamp + 25;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 pkOpponent = _getPk(opponent);
        if (pkOpponent == 0) return;

        bytes memory sig = _sign(pkOpponent, roomId, counterWinner, outcome, 0, 22, movesHash, nonce, deadline);

        vm.prank(opponent);
        escrow.challenge{ value: bond }(roomId, counterWinner, outcome, 0, 22, movesHash, nonce, deadline, sig);
        tracker.inc_challenge();
    }

    // ──────── Action 10: Resolve Challenge (Arbiter Ruling Bond Branch) ────────
    function resolveChallengeAction(uint256 roomSeed, uint8 rulingSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Challenged) return;

        // Resolve within arbiter deadline
        vm.warp(r.challengedAt + 3600);
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        address winner;
        if (rulingSeed % 3 == 0) winner = whitePlayer;
        else if (rulingSeed % 3 == 1) winner = blackPlayer;
        else winner = address(0);

        vm.prank(escrow.arbiter());
        escrow.resolveChallenge(roomId, winner);
        tracker.inc_resolveChallenge();
    }

    // ──────── Action 11: Resolve Default Challenge (Default Bond Branch) ────────
    function resolveDefaultChallengeAction(uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Challenged) return;

        // Arbiter silent past deadline
        vm.warp(r.challengedAt + escrow.ARBITER_DEADLINE() + 1);
        escrow.resolveDefaultChallenge(roomId);
        tracker.inc_resolveDefaultChallenge();
    }

    // ──────── Action 12: Finalize Single Signed (Finalize Bond Branch) ────────
    function finalizeSingleSignedAction(uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt == 0) return;

        vm.warp(r.singleSignedAt + escrow.CHALLENGE_WINDOW() + 1);
        escrow.finalizeSingleSigned(roomId);
        tracker.inc_finalizeSingleSigned();
    }

    // ──────── Action 13: Refund on Timeout ────────
    function refundOnTimeoutAction(uint256 roomSeed) external {
        tracker.incCall();
        if (allRoomIds.length == 0) return;
        uint256 roomId = allRoomIds[roomSeed % allRoomIds.length];

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        uint256 baseTime = r.gameStartedAt > r.startedAt ? r.gameStartedAt : r.startedAt;
        vm.warp(baseTime + escrow.REFUND_TIMEOUT() + 1);
        escrow.refundOnTimeout(roomId);
        tracker.inc_refundOnTimeout();
    }

    // ──────── Action 14: Withdraw Pull Payments ────────
    function withdraw(uint256 actorIdx) external {
        tracker.incCall();
        address actor = players[actorIdx % 3];
        if (escrow.pendingWithdrawals(actor) > 0) {
            vm.prank(actor);
            escrow.withdraw();
            tracker.inc_withdraw();
        }
    }

    // ──────── Action 15: Withdraw Protocol Fees ────────
    function withdrawProtocolFees() external {
        tracker.incCall();
        if (escrow.protocolFees() > 0) {
            vm.prank(escrow.owner());
            escrow.withdrawProtocolFees();
            tracker.inc_withdrawProtocolFees();
        }
    }

    // ──────── Action 16: Pause Contract ────────
    function pauseAction() external {
        tracker.incCall();
        if (!escrow.paused()) {
            vm.prank(escrow.owner());
            escrow.pause();
            tracker.inc_pause();
        }
    }

    // ──────── Action 17: Unpause Contract ────────
    function unpauseAction() external {
        tracker.incCall();
        if (escrow.paused()) {
            vm.prank(escrow.owner());
            escrow.unpause();
            tracker.inc_unpause();
        }
    }

    // ──────── Action 18: Set Single Signed Enabled ────────
    function setSingleSignedEnabledAction(uint8 seed) external {
        tracker.incCall();
        // Keep enabled most of the time (80% enabled, 20% disabled) to ensure high bond coverage
        bool enabled = (seed % 5 != 0);
        vm.prank(escrow.owner());
        escrow.setSingleSignedEnabled(enabled);
        tracker.inc_setSingleSignedEnabled();
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
