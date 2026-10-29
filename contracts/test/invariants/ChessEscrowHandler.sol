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

    // All created room IDs
    uint256[] public allRoomIds;

    // Room queues for O(1) state transitions during fuzzing
    uint256[] public openRooms;
    uint256[] public activeRooms;
    uint256[] public singleSignedRooms;
    uint256[] public challengedRooms;

    function _removeFrom(uint256[] storage arr, uint256 val) internal {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == val) {
                arr[i] = arr[len - 1];
                arr.pop();
                break;
            }
        }
    }

    // Paused steps management (item 3d: pause ~2% of calls and auto-unpause after a few calls)
    uint256 public pausedRemainingSteps;

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

    uint256 internal globalNonce = 1000;

    function _warpTo(uint256 targetTime) internal {
        if (targetTime > block.timestamp) {
            vm.warp(targetTime);
        }
    }

    function _checkChallengedSampled() internal {
        if (challengedRooms.length > 0) {
            tracker.inc_invariantChallengedSampled();
        }
    }

    function _checkAutoUnpause() internal returns (bool) {
        _checkChallengedSampled();
        if (escrow.paused()) {
            if (pausedRemainingSteps > 0) {
                pausedRemainingSteps--;
            }
            if (pausedRemainingSteps == 0) {
                vm.prank(escrow.owner());
                escrow.unpause();
                tracker.inc_unpause();
                return true;
            }
        }
        return false;
    }

    // ──────── Action 1: Create Room ────────
    function createRoom(uint256 actorIdx, uint256 stakeAmount, bool creatorIsWhite) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;

        address creator = players[actorIdx % 3];
        uint256 stake = bound(stakeAmount, 0.01 ether, 1 ether);

        vm.prank(creator);
        uint256 roomId = escrow.createRoom{ value: stake }(creatorIsWhite);
        allRoomIds.push(roomId);
        openRooms.push(roomId);
        tracker.inc_createRoom();
    }

    // ──────── Action 2: Join Room ────────
    function joinRoom(uint256 actorIdx, uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (openRooms.length == 0) return;

        uint256 targetId;
        if (roomSeed < escrow.nextRoomId() && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Open) {
            targetId = roomSeed;
        } else {
            targetId = openRooms[roomSeed % openRooms.length];
        }

        ChessEscrow.Room memory r = escrow.getRoom(targetId);
        if (r.status != ChessEscrow.RoomStatus.Open) return;

        address joiner = players[actorIdx % 3];
        if (joiner == r.playerA) {
            joiner = players[(actorIdx % 3 + 1) % 3];
        }

        vm.prank(joiner);
        escrow.joinRoom{ value: r.stake }(targetId);
        _removeFrom(openRooms, targetId);
        activeRooms.push(targetId);
        tracker.inc_joinRoom();
    }

    // ──────── Action 3: Signal Game Started ────────
    function signalGameStartedAction(uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (activeRooms.length == 0) return;

        uint256 targetId;
        if (roomSeed < escrow.nextRoomId() && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active) {
            targetId = roomSeed;
        } else {
            targetId = activeRooms[roomSeed % activeRooms.length];
        }

        ChessEscrow.Room memory check = escrow.getRoom(targetId);
        if (check.status != ChessEscrow.RoomStatus.Active || check.gameStarted) return;

        vm.prank(relay);
        escrow.signalGameStarted(targetId);
        tracker.inc_signalGameStarted();
    }

    // ──────── Action 4: Cancel Room ────────
    function cancelRoom(uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (openRooms.length == 0) return;

        bool isScripted = (roomSeed < escrow.nextRoomId());
        if (!isScripted && roomSeed % 20 != 0) return;

        uint256 targetId;
        if (isScripted && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Open) {
            targetId = roomSeed;
        } else {
            targetId = openRooms[roomSeed % openRooms.length];
        }

        ChessEscrow.Room memory check = escrow.getRoom(targetId);
        if (check.status != ChessEscrow.RoomStatus.Open) return;

        vm.prank(check.playerA);
        escrow.cancelRoom(targetId);
        _removeFrom(openRooms, targetId);
        tracker.inc_cancelRoom();
    }

    // ──────── Action 5: Abort Room ────────
    function abortRoom(uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (activeRooms.length == 0) return;

        bool isScripted = (roomSeed < escrow.nextRoomId());
        if (!isScripted && roomSeed % 20 != 0) return;

        uint256 targetId;
        if (isScripted && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active) {
            targetId = roomSeed;
        } else {
            targetId = activeRooms[roomSeed % activeRooms.length];
        }

        ChessEscrow.Room memory check = escrow.getRoom(targetId);
        if (check.status != ChessEscrow.RoomStatus.Active || check.gameStarted || check.singleSignedAt != 0) return;

        vm.warp(check.startedAt + escrow.ABORT_TIMEOUT() + 1);
        escrow.abortRoom(targetId);
        _removeFrom(activeRooms, targetId);
        tracker.inc_abortRoom();
    }

    // ──────── Action 6: Submit Result (Dual Player Signatures) ────────
    function submitResultDual(uint256 roomSeed, uint8 outcomeSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (activeRooms.length == 0) return;

        bool isScripted = (roomSeed < escrow.nextRoomId());
        if (!isScripted && roomSeed % 20 != 0) return;

        uint256 roomId;
        if (isScripted && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active) {
            roomId = roomSeed;
        } else {
            roomId = activeRooms[roomSeed % activeRooms.length];
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        uint8 outcome = outcomeSeed % 3; // 0=White, 1=Black, 2=Draw
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        address winner;
        if (outcome == 0) winner = whitePlayer;
        else if (outcome == 1) winner = blackPlayer;
        else winner = address(0);

        bytes32 movesHash = keccak256(abi.encodePacked("invariant-dual", roomId, outcome));
        uint256 nonce = ++globalNonce;
        uint256 deadline = block.timestamp + 1 hours;

        uint256 pkA = _getPk(r.playerA);
        uint256 pkB = _getPk(r.playerB);
        if (pkA == 0 || pkB == 0) return;

        bytes memory sigA = _sign(pkA, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);
        bytes memory sigB = _sign(pkB, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);

        escrow.submitResult(roomId, winner, outcome, 0, 30, movesHash, nonce, deadline, sigA, sigB);
        _removeFrom(activeRooms, roomId);
        tracker.inc_submitResultDual();
    }

    // ──────── Action 7: Submit Result (Player + Relay Signatures, 2-of-3) ────────
    function submitResultRelay(uint256 roomSeed, uint8 outcomeSeed, uint256 playerChoice) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (activeRooms.length == 0) return;

        bool isScripted = (roomSeed < escrow.nextRoomId());
        if (!isScripted && roomSeed % 20 != 1) return;

        uint256 roomId;
        if (isScripted && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active) {
            roomId = roomSeed;
        } else {
            roomId = activeRooms[roomSeed % activeRooms.length];
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        uint8 outcome = outcomeSeed % 3;
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        address winner;
        if (outcome == 0) winner = whitePlayer;
        else if (outcome == 1) winner = blackPlayer;
        else winner = address(0);

        bytes32 movesHash = keccak256(abi.encodePacked("invariant-relay", roomId, outcome));
        uint256 nonce = ++globalNonce;
        uint256 deadline = block.timestamp + 1 hours;

        address player = (playerChoice % 2 == 0) ? r.playerA : r.playerB;
        uint256 pkPlayer = _getPk(player);
        if (pkPlayer == 0) return;

        bytes memory sigPlayer = _sign(pkPlayer, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);
        bytes memory sigRelay = _sign(relayPk, roomId, winner, outcome, 0, 30, movesHash, nonce, deadline);

        escrow.submitResult(roomId, winner, outcome, 0, 30, movesHash, nonce, deadline, sigPlayer, sigRelay);
        _removeFrom(activeRooms, roomId);
        tracker.inc_submitResultRelay();
    }

    // ──────── Action 8: Submit Single Signed (Submitter Bond Branch) ────────
    function submitSingleSignedAction(uint256 roomSeed, uint8 outcomeSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;

        if (!escrow.singleSignedEnabled()) {
            vm.prank(escrow.owner());
            escrow.setSingleSignedEnabled(true);
            tracker.inc_setSingleSignedEnabled();
        }

        uint256 roomId;
        if (
            roomSeed < escrow.nextRoomId() &&
            escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active &&
            escrow.getRoom(roomSeed).singleSignedAt == 0
        ) {
            roomId = roomSeed;
        } else if (activeRooms.length > 0) {
            roomId = activeRooms[roomSeed % activeRooms.length];
        } else {
            address creator = players[outcomeSeed % 3];
            address joiner = players[(uint256(outcomeSeed) % 3 + 1) % 3];
            vm.prank(creator);
            roomId = escrow.createRoom{ value: 0.1 ether }(true);
            allRoomIds.push(roomId);
            vm.prank(joiner);
            escrow.joinRoom{ value: 0.1 ether }(roomId);
            activeRooms.push(roomId);
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt != 0) return;

        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        uint8 outcome = (outcomeSeed % 2 == 0) ? 0 : 1;
        address winner = (outcome == 0) ? whitePlayer : blackPlayer;
        uint256 pkWinner = _getPk(winner);
        if (pkWinner == 0) return;

        bytes32 movesHash = keccak256(abi.encodePacked("single", roomId, outcome));
        uint256 nonce = ++globalNonce;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 bond = escrow.getChallengeBond(r.stake);

        bytes memory sig = _sign(pkWinner, roomId, winner, outcome, 0, 20, movesHash, nonce, deadline);

        vm.prank(winner);
        escrow.submitSingleSigned{ value: bond }(roomId, winner, outcome, 0, 20, movesHash, nonce, deadline, sig);
        _removeFrom(activeRooms, roomId);
        singleSignedRooms.push(roomId);
        tracker.inc_submitSingleSigned();
    }

    // ──────── Action 9: Challenge (Challenger Bond Branch) ────────
    function challengeAction(uint256 roomSeed, uint8 outcomeSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;

        bool isScripted = (
            roomSeed < escrow.nextRoomId() &&
            escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active &&
            escrow.getRoom(roomSeed).singleSignedAt != 0
        );

        uint256 roomId;
        if (isScripted) {
            roomId = roomSeed;
        } else if (singleSignedRooms.length > 0) {
            roomId = singleSignedRooms[roomSeed % singleSignedRooms.length];
        } else {
            roomId = _ensureSingleSignedRoom(outcomeSeed);
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt == 0) return;

        // Challenge within window
        vm.warp(r.singleSignedAt + 60);

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

        uint256 bond = escrow.getChallengeBond(r.stake);

        bytes32 movesHash = keccak256(abi.encodePacked("challenge", roomId, outcome));
        uint256 nonce = ++globalNonce;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 pkOpponent = _getPk(opponent);
        if (pkOpponent == 0) return;

        bytes memory sig = _sign(pkOpponent, roomId, counterWinner, outcome, 0, 22, movesHash, nonce, deadline);

        vm.prank(opponent);
        escrow.challenge{ value: bond }(roomId, counterWinner, outcome, 0, 22, movesHash, nonce, deadline, sig);
        _removeFrom(singleSignedRooms, roomId);
        challengedRooms.push(roomId);
        tracker.inc_challenge();
    }

    // ──────── Action 10: Resolve Challenge (Arbiter Ruling Bond Branch) ────────
    function resolveChallengeAction(uint256 roomSeed, uint8 rulingSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;

        bool isScripted = (
            roomSeed < escrow.nextRoomId() &&
            escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Challenged
        );

        uint256 roomId;
        if (isScripted) {
            roomId = roomSeed;
        } else if (challengedRooms.length > 0) {
            roomId = challengedRooms[roomSeed % challengedRooms.length];
        } else {
            roomId = _ensureChallengedRoom(rulingSeed);
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Challenged) return;

        vm.warp(r.challengedAt + 60);

        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        address winner;
        if (rulingSeed % 3 == 0) winner = whitePlayer;
        else if (rulingSeed % 3 == 1) winner = blackPlayer;
        else winner = address(0);

        vm.prank(escrow.arbiter());
        escrow.resolveChallenge(roomId, winner);
        _removeFrom(challengedRooms, roomId);
        tracker.inc_resolveChallenge();
    }

    // ──────── Action 11: Resolve Default Challenge (Default Bond Branch) ────────
    function resolveDefaultChallengeAction(uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;

        bool isScripted = (
            roomSeed < escrow.nextRoomId() &&
            escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Challenged
        );

        uint256 roomId;
        if (isScripted) {
            roomId = roomSeed;
        } else if (challengedRooms.length > 0) {
            roomId = challengedRooms[roomSeed % challengedRooms.length];
        } else {
            roomId = _ensureChallengedRoom(roomSeed);
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Challenged) return;

        vm.warp(r.challengedAt + escrow.ARBITER_DEADLINE() + 1);
        escrow.resolveDefaultChallenge(roomId);
        _removeFrom(challengedRooms, roomId);
        tracker.inc_resolveDefaultChallenge();
    }

    // ──────── Action 12: Finalize Single Signed (Finalize Bond Branch) ────────
    function finalizeSingleSignedAction(uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;

        bool isScripted = (
            roomSeed < escrow.nextRoomId() &&
            escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active &&
            escrow.getRoom(roomSeed).singleSignedAt != 0
        );

        uint256 roomId;
        if (isScripted) {
            roomId = roomSeed;
        } else if (singleSignedRooms.length > 0) {
            roomId = singleSignedRooms[roomSeed % singleSignedRooms.length];
        } else {
            roomId = _ensureSingleSignedRoom(roomSeed);
        }

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        if (r.status != ChessEscrow.RoomStatus.Active || r.singleSignedAt == 0) return;

        vm.warp(r.singleSignedAt + escrow.CHALLENGE_WINDOW() + 1);
        escrow.finalizeSingleSigned(roomId);
        _removeFrom(singleSignedRooms, roomId);
        tracker.inc_finalizeSingleSigned();
    }

    // ──────── Action 13: Refund on Timeout ────────
    function refundOnTimeoutAction(uint256 roomSeed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;
        if (escrow.paused()) return;
        if (activeRooms.length == 0) return;

        bool isScripted = (roomSeed < escrow.nextRoomId());
        if (!isScripted && roomSeed % 20 != 2) return;

        uint256 roomId;
        if (isScripted && escrow.getRoom(roomSeed).status == ChessEscrow.RoomStatus.Active) {
            roomId = roomSeed;
        } else {
            roomId = activeRooms[roomSeed % activeRooms.length];
        }

        ChessEscrow.Room memory check = escrow.getRoom(roomId);
        if (check.status != ChessEscrow.RoomStatus.Active || check.singleSignedAt != 0) return;

        uint256 baseTime = check.gameStartedAt > check.startedAt ? check.gameStartedAt : check.startedAt;
        vm.warp(baseTime + escrow.REFUND_TIMEOUT() + 1);
        escrow.refundOnTimeout(roomId);
        _removeFrom(activeRooms, roomId);
        tracker.inc_refundOnTimeout();
    }

    // ──────── Action 14: Withdraw Pull Payments ────────
    function withdraw(uint256 actorIdx) external {
        tracker.incCall();
        _checkAutoUnpause();
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
        _checkAutoUnpause();
        if (escrow.protocolFees() > 0) {
            vm.prank(escrow.owner());
            escrow.withdrawProtocolFees();
            tracker.inc_withdrawProtocolFees();
        }
    }

    // ──────── Action 16: Pause Contract (Item 3d: ~2% of calls and auto-unpause) ────────
    function pauseAction(uint256 seed) external {
        tracker.incCall();
        if (_checkAutoUnpause()) return;

        // With 18 actions, pausing on ~36% of pauseAction calls yields ~2% of total calls
        if (seed % 100 >= 36) return;

        if (!escrow.paused()) {
            vm.prank(escrow.owner());
            escrow.pause();
            pausedRemainingSteps = 3 + (seed % 3); // Stay paused for 3 to 5 calls
            tracker.inc_pause();
        }
    }

    // ──────── Action 17: Unpause Contract ────────
    function unpauseAction() external {
        tracker.incCall();
        if (escrow.paused()) {
            if (pausedRemainingSteps == 0) {
                vm.prank(escrow.owner());
                escrow.unpause();
                tracker.inc_unpause();
            } else {
                pausedRemainingSteps--;
            }
        }
    }

    // ──────── Action 18: Set Single Signed Enabled ────────
    function setSingleSignedEnabledAction(uint8 seed) external {
        tracker.incCall();
        _checkAutoUnpause();
        // Keep enabled 90% of the time to ensure high bond coverage
        bool enabled = (seed % 10 != 0);
        vm.prank(escrow.owner());
        escrow.setSingleSignedEnabled(enabled);
        tracker.inc_setSingleSignedEnabled();
    }

    // ──────── Room State Setup Helpers ────────
    function _ensureSingleSignedRoom(uint256 seed) internal returns (uint256 roomId) {
        if (!escrow.singleSignedEnabled()) {
            vm.prank(escrow.owner());
            escrow.setSingleSignedEnabled(true);
            tracker.inc_setSingleSignedEnabled();
        }

        address creator = players[seed % 3];
        address joiner = players[(seed % 3 + 1) % 3];
        vm.prank(creator);
        roomId = escrow.createRoom{ value: 0.1 ether }(true);
        allRoomIds.push(roomId);
        vm.prank(joiner);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;
        address blackPlayer = r.creatorIsWhite ? r.playerB : r.playerA;

        uint8 outcome = (seed % 2 == 0) ? 0 : 1;
        address winner = (outcome == 0) ? whitePlayer : blackPlayer;
        uint256 pkWinner = _getPk(winner);

        bytes32 movesHash = keccak256(abi.encodePacked("single", roomId, outcome));
        uint256 nonce = ++globalNonce;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 bond = escrow.getChallengeBond(r.stake);

        bytes memory sig = _sign(pkWinner, roomId, winner, outcome, 0, 20, movesHash, nonce, deadline);

        vm.prank(winner);
        escrow.submitSingleSigned{ value: bond }(roomId, winner, outcome, 0, 20, movesHash, nonce, deadline, sig);
        singleSignedRooms.push(roomId);
        tracker.inc_submitSingleSigned();
    }

    function _ensureChallengedRoom(uint256 seed) internal returns (uint256 roomId) {
        if (singleSignedRooms.length == 0) {
            roomId = _ensureSingleSignedRoom(seed);
        } else {
            roomId = singleSignedRooms[seed % singleSignedRooms.length];
        }
        ChessEscrow.Room memory r = escrow.getRoom(roomId);
        vm.warp(r.singleSignedAt + 60);

        address opponent = (r.singleSignedWinner == r.playerA) ? r.playerB : r.playerA;
        address whitePlayer = r.creatorIsWhite ? r.playerA : r.playerB;

        uint8 outcome = (opponent == whitePlayer) ? 0 : 1;
        address counterWinner = opponent;
        uint256 bond = escrow.getChallengeBond(r.stake);
        bytes32 movesHash = keccak256(abi.encodePacked("challenge", roomId, outcome));
        uint256 nonce = ++globalNonce;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 pkOpponent = _getPk(opponent);

        bytes memory sig = _sign(pkOpponent, roomId, counterWinner, outcome, 0, 22, movesHash, nonce, deadline);
        vm.prank(opponent);
        escrow.challenge{ value: bond }(roomId, counterWinner, outcome, 0, 22, movesHash, nonce, deadline, sig);
        _removeFrom(singleSignedRooms, roomId);
        challengedRooms.push(roomId);
        tracker.inc_challenge();
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
