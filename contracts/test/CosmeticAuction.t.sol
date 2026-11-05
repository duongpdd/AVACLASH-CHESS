// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { CosmeticAuction as Auction } from "../src/CosmeticAuction.sol";
import { CosmeticsFixture, Skins } from "./CosmeticsFixture.sol";

contract ReenteringBidder {
    Auction private immutable auction;
    bool public reentered;

    constructor(Auction market) {
        auction = market;
    }

    function place(uint256 id) external payable {
        auction.bid{ value: msg.value }(id);
    }

    function withdraw() external {
        auction.withdraw();
    }

    receive() external payable {
        (reentered,) = address(auction).call(abi.encodeCall(Auction.withdraw, ()));
    }
}

contract RejectingSeller {
    function list(Skins skins, Auction auction, uint256 token) external {
        skins.approve(address(auction), token);
        auction.create(token, 1 ether, 60);
    }

    function claim(Skins skins, uint256 id) external {
        skins.claimTrophy(id);
    }

    function withdraw(Auction auction) external {
        auction.withdraw();
    }

    receive() external payable {
        revert();
    }
}

contract CosmeticAuctionTest is CosmeticsFixture {
    Auction private market;
    uint256 private token;
    uint256 private constant RESERVE = 1 ether;
    address private constant BIDDER = address(201);
    address private constant OTHER = address(202);

    function setUp() public override {
        super.setUp();
        market = new Auction(address(skins), 60, 7 days, 15, 25);
        token = _mintBoard(WHITE);
        vm.deal(BIDDER, 100 ether);
        vm.deal(OTHER, 100 ether);
    }

    function _list(uint256 reserve) private returns (uint256 id) {
        vm.startPrank(WHITE);
        skins.equip(token);
        skins.approve(address(market), token);
        id = market.create(token, reserve, 60);
        vm.stopPrank();
    }

    function _bid(address bidder, uint256 id, uint256 value) private {
        vm.prank(bidder);
        market.bid{ value: value }(id);
    }

    function testApprovalAndEscrowClearEquipment() public {
        vm.prank(WHITE);
        vm.expectRevert(abi.encodeWithSignature("ERC721InsufficientApproval(address,uint256)", address(market), token));
        market.create(token, RESERVE, 60);
        _list(RESERVE);
        assertEq(skins.ownerOf(token), address(market));
        (bool equipped,,,) = skins.equippedOf(WHITE);
        assertFalse(equipped);
    }

    function testReservePercentageAndPullRefund() public {
        uint256 id = _list(RESERVE);
        vm.expectRevert(abi.encodeWithSelector(Auction.BidTooLow.selector, RESERVE));
        _bid(BIDDER, id, RESERVE - 1);
        _bid(BIDDER, id, RESERVE);
        uint256 minimum = 1.05 ether;
        assertEq(market.minimumBid(id), minimum);
        vm.expectRevert(abi.encodeWithSelector(Auction.BidTooLow.selector, minimum));
        _bid(OTHER, id, minimum - 1);
        _bid(OTHER, id, minimum);
        assertEq(market.pending(BIDDER), RESERVE);
        vm.prank(BIDDER);
        market.withdraw();
        assertEq(BIDDER.balance, 100 ether);
        assertEq(address(market).balance, minimum);
    }

    function testAbsoluteIncrementFloor() public {
        uint256 id = _list(1);
        _bid(BIDDER, id, 1);
        assertEq(market.minimumBid(id), 1 + market.MIN_INCREMENT_ABS());
    }

    function testExtensionCannotExceedOriginalEndPlusCap() public {
        uint256 id = _list(RESERVE);
        uint256 original = market.getAuction(id).endTime;
        vm.warp(original - 15);
        _bid(BIDDER, id, RESERVE);
        assertEq(market.getAuction(id).endTime, original);
        vm.warp(original - 1);
        _bid(OTHER, id, market.minimumBid(id));
        assertEq(market.getAuction(id).endTime, original + 14);
        vm.warp(original + 13);
        _bid(BIDDER, id, market.minimumBid(id));
        assertEq(market.getAuction(id).endTime, original + 25);
        vm.warp(original + 24);
        _bid(OTHER, id, market.minimumBid(id));
        assertEq(market.getAuction(id).endTime, original + 25);
    }

    function testSettleWithBidAndRejectInvalidActions() public {
        uint256 id = _list(RESERVE);
        vm.deal(WHITE, RESERVE);
        vm.expectRevert(Auction.Unauthorized.selector);
        _bid(WHITE, id, RESERVE);
        _bid(BIDDER, id, RESERVE);
        vm.expectRevert(Auction.WrongState.selector);
        market.settle(id);
        vm.prank(WHITE);
        vm.expectRevert(Auction.WrongState.selector);
        market.cancel(id);
        vm.warp(market.getAuction(id).endTime);
        vm.expectRevert(Auction.WrongState.selector);
        _bid(OTHER, id, 2 ether);
        market.settle(id);
        assertEq(skins.ownerOf(token), BIDDER);
        assertEq(market.pending(WHITE), RESERVE);
        vm.expectRevert(Auction.WrongState.selector);
        market.settle(id);
    }

    function testCancelAndSettleWithoutBids() public {
        uint256 id = _list(RESERVE);
        vm.expectRevert(Auction.Unauthorized.selector);
        market.cancel(id);
        vm.prank(WHITE);
        market.cancel(id);
        assertEq(skins.ownerOf(token), WHITE);
        assertEq(uint8(market.getAuction(id).status), uint8(Auction.Status.Cancelled));
        id = _list(RESERVE);
        vm.warp(market.getAuction(id).endTime);
        market.settle(id);
        assertEq(skins.ownerOf(token), WHITE);
        assertEq(market.pending(WHITE), 0);
    }

    function testReenteringBidderOnlyWithdrawsOnce() public {
        uint256 id = _list(RESERVE);
        ReenteringBidder attacker = new ReenteringBidder(market);
        attacker.place{ value: RESERVE }(id);
        uint256 minimum = market.minimumBid(id);
        _bid(OTHER, id, minimum);
        attacker.withdraw();
        assertFalse(attacker.reentered());
        assertEq(address(attacker).balance, RESERVE);
        assertEq(address(market).balance, minimum);
    }

    function testRejectingSellerCannotBlockSettlement() public {
        RejectingSeller seller = new RejectingSeller();
        uint256 otherToken = _mintBoard(address(seller));
        seller.list(skins, market, otherToken);
        _bid(BIDDER, 0, RESERVE);
        vm.warp(market.getAuction(0).endTime);
        market.settle(0);
        assertEq(skins.ownerOf(otherToken), BIDDER);
        vm.expectRevert(Auction.TransferFailed.selector);
        seller.withdraw(market);
        assertEq(market.pending(address(seller)), RESERVE);
    }

    function testRejectsMainnet() public {
        vm.chainId(1);
        vm.expectRevert(Auction.InvalidInput.selector);
        new Auction(address(skins), 60, 7 days, 15, 25);
    }
}
