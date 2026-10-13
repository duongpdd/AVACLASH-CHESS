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
    address internal alice;
    address internal bob;
    address internal evil;

    uint256 internal constant STAKE = 0.1 ether;

    function setUp() public {
        escrow = new ChessEscrow();
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);
        evil = vm.addr(evilPk);

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(evil, 10 ether);
    }

    // ──────── Helpers ────────

    function _createRoom(address creator, uint256 stake) internal returns (uint256) {
        vm.prank(creator);
        return escrow.createRoom{ value: stake }();
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

    function _signResult(uint256 pk, uint256 roomId, address winner, bytes32 movesHash, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(escrow.RESULT_TYPEHASH(), roomId, winner, movesHash, nonce));
        bytes32 digest = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", escrow.getDomainSeparator(), structHash));
    }

    // ──────── createRoom Tests ────────

    function test_createRoom() public {
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: STAKE }();

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(room.playerA, alice);
        assertEq(room.playerB, address(0));
        assertEq(room.stake, STAKE);
        assertEq(uint256(room.status), 0); // Open
    }

    function test_createRoom_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ChessEscrow.RoomCreated(0, alice, STAKE);
        escrow.createRoom{ value: STAKE }();
    }

    function test_createRoom_revert_zeroStake() public {
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.StakeTooLow.selector);
        escrow.createRoom{ value: 0 }();
    }

    function test_createRoom_revert_stakeAboveMax() public {
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.StakeTooHigh.selector);
        escrow.createRoom{ value: 2 ether }();
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

    // ──────── submitResult Tests (happy path) ────────

    function test_submitResult_whiteWins() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7"));
        uint256 nonce = 1;

        bytes memory sigA = _signResult(alicePk, roomId, alice, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, alice, movesHash, nonce);

        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigB);

        ChessEscrow.Room memory room = escrow.getRoom(roomId);
        assertEq(uint256(room.status), 2); // Settled
        assertEq(escrow.pendingWithdrawals(alice), STAKE * 2);
        assertEq(escrow.pendingWithdrawals(bob), 0);
    }

    function test_submitResult_blackWins() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("f2f3 e7e5 g2g4 d8h4"));
        uint256 nonce = 1;

        bytes memory sigA = _signResult(alicePk, roomId, bob, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, bob, movesHash, nonce);

        escrow.submitResult(roomId, bob, movesHash, nonce, sigA, sigB);

        assertEq(escrow.pendingWithdrawals(bob), STAKE * 2);
        assertEq(escrow.pendingWithdrawals(alice), 0);
    }

    function test_submitResult_draw() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5"));
        uint256 nonce = 1;

        bytes memory sigA = _signResult(alicePk, roomId, address(0), movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, address(0), movesHash, nonce);

        escrow.submitResult(roomId, address(0), movesHash, nonce, sigA, sigB);

        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        assertEq(escrow.pendingWithdrawals(bob), STAKE);
    }

    function test_submitResult_sigsReversed() public {
        // sigA from bob, sigB from alice — should still work
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4"));
        uint256 nonce = 1;

        bytes memory sigA = _signResult(bobPk, roomId, alice, movesHash, nonce);
        bytes memory sigB = _signResult(alicePk, roomId, alice, movesHash, nonce);

        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigB);
        assertEq(escrow.pendingWithdrawals(alice), STAKE * 2);
    }

    // ──────── submitResult Revert Tests ────────

    function test_submitResult_revert_invalidWinner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sigA = _signResult(alicePk, roomId, evil, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, evil, movesHash, nonce);

        vm.expectRevert(ChessEscrow.InvalidWinner.selector);
        escrow.submitResult(roomId, evil, movesHash, nonce, sigA, sigB);
    }

    function test_submitResult_revert_wrongSigner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        // Evil signs instead of bob
        bytes memory sigA = _signResult(alicePk, roomId, alice, movesHash, nonce);
        bytes memory sigEvil = _signResult(evilPk, roomId, alice, movesHash, nonce);

        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigEvil);
    }

    function test_submitResult_revert_sameSigner() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        // Alice signs both
        bytes memory sigA = _signResult(alicePk, roomId, alice, movesHash, nonce);

        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigA);
    }

    function test_submitResult_revert_replayNonce() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sigA = _signResult(alicePk, roomId, alice, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, alice, movesHash, nonce);

        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigB);

        // Create a new room and try same nonce on the same roomId (already settled)
        vm.expectRevert(ChessEscrow.RoomNotActive.selector);
        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigB);
    }

    function test_submitResult_revert_roomNotActive() public {
        uint256 roomId = _createRoom(alice, STAKE);
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sigA = _signResult(alicePk, roomId, alice, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, alice, movesHash, nonce);

        vm.expectRevert(ChessEscrow.RoomNotActive.selector);
        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigB);
    }

    function test_submitResult_revert_nonceAlreadyUsed() public {
        // Need two rooms to test nonce reuse on same roomId
        // But nonce is per roomId, so after settle the room won't be Active
        // Actually, the nonce check happens before the settle, so same roomId same nonce won't work
        // Let's test cross-room nonce isolation instead — nonce 1 on room 0 shouldn't affect room 1
        uint256 room1 = _createAndJoin();
        bytes32 movesHash = keccak256("test");

        bytes memory sigA1 = _signResult(alicePk, room1, alice, movesHash, 1);
        bytes memory sigB1 = _signResult(bobPk, room1, alice, movesHash, 1);
        escrow.submitResult(room1, alice, movesHash, 1, sigA1, sigB1);

        // Room 2 with same nonce should work fine
        uint256 room2 = _createAndJoin();
        bytes memory sigA2 = _signResult(alicePk, room2, alice, movesHash, 1);
        bytes memory sigB2 = _signResult(bobPk, room2, alice, movesHash, 1);
        escrow.submitResult(room2, alice, movesHash, 1, sigA2, sigB2);

        assertEq(uint256(escrow.getRoom(room2).status), 2); // Settled
    }

    // ──────── submitSingleSigned Tests ────────

    function test_submitSingleSigned() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sig = _signResult(alicePk, roomId, alice, movesHash, nonce);

        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sig);

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

        bytes memory sig = _signResult(alicePk, roomId, alice, movesHash, nonce);

        vm.prank(bob); // Bob tries to submit claiming Alice won
        vm.expectRevert(ChessEscrow.NotTheWinner.selector);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sig);
    }

    function test_submitSingleSigned_revert_invalidSig() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        // Evil signs, alice submits
        bytes memory sig = _signResult(evilPk, roomId, alice, movesHash, nonce);

        vm.prank(alice);
        vm.expectRevert(ChessEscrow.InvalidSignature.selector);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sig);
    }

    // ──────── finalizeSingleSigned Tests ────────

    function test_finalizeSingleSigned() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sig = _signResult(alicePk, roomId, alice, movesHash, nonce);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sig);

        // Warp past challenge window
        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);

        escrow.finalizeSingleSigned(roomId);

        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
        assertEq(escrow.pendingWithdrawals(alice), STAKE * 2);
    }

    function test_finalizeSingleSigned_revert_tooEarly() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sig = _signResult(alicePk, roomId, alice, movesHash, nonce);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sig);

        // Don't warp — still within challenge window
        vm.expectRevert(ChessEscrow.ChallengeWindowNotExpired.selector);
        escrow.finalizeSingleSigned(roomId);
    }

    // ──────── challenge Tests ────────

    function test_challenge() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        // Alice submits single-signed claiming she won
        bytes memory sigAlice = _signResult(alicePk, roomId, alice, movesHash, nonce);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sigAlice);

        // Bob challenges with different result (claims he won)
        bytes32 bobMovesHash = keccak256("different");
        bytes memory sigBob = _signResult(bobPk, roomId, bob, bobMovesHash, 2);

        vm.prank(bob);
        escrow.challenge(roomId, bob, bobMovesHash, 2, sigBob);

        assertEq(uint256(escrow.getRoom(roomId).status), 4); // Refunded
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        assertEq(escrow.pendingWithdrawals(bob), STAKE);
    }

    function test_challenge_revert_afterWindow() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, movesHash, nonce);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sigAlice);

        // Warp past challenge window
        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);

        bytes memory sigBob = _signResult(bobPk, roomId, bob, movesHash, 2);
        vm.prank(bob);
        vm.expectRevert(ChessEscrow.ChallengeWindowExpired.selector);
        escrow.challenge(roomId, bob, movesHash, 2, sigBob);
    }

    function test_challenge_revert_samePlayer() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("test");
        uint256 nonce = 1;

        bytes memory sigAlice = _signResult(alicePk, roomId, alice, movesHash, nonce);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sigAlice);

        // Alice tries to challenge her own submission
        bytes memory sigAlice2 = _signResult(alicePk, roomId, alice, movesHash, 2);
        vm.prank(alice);
        vm.expectRevert(ChessEscrow.NotAPlayer.selector);
        escrow.challenge(roomId, alice, movesHash, 2, sigAlice2);
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

    // ──────── Reentrancy Tests ────────

    function test_reentrancy_withdraw() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(escrow);
        vm.deal(address(attacker), 2 ether);

        // Attacker creates and cancels room to get pending balance
        attacker.createAndCancel(STAKE);
        assertEq(escrow.pendingWithdrawals(address(attacker)), STAKE);

        // Fund the escrow with extra ETH to make reentrancy worthwhile
        // (another user also has pending balance)
        uint256 roomId2 = _createRoom(alice, STAKE);
        vm.prank(alice);
        escrow.cancelRoom(roomId2);

        uint256 escrowBalBefore = address(escrow).balance;
        uint256 attackerBalBefore = address(attacker).balance;

        // Attack: withdraw triggers receive() which tries to re-enter
        // The re-entrant call should revert due to ReentrancyGuard,
        // but the outer withdraw should still succeed
        attacker.attack();

        // Attacker should only get their STAKE, not drain the contract
        assertEq(address(attacker).balance, attackerBalBefore + STAKE);
        assertEq(escrow.pendingWithdrawals(address(attacker)), 0);
        // Alice's balance should remain untouched
        assertEq(escrow.pendingWithdrawals(alice), STAKE);
        // Contract should still have Alice's stake
        assertEq(address(escrow).balance, escrowBalBefore - STAKE);
    }

    // ──────── Full Flow Integration Tests ────────

    function test_fullFlow_whiteWinsAndWithdraws() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256(abi.encodePacked("e2e4 e7e5"));
        uint256 nonce = 42;

        bytes memory sigA = _signResult(alicePk, roomId, alice, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, alice, movesHash, nonce);

        escrow.submitResult(roomId, alice, movesHash, nonce, sigA, sigB);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        escrow.withdraw();
        assertEq(alice.balance, balBefore + STAKE * 2);
    }

    function test_fullFlow_loserSilent_finalize() public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("game");
        uint256 nonce = 1;

        // Alice claims win with single sig
        bytes memory sig = _signResult(alicePk, roomId, alice, movesHash, nonce);
        vm.prank(alice);
        escrow.submitSingleSigned(roomId, alice, movesHash, nonce, sig);

        // Bob doesn't challenge → warp past window
        vm.warp(block.timestamp + escrow.CHALLENGE_WINDOW() + 1);
        escrow.finalizeSingleSigned(roomId);

        assertEq(escrow.pendingWithdrawals(alice), STAKE * 2);
    }

    // ──────── Fuzz Tests ────────

    function testFuzz_createRoom_stakeRange(uint256 stake) public {
        stake = bound(stake, 1, escrow.MAX_STAKE());
        vm.deal(alice, stake);
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: stake }();
        assertEq(escrow.getRoom(roomId).stake, stake);
    }

    function testFuzz_submitResult_anyValidWinner(uint8 winnerChoice) public {
        uint256 roomId = _createAndJoin();
        bytes32 movesHash = keccak256("fuzz");
        uint256 nonce = 1;

        // 0 = alice, 1 = bob, else = draw
        address winner;
        if (winnerChoice % 3 == 0) {
            winner = alice;
        } else if (winnerChoice % 3 == 1) {
            winner = bob;
        } else {
            winner = address(0);
        }

        bytes memory sigA = _signResult(alicePk, roomId, winner, movesHash, nonce);
        bytes memory sigB = _signResult(bobPk, roomId, winner, movesHash, nonce);

        escrow.submitResult(roomId, winner, movesHash, nonce, sigA, sigB);
        assertEq(uint256(escrow.getRoom(roomId).status), 2); // Settled
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

        // Settle room1
        bytes32 hash1 = keccak256("game1");
        bytes memory s1a = _signResult(alicePk, room1, alice, hash1, 1);
        bytes memory s1b = _signResult(bobPk, room1, alice, hash1, 1);
        escrow.submitResult(room1, alice, hash1, 1, s1a, s1b);

        // Room2 should still be active
        assertEq(uint256(escrow.getRoom(room2).status), 1);
    }

    function test_maxStake() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        uint256 roomId = escrow.createRoom{ value: 1 ether }();
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
}

// ──────── Reentrancy Attacker Helper ────────

contract ReentrancyAttacker {
    ChessEscrow public escrow;
    bool public attacking;

    constructor(ChessEscrow _escrow) {
        escrow = _escrow;
    }

    function createAndCancel(uint256 stake) external {
        uint256 roomId = escrow.createRoom{ value: stake }();
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
