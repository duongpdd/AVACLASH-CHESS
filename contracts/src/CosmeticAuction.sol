// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CosmeticAuction is ReentrancyGuard {
    enum Status {
        Open,
        Settled,
        Cancelled
    }

    struct Auction {
        uint256 tokenId;
        address seller;
        uint256 reserve;
        uint64 endTime;
        uint64 originalEndTime;
        address highestBidder;
        uint256 highestBid;
        Status status;
    }

    IERC721 public immutable cosmetics;
    uint64 public immutable minDuration;
    uint64 public immutable maxDuration;
    uint64 public immutable extendWindow;
    uint64 public immutable maxExtension;
    uint256 public constant MIN_INCREMENT_ABS = 0.0001 ether;

    uint256 public nextAuctionId;
    mapping(uint256 => Auction) private auctions;
    mapping(address => uint256) public pending;

    error InvalidInput();
    error WrongState();
    error Unauthorized();
    error BidTooLow(uint256 minimum);
    error TransferFailed();

    event Created(
        uint256 indexed auctionId, uint256 indexed tokenId, address indexed seller, uint256 reserve, uint64 endTime
    );
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 value, uint64 endTime);
    event Settled(uint256 indexed auctionId, address indexed recipient, uint256 value);
    event Cancelled(uint256 indexed auctionId);
    event Withdrawn(address indexed account, uint256 value);

    constructor(address collection, uint64 minimum, uint64 maximum, uint64 window, uint64 extension) {
        if (block.chainid != 31337 && block.chainid != 43113) revert InvalidInput();
        if (collection == address(0) || minimum == 0 || maximum < minimum || window == 0 || extension == 0) {
            revert InvalidInput();
        }
        cosmetics = IERC721(collection);
        minDuration = minimum;
        maxDuration = maximum;
        extendWindow = window;
        maxExtension = extension;
    }

    function getAuction(uint256 id) public view returns (Auction memory) {
        if (id >= nextAuctionId) revert InvalidInput();
        return auctions[id];
    }

    function minimumBid(uint256 id) public view returns (uint256) {
        if (id >= nextAuctionId) revert InvalidInput();
        return _minimum(auctions[id]);
    }

    function create(uint256 tokenId, uint256 reserve, uint64 duration) external nonReentrant returns (uint256 id) {
        uint256 end = block.timestamp + duration;
        if (reserve == 0 || duration < minDuration || duration > maxDuration || end + maxExtension > type(uint64).max) {
            revert InvalidInput();
        }
        if (cosmetics.ownerOf(tokenId) != msg.sender) revert Unauthorized();
        id = nextAuctionId++;
        auctions[id] = Auction(tokenId, msg.sender, reserve, uint64(end), uint64(end), address(0), 0, Status.Open);
        cosmetics.transferFrom(msg.sender, address(this), tokenId);
        emit Created(id, tokenId, msg.sender, reserve, uint64(end));
    }

    function bid(uint256 id) external payable nonReentrant {
        Auction storage auction = _open(id);
        if (block.timestamp >= auction.endTime) revert WrongState();
        if (msg.sender == auction.seller) revert Unauthorized();
        uint256 minimum = _minimum(auction);
        if (msg.value < minimum) revert BidTooLow(minimum);

        if (auction.highestBidder != address(0)) pending[auction.highestBidder] += auction.highestBid;
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        uint256 newEnd = block.timestamp + extendWindow;
        uint256 limit = uint256(auction.originalEndTime) + maxExtension;
        if (newEnd > limit) newEnd = limit;
        if (newEnd > auction.endTime) auction.endTime = uint64(newEnd);

        emit BidPlaced(id, msg.sender, msg.value, auction.endTime);
    }

    function settle(uint256 id) external nonReentrant {
        Auction storage auction = _open(id);
        if (block.timestamp < auction.endTime) revert WrongState();
        auction.status = Status.Settled;

        address recipient = auction.seller;
        if (auction.highestBidder != address(0)) {
            recipient = auction.highestBidder;
            pending[auction.seller] += auction.highestBid;
        }
        // transferFrom avoids a recipient callback blocking settlement.
        cosmetics.transferFrom(address(this), recipient, auction.tokenId);
        emit Settled(id, recipient, auction.highestBid);
    }

    function cancel(uint256 id) external nonReentrant {
        Auction storage auction = _open(id);
        if (msg.sender != auction.seller) revert Unauthorized();
        if (auction.highestBidder != address(0)) revert WrongState();
        auction.status = Status.Cancelled;
        cosmetics.transferFrom(address(this), auction.seller, auction.tokenId);
        emit Cancelled(id);
    }

    function withdraw() external nonReentrant {
        uint256 value = pending[msg.sender];
        if (value == 0) revert WrongState();
        pending[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{ value: value }("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, value);
    }

    function _open(uint256 id) private view returns (Auction storage auction) {
        if (id >= nextAuctionId) revert InvalidInput();
        auction = auctions[id];
        if (auction.status != Status.Open) revert WrongState();
    }

    function _minimum(Auction storage auction) private view returns (uint256) {
        uint256 highest = auction.highestBid;
        if (highest == 0) return auction.reserve;
        // Round 5% up to the next wei.
        uint256 increment = (highest - 1) / 20 + 1;
        if (increment < MIN_INCREMENT_ABS) increment = MIN_INCREMENT_ABS;
        return highest + increment;
    }
}
