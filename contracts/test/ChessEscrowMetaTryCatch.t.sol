// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ChessEscrow, IAvaClashMeta } from "../src/ChessEscrow.sol";
import { AvaClashMeta } from "../src/AvaClashMeta.sol";

contract RevertingMetaMock is IAvaClashMeta {
    bool public failRegisterMatch;
    bool public failLockBetting;
    bool public failUpdateElo = true;
    bool public failResolvePrediction = true;
    bool public failCancelPrediction = true;

    function setFailRegisterMatch(bool fail) external {
        failRegisterMatch = fail;
    }

    function setFailLockBetting(bool fail) external {
        failLockBetting = fail;
    }

    function setFailUpdateElo(bool fail) external {
        failUpdateElo = fail;
    }

    function setFailResolvePrediction(bool fail) external {
        failResolvePrediction = fail;
    }

    function setFailCancelPrediction(bool fail) external {
        failCancelPrediction = fail;
    }

    function registerMatch(uint256, address, address) external view override {
        if (failRegisterMatch) revert("RevertingMetaMock: registerMatch failed");
    }

    function lockBetting(uint256) external view override {
        if (failLockBetting) revert("RevertingMetaMock: lockBetting failed");
    }

    function updateEloOnSettle(address, address) external view override {
        if (failUpdateElo) revert("RevertingMetaMock: updateEloOnSettle failed");
    }

    function resolvePrediction(uint256, uint8, uint16) external view override {
        if (failResolvePrediction) revert("RevertingMetaMock: resolvePrediction failed");
    }

    function cancelPrediction(uint256) external view override {
        if (failCancelPrediction) revert("RevertingMetaMock: cancelPrediction failed");
    }
}

contract ChessEscrowMetaTryCatchTest is Test {
    ChessEscrow public escrow;
    RevertingMetaMock public revertingMeta;

    uint256 internal creatorPrivateKey = 0xA11CE;
    uint256 internal joinerPrivateKey = 0xB0B;
    uint256 internal relayPrivateKey = 0x9999;

    address public playerA;
    address public playerB;
    address public relaySigner;
    address public arbiter = address(0xAAAA);
    address public treasury = address(0xEEEE);

    bytes32 internal constant RESULT_TYPEHASH =
        keccak256("Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)");

    function setUp() public {
        playerA = vm.addr(creatorPrivateKey);
        playerB = vm.addr(joinerPrivateKey);
        relaySigner = vm.addr(relayPrivateKey);

        escrow = new ChessEscrow(relaySigner, arbiter, treasury);
        revertingMeta = new RevertingMetaMock();
        escrow.setMetaContract(address(revertingMeta));

        vm.deal(playerA, 10 ether);
        vm.deal(playerB, 10 ether);
    }

    function _signResult(
        uint256 privateKey,
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(RESULT_TYPEHASH, roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", escrow.getDomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_JoinRoom_RevertsWhenMetaRegisterMatchFails() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        revertingMeta.setFailRegisterMatch(true);

        vm.prank(playerB);
        vm.expectRevert("RevertingMetaMock: registerMatch failed");
        escrow.joinRoom{ value: 0.1 ether }(roomId);
    }

    function test_SignalGameStarted_EmitsMetaCallFailedWhenMetaLockBettingFails() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        revertingMeta.setFailLockBetting(true);

        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.lockBetting.selector);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        assertTrue(escrow.getRoom(roomId).gameStarted);
        assertEq(escrow.getRoom(roomId).gameStartedAt, block.timestamp);
    }

    function test_AbortRoom_SuccessWhenMetaReverts() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Warp past abort timeout (3 minutes)
        vm.warp(block.timestamp + 4 minutes);

        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);

        escrow.abortRoom(roomId);

        assertEq(escrow.pendingWithdrawals(playerA), 0.1 ether);
        assertEq(escrow.pendingWithdrawals(playerB), 0.1 ether);

        // Verify withdrawal works
        vm.prank(playerA);
        escrow.withdraw();
        assertEq(playerA.balance, 10 ether);
    }

    function test_RefundOnTimeout_SuccessWhenMetaReverts() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Warp past refund timeout (60 minutes)
        vm.warp(block.timestamp + 61 minutes);

        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);

        escrow.refundOnTimeout(roomId);

        assertEq(escrow.pendingWithdrawals(playerA), 0.1 ether);
        assertEq(escrow.pendingWithdrawals(playerB), 0.1 ether);
    }

    function test_SubmitResult_SettleSuccessWhenMetaReverts() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        bytes32 movesHash = keccak256("e2e4");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);

        // Expect MetaCallFailed for updateEloOnSettle and resolvePrediction
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.updateEloOnSettle.selector);
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.resolvePrediction.selector);

        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 1, movesHash, nonce, deadline, sigA, sigB);

        // Winner gets pot minus 5% fee (0.2 ether - 0.01 ether = 0.19 ether)
        assertEq(escrow.pendingWithdrawals(playerA), 0.19 ether);
        assertEq(escrow.protocolFees(), 0.01 ether);

        // Check that recovery flags are recorded
        assertTrue(escrow.metaResolutionFailed(roomId));
        assertEq(escrow.metaWinningOption(roomId), 1);

        // Winner can withdraw immediately
        vm.prank(playerA);
        escrow.withdraw();
        assertEq(playerA.balance, 9.9 ether + 0.19 ether);
    }

    function test_SubmitResult_DrawSuccessWhenMetaReverts() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        bytes32 movesHash = keccak256("e2e4");
        uint256 nonce = 2;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, address(0), 2, 7, 1, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, address(0), 2, 7, 1, movesHash, nonce, deadline);

        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.resolvePrediction.selector);

        vm.prank(playerA);
        escrow.submitResult(roomId, address(0), 2, 7, 1, movesHash, nonce, deadline, sigA, sigB);

        assertEq(escrow.pendingWithdrawals(playerA), 0.1 ether);
        assertEq(escrow.pendingWithdrawals(playerB), 0.1 ether);
        assertTrue(escrow.metaResolutionFailed(roomId));
        assertEq(escrow.metaWinningOption(roomId), 3);
    }

    function test_RetryResolvePrediction_SuccessAndFailure() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        bytes32 movesHash = keccak256("e2e4");
        uint256 nonce = 10;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);

        // Submit result while resolvePrediction reverts
        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 1, movesHash, nonce, deadline, sigA, sigB);

        assertTrue(escrow.metaResolutionFailed(roomId));
        assertEq(escrow.metaWinningOption(roomId), 1);

        // 1. Retry fails while Meta mock still set to fail
        vm.expectRevert("RevertingMetaMock: resolvePrediction failed");
        escrow.retryResolvePrediction(roomId);

        // 2. Unblock Meta mock
        revertingMeta.setFailResolvePrediction(false);

        // Retry succeeds
        escrow.retryResolvePrediction(roomId);

        // Recovery flags are cleared
        assertFalse(escrow.metaResolutionFailed(roomId));
        assertEq(escrow.metaWinningOption(roomId), 0);

        // Second retry reverts NoFailedResolution
        vm.expectRevert(ChessEscrow.NoFailedResolution.selector);
        escrow.retryResolvePrediction(roomId);
    }

    function test_FallbackCancelPrediction_Timelock() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);
        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        bytes32 movesHash = keccak256("e2e4");
        uint256 nonce = 12;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);

        // Submit result while resolvePrediction reverts
        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 1, movesHash, nonce, deadline, sigA, sigB);

        assertTrue(escrow.metaResolutionFailed(roomId));

        // Before 3 days, fallbackCancelPrediction must revert TimelockNotReady
        vm.expectRevert(ChessEscrow.TimelockNotReady.selector);
        escrow.fallbackCancelPrediction(roomId);

        // retryResolvePrediction can be called immediately (does not wait for 3 days)
        revertingMeta.setFailResolvePrediction(false);
        escrow.retryResolvePrediction(roomId);
        assertFalse(escrow.metaResolutionFailed(roomId));
    }

    function test_FallbackCancelPrediction_ConservesAllFundsAndSpectatorsRefunded() public {
        // Deploy real AvaClashMeta
        AvaClashMeta realMeta = new AvaClashMeta();
        realMeta.setEscrowContract(address(escrow));
        escrow.setMetaContract(address(realMeta));
        vm.warp(block.timestamp + 2 days);
        escrow.executeMetaContractChange();

        address spec1 = address(0xC1);
        address spec2 = address(0xC2);
        vm.deal(spec1, 1 ether);
        vm.deal(spec2, 1 ether);

        // Alice creates room
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        // Spectators bet before match starts
        vm.prank(spec1);
        realMeta.betOnMatch{ value: 0.5 ether }(roomId, 1);
        vm.prank(spec2);
        realMeta.betOnMatch{ value: 0.3 ether }(roomId, 2);

        // Bob joins
        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Total funds locked before settle:
        // Escrow = 0.2 ether, Meta = 0.8 ether. Sum = 1.0 ether.
        assertEq(address(escrow).balance, 0.2 ether);
        assertEq(address(realMeta).balance, 0.8 ether);

        // Simulate resolution failure by pointing to reverting mock temporarily during settle
        escrow.setMetaContract(address(revertingMeta));
        vm.warp(block.timestamp + 2 days);
        escrow.executeMetaContractChange();

        bytes32 movesHash = keccak256("e2e4");
        uint256 nonce = 11;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerA, 0, 0, 1, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 1, movesHash, nonce, deadline, sigA, sigB);

        assertTrue(escrow.metaResolutionFailed(roomId));

        // Reconnect real Meta and trigger fallback cancellation after 3 days timelock
        escrow.setMetaContract(address(realMeta));
        vm.warp(block.timestamp + 3 days);
        escrow.executeMetaContractChange();
        escrow.fallbackCancelPrediction(roomId);

        // Verify flags cleared
        assertFalse(escrow.metaResolutionFailed(roomId));

        // Spectators claim full 100% gross refund
        uint256 s1Before = spec1.balance;
        vm.prank(spec1);
        realMeta.claimSpectatorRefund(roomId);
        assertEq(spec1.balance, s1Before + 0.5 ether);

        uint256 s2Before = spec2.balance;
        vm.prank(spec2);
        realMeta.claimSpectatorRefund(roomId);
        assertEq(spec2.balance, s2Before + 0.3 ether);

        // Players and treasury withdraw from escrow
        vm.prank(playerA);
        escrow.withdraw();
        escrow.withdrawProtocolFees();

        // Escrow and Meta balances are now 0 (100% fund conservation)
        assertEq(address(escrow).balance, 0);
        assertEq(address(realMeta).balance, 0);
    }

    function test_FinalizeSingleSigned_SuccessWhenMetaReverts() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHash = keccak256("single_signed");
        uint256 nonce = 21;
        uint256 deadline = block.timestamp + 1 hours;
        uint16 moveCount = 24;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, moveCount, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, moveCount, movesHash, nonce, deadline, sigA);

        // Warp past challenge window (1 day)
        vm.warp(block.timestamp + 1 days + 1);

        // Expect MetaCallFailed for updateEloOnSettle and resolvePrediction
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.updateEloOnSettle.selector);
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.resolvePrediction.selector);

        escrow.finalizeSingleSigned(roomId);

        // Pot = 0.2 ether, fee = 0.01 ether, winner gets 0.19 ether + 0.02 ether bond = 0.21 ether
        assertEq(escrow.pendingWithdrawals(playerA), 0.21 ether);
        assertEq(escrow.protocolFees(), 0.01 ether);
        assertTrue(escrow.metaResolutionFailed(roomId));
        assertEq(escrow.metaWinningOption(roomId), 1);

        vm.prank(playerA);
        escrow.withdraw();
        assertEq(playerA.balance, 9.9 ether - 0.02 ether + 0.21 ether);
    }

    function test_ResolveDefaultChallenge_SuccessWhenMetaReverts() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHashA = keccak256("claim_a");
        uint256 nonceA = 31;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 24, movesHashA, nonceA, deadline);

        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, 24, movesHashA, nonceA, deadline, sigA);

        bytes32 movesHashB = keccak256("claim_b");
        uint256 nonceB = 32;
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerB, 1, 0, 24, movesHashB, nonceB, deadline);

        vm.prank(playerB);
        escrow.challenge{ value: 0.02 ether }(roomId, playerB, 1, 0, 24, movesHashB, nonceB, deadline, sigB);

        // Warp past arbiter deadline (24 hours)
        vm.warp(block.timestamp + 24 hours + 1);

        // Expect MetaCallFailed for cancelPrediction
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);

        escrow.resolveDefaultChallenge(roomId);

        // Stakes refunded + bond penalty (submitter gets sBond 0.02 + cBond/2 0.01 = 0.03; challenger gets cBond/2 0.01)
        assertEq(escrow.pendingWithdrawals(playerA), 0.1 ether + 0.03 ether);
        assertEq(escrow.pendingWithdrawals(playerB), 0.1 ether + 0.01 ether);

        vm.prank(playerA);
        escrow.withdraw();
        vm.prank(playerB);
        escrow.withdraw();
        assertEq(playerA.balance, 10 ether + 0.01 ether);
        assertEq(playerB.balance, 10 ether - 0.01 ether);
    }

    function test_ResolveChallenge_SuccessWhenMetaReverts() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHashA = keccak256("claim_a2");
        uint256 nonceA = 41;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 24, movesHashA, nonceA, deadline);

        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, 24, movesHashA, nonceA, deadline, sigA);

        bytes32 movesHashB = keccak256("claim_b2");
        uint256 nonceB = 42;
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerB, 1, 0, 24, movesHashB, nonceB, deadline);

        vm.prank(playerB);
        escrow.challenge{ value: 0.02 ether }(roomId, playerB, 1, 0, 24, movesHashB, nonceB, deadline, sigB);

        // Arbiter resolves declaring playerB (Black) as winner
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.updateEloOnSettle.selector);
        vm.expectEmit(true, false, false, true);
        emit ChessEscrow.MetaCallFailed(roomId, IAvaClashMeta.resolvePrediction.selector);

        vm.prank(arbiter);
        escrow.resolveChallenge(roomId, playerB);

        // Challenger was right: challenger (playerB) gets cBond (0.02) + sBond (0.02) = 0.04 ether bond
        // Plus pot minus fee: 0.2 - 0.01 = 0.19 ether. Total = 0.23 ether.
        assertEq(escrow.pendingWithdrawals(playerB), 0.23 ether);
        assertTrue(escrow.metaResolutionFailed(roomId));
        assertEq(escrow.metaWinningOption(roomId), 2);

        vm.prank(playerB);
        escrow.withdraw();
        assertEq(playerB.balance, 9.9 ether - 0.02 ether + 0.23 ether);
    }

    function test_ClaimSpectatorRefund_After7DaysOfJoinedAt() public {
        AvaClashMeta realMeta = new AvaClashMeta();
        realMeta.setEscrowContract(address(escrow));
        escrow.setMetaContract(address(realMeta));
        vm.warp(block.timestamp + 2 days);
        escrow.executeMetaContractChange();

        address spectator = address(0xC9);
        vm.deal(spectator, 1 ether);

        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(spectator);
        realMeta.betOnMatch{ value: 0.5 ether }(roomId, 1);

        uint256 joinTime = block.timestamp + 100;
        vm.warp(joinTime);
        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // At joinTime + 6 days: cannot claim yet
        vm.warp(joinTime + 6 days);
        vm.prank(spectator);
        vm.expectRevert(AvaClashMeta.MatchCancelled.selector);
        realMeta.claimSpectatorRefund(roomId);

        // At joinTime + 7 days + 1 second: refund opens independently
        vm.warp(joinTime + 7 days + 1);
        uint256 balBefore = spectator.balance;
        vm.prank(spectator);
        realMeta.claimSpectatorRefund(roomId);
        assertEq(spectator.balance, balBefore + 0.5 ether);
    }
}

