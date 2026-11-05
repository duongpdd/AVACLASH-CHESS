// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { CosmeticsFixture } from "../CosmeticsFixture.sol";
import { CosmeticAuction as Auction } from "../../src/CosmeticAuction.sol";
import { AvaClashCosmetics as Skins } from "../../src/AvaClashCosmetics.sol";

contract CosmeticAuctionHandler is Test {
    Auction private immutable market;
    Skins private immutable skins;
    uint256 private immutable tokenId;
    address[3] private actors;

    constructor(Auction market_, Skins skins_, uint256 token, address initialOwner) {
        market = market_;
        skins = skins_;
        tokenId = token;
        actors = [initialOwner, address(201), address(202)];
    }

    function list() external {
        address owner = skins.ownerOf(tokenId);
        if (owner == address(market)) return;
        vm.startPrank(owner);
        skins.approve(address(market), tokenId);
        market.create(tokenId, 0.001 ether, 60);
        vm.stopPrank();
    }

    function bid(uint256 seed, uint64 extra) external {
        uint256 count = market.nextAuctionId();
        if (count == 0) return;
        uint256 id = count - 1;
        Auction.Auction memory a = market.getAuction(id);
        address bidder = actors[seed % actors.length];
        if (a.status != Auction.Status.Open || a.seller == bidder || block.timestamp >= a.endTime) return;
        uint256 amount = market.minimumBid(id) + uint256(extra);
        if (amount > bidder.balance) return;
        vm.prank(bidder);
        market.bid{ value: amount }(id);
    }

    function settleOrCancel(bool cancel) external {
        uint256 count = market.nextAuctionId();
        if (count == 0) return;
        uint256 id = count - 1;
        Auction.Auction memory a = market.getAuction(id);
        if (a.status != Auction.Status.Open) return;
        if (cancel && a.highestBid == 0) {
            vm.prank(a.seller);
            market.cancel(id);
        } else if (block.timestamp >= a.endTime) {
            market.settle(id);
        }
    }

    function withdraw(uint256 seed) external {
        address actor = actors[seed % actors.length];
        if (market.pending(actor) == 0) return;
        vm.prank(actor);
        market.withdraw();
    }

    function elapse(uint8 seconds_) external {
        vm.warp(block.timestamp + seconds_);
    }
}

contract CosmeticAuctionInvariantTest is CosmeticsFixture {
    Auction private market;

    function setUp() public override {
        super.setUp();
        market = new Auction(address(skins), 60, 7 days, 15, 25);
        uint256 token = _mintBoard(WHITE);
        vm.deal(WHITE, 100 ether);
        vm.deal(address(201), 100 ether);
        vm.deal(address(202), 100 ether);
        CosmeticAuctionHandler handler = new CosmeticAuctionHandler(market, skins, token, WHITE);
        handler.list();
        targetContract(address(handler));
    }

    function invariant_BalanceEqualsOpenBidsPlusPending() public view {
        uint256 liabilities = market.pending(WHITE) + market.pending(address(201)) + market.pending(address(202));
        uint256 count = market.nextAuctionId();
        for (uint256 i; i < count; ++i) {
            Auction.Auction memory a = market.getAuction(i);
            if (a.status == Auction.Status.Open) liabilities += a.highestBid;
        }
        assertEq(address(market).balance, liabilities);
    }
}
