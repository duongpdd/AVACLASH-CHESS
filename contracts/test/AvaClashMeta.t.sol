// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AvaClashMeta} from "../src/AvaClashMeta.sol";

contract AvaClashMetaTest is Test {
    AvaClashMeta public meta;

    address public playerA = address(0xAAA1);
    address public playerB = address(0xBBB2);
    address public spectator1 = address(0xCCC3);
    address public spectator2 = address(0xDDD4);

    function setUp() public {
        meta = new AvaClashMeta();
        meta.setEscrowContract(address(this));
        vm.deal(playerA, 10 ether);
        vm.deal(playerB, 10 ether);
        vm.deal(spectator1, 10 ether);
        vm.deal(spectator2, 10 ether);
    }

    // ──────────────────────── ELO Tests ────────────────────────

    function test_InitialElo() public view {
        assertEq(meta.getElo(playerA), 1200);
        assertEq(meta.getElo(playerB), 1200);
    }

    function test_UpdateEloOnSettle() public {
        meta.updateEloOnSettle(playerA, playerB);
        // Initial delta = 24 >> 0 = 24
        assertEq(meta.getElo(playerA), 1224);
        assertEq(meta.getElo(playerB), 1176);
    }

    function test_UpdateElo_revert_notEscrow() public {
        vm.prank(spectator1);
        vm.expectRevert(AvaClashMeta.NotEscrow.selector);
        meta.updateEloOnSettle(playerA, playerB);
    }

    function test_AntiWinTradingDeltaReduction() public {
        // First match: delta = 24
        meta.updateEloOnSettle(playerA, playerB);
        assertEq(meta.getElo(playerA), 1224);

        // Second match same day: matchesToday = 1, delta = 24 >> 1 = 12
        meta.updateEloOnSettle(playerA, playerB);
        assertEq(meta.getElo(playerA), 1236);

        // Third match: delta = 24 >> 2 = 6
        meta.updateEloOnSettle(playerA, playerB);
        assertEq(meta.getElo(playerA), 1242);
    }

    // ──────────────────────── No-Loss Vault Tests ────────────────────────

    function test_EnterNoLossVault_RevertBelowMin() public {
        vm.prank(playerA);
        vm.expectRevert(AvaClashMeta.MinStakeRequired.selector);
        meta.enterNoLossVault{value: 0.1 ether}();
    }

    function test_EnterNoLossVault_Success() public {
        vm.prank(playerA);
        meta.enterNoLossVault{value: 1 ether}();

        assertEq(meta.noLossPrincipal(playerA), 1 ether);
        assertEq(meta.totalNoLossStaked(), 1 ether);
    }

    function test_ExitNoLossVault_100PercentPrincipal() public {
        vm.prank(playerA);
        meta.enterNoLossVault{value: 2 ether}();

        uint256 balBefore = playerA.balance;
        vm.prank(playerA);
        meta.exitNoLossVault();

        assertEq(playerA.balance, balBefore + 2 ether);
        assertEq(meta.noLossPrincipal(playerA), 0);
        assertEq(meta.totalNoLossStaked(), 0);
    }

    function test_SeasonPointsAwardedIfStaked() public {
        // Player A stakes in No-Loss vault
        vm.prank(playerA);
        meta.enterNoLossVault{value: 1 ether}();

        // Player A wins match
        meta.updateEloOnSettle(playerA, playerB);

        // Should receive 15 season points
        assertEq(meta.seasonPoints(playerA), 15);
        // Player B did not stake and did not win
        assertEq(meta.seasonPoints(playerB), 0);
    }

    // ──────────────────────── Spectator Prediction Tests ────────────────────────

    function test_BetOnMatch_FeeSplit() public {
        uint256 matchId = 101;

        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1); // Bet on White

        // Bets are stored gross (5% fee NOT deducted at bet time)
        assertEq(meta.seasonPrizePool(), 0);

        (bool locked, bool resolved, bool cancelled, uint8 winOpt, uint256 wBet, uint256 bBet, uint256 dBet) =
            meta.getPredictionPool(matchId);
        assertFalse(locked);
        assertFalse(resolved);
        assertFalse(cancelled);
        assertEq(winOpt, 0);
        assertEq(wBet, 1 ether); // Gross 1 ether
        assertEq(bBet, 0);
        assertEq(dBet, 0);

        // When resolved, 5% fee is deducted from totalPool into seasonPrizePool
        meta.resolvePrediction(matchId, 1);
        assertEq(meta.seasonPrizePool(), 0.05 ether);
    }

    function test_BetOnMatch_SelfBetNotAllowed() public {
        uint256 matchId = 102;
        meta.registerMatch(matchId, playerA, playerB);

        vm.prank(playerA);
        vm.expectRevert(AvaClashMeta.SelfBetNotAllowed.selector);
        meta.betOnMatch{value: 0.5 ether}(matchId, 1);
    }

    function test_BetOnMatch_LockBeforeStart() public {
        uint256 matchId = 103;
        meta.lockBetting(matchId);

        vm.prank(spectator1);
        vm.expectRevert(AvaClashMeta.BettingClosed.selector);
        meta.betOnMatch{value: 0.5 ether}(matchId, 1);
    }

    function test_ResolveAndClaimSpectatorReward_WhiteWins() public {
        uint256 matchId = 104;

        // Spectator 1 bets 1 ether on White (gross 1 ether)
        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1);

        // Spectator 2 bets 1 ether on Black (gross 1 ether)
        vm.prank(spectator2);
        meta.betOnMatch{value: 1 ether}(matchId, 2);

        // White wins (Option 1). Total pool = 2 ether. Fee = 5% * 2 ether = 0.1 ether.
        // Net reward = 1 * (2 - 0.1) / 1 = 1.9 ether.
        meta.resolvePrediction(matchId, 1);
        assertEq(meta.seasonPrizePool(), 0.1 ether);

        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorReward(matchId);

        assertEq(spectator1.balance, balBefore + 1.9 ether);

        // Spectator 2 cannot claim (lost)
        vm.prank(spectator2);
        vm.expectRevert(AvaClashMeta.NoWinningBet.selector);
        meta.claimSpectatorReward(matchId);
    }

    function test_ResolveAndClaimSpectatorReward_Draw() public {
        uint256 matchId = 105;

        // Spectator 1 bets on White, Spectator 2 bets on Draw
        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1);

        vm.prank(spectator2);
        meta.betOnMatch{value: 1 ether}(matchId, 3); // Option 3 = Draw

        // Resolved as Draw (Option 3). Total = 2 ether, fee = 0.1 ether, payout = 1.9 ether.
        meta.resolvePrediction(matchId, 3);
        assertEq(meta.seasonPrizePool(), 0.1 ether);

        uint256 balBefore = spectator2.balance;
        vm.prank(spectator2);
        meta.claimSpectatorReward(matchId);

        assertEq(spectator2.balance, balBefore + 1.9 ether);
    }

    function test_CancelPrediction_FullRefund() public {
        uint256 matchId = 106;

        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1); // gross 1 ether

        // Match cancelled / refunded -> 100% gross refund
        meta.cancelPrediction(matchId);
        assertEq(meta.seasonPrizePool(), 0);

        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(matchId);

        assertEq(spectator1.balance, balBefore + 1.0 ether);
    }

    function test_ResolvePrediction_WinningPoolZero_TreatedAsCancelled_RefundsAll() public {
        uint256 matchId = 107;

        // Spectator 1 bets 1 ether on White (Option 1)
        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1);

        // Match ends in Draw (Option 3), but Draw pool has 0 bets!
        meta.resolvePrediction(matchId, 3);

        // Pool must be cancelled, not resolved
        (, bool resolved, bool cancelled,,,,) = meta.getPredictionPool(matchId);
        assertFalse(resolved);
        assertTrue(cancelled);
        assertEq(meta.seasonPrizePool(), 0);

        // Spectator 1 claims 100% gross refund
        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(matchId);
        assertEq(spectator1.balance, balBefore + 1.0 ether);
    }

    function test_ClaimSpectatorRefund_IndependentAfter7Days() public {
        uint256 matchId = 108;

        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1);

        // Attempting refund early without Escrow cancel reverts
        vm.prank(spectator1);
        vm.expectRevert(AvaClashMeta.MatchCancelled.selector);
        meta.claimSpectatorRefund(matchId);

        // Warp past MAX_UNRESOLVED (7 days)
        vm.warp(block.timestamp + 7 days + 1);

        // Spectator triggers refund independently without Escrow
        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(matchId);

        assertEq(spectator1.balance, balBefore + 1.0 ether);

        // Pool is now marked cancelled
        (,, bool cancelled,,,,) = meta.getPredictionPool(matchId);
        assertTrue(cancelled);
    }

    function test_ResolvePrediction_RevertIfAlreadyCancelledOrResolved() public {
        uint256 matchId = 109;

        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1);

        meta.cancelPrediction(matchId);

        // Attempting to resolve after cancel must revert
        vm.expectRevert(AvaClashMeta.AlreadyResolved.selector);
        meta.resolvePrediction(matchId, 1);
    }

    function test_SpectatorReward_GrossFeeConservationMultipleBettors() public {
        uint256 matchId = 110;

        // Spectator 1 bets 1 ether on White
        vm.prank(spectator1);
        meta.betOnMatch{value: 1 ether}(matchId, 1);

        // Spectator 2 bets 3 ether on White
        vm.prank(spectator2);
        meta.betOnMatch{value: 3 ether}(matchId, 1);

        // White wins (Option 1). Total pool = 4 ether. Fee = 5% * 4 = 0.2 ether.
        // Net pool = 3.8 ether.
        // Spectator 1 share: 1/4 * 3.8 = 0.95 ether.
        // Spectator 2 share: 3/4 * 3.8 = 2.85 ether.
        // Total payouts = 0.95 + 2.85 = 3.8 ether.
        // With fee 0.2 ether, sum = 4.0 ether (100% exact conservation).
        meta.resolvePrediction(matchId, 1);
        assertEq(meta.seasonPrizePool(), 0.2 ether);

        uint256 s1Before = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorReward(matchId);
        assertEq(spectator1.balance, s1Before + 0.95 ether);

        uint256 s2Before = spectator2.balance;
        vm.prank(spectator2);
        meta.claimSpectatorReward(matchId);
        assertEq(spectator2.balance, s2Before + 2.85 ether);
    }
}
