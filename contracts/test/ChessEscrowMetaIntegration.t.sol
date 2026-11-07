// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ChessEscrow } from "../src/ChessEscrow.sol";
import { AvaClashMeta } from "../src/AvaClashMeta.sol";

contract ChessEscrowMetaIntegrationTest is Test {
    ChessEscrow public escrow;
    AvaClashMeta public meta;

    uint256 internal creatorPrivateKey = 0xA11CE;
    uint256 internal joinerPrivateKey = 0xB0B;
    uint256 internal relayPrivateKey = 0x9999;

    address public playerA;
    address public playerB;
    address public relaySigner;
    address public arbiter = address(0xAAAA);
    address public treasury = address(0xEEEE);
    address public spectator1 = address(0xC1);
    address public spectator2 = address(0xC2);
    address public spectator3 = address(0xC3);

    bytes32 internal constant RESULT_TYPEHASH =
        keccak256("Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)");
    bytes32 internal constant META_CALL_FAILED_TOPIC =
        keccak256("MetaCallFailed(uint256,bytes4)");

    function setUp() public {
        playerA = vm.addr(creatorPrivateKey);
        playerB = vm.addr(joinerPrivateKey);
        relaySigner = vm.addr(relayPrivateKey);

        // 1. Deploy both contracts
        escrow = new ChessEscrow(relaySigner, arbiter, treasury);
        meta = new AvaClashMeta();
        meta.setSpectatorBettingEnabled(true);

        // 2. Link them bidirectionally
        meta.setEscrowContract(address(escrow));
        escrow.setMetaContract(address(meta));

        // Fund accounts
        vm.deal(playerA, 10 ether);
        vm.deal(playerB, 10 ether);
        vm.deal(spectator1, 10 ether);
        vm.deal(spectator2, 10 ether);
        vm.deal(spectator3, 10 ether);
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

    function test_FullMatchFlow_EloAndSpectatorPayout() public {
        // 1. Player A creates room with 0.1 AVAX
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        // 2. Spectators bet before match starts
        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.5 ether }(roomId, 1); // Bet on White

        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 2); // Bet on Black

        // 3. Player B joins room -> registers players in Meta
        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Signal game started -> locks betting in Meta
        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        // Verify betting is locked
        vm.prank(spectator1);
        vm.expectRevert(AvaClashMeta.BettingClosed.selector);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 1);

        // 4. Game is played and Player A wins (White win: outcome = 0), moveCount = 24 (>= 20)
        bytes32 movesHash = keccak256("e2e4 e7e5");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 24, movesHash, nonce, deadline);
        bytes memory sigRelay = _signResult(relayPrivateKey, roomId, playerA, 0, 0, 24, movesHash, nonce, deadline);

        // Submit result
        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 24, movesHash, nonce, deadline, sigA, sigRelay);

        // 5. Verify on-chain ELO updated automatically
        assertEq(meta.getElo(playerA), 1224);
        assertEq(meta.getElo(playerB), 1176);

        // 6. Verify spectator 1 can claim winning reward
        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorReward(roomId);
        uint256 balAfter = spectator1.balance;
        assertTrue(balAfter > balBefore, "Spectator 1 received parimutuel reward");

        // Spectator 2 (lost) cannot claim
        vm.prank(spectator2);
        vm.expectRevert(AvaClashMeta.NoWinningBet.selector);
        meta.claimSpectatorReward(roomId);
    }

    function test_FullMatchFlow_MovesUnder20_CancelsSpectatorPool() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.5 ether }(roomId, 1);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        // Game ends with only 10 moves (< 20 MIN_MOVES_FOR_PREDICTION)
        bytes32 movesHash = keccak256("e2e4");
        uint256 nonce = 2;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 10, movesHash, nonce, deadline);
        bytes memory sigRelay = _signResult(relayPrivateKey, roomId, playerA, 0, 0, 10, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 10, movesHash, nonce, deadline, sigA, sigRelay);

        // Prediction pool was cancelled due to Q20 moveCount < 20
        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(roomId);
        assertEq(spectator1.balance, balBefore + 0.5 ether);

        // Verify on-chain ELO unchanged when moveCount < 20 (MIN_MOVES_FOR_ELO)
        assertEq(meta.getElo(playerA), 1200);
        assertEq(meta.getElo(playerB), 1200);
    }

    function test_Elo_MovesUnder20_EloUnchanged() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        // Move count = 19 (< 20 threshold)
        bytes32 movesHash = keccak256("19_moves");
        uint256 nonce = 101;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 19, movesHash, nonce, deadline);
        bytes memory sigRelay = _signResult(relayPrivateKey, roomId, playerA, 0, 0, 19, movesHash, nonce, deadline);

        assertEq(meta.getElo(playerA), 1200);
        assertEq(meta.getElo(playerB), 1200);

        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 19, movesHash, nonce, deadline, sigA, sigRelay);

        // Under 20 plies: ELO must NOT change
        assertEq(meta.getElo(playerA), 1200);
        assertEq(meta.getElo(playerB), 1200);
    }

    function test_Elo_MovesAtLeast20_EloChanged() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        // Move count = 20 (>= 20 threshold)
        bytes32 movesHash = keccak256("20_moves");
        uint256 nonce = 102;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 20, movesHash, nonce, deadline);
        bytes memory sigRelay = _signResult(relayPrivateKey, roomId, playerA, 0, 0, 20, movesHash, nonce, deadline);

        assertEq(meta.getElo(playerA), 1200);
        assertEq(meta.getElo(playerB), 1200);

        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 20, movesHash, nonce, deadline, sigA, sigRelay);

        // At least 20 plies: ELO MUST change
        assertEq(meta.getElo(playerA), 1224);
        assertEq(meta.getElo(playerB), 1176);
    }

    function test_DrawMatchFlow_EloAndSpectatorDrawOption() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        // Spectator 1 bets on Draw (option 3)
        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 3);

        // Spectator 2 bets on White (option 1)
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 1);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Settle as Draw (winner = address(0), outcome = 2), moveCount = 22 (>= 20)
        bytes32 movesHash = keccak256("e2e4 e7e5");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, address(0), 2, 3, 22, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, address(0), 2, 3, 22, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitResult(roomId, address(0), 2, 3, 22, movesHash, nonce, deadline, sigA, sigB);

        // Verify Draw spectator can claim
        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorReward(roomId);
        assertTrue(spectator1.balance > balBefore, "Draw bettor won parimutuel pool");

        // Both players got refunded in pending withdrawals
        assertEq(escrow.pendingWithdrawals(playerA), 0.1 ether);
        assertEq(escrow.pendingWithdrawals(playerB), 0.1 ether);
    }

    function test_AbortRoom_CancelsPredictionAndRefundsSpectators() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.5 ether }(roomId, 1);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Advance past abort timeout
        vm.warp(block.timestamp + 3 minutes + 1);

        // Abort room
        vm.prank(playerA);
        escrow.abortRoom(roomId);

        // Spectator can claim full refund
        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(roomId);
        assertTrue(spectator1.balance > balBefore, "Spectator refunded after abort");
    }

    // ──────────────────────── Item 1 Matrix & Integration Tests ────────────────────────

    function _assertNoMetaCallFailed() internal view {
        Vm.Log[] memory entries = vm.getRecordedLogs();
        for (uint256 i = 0; i < entries.length; i++) {
            assertTrue(entries[i].topics[0] != META_CALL_FAILED_TOPIC, "MetaCallFailed emitted unexpectedly");
        }
    }

    function _runDualSignMatrixCase(bool creatorIsWhite, uint8 outcome, uint16 moveCount) internal {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(creatorIsWhite);

        // Spectators bet on White (1), Black (2), Draw (3)
        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 1);
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 2);
        vm.prank(spectator3);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 3);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        address whitePlayer = creatorIsWhite ? playerA : playerB;
        address blackPlayer = creatorIsWhite ? playerB : playerA;
        address winner = (outcome == 0) ? whitePlayer : (outcome == 1 ? blackPlayer : address(0));

        bytes32 movesHash = keccak256("item1_matrix_moves");
        uint256 nonce = 500 + roomId;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, winner, outcome, 0, moveCount, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, winner, outcome, 0, moveCount, movesHash, nonce, deadline);

        vm.recordLogs();
        vm.prank(playerA);
        escrow.submitResult(roomId, winner, outcome, 0, moveCount, movesHash, nonce, deadline, sigA, sigB);

        _assertNoMetaCallFailed();

        (, bool resolved, bool cancelled, uint8 winningOption, , , ) = meta.getPredictionPool(roomId);

        if (moveCount >= 20) {
            assertTrue(resolved, "Pool should be resolved");
            assertFalse(cancelled, "Pool should not be cancelled");
            uint8 expectedOption = (outcome == 0) ? 1 : (outcome == 1 ? 2 : 3);
            assertEq(winningOption, expectedOption, "Winning option mismatch");

            address winningSpectator = (expectedOption == 1) ? spectator1 : (expectedOption == 2 ? spectator2 : spectator3);
            uint256 balBefore = winningSpectator.balance;
            vm.prank(winningSpectator);
            meta.claimSpectatorReward(roomId);
            // Total gross pool = 0.6 ether, 5% fee = 0.03 ether, prize = 0.57 ether
            assertEq(winningSpectator.balance - balBefore, 0.57 ether, "Spectator received parimutuel reward");
        } else {
            assertFalse(resolved, "Pool should not be resolved for moveCount < 20");
            assertTrue(cancelled, "Pool should be cancelled for moveCount < 20");

            uint256 s1Before = spectator1.balance;
            vm.prank(spectator1);
            meta.claimSpectatorRefund(roomId);
            assertEq(spectator1.balance - s1Before, 0.3 ether, "Spectator 1 full refund");

            uint256 s2Before = spectator2.balance;
            vm.prank(spectator2);
            meta.claimSpectatorRefund(roomId);
            assertEq(spectator2.balance - s2Before, 0.2 ether, "Spectator 2 full refund");

            uint256 s3Before = spectator3.balance;
            vm.prank(spectator3);
            meta.claimSpectatorRefund(roomId);
            assertEq(spectator3.balance - s3Before, 0.1 ether, "Spectator 3 full refund");
        }
    }

    // Matrix 12 tests: creatorIsWhite (true/false) x outcome (0=White, 1=Black, 2=Draw) x moveCount (>=20, <20)
    function test_Matrix_CreatorWhite_WhiteWin_MovesGE20() public {
        _runDualSignMatrixCase(true, 0, 24);
    }

    function test_Matrix_CreatorWhite_WhiteWin_MovesLT20() public {
        _runDualSignMatrixCase(true, 0, 10);
    }

    function test_Matrix_CreatorWhite_BlackWin_MovesGE20() public {
        _runDualSignMatrixCase(true, 1, 24);
    }

    function test_Matrix_CreatorWhite_BlackWin_MovesLT20() public {
        _runDualSignMatrixCase(true, 1, 10);
    }

    function test_Matrix_CreatorWhite_Draw_MovesGE20() public {
        _runDualSignMatrixCase(true, 2, 24);
    }

    function test_Matrix_CreatorWhite_Draw_MovesLT20() public {
        _runDualSignMatrixCase(true, 2, 10);
    }

    function test_Matrix_CreatorBlack_WhiteWin_MovesGE20() public {
        _runDualSignMatrixCase(false, 0, 24);
    }

    function test_Matrix_CreatorBlack_WhiteWin_MovesLT20() public {
        _runDualSignMatrixCase(false, 0, 10);
    }

    function test_Matrix_CreatorBlack_BlackWin_MovesGE20() public {
        _runDualSignMatrixCase(false, 1, 24);
    }

    function test_Matrix_CreatorBlack_BlackWin_MovesLT20() public {
        _runDualSignMatrixCase(false, 1, 10);
    }

    function test_Matrix_CreatorBlack_Draw_MovesGE20() public {
        _runDualSignMatrixCase(false, 2, 24);
    }

    function test_Matrix_CreatorBlack_Draw_MovesLT20() public {
        _runDualSignMatrixCase(false, 2, 10);
    }

    // Single-signed finalization flow tests
    function test_FinalizeSingleSigned_MetaResolution_MovesGE20() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true); // playerA is White

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 1); // Bet White
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 2); // Bet Black
        vm.prank(spectator3);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 3); // Bet Draw

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHash = keccak256("single_signed_moves");
        uint256 nonce = 601;
        uint256 deadline = block.timestamp + 1 hours;
        uint16 moveCount = 28;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, moveCount, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, moveCount, movesHash, nonce, deadline, sigA);

        // Warp past CHALLENGE_WINDOW (1 day)
        vm.warp(block.timestamp + 1 days + 1);

        vm.recordLogs();
        escrow.finalizeSingleSigned(roomId);

        _assertNoMetaCallFailed();

        (, bool resolved, bool cancelled, uint8 winningOption, , , ) = meta.getPredictionPool(roomId);
        assertTrue(resolved, "Pool resolved via finalizeSingleSigned");
        assertFalse(cancelled, "Pool not cancelled");
        assertEq(winningOption, 1, "Winning option must be 1 (White)");

        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorReward(roomId);
        assertEq(spectator1.balance - balBefore, 0.57 ether, "Spectator 1 received parimutuel reward");
    }

    function test_FinalizeSingleSigned_MetaResolution_MovesLT20() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true); // playerA is White

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 1);
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 2);
        vm.prank(spectator3);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 3);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHash = keccak256("single_signed_short");
        uint256 nonce = 602;
        uint256 deadline = block.timestamp + 1 hours;
        uint16 moveCount = 14;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, moveCount, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, moveCount, movesHash, nonce, deadline, sigA);

        vm.warp(block.timestamp + 1 days + 1);

        vm.recordLogs();
        escrow.finalizeSingleSigned(roomId);

        _assertNoMetaCallFailed();

        (, bool resolved, bool cancelled, , , , ) = meta.getPredictionPool(roomId);
        assertFalse(resolved, "Pool not resolved");
        assertTrue(cancelled, "Pool cancelled due to moveCount < 20");

        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(roomId);
        assertEq(spectator1.balance - balBefore, 0.3 ether, "Spectator 1 refund");
    }

    // Challenge resolution flow tests
    function test_ResolveChallenge_ArbiterDeclaresWinner_MovesGE20() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true); // playerA is White, playerB is Black

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 1);
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 2);
        vm.prank(spectator3);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 3);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHashA = keccak256("claim_white");
        uint256 nonceA = 701;
        uint256 deadline = block.timestamp + 1 hours;
        uint16 moveCount = 26;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, moveCount, movesHashA, nonceA, deadline);
        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, moveCount, movesHashA, nonceA, deadline, sigA);

        // Player B challenges claiming BlackWin
        bytes32 movesHashB = keccak256("claim_black");
        uint256 nonceB = 702;
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerB, 1, 0, moveCount, movesHashB, nonceB, deadline);
        vm.prank(playerB);
        escrow.challenge{ value: 0.02 ether }(roomId, playerB, 1, 0, moveCount, movesHashB, nonceB, deadline, sigB);

        // Arbiter resolves challenge declaring playerB (Black) as valid winner
        vm.recordLogs();
        vm.prank(arbiter);
        escrow.resolveChallenge(roomId, playerB);

        _assertNoMetaCallFailed();

        (, bool resolved, bool cancelled, uint8 winningOption, , , ) = meta.getPredictionPool(roomId);
        assertTrue(resolved, "Pool resolved via challenge");
        assertFalse(cancelled, "Pool not cancelled");
        assertEq(winningOption, 2, "Option must be 2 (Black)");

        uint256 balBefore = spectator2.balance;
        vm.prank(spectator2);
        meta.claimSpectatorReward(roomId);
        assertEq(spectator2.balance - balBefore, 0.57 ether, "Spectator 2 received parimutuel reward");
    }

    function test_ResolveChallenge_ArbiterDeclaresWinner_MovesLT20() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(true);

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 1);
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 2);
        vm.prank(spectator3);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 3);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHashA = keccak256("claim_white_short");
        uint256 nonceA = 703;
        uint256 deadline = block.timestamp + 1 hours;
        uint16 moveCount = 15;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, moveCount, movesHashA, nonceA, deadline);
        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 0, 0, moveCount, movesHashA, nonceA, deadline, sigA);

        bytes32 movesHashB = keccak256("claim_black_short");
        uint256 nonceB = 704;
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerB, 1, 0, moveCount, movesHashB, nonceB, deadline);
        vm.prank(playerB);
        escrow.challenge{ value: 0.02 ether }(roomId, playerB, 1, 0, moveCount, movesHashB, nonceB, deadline, sigB);

        // Arbiter resolves challenge declaring playerA as valid winner
        vm.recordLogs();
        vm.prank(arbiter);
        escrow.resolveChallenge(roomId, playerA);

        _assertNoMetaCallFailed();

        (, bool resolved, bool cancelled, , , , ) = meta.getPredictionPool(roomId);
        assertFalse(resolved, "Pool not resolved for moveCount < 20");
        assertTrue(cancelled, "Pool cancelled for moveCount < 20");

        uint256 balBefore = spectator1.balance;
        vm.prank(spectator1);
        meta.claimSpectatorRefund(roomId);
        assertEq(spectator1.balance - balBefore, 0.3 ether, "Spectator 1 refund");
    }

    function test_ResolveChallenge_ArbiterDeclaresDraw_MovesGE20() public {
        escrow.setSingleSignedEnabled(true);
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }(false); // playerA is Black, playerB is White

        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 1);
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 2);
        vm.prank(spectator3);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 3);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        vm.prank(relaySigner);
        escrow.signalGameStarted(roomId);

        bytes32 movesHashA = keccak256("claim_draw_conflictA");
        uint256 nonceA = 705;
        uint256 deadline = block.timestamp + 1 hours;
        uint16 moveCount = 22;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 1, 0, moveCount, movesHashA, nonceA, deadline);
        vm.prank(playerA);
        escrow.submitSingleSigned{ value: 0.02 ether }(roomId, playerA, 1, 0, moveCount, movesHashA, nonceA, deadline, sigA);

        bytes32 movesHashB = keccak256("claim_draw_conflictB");
        uint256 nonceB = 706;
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, playerB, 0, 0, moveCount, movesHashB, nonceB, deadline);
        vm.prank(playerB);
        escrow.challenge{ value: 0.02 ether }(roomId, playerB, 0, 0, moveCount, movesHashB, nonceB, deadline, sigB);

        // Arbiter resolves as Draw (address(0))
        vm.recordLogs();
        vm.prank(arbiter);
        escrow.resolveChallenge(roomId, address(0));

        _assertNoMetaCallFailed();

        (, bool resolved, bool cancelled, uint8 winningOption, , , ) = meta.getPredictionPool(roomId);
        assertTrue(resolved, "Pool resolved as draw");
        assertFalse(cancelled, "Pool not cancelled");
        assertEq(winningOption, 3, "Option must be 3 (Draw)");

        uint256 balBefore = spectator3.balance;
        vm.prank(spectator3);
        meta.claimSpectatorReward(roomId);
        assertEq(spectator3.balance - balBefore, 0.57 ether, "Spectator 3 received parimutuel reward");
    }
}

