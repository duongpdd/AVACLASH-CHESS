// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
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
    address public treasury = address(0xEEEE);
    address public spectator1 = address(0xC1);
    address public spectator2 = address(0xC2);

    bytes32 internal constant RESULT_TYPEHASH =
        keccak256("Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)");

    function setUp() public {
        playerA = vm.addr(creatorPrivateKey);
        playerB = vm.addr(joinerPrivateKey);
        relaySigner = vm.addr(relayPrivateKey);

        // 1. Deploy both contracts
        escrow = new ChessEscrow(relaySigner, treasury);
        meta = new AvaClashMeta();

        // 2. Link them bidirectionally
        meta.setEscrowContract(address(escrow));
        escrow.setMetaContract(address(meta));

        // Fund accounts
        vm.deal(playerA, 10 ether);
        vm.deal(playerB, 10 ether);
        vm.deal(spectator1, 10 ether);
        vm.deal(spectator2, 10 ether);
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
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }();

        // 2. Spectators bet before match starts
        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.5 ether }(roomId, 1); // Bet on White

        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.3 ether }(roomId, 2); // Bet on Black

        // 3. Player B joins room -> registers players in Meta and locks betting
        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Verify betting is locked
        vm.prank(spectator1);
        vm.expectRevert(AvaClashMeta.BettingClosed.selector);
        meta.betOnMatch{ value: 0.1 ether }(roomId, 1);

        // 4. Game is played and Player A wins (White win: outcome = 0)
        bytes32 movesHash = keccak256("e2e4 e7e5");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, playerA, 0, 0, 2, movesHash, nonce, deadline);
        bytes memory sigRelay = _signResult(relayPrivateKey, roomId, playerA, 0, 0, 2, movesHash, nonce, deadline);

        // Submit result
        vm.prank(playerA);
        escrow.submitResult(roomId, playerA, 0, 0, 2, movesHash, nonce, deadline, sigA, sigRelay);

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

    function test_DrawMatchFlow_EloAndSpectatorDrawOption() public {
        vm.prank(playerA);
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }();

        // Spectator 1 bets on Draw (option 3)
        vm.prank(spectator1);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 3);

        // Spectator 2 bets on White (option 1)
        vm.prank(spectator2);
        meta.betOnMatch{ value: 0.2 ether }(roomId, 1);

        vm.prank(playerB);
        escrow.joinRoom{ value: 0.1 ether }(roomId);

        // Settle as Draw (winner = address(0), outcome = 2)
        bytes32 movesHash = keccak256("e2e4 e7e5");
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;

        bytes memory sigA = _signResult(creatorPrivateKey, roomId, address(0), 2, 3, 2, movesHash, nonce, deadline);
        bytes memory sigB = _signResult(joinerPrivateKey, roomId, address(0), 2, 3, 2, movesHash, nonce, deadline);

        vm.prank(playerA);
        escrow.submitResult(roomId, address(0), 2, 3, 2, movesHash, nonce, deadline, sigA, sigB);

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
        uint256 roomId = escrow.createRoom{ value: 0.1 ether }();

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
}
