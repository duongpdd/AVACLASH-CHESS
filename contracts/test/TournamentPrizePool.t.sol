// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TournamentPrizePool as Pool } from "../src/TournamentPrizePool.sol";

contract TournamentPrizePoolTest is Test {
    Pool pool;
    address reviewer = address(20);
    address sponsor = address(21);
    address sponsorB = address(22);
    uint256 relayKey = 0x5afe;
    bytes32 evidence = keccak256("reviewed replay");

    function setUp() public {
        vm.chainId(31337);
        pool = new Pool(vm.addr(relayKey));
        vm.deal(sponsor, 10 ether);
        vm.deal(sponsorB, 10 ether);
    }

    function setupTournament(uint8 seats, uint256 funding) internal returns (uint256 id) {
        id = pool.createTournament(
            "Campus Cup",
            "5+0 round robin",
            seats,
            reviewer,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 3 days),
            1 hours
        );
        vm.prank(sponsor);
        pool.fund{ value: funding }(id);
        for (uint256 i; i < seats; i++) {
            vm.prank(address(uint160(100 + i)));
            pool.register(id);
        }
        pool.start(id);
    }

    function testEightPlayersTwentyEightMatchesAndRewards() public {
        uint256 id = setupTournament(8, 1 ether);
        uint256[] memory matches = pool.getMatches(id);
        assertEq(matches.length, 28);
        for (uint256 i; i < matches.length; i++) {
            Pool.MatchResult memory r;
            (r.tournamentId,,,,,) = pool.results(matches[i]);
            assertEq(r.tournamentId, id);
            // Lower seed wins each pairing; color alternates to balance the board.
            uint8 outcome = pool.getRoom(matches[i]).creatorIsWhite ? 0 : 1;
            vm.prank(reviewer);
            pool.review(matches[i], outcome, evidence);
        }
        vm.warp(pool.getTournament(id).reviewUntil);
        pool.finalize(id);
        assertEq(pool.awards(id, address(100)), 0.6 ether);
        assertEq(pool.awards(id, address(101)), 0.3 ether);
        assertEq(pool.awards(id, address(102)), 0.1 ether);
        for (uint160 i = 100; i < 103; i++) {
            vm.prank(address(i));
            pool.claim(id);
        }
        assertEq(address(pool).balance, 0);
        vm.prank(address(100));
        vm.expectRevert(Pool.NotReady.selector);
        pool.claim(id);
    }

    function testRelayReportCannotPayBeforeAppealIsResolved() public {
        uint256 id = setupTournament(2, 1 ether);
        Pool.Result memory r = Pool.Result(0, address(100), 0, 1, 4, evidence, 1, block.timestamp + 60);
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AvaClashChess"),
                keccak256("2"),
                block.chainid,
                address(pool)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                pool.RESULT_TYPEHASH(),
                r.matchId,
                r.winner,
                r.outcome,
                r.reason,
                r.moveCount,
                r.movesHash,
                r.nonce,
                r.deadline
            )
        );
        (uint8 v, bytes32 a, bytes32 b) = vm.sign(relayKey, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        pool.reportResult(r, abi.encodePacked(a, b, v));
        vm.expectRevert(Pool.Unauthorized.selector);
        pool.review(0, 0, evidence);
        vm.prank(reviewer);
        pool.review(0, 0, evidence);
        vm.prank(address(101));
        pool.appeal(0, evidence);
        vm.warp(pool.getTournament(id).reviewUntil);
        vm.expectRevert(Pool.NotReady.selector);
        pool.finalize(id);
        vm.prank(reviewer);
        pool.resolveAppeal(0, address(101), 2, evidence);
        vm.expectRevert(Pool.NotReady.selector);
        pool.finalize(id);
        vm.warp(pool.getTournament(id).reviewUntil);
        pool.finalize(id);
        assertEq(pool.awards(id, address(100)), 0.5 ether);
        assertEq(pool.awards(id, address(101)), 0.5 ether);
    }

    function testCancellationCannotBeUnilateralOncePlayStarts() public {
        uint256 id = setupTournament(2, 1 ether);
        pool.requestCancellation(id);
        vm.prank(sponsor);
        vm.expectRevert(Pool.WrongPhase.selector);
        pool.refund(id);
        vm.expectRevert(Pool.Unauthorized.selector);
        pool.approveCancellation(id);
        vm.prank(reviewer);
        pool.approveCancellation(id);
        uint256 balance = sponsor.balance;
        vm.prank(sponsor);
        pool.refund(id);
        assertEq(sponsor.balance, balance + 1 ether);
        vm.prank(sponsor);
        vm.expectRevert(Pool.NotReady.selector);
        pool.refund(id);
    }

    function testPrizeContributionsCannotBeRequiredFromEntrants() public {
        uint256 id = pool.createTournament(
            "Cup", "Rules", 2, reviewer, uint64(block.timestamp + 1 days), uint64(block.timestamp + 3 days), 1 hours
        );
        vm.prank(address(100));
        vm.expectRevert(Pool.NotReady.selector);
        pool.register(id);
        vm.prank(sponsor);
        pool.fund{ value: 1 ether }(id);
        vm.prank(sponsor);
        vm.expectRevert(Pool.InvalidInput.selector);
        pool.register(id);
        vm.prank(address(100));
        pool.register(id);
        vm.deal(address(100), 1 ether);
        vm.prank(address(100));
        vm.expectRevert(Pool.InvalidInput.selector);
        pool.fund{ value: 1 ether }(id);
        assertEq(address(pool).balance, 1 ether);
    }

    function testExpiredPayoutRefundsOnlyUnpaidRemainderProRata() public {
        uint256 id = pool.createTournament(
            "Cup", "Rules", 2, reviewer, uint64(block.timestamp + 1 days), uint64(block.timestamp + 3 days), 1 hours
        );
        vm.prank(sponsor);
        pool.fund{ value: 3 ether }(id);
        vm.prank(sponsorB);
        pool.fund{ value: 1 ether }(id);
        vm.prank(address(100));
        pool.register(id);
        vm.prank(address(101));
        pool.register(id);
        pool.start(id);
        vm.prank(reviewer);
        pool.review(0, 0, evidence);
        vm.warp(pool.getTournament(id).reviewUntil);
        pool.finalize(id);
        vm.prank(address(100));
        pool.claim(id);
        vm.warp(pool.getTournament(id).claimUntil);
        vm.prank(address(101));
        vm.expectRevert(Pool.NotReady.selector);
        pool.claim(id);
        uint256 a = sponsor.balance;
        uint256 b = sponsorB.balance;
        vm.prank(sponsor);
        pool.refund(id);
        vm.prank(sponsorB);
        pool.refund(id);
        assertEq(sponsor.balance - a, 0.9 ether);
        assertEq(sponsorB.balance - b, 0.3 ether);
        assertEq(address(pool).balance, 0);
    }
}
