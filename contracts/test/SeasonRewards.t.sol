// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {AvaClashMeta} from "../src/AvaClashMeta.sol";

contract SeasonRewardsTest is Test {
    AvaClashMeta meta;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    function setUp() public { meta = new AvaClashMeta(); vm.deal(address(this), 10 ether); vm.deal(alice, 2 ether); }
    function fund() internal { meta.fundSeasonRewards{value: 1 ether}(); }
    function schedule(address player, uint256 amount) internal returns (uint256) {
        return meta.scheduleSeasonRewards(meta.seasonRewardLeaf(meta.nextRewardSeason(), player, amount), keccak256("public allocation file"), amount);
    }
    function test_SpectatorDisabledByDefault() public {
        vm.expectRevert(AvaClashMeta.SpectatorDisabled.selector);
        meta.betOnMatch{value: 0.1 ether}(1, 1);
        assertFalse(meta.spectatorBettingEnabled());
    }
    function test_OnlyOwnerCanEnableBetsOrSchedule() public {
        fund(); vm.startPrank(alice);
        vm.expectRevert(AvaClashMeta.NotOwner.selector); meta.setSpectatorBettingEnabled(true);
        vm.expectRevert(AvaClashMeta.NotOwner.selector); meta.scheduleSeasonRewards(bytes32(uint256(1)), bytes32(uint256(1)), 1);
        vm.stopPrank();
    }
    function test_VaultPrincipalCannotBeAllocatedAsReward() public {
        vm.prank(alice); meta.enterNoLossVault{value: 1 ether}();
        vm.expectRevert(AvaClashMeta.InvalidRewardAllocation.selector); meta.scheduleSeasonRewards(bytes32(uint256(1)), bytes32(uint256(1)), 1 ether);
        assertEq(meta.noLossPrincipal(alice), 1 ether);
        vm.prank(alice); meta.exitNoLossVault(); assertEq(alice.balance, 2 ether);
    }
    function test_NoticeThenClaimOnceAndConservePrincipal() public {
        vm.prank(alice); meta.enterNoLossVault{value: 0.5 ether}();
        fund(); uint256 id = schedule(alice, 0.4 ether);
        bytes32[] memory proof = new bytes32[](0);
        vm.prank(alice); vm.expectRevert(AvaClashMeta.RewardNotClaimable.selector); meta.claimSeasonReward(id, 0.4 ether, proof);
        vm.warp(block.timestamp + 2 days);
        uint256 beforeBalance = alice.balance;
        vm.prank(alice); meta.claimSeasonReward(id, 0.4 ether, proof);
        assertEq(alice.balance, beforeBalance + 0.4 ether);
        assertEq(meta.reservedSeasonRewards(), 0);
        assertEq(meta.seasonPrizePool(), 0.6 ether);
        assertEq(address(meta).balance, 1.1 ether);
        vm.prank(alice); vm.expectRevert(AvaClashMeta.AlreadyClaimed.selector); meta.claimSeasonReward(id, 0.4 ether, proof);
        vm.prank(alice); meta.exitNoLossVault(); assertEq(address(meta).balance, 0.6 ether);
    }
    function test_WrongRecipientAmountSeasonAndChainFail() public {
        fund(); uint256 id = schedule(alice, 0.4 ether); vm.warp(block.timestamp + 2 days);
        bytes32[] memory proof = new bytes32[](0);
        vm.prank(bob); vm.expectRevert(AvaClashMeta.InvalidRewardAllocation.selector); meta.claimSeasonReward(id, 0.4 ether, proof);
        vm.prank(alice); vm.expectRevert(AvaClashMeta.InvalidRewardAllocation.selector); meta.claimSeasonReward(id, 0.3 ether, proof);
        vm.chainId(block.chainid + 1);
        vm.prank(alice); vm.expectRevert(AvaClashMeta.InvalidRewardAllocation.selector); meta.claimSeasonReward(id, 0.4 ether, proof);
        vm.expectRevert(AvaClashMeta.RewardNotClaimable.selector); meta.claimSeasonReward(id + 1, 1, proof);
    }
    function test_ExpiredRemainderReturnsToPoolAndCannotBeClaimed() public {
        fund(); uint256 id = schedule(alice, 0.4 ether);
        vm.expectRevert(AvaClashMeta.RewardNotClaimable.selector); meta.closeRewardSeason(id);
        vm.warp(block.timestamp + 92 days + 1);
        vm.prank(bob); meta.closeRewardSeason(id);
        assertEq(meta.reservedSeasonRewards(), 0); assertEq(meta.seasonPrizePool(), 1 ether);
        vm.prank(alice); vm.expectRevert(AvaClashMeta.RewardNotClaimable.selector); meta.claimSeasonReward(id, 0.4 ether, new bytes32[](0));
        vm.expectRevert(AvaClashMeta.RewardNotClaimable.selector); meta.closeRewardSeason(id);
    }
    function test_TwoLeafProofAndReservationBudget() public {
        fund(); bytes32 a = meta.seasonRewardLeaf(0, alice, 0.4 ether); bytes32 b = meta.seasonRewardLeaf(0, bob, 0.6 ether);
        bytes32 root = a < b ? keccak256(abi.encodePacked(a,b)) : keccak256(abi.encodePacked(b,a));
        meta.scheduleSeasonRewards(root, keccak256("allocation"), 1 ether);
        vm.expectRevert(AvaClashMeta.InvalidRewardAllocation.selector); meta.scheduleSeasonRewards(bytes32(uint256(1)), bytes32(uint256(1)), 1);
        vm.warp(block.timestamp + 2 days); bytes32[] memory proof = new bytes32[](1); proof[0] = b;
        vm.prank(alice); meta.claimSeasonReward(0, 0.4 ether, proof);
        proof[0] = a; vm.prank(bob); meta.claimSeasonReward(0, 0.6 ether, proof);
        assertEq(address(meta).balance, 0); assertEq(meta.reservedSeasonRewards(), 0);
    }
}
