// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ChessEscrow } from "../src/ChessEscrow.sol";

contract ChessEscrowTest is Test {
    ChessEscrow public escrow;

    // Test accounts
    uint256 internal alicePk = 0xA11CE;
    uint256 internal bobPk = 0xB0B;
    uint256 internal evilPk = 0xE111;
    uint256 internal relayPk = 0xBE1A1;
    address internal alice;
    address internal bob;
    address internal evil;
    address internal relay;
    address internal arbiter;
    address internal treasury;

    uint256 internal constant STAKE = 0.1 ether;

    function setUp() public {
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);
        evil = vm.addr(evilPk);
        relay = vm.addr(relayPk);
        arbiter = makeAddr("arbiter");
        treasury = makeAddr("treasury");

        escrow = new ChessEscrow(relay, arbiter, treasury);

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(evil, 10 ether);
        vm.deal(relay, 10 ether);
        vm.deal(arbiter, 10 ether);
    }

    // ──────── Helpers ────────

    function _createRoom(address creator, uint256 stake) internal returns (uint256) {
        vm.prank(creator);
        return escrow.createRoom{ value: stake }(true);
    }

    function _createRoomWithColor(address creator, uint256 stake, bool creatorIsWhite) internal returns (uint256) {
        vm.prank(creator);
        return escrow.createRoom{ value: stake }(creatorIsWhite);
    }

    function _joinRoom(address joiner, uint256 roomId, uint256 stake) internal {
        vm.prank(joiner);
        escrow.joinRoom{ value: stake }(roomId);
    }

    function _createAndJoin() internal returns (uint256) {
        uint256 roomId = _createRoom(alice, STAKE);
        _joinRoom(bob, roomId, STAKE);
        return roomId;
    }

    function _signResult(
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
            escrow.RESULT_TYPEHASH(), roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", escrow.getDomainSeparator(), structHash));
    }

    // Default signature helper with common params
    function _signDefault(uint256 pk, uint256 roomId, address winner, bytes32 movesHash, uint256 nonce)
        internal view returns (bytes memory)
    {
        return _signResult(pk, roomId, winner, 0, 0, 42, movesHash, nonce, block.timestamp + 1 hours);
    }

    // ──────── createRoom Tests ────────

    function test_createRoom() public {
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: STAKE }(true);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(room.playerA, alice);
        assertEq(room.playerB, address(0));
        assertEq(room.stake, STAKE);
        assertTrue(room.creatorIsWhite);
        assertEq(uint256(room.status), 0); // Open
        assertEq(escrow.getWhitePlayer(roomId), alice);
        assertEq(escrow.getBlackPlayer(roomId), address(0));
    }

    function test_createRoom_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ChessEscrow.RoomCreated(0, alice, STAKE, true);
        escrow.createRoom{ value: STAKE }(true);
    }

    function test_createRoom_revert_stakeBelowMin() public {
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.StakeTooLow.selector);
        escrow.createRoom{ value: 0 }(true);

        vm.prank(alice);
        vm.expectRevert(ChessEscrow.StakeTooLow.selector);
        escrow.createRoom{ value: 0.009 ether }(true);
    }

    function test_createRoom_revert_stakeAboveMax() public {
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.StakeTooHigh.selector);
        escrow.createRoom{ value: 2 ether }(true);
    }

    function test_createRoom_bothColorModes() public {
        // Mode 1: creator is White
        vm.prank(alice);
        uint256 rWhite = escrow.createRoom{ value: STAKE }(true);
        assertEq(escrow.getWhitePlayer(rWhite), alice);
        assertEq(escrow.getBlackPlayer(rWhite), address(0));
        _joinRoom(bob, rWhite, STAKE);
        assertEq(escrow.getWhitePlayer(rWhite), alice);
        assertEq(escrow.getBlackPlayer(rWhite), bob);

        // Mode 2: creator is Black
        vm.prank(alice);
        uint256 rBlack = escrow.createRoom{ value: STAKE }(false);
        assertEq(escrow.getWhitePlayer(rBlack), address(0));
        assertEq(escrow.getBlackPlayer(rBlack), alice);
        _joinRoom(bob, rBlack, STAKE);
        assertEq(escrow.getWhitePlayer(rBlack), bob);
        assertEq(escrow.getBlackPlayer(rBlack), alice);
    }

    function test_createRoom_incrementsId() public {
        uint256 id1 = _createRoom(alice, STAKE);
        uint256 id2 = _createRoom(alice, STAKE);
        assertEq(id1, 0);
        assertEq(id2, 1);
    }

    // ──────── joinRoom Tests ────────

    function test_joinRoom() public {
        uint256 roomId = _createRoom(alice, STAKE);
        _joinRoom(bob, roomId, STAKE);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(room.playerB, bob);
        assertEq(uint256(room.status), 1); // Active
        assertGt(room.startedAt, 0);
    }

    function test_joinRoom_revert_wrongStake() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(bob);
        vm.expectRevert(ChessEscrow.WrongStakeAmount.selector);
        escrow.joinRoom{ value: STAKE + 1 }(roomId);
    }

    function test_joinRoom_revert_selfJoin() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.CannotJoinOwnRoom.selector);
        escrow.joinRoom{ value: STAKE }(roomId);
    }

    function test_joinRoom_revert_notOpen() public {
        uint256 roomId = _createAndJoin();
        vm.prank(evil);
        vm.expectRevert(ChessEscrow.RoomNotOpen.selector);
        escrow.joinRoom{ value: STAKE }(roomId);
    }

    // ──────── cancelRoom Tests ────────

    function test_cancelRoom() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(alice);
        escrow.cancelRoom(roomId);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(uint256(room.status), 3); // Cancelled
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
    }

    function test_cancelRoom_revert_notCreator() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(bob);
        vm.expectRevert(ChessEscrow.NotCreator.selector);
        escrow.cancelRoom(roomId);
    }

    function test_cancelRoom_revert_roomActive() public {
        uint256 roomId = _createAndJoin();
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.RoomNotOpen.selector);
        escrow.cancelRoom(roomId);
    }

    // ──────── abortRoom Tests ────────

    function test_abortRoom_afterTimeout() public {
        uint256 roomId = _createAndJoin();
        // Warp past abort timeout
        vm.warp(block.timestamp + escrow.ABORT_TIMEOUT() + 1);
        escrow.abortRoom(roomId);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(uint256(room.status), 6); // Aborted
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        assertEq(escrow.pendingWithdrawals(bob), STAKE);
    }

    function test_abortRoom_revert_tooEarly() public {
        uint256 roomId = _createAndJoin();
        vm.expectRevert(ChessEscrow.AbortTooEarly.selector);
        escrow.abortRoom(roomId);
    }

    function test_abortRoom_revert_gameAlreadyStarted() public {
        uint256 roomId = _createAndJoin();
        // Signal game started
        vm.prank(relay);
        escrow.signalGameStarted(roomId);

        vm.warp(block.timestamp + escrow.ABORT_TIMEOUT() + 1);
        vm.expectRevert(ChessEscrow.GameAlreadyStarted.selector);
        escrow.abortRoom(roomId);
    }

    // ──────── signalGameStarted Tests ────────

    function test_signalGameStarted() public {
        uint256 roomId = _createAndJoin();
        vm.prank(relay);
        escrow.signalGameStarted(roomId);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertTrue(room.gameStarted);
    }

    function test_signalGameStarted_revert_notRelay() public {
        uint256 roomId = _createAndJoin();
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.signalGameStarted(roomId);
    }

    // ──────── submitResult Tests (2-of-3 signatures) ────────

    function test_submitResult_dualPlayerSigs() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7"));
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 7, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 0, 0, 7, movesHash, nonce, deadline);

        escrow.submitResult(roomId, alice, 0, 0, 7, movesHash, nonce, deadline, sigA, sigB);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(uint256(room.status), 2); // Settled
        // Winner gets pot minus 5% fee
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(alice), pot - fee);
        assertEq(escrow.pendingWithdrawals(bob), 0);
        assertEq(escrow.protocolFees(), fee);
    }

    function test_submitResult_playerAndRelaySigs() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5"));
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Alice + Relay (no Bob signature needed)
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 2, 10, movesHash, nonce, deadline);
        bytes memory sigRelay = _signResult(relayPk, roomId, alice, 0, 2, 10, movesHash, nonce, deadline);

        escrow.submitResult(roomId, alice, 0, 2, 10, movesHash, nonce, deadline, sigAlice, sigRelay);
        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
    }

    function test_submitResult_draw() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5"));
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, address(0), 2, 7, 20, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, address(0), 2, 7, 20, movesHash, nonce, deadline);

        escrow.submitResult(roomId, address(0), 2, 7, 20, movesHash, nonce, deadline, sigA, sigB);

        // Draw: both get stake back, no fee
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        assertEq(escrow.pendingWithdrawals(bob), STAKE);
        assertEq(escrow.protocolFees(), 0);
    }

    function test_submitResult_sigsReversed() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4"));
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(bobPk, roomId, alice, 0, 0, 1, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(alicePk, roomId, alice, 0, 0, 1, movesHash, nonce, deadline);

        escrow.submitResult(roomId, alice, 0, 0, 1, movesHash, nonce, deadline, sigA, sigB);
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(alice), pot - fee);
    }

    // ──────── submitResult Revert Tests ────────

    function test_submitResult_revert_invalidWinner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, evil, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, evil, 0, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, evil, 0, 0, 10, movesHash, nonce, deadline, sigA, sigB);
    }

    function test_submitResult_revert_winnerColorMismatch() public {
        uint256 roomId = _createAndJoin(); // alice is White, bob is Black
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // 1. Outcome 0 (WhiteWin) but winner is bob (Black player) -> revert InvalidWinner
        bytes memory sigA1 = _signResult(alicePk, roomId, bob, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB1 = _signResult(bobPk, roomId, bob, 0, 0, 10, movesHash, nonce, deadline);
        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, bob, 0, 0, 10, movesHash, nonce, deadline, sigA1, sigB1);

        // 2. Outcome 1 (BlackWin) but winner is alice (White player) -> revert InvalidWinner
        bytes memory sigA2 = _signResult(alicePk, roomId, alice, 1, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB2 = _signResult(bobPk, roomId, alice, 1, 0, 10, movesHash, nonce, deadline);
        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, alice, 1, 0, 10, movesHash, nonce, deadline, sigA2, sigB2);
    }

    function test_submitResult_creatorIsBlack_validWinnerAndMetaOption() public {
        // Alice creates room with creatorIsWhite = false (Alice is Black, Bob is White)
        uint256 roomId = _createRoomWithColor(alice, STAKE, false);
        _joinRoom(bob, roomId, STAKE);

        assertEq(escrow.getWhitePlayer(roomId), bob);
        assertEq(escrow.getBlackPlayer(roomId), alice);

        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Outcome 0 (WhiteWin) with Alice (who is Black) -> reverts
        bytes memory sigA1 = _signResult(alicePk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB1 = _signResult(bobPk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);
        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, alice, 0, 0, 10, movesHash, nonce, deadline, sigA1, sigB1);

        // Outcome 0 (WhiteWin) with Bob (White) -> success!
        bytes memory sigA2 = _signResult(alicePk, roomId, bob, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB2 = _signResult(bobPk, roomId, bob, 0, 0, 10, movesHash, nonce, deadline);
        escrow.submitResult(roomId, bob, 0, 0, 10, movesHash, nonce, deadline, sigA2, sigB2);

        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(bob), pot - fee);
    }

    function test_submitResult_revert_drawWithNonZeroWinner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // outcome == 2 (Draw) but winner is Alice != address(0)
        bytes memory sigA = _signResult(alicePk, roomId, alice, 2, 7, 10, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 2, 7, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, alice, 2, 7, 10, movesHash, nonce, deadline, sigA, sigB);
    }

    function test_submitResult_revert_zeroWinnerWithNonDrawOutcome() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // winner is address(0) but outcome == 0 (WhiteWin)
        bytes memory sigA = _signResult(alicePk, roomId, address(0), 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, address(0), 0, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, address(0), 0, 0, 10, movesHash, nonce, deadline, sigA, sigB);
    }

    function test_submitResult_revert_invalidOutcomeCode() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // outcome == 3 (invalid)
        bytes memory sigA = _signResult(alicePk, roomId, alice, 3, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 3, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, alice, 3, 0, 10, movesHash, nonce, deadline, sigA, sigB);
    }

    function test_submitSingleSigned_revert_outcomeWinnerMismatch() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Single signed claiming Alice won but outcome == 2 (Draw)
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 2, 7, 10, movesHash, nonce, deadline);

        vm.prank(alice);
        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitSingleSigned(roomId, alice, 2, 7, 10, movesHash, nonce, deadline, sigAlice);
    }

    function test_challenge_revert_outcomeWinnerMismatch() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 10, movesHash, nonce, deadline, sigAlice);

        // Bob challenges with mismatch: winner == bob but outcome == 2 (Draw)
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 2, 7, 10, movesHash, 2, deadline);
        uint256 bond = escrow.getChallengeBond(STAKE);

        vm.prank(bob);
        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.challenge{ value: bond }(roomId, bob, 2, 7, 10, movesHash, 2, deadline, sigBob);
    }

    function test_submitResult_revert_wrongSigner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigEvil = _signResult(evilPk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.submitResult(roomId, alice, 0, 0, 10, movesHash, nonce, deadline, sigA, sigEvil);
    }

    function test_submitResult_revert_sameSigner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.submitResult(roomId, alice, 0, 0, 10, movesHash, nonce, deadline, sigA, sigA);
    }

    function test_submitResult_revert_deadlineExpired() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp - 1; // Already expired

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.DeadlineExpired.selector);
        escrow.submitResult(roomId, alice, 0, 0, 10, movesHash, nonce, deadline, sigA, sigB);
    }

    function test_submitResult_revert_roomNotActive() public {
        uint256 roomId = _createRoom(alice, STAKE);
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 0, 0, 10, movesHash, nonce, deadline);

        vm.expectRevert(ChessEscrow.RoomNotActive.selector);
        escrow.submitResult(roomId, alice, 0, 0, 10, movesHash, nonce, deadline, sigA, sigB);
    }

    function test_submitResult_nonceIsolation() public {
        uint256 room1 = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory s1a = _signResult(alicePk, room1, alice, 0, 0, 10, movesHash, 1, deadline);
        bytes memory s1b = _signResult(bobPk, room1, alice, 0, 0, 10, movesHash, 1, deadline);
        escrow.submitResult(room1, alice, 0, 0, 10, movesHash, 1, deadline, s1a, s1b);

        // Room 2 with same nonce should work fine
        uint256 room2 = _createAndJoin();
        bytes memory s2a = _signResult(alicePk, room2, alice, 0, 0, 10, movesHash, 1, deadline);
        bytes memory s2b = _signResult(bobPk, room2, alice, 0, 0, 10, movesHash, 1, deadline);
        escrow.submitResult(room2, alice, 0, 0, 10, movesHash, 1, deadline, s2a, s2b);

        assertEq(uint256(escrow.getRoom(room2).status), 2); // Settled
    }

    // ──────── submitSingleSigned Tests ────────

    function test_submitSingleSigned() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);

        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(room.singleSignedWinner, alice);
        assertEq(room.singleSignedMovesHash, movesHash);
        assertGt(room.singleSignedAt, 0);
        assertEq(uint256(room.status), 1); // Still Active
    }

    function test_submitSingleSigned_revert_notWinner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);

        vm.prank(bob);
        vm.expectRevert(ChessEscrow.NotTheWinner.selector);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);
    }

    function test_submitSingleSigned_revert_invalidSig() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signResult(evilPk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);

        vm.prank(alice);
        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);
    }

    function test_submitSingleSigned_revert_deadlineExpired() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp - 1;

        bytes memory sig = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);

        vm.prank(alice);
        vm.expectRevert(ChessEscrow.DeadlineExpired.selector);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);
    }

    function test_submitSingleSigned_revert_overwriteExistingClaim() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Alice claims victory first
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sigAlice);

        // Bob attempts to overwrite Alice's claim with his own claim -> must revert
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 42, movesHash, nonce, deadline);
        vm.prank(bob);
        vm.expectRevert(ChessEscrow.SingleSignedAlreadySubmitted.selector);
        escrow.submitSingleSigned(roomId, bob, 1, 0, 42, movesHash, nonce, deadline, sigBob);

        // Even after challenge window expires, Bob cannot submit a new single-signed claim (must challenge or finalize)
        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);
        vm.prank(bob);
        vm.expectRevert(ChessEscrow.SingleSignedAlreadySubmitted.selector);
        escrow.submitSingleSigned(roomId, bob, 1, 0, 42, movesHash, nonce, deadline, sigBob);
    }

    function test_submitSingleSigned_cannotBurnOthersNonce() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Alice claims with nonce = 1
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sigAlice);

        // Alice's nonce 1 is marked used
        assertTrue(escrow.usedNonces(roomId, alice, nonce));
        // Bob's nonce 1 in this room is NOT burned
        assertFalse(escrow.usedNonces(roomId, bob, nonce));
    }

    // ──────── finalizeSingleSigned Tests ────────

    function test_finalizeSingleSigned() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);

        // Warp past challenge window
        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);

        escrow.finalizeSingleSigned(roomId);

        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(alice), pot - fee);
    }

    function test_finalizeSingleSigned_revert_tooEarly() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);

        vm.expectRevert(ChessEscrow.ChallengeWindowNotExpired.selector);
        escrow.finalizeSingleSigned(roomId);
    }

    // ──────── challenge Tests (with bond) ────────

    function test_challenge_withBond() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // Alice submits single-signed claiming she won
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sigAlice);

        // Bob challenges with bond
        bytes32 bobMovesHash = keccak256("different");
        uint256 deadline2 = block.timestamp + 1 hours;
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, bobMovesHash, 2, deadline2);

        uint256 bond = escrow.getChallengeBond(STAKE);
        vm.prank(bob);
        escrow.challenge{value: bond}(roomId, bob, 1, 0, 40, bobMovesHash, 2, deadline2, sigBob);

        assertEq(uint256(escrow.getRoom(roomId).status), 5); // Challenged
    }

    function test_challenge_revert_insufficientBond() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sigAlice);

        bytes32 bobMovesHash = keccak256("different");
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, bobMovesHash, 2, deadline);

        vm.prank(bob);
        vm.expectRevert(ChessEscrow.InsufficientBond.selector);
        escrow.challenge{value: 0.001 ether}(roomId, bob, 1, 0, 40, bobMovesHash, 2, deadline, sigBob);
    }

    function test_challenge_revert_afterWindow() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 2 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sigAlice);

        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);

        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        vm.expectRevert(ChessEscrow.ChallengeWindowExpired.selector);
        escrow.challenge{value: bond}(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);
    }

    function test_challenge_revert_samePlayer() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sigAlice);

        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigAlice2 = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 2, deadline);
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.NotAPlayer.selector);
        escrow.challenge{value: bond}(roomId, alice, 0, 0, 42, movesHash, 2, deadline, sigAlice2);
    }

    // ──────── resolveChallenge Tests ────────

    function test_resolveChallenge_challengerRight() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        // Alice claims win (wrong)
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigAlice);

        // Bob challenges (he actually won)
        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{value: bond}(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);

        // Arbiter rules in favor of Bob
        vm.prank(arbiter);
        escrow.resolveChallenge(roomId, bob);

        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
        // Bob gets: bond back + pot minus fee
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(bob), bond + pot - fee);
    }

    function test_resolveChallenge_challengerWrong() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        // Alice claims win (correct)
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigAlice);

        // Bob challenges (wrong)
        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{value: bond}(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);

        // Arbiter rules in favor of Alice
        vm.prank(arbiter);
        escrow.resolveChallenge(roomId, alice);

        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        // Alice gets: pot minus fee + Bob's bond
        assertEq(escrow.pendingWithdrawals(alice), pot - fee + bond);
        assertEq(escrow.pendingWithdrawals(bob), 0);
    }

    // ──────── resolveDefaultChallenge Tests ────────

    function test_resolveDefaultChallenge() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigAlice);

        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{value: bond}(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);

        // Arbiter doesn't respond, warp past deadline
        vm.warp(block.timestamp + escrow.ARBITER_DEADLINE() + 1);
        escrow.resolveDefaultChallenge(roomId);

        assertEq(uint256(escrow.getRoom(roomId).status), 4); // Refunded
        // Alice gets stake + 50% bond compensation
        assertEq(escrow.pendingWithdrawals(alice), STAKE + bond / 2);
        // Bob gets stake + remaining 50% bond
        assertEq(escrow.pendingWithdrawals(bob), STAKE + (bond - bond / 2));
    }

    function test_resolveDefaultChallenge_conservationAndFundFlow() public {
        uint256 aliceInitialBal = alice.balance;
        uint256 bobInitialBal = bob.balance;

        // Alice creates room, Bob joins
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: STAKE }(true);
        vm.prank(bob);
        escrow.joinRoom{ value: STAKE }(roomId);

        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigAlice);

        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{ value: bond }(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);

        // Contract holds exactly 2 * STAKE + bond
        assertEq(address(escrow).balance, 2 * STAKE + bond);

        // Arbiter is silent for 24h
        vm.warp(block.timestamp + escrow.ARBITER_DEADLINE() + 1);
        escrow.resolveDefaultChallenge(roomId);

        // Verify total funds are 100% conserved
        uint256 totalCredited = escrow.pendingWithdrawals(alice) + escrow.pendingWithdrawals(bob);
        assertEq(totalCredited, 2 * STAKE + bond);
        assertEq(totalCredited, address(escrow).balance);

        // Both players withdraw
        vm.prank(alice);
        escrow.withdraw();
        vm.prank(bob);
        escrow.withdraw();

        // Total contract balance after full withdrawals is 0
        assertEq(address(escrow).balance, 0);

        // Bob lost 50% of his challenge bond (penalty for challenging without arbiter resolution):
        // Bob's balance is strictly lower than bobInitialBal by bond/2:
        assertEq(bob.balance, bobInitialBal - (bond / 2));
        // Alice was compensated with 50% of Bob's bond:
        assertEq(alice.balance, aliceInitialBal + (bond / 2));
    }

    function test_G1_payoffComparison_loserSignsVsChallengeWithSilentArbiter() public {
        // Initial setup: Bob and Alice each have 10 AVAX
        // Stake is 0.1 AVAX.
        // Game played: Alice won on board.
        //
        // CASE A: Bob cooperates or Alice finalizes (Bob accepts loss)
        // Bob pays 0.1 AVAX stake, receives 0 back.
        // Bob net loss = -0.10 AVAX (-100% of stake).
        uint256 bobBalBeforeCaseA = bob.balance;
        uint256 roomA = _createAndJoin();
        bytes32 movesHash = keccak256("gameA");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sigAliceA = _signResult(alicePk, roomA, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomA, alice, 0, 0, 42, movesHash, 1, deadline, sigAliceA);

        // Bob does not challenge, Alice finalizes
        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);
        escrow.finalizeSingleSigned(roomA);

        vm.prank(bob);
        if (escrow.pendingWithdrawals(bob) > 0) escrow.withdraw();
        uint256 bobNetLossCaseA = bobBalBeforeCaseA - bob.balance;
        assertEq(bobNetLossCaseA, STAKE); // Exactly 0.1 ether net loss

        // CASE B: Bob challenges and arbiter remains silent (G1 residual incentive)
        // Bob stakes 0.1 AVAX, posts challenge bond of 0.02 AVAX (20%).
        // Arbiter does not resolve within 24 hours.
        // resolveDefaultChallenge refunds both players their stake, and returns 50% of the bond to Bob.
        uint256 bobBalBeforeCaseB = bob.balance;
        uint256 roomB = _createAndJoin();
        bytes memory sigAliceB = _signResult(alicePk, roomB, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomB, alice, 0, 0, 42, movesHash, 1, deadline, sigAliceB);

        uint256 bond = escrow.getChallengeBond(STAKE); // 0.02 ether
        bytes memory sigBobB = _signResult(bobPk, roomB, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{ value: bond }(roomB, bob, 1, 0, 40, movesHash, 2, deadline, sigBobB);

        // Arbiter silent for 24h
        vm.warp(block.timestamp + escrow.ARBITER_DEADLINE() + 1);
        escrow.resolveDefaultChallenge(roomB);

        vm.prank(bob);
        escrow.withdraw();
        uint256 bobNetLossCaseB = bobBalBeforeCaseB - bob.balance;
        assertEq(bobNetLossCaseB, bond / 2); // Exactly 0.01 ether net loss

        // Comparing the two payoffs:
        // By challenging and waiting for silent arbiter, Bob loses only 0.01 AVAX instead of 0.10 AVAX
        // Bob recovers 0.09 AVAX (90% of stake) due to default refund design.
        assertTrue(bobNetLossCaseB < bobNetLossCaseA);
        assertEq(bobNetLossCaseA - bobNetLossCaseB, STAKE - bond / 2); // 0.09 ether payoff difference
    }

    function test_resolveDefaultChallenge_revert_tooEarly() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigAlice);

        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{value: bond}(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);

        vm.expectRevert(ChessEscrow.ArbiterDeadlineNotReached.selector);
        escrow.resolveDefaultChallenge(roomId);
    }

    // ──────── refundOnTimeout Tests ────────

    function test_refundOnTimeout() public {
        uint256 roomId = _createAndJoin();

        vm.warp(block.timestamp + escrow.REFUND_TIMEOUT() + 1);

        escrow.refundOnTimeout(roomId);

        assertEq(uint256(escrow.getRoom(roomId).status), 4); // Refunded
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        assertEq(escrow.pendingWithdrawals(bob), STAKE);
    }

    function test_refundOnTimeout_revert_tooEarly() public {
        uint256 roomId = _createAndJoin();

        vm.expectRevert(ChessEscrow.RefundTooEarly.selector);
        escrow.refundOnTimeout(roomId);
    }

    // ──────── withdraw Tests ────────

    function test_withdraw() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(alice);
        escrow.cancelRoom(roomId);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        escrow.withdraw();

        assertEq(alice.balance, balanceBefore + STAKE);
        assertEq(escrow.pendingWithdrawals(alice), 0);
    }

    function test_withdraw_revert_nothingToWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.NothingToWithdraw.selector);
        escrow.withdraw();
    }

    function test_withdraw_emitsEvent() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(alice);
        escrow.cancelRoom(roomId);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.Withdrawn(alice, STAKE);
        escrow.withdraw();
    }

    // ──────── Relay Signer Rotation Tests ────────

    function test_proposeAndExecuteRelaySigner() public {
        address newRelay = makeAddr("newRelay");

        escrow.proposeRelaySigner(newRelay);
        assertEq(escrow.pendingRelaySigner(), newRelay);

        vm.warp(block.timestamp + escrow.RELAY_TIMELOCK() + 1);
        escrow.executeRelaySignerChange();

        assertEq(escrow.relaySigner(), newRelay);
        assertEq(escrow.pendingRelaySigner(), address(0));
    }

    function test_executeRelaySignerChange_revert_tooEarly() public {
        escrow.proposeRelaySigner(makeAddr("newRelay"));

        vm.expectRevert(ChessEscrow.TimelockNotReady.selector);
        escrow.executeRelaySignerChange();
    }

    function test_proposeRelaySigner_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.NotOwner.selector);
        escrow.proposeRelaySigner(makeAddr("newRelay"));
    }

    // ──────── Protocol Fees Tests ────────

    function test_protocolFee_onWin() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signDefault(alicePk, roomId, alice, movesHash, 1);
        bytes memory sigB = _signDefault(bobPk, roomId, alice, movesHash, 1);

        escrow.submitResult(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigA, sigB);

        uint256 expectedFee = (STAKE * 2 * 500) / 10000;
        assertEq(escrow.protocolFees(), expectedFee);
    }

    function test_protocolFee_noFeeOnDraw() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("draw");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, address(0), 2, 7, 30, movesHash, 1, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, address(0), 2, 7, 30, movesHash, 1, deadline);

        escrow.submitResult(roomId, address(0), 2, 7, 30, movesHash, 1, deadline, sigA, sigB);

        assertEq(escrow.protocolFees(), 0);
    }

    function test_withdrawProtocolFees() public {
        // Settle a game to generate fees
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        escrow.submitResult(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigA, sigB);

        uint256 fees = escrow.protocolFees();
        assertGt(fees, 0);

        uint256 treasuryBal = treasury.balance;
        escrow.withdrawProtocolFees();
        assertEq(treasury.balance, treasuryBal + fees);
        assertEq(escrow.protocolFees(), 0);
    }

    // ──────── Reentrancy Tests ────────

    function test_reentrancy_withdraw() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(escrow);
        vm.deal(address(attacker), 2 ether);

        attacker.createAndCancel(STAKE);
        assertEq(escrow.pendingWithdrawals(address(attacker)), STAKE);

        uint256 roomId2 = _createRoom(alice, STAKE);
        vm.prank(alice);
        escrow.cancelRoom(roomId2);

        uint256 escrowBalBefore = address(escrow).balance;
        uint256 attackerBalBefore = address(attacker).balance;

        attacker.attack();

        assertEq(address(attacker).balance, attackerBalBefore + STAKE);
        assertEq(escrow.pendingWithdrawals(address(attacker)), 0);
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        assertEq(address(escrow).balance, escrowBalBefore - STAKE);
    }

    // ──────── Full Flow Integration Tests ────────

    function test_fullFlow_whiteWinsAndWithdraws() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5"));
        uint256 nonce = 42;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(alicePk, roomId, alice, 0, 0, 2, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, alice, 0, 0, 2, movesHash, nonce, deadline);

        escrow.submitResult(roomId, alice, 0, 0, 2, movesHash, nonce, deadline, sigA, sigB);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        escrow.withdraw();
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(alice.balance, balBefore + pot - fee);
    }

    function test_fullFlow_loserSilent_finalize() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("game");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sig = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, nonce, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, nonce, deadline, sig);

        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);
        escrow.finalizeSingleSigned(roomId);

        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(alice), pot - fee);
    }

    // ──────── Fuzz Tests ────────

    function testFuzz_createRoom_stakeRange(uint256 stake) public {
        stake = bound(stake, escrow.MIN_STAKE(), escrow.MAX_STAKE());
        vm.deal(alice, stake);
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: stake }(true);
        assertEq(escrow.getRoom(roomId).stake, stake);
    }

    function testFuzz_challengeBond(uint256 stake) public {
        stake = bound(stake, escrow.MIN_STAKE(), escrow.MAX_STAKE());
        uint256 bond = escrow.getChallengeBond(stake);
        uint256 expectedFromStake = (stake * 2000) / 10000;
        uint256 expected = expectedFromStake > 0.01 ether ? expectedFromStake : 0.01 ether;
        assertEq(bond, expected);
    }

    function testFuzz_submitResult_validOutcomesAndWinners(
        uint8 outcomeChoice,
        uint8 reason,
        uint16 moveCount,
        uint256 nonce,
        uint256 extraDeadline
    ) public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("fuzzMoves", nonce));
        extraDeadline = bound(extraDeadline, 1, 30 days);
        uint256 deadline = block.timestamp + extraDeadline;

        outcomeChoice = uint8(bound(outcomeChoice, 0, 2)); // 0: White, 1: Black, 2: Draw
        address winner;
        if (outcomeChoice == 0) {
            winner = alice;
        } else if (outcomeChoice == 1) {
            winner = bob;
        } else {
            winner = address(0);
        }

        bytes memory sigA = _signResult(alicePk, roomId, winner, outcomeChoice, reason, moveCount, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(bobPk, roomId, winner, outcomeChoice, reason, moveCount, movesHash, nonce, deadline);

        escrow.submitResult(roomId, winner, outcomeChoice, reason, moveCount, movesHash, nonce, deadline, sigA, sigB);

        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
        if (outcomeChoice == 2) {
            assertEq(escrow.pendingWithdrawals(alice), STAKE);
            assertEq(escrow.pendingWithdrawals(bob), STAKE);
        } else {
            uint256 pot = STAKE * 2;
            uint256 fee = (pot * 500) / 10000;
            assertEq(escrow.pendingWithdrawals(winner), pot - fee);
            assertEq(escrow.protocolFees(), fee);
        }
    }

    function testFuzz_refundTimeout_warpAmount(uint256 extraTime) public {
        extraTime = bound(extraTime, 1, 365 days);
        uint256 roomId = _createAndJoin();

        vm.warp(block.timestamp + escrow.REFUND_TIMEOUT() + extraTime);
        escrow.refundOnTimeout(roomId);
        assertEq(uint256(escrow.getRoom(roomId).status), 4);
    }

    // ──────── Edge Cases ────────

    function test_multipleRooms_independentState() public {
        uint256 room1 = _createAndJoin();
        uint256 room2 = _createAndJoin();

        bytes32 hash1 = keccak256("game1");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory s1a = _signResult(alicePk, room1, alice, 0, 0, 10, hash1, 1, deadline);
        bytes memory s1b = _signResult(bobPk, room1, alice, 0, 0, 10, hash1, 1, deadline);
        escrow.submitResult(room1, alice, 0, 0, 10, hash1, 1, deadline, s1a, s1b);

        assertEq(uint256(escrow.getRoom(room2).status), 1); // Still Active
    }

    function test_maxStake() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: 1 ether }(true);
        assertEq(escrow.getRoom(roomId).stake, 1 ether);
    }

    function test_cancelRoom_thenWithdraw() public {
        uint256 roomId = _createRoom(alice, STAKE);
        vm.prank(alice);
        escrow.cancelRoom(roomId);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        escrow.withdraw();
        assertEq(alice.balance, balBefore + STAKE);
    }

    function test_getDomainSeparator_nonZero() public view {
        bytes32 ds = escrow.getDomainSeparator();
        assertNotEq(ds, bytes32(0));
    }

    function test_EIP712_DomainSeparator_Matches_V2_Spec() public view {
        bytes32 typeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
        bytes32 expectedDomainSeparator = keccak256(
            abi.encode(
                typeHash,
                keccak256(bytes("AvaClashChess")),
                keccak256(bytes("2")),
                block.chainid,
                address(escrow)
            )
        );
        assertEq(escrow.getDomainSeparator(), expectedDomainSeparator);
    }

    function test_crossSpec_submitResult_acceptsViemSignatures() public {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/test/fixtures/cross_spec_result.json");
        string memory json = vm.readFile(path);

        uint256 fixtureChainId = vm.parseJsonUint(json, ".chainId");
        address fixtureVerifyingContract = vm.parseJsonAddress(json, ".verifyingContract");
        address fixtureSignerA = vm.parseJsonAddress(json, ".signerA");
        address fixtureSignerB = vm.parseJsonAddress(json, ".signerB");
        address fixtureWinner = vm.parseJsonAddress(json, ".winner");
        uint256 fixtureMatchId = vm.parseJsonUint(json, ".matchId");
        uint8 outcome = uint8(vm.parseJsonUint(json, ".outcome"));
        uint8 reason = uint8(vm.parseJsonUint(json, ".reason"));
        uint16 moveCount = uint16(vm.parseJsonUint(json, ".moveCount"));
        bytes32 movesHash = vm.parseJsonBytes32(json, ".movesHash");
        uint256 nonce = vm.parseJsonUint(json, ".nonce");
        uint256 deadline = vm.parseJsonUint(json, ".deadline");
        bytes32 expectedDigest = vm.parseJsonBytes32(json, ".digest");
        bytes memory sigA = vm.parseJsonBytes(json, ".sigA");
        bytes memory sigB = vm.parseJsonBytes(json, ".sigB");

        assertEq(block.chainid, fixtureChainId);
        assertEq(address(escrow), fixtureVerifyingContract);

        // Fund accounts generated by TypeScript
        vm.deal(fixtureSignerA, 10 ether);
        vm.deal(fixtureSignerB, 10 ether);

        // Signer A creates room
        vm.prank(fixtureSignerA);
        uint256 roomId = escrow.createRoom{ value: STAKE }(true);
        assertEq(roomId, fixtureMatchId);

        // Signer B joins room
        vm.prank(fixtureSignerB);
        escrow.joinRoom{ value: STAKE }(roomId);

        // Verify digest computed inside contract matches Viem fixture digest
        bytes32 typeHash = keccak256("Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(typeHash, roomId, fixtureWinner, outcome, reason, moveCount, movesHash, nonce, deadline));
        bytes32 computedDigest = keccak256(abi.encodePacked("\x19\x01", escrow.getDomainSeparator(), structHash));
        assertEq(computedDigest, expectedDigest);

        // Submit result using signatures produced by Viem in TypeScript
        vm.prank(fixtureSignerA);
        escrow.submitResult(roomId, fixtureWinner, outcome, reason, moveCount, movesHash, nonce, deadline, sigA, sigB);

        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 500) / 10000;
        assertEq(escrow.pendingWithdrawals(fixtureWinner), pot - fee);
    }

    // ──────── Arbiter & Pausable Tests (G5) ────────

    function test_arbiter_different_from_relaySigner() public {
        // 1. Initial arbiter is distinct from relaySigner
        assertTrue(escrow.arbiter() != escrow.relaySigner());
        assertEq(escrow.arbiter(), arbiter);

        // 2. Deploying with identical arbiter and relaySigner must revert
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        new ChessEscrow(relay, relay, treasury);

        // 3. Deploying with zero address must revert
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        new ChessEscrow(address(0), arbiter, treasury);

        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        new ChessEscrow(relay, address(0), treasury);

        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        new ChessEscrow(relay, arbiter, address(0));

        // 4. Propose and rotate to new arbiter
        address newArbiter = address(0xAAAA9999);

        // Propose new arbiter
        escrow.proposeArbiter(newArbiter);
        assertEq(escrow.pendingArbiter(), newArbiter);

        // Cannot execute before timelock (2 days)
        vm.expectRevert(ChessEscrow.TimelockNotReady.selector);
        escrow.executeArbiterChange();

        // Warp 2 days and execute
        vm.warp(block.timestamp + 2 days);
        escrow.executeArbiterChange();
        assertEq(escrow.arbiter(), newArbiter);
        assertTrue(escrow.arbiter() != escrow.relaySigner());

        // Setup a challenge
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, 0, 0, 42, movesHash, 1, deadline);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, 0, 0, 42, movesHash, 1, deadline, sigAlice);

        uint256 bond = escrow.getChallengeBond(STAKE);
        bytes memory sigBob = _signResult(bobPk, roomId, bob, 1, 0, 40, movesHash, 2, deadline);
        vm.prank(bob);
        escrow.challenge{ value: bond }(roomId, bob, 1, 0, 40, movesHash, 2, deadline, sigBob);

        // Relay signer can no longer resolve challenge
        vm.prank(relay);
        vm.expectRevert(ChessEscrow.NotArbiter.selector);
        escrow.resolveChallenge(roomId, bob);

        // Old arbiter can no longer resolve challenge
        vm.prank(arbiter);
        vm.expectRevert(ChessEscrow.NotArbiter.selector);
        escrow.resolveChallenge(roomId, bob);

        // New arbiter resolves successfully
        vm.prank(newArbiter);
        escrow.resolveChallenge(roomId, bob);
        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
    }

    function test_pause_blocksCreateAndJoin_allowsAbortRefundWithdraw() public {
        // Create and join room 1 before pause
        uint256 roomId = _createAndJoin();

        // Owner pauses contract
        escrow.pause();

        // 1. Cannot create new room while paused
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        escrow.createRoom{ value: STAKE }(true);

        // 2. Cannot join existing open room while paused
        // Unpause temporarily to create an open room
        escrow.unpause();
        vm.prank(alice);
        uint256 openRoomId = escrow.createRoom{ value: STAKE }(true);
        escrow.pause();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        escrow.joinRoom{ value: STAKE }(openRoomId);

        // 3. Creator can still cancel their open room while paused
        vm.prank(alice);
        escrow.cancelRoom(openRoomId);
        assertEq(escrow.pendingWithdrawals(alice), STAKE);

        // 4. Players can still abort an active room while paused
        vm.warp(block.timestamp + escrow.ABORT_TIMEOUT() + 1);
        escrow.abortRoom(roomId);
        assertEq(escrow.pendingWithdrawals(bob), STAKE);

        // 5. Players can withdraw all funds without being blocked by pause
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        escrow.withdraw();
        assertEq(bob.balance, bobBalBefore + STAKE);
    }
}

// ──────── Reentrancy Attacker Helper ────────

contract ReentrancyAttacker {
    ChessEscrow public escrow;
    bool public attacking;

    constructor(ChessEscrow _escrow) {
        escrow = _escrow;
    }

    function createAndCancel(uint256 stake) external {
        uint256 roomId = escrow.createRoom{ value: stake }(true);
        escrow.cancelRoom(roomId);
    }

    function attack() external {
        attacking = true;
        escrow.withdraw();
    }

    receive() external payable {
        if (attacking && escrow.pendingWithdrawals(address(this)) > 0) {
            escrow.withdraw(); // Reentrancy attempt
        }
    }
}
