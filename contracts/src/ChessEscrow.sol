// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ChessEscrow
 * @notice Escrow contract for AvaClash Chess 1v1 matches on Avalanche Fuji Testnet.
 *         Players stake equal AVAX; the winner (or both in draw) gets paid out
 *         after both sign the result via EIP-712. Supports single-signed submissions
 *         with a challenge window, and timeout refunds.
 */
contract ChessEscrow is EIP712, ReentrancyGuard {
    // ──────────────────────── Constants ────────────────────────

    /// @notice Maximum stake per room (1 AVAX).
    uint256 public constant MAX_STAKE = 1 ether;

    /// @notice Window after submitSingleSigned during which opponent can challenge (10 min).
    uint256 public constant CHALLENGE_WINDOW = 10 minutes;

    /// @notice If room stays Active with no result for this long, anyone can trigger refund (60 min).
    uint256 public constant REFUND_TIMEOUT = 60 minutes;

    // ──────────────────────── Types ────────────────────────

    enum RoomStatus {
        Open, // 0 — created, waiting for opponent
        Active, // 1 — both players joined, game in progress
        Settled, // 2 — result submitted and paid out
        Cancelled, // 3 — creator cancelled before opponent joined
        Refunded // 4 — timed out, both refunded
    }

    struct Room {
        address playerA; // creator (white)
        address playerB; // joiner (black)
        uint256 stake; // amount each player staked
        RoomStatus status;
        uint256 startedAt; // timestamp when playerB joined
        // Single-signed submission fields
        address singleSignedWinner;
        bytes32 singleSignedMovesHash;
        uint256 singleSignedNonce;
        uint256 singleSignedAt; // timestamp of submitSingleSigned
    }

    // EIP-712 typehash for Result(uint256 matchId, address winner, bytes32 movesHash, uint256 nonce)
    bytes32 public constant RESULT_TYPEHASH =
        keccak256("Result(uint256 matchId,address winner,bytes32 movesHash,uint256 nonce)");

    // ──────────────────────── State ────────────────────────

    /// @notice Auto-incrementing room ID counter.
    uint256 public nextRoomId;

    /// @notice Room data by ID.
    mapping(uint256 => Room) public rooms;

    /// @notice Pending withdrawal balances (pull payment pattern).
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Used nonces to prevent replay (roomId => nonce => used).
    mapping(uint256 => mapping(uint256 => bool)) public usedNonces;

    // ──────────────────────── Events ────────────────────────

    event RoomCreated(uint256 indexed roomId, address indexed creator, uint256 stake);
    event RoomJoined(uint256 indexed roomId, address indexed joiner);
    event RoomCancelled(uint256 indexed roomId);
    event ResultSubmitted(uint256 indexed roomId, address winner, bytes32 movesHash);
    event ResultChallenged(uint256 indexed roomId);
    event SingleSignedSubmitted(uint256 indexed roomId, address claimedWinner);
    event Settled(uint256 indexed roomId, address winner);
    event Refunded(uint256 indexed roomId);
    event Withdrawn(address indexed account, uint256 amount);

    // ──────────────────────── Errors ────────────────────────

    error StakeTooLow();
    error StakeTooHigh();
    error RoomNotOpen();
    error RoomNotActive();
    error NotCreator();
    error CannotJoinOwnRoom();
    error WrongStakeAmount();
    error InvalidWinner();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error NotAPlayer();
    error RefundTooEarly();
    error ChallengeWindowExpired();
    error ChallengeWindowNotExpired();
    error NoPendingSingleSigned();
    error NothingToWithdraw();
    error AlreadySettled();
    error NotTheWinner();

    // ──────────────────────── Constructor ────────────────────────

    constructor() EIP712("AvaClashChess", "1") { }

    // ──────────────────────── External Functions ────────────────────────

    /**
     * @notice Create a new room and stake AVAX.
     * @return roomId The ID of the newly created room.
     */
    function createRoom() external payable returns (uint256 roomId) {
        if (msg.value == 0) revert StakeTooLow();
        if (msg.value > MAX_STAKE) revert StakeTooHigh();

        roomId = nextRoomId++;
        rooms[roomId] = Room({
            playerA: msg.sender,
            playerB: address(0),
            stake: msg.value,
            status: RoomStatus.Open,
            startedAt: 0,
            singleSignedWinner: address(0),
            singleSignedMovesHash: bytes32(0),
            singleSignedNonce: 0,
            singleSignedAt: 0
        });

        emit RoomCreated(roomId, msg.sender, msg.value);
    }

    /**
     * @notice Join an open room by matching the stake.
     * @param roomId The room to join.
     */
    function joinRoom(uint256 roomId) external payable {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Open) revert RoomNotOpen();
        if (msg.sender == room.playerA) revert CannotJoinOwnRoom();
        if (msg.value != room.stake) revert WrongStakeAmount();

        room.playerB = msg.sender;
        room.status = RoomStatus.Active;
        room.startedAt = block.timestamp;

        emit RoomJoined(roomId, msg.sender);
    }

    /**
     * @notice Cancel an open room (only creator, before opponent joins).
     * @param roomId The room to cancel.
     */
    function cancelRoom(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Open) revert RoomNotOpen();
        if (msg.sender != room.playerA) revert NotCreator();

        room.status = RoomStatus.Cancelled;
        pendingWithdrawals[room.playerA] += room.stake;

        emit RoomCancelled(roomId);
    }

    /**
     * @notice Submit result with both players' EIP-712 signatures.
     * @param roomId The room ID (= matchId in the signed struct).
     * @param winner Address of the winner, or address(0) for draw.
     * @param movesHash keccak256 of the UCI moves string.
     * @param nonce Unique nonce for this result submission.
     * @param sigA Signature from player A.
     * @param sigB Signature from player B.
     */
    function submitResult(
        uint256 roomId,
        address winner,
        bytes32 movesHash,
        uint256 nonce,
        bytes calldata sigA,
        bytes calldata sigB
    ) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (winner != room.playerA && winner != room.playerB && winner != address(0)) {
            revert InvalidWinner();
        }
        if (usedNonces[roomId][nonce]) revert NonceAlreadyUsed();

        // Verify both signatures match the two players
        _verifyDualSignatures(roomId, winner, movesHash, nonce, sigA, sigB, room.playerA, room.playerB);

        usedNonces[roomId][nonce] = true;
        room.status = RoomStatus.Settled;

        _distribute(room, winner);

        emit ResultSubmitted(roomId, winner, movesHash);
        emit Settled(roomId, winner);
    }

    /**
     * @notice Submit result with only the winner's signature (when loser refuses to sign).
     *         Opens a challenge window for the opponent.
     * @param roomId The room ID.
     * @param winner Must be msg.sender (the winner claiming the result).
     * @param movesHash keccak256 of the UCI moves string.
     * @param nonce Unique nonce.
     * @param sig The caller's EIP-712 signature.
     */
    function submitSingleSigned(uint256 roomId, address winner, bytes32 movesHash, uint256 nonce, bytes calldata sig)
        external
    {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (winner != msg.sender) revert NotTheWinner();
        if (winner != room.playerA && winner != room.playerB) revert InvalidWinner();
        if (usedNonces[roomId][nonce]) revert NonceAlreadyUsed();

        // Verify the caller's signature
        address signer = ECDSA.recover(_computeDigest(roomId, winner, movesHash, nonce), sig);
        if (signer != msg.sender) revert InvalidSignature();

        usedNonces[roomId][nonce] = true;

        room.singleSignedWinner = winner;
        room.singleSignedMovesHash = movesHash;
        room.singleSignedNonce = nonce;
        room.singleSignedAt = block.timestamp;

        emit SingleSignedSubmitted(roomId, winner);
    }

    /**
     * @notice Challenge a single-signed result by submitting a different result
     *         signed by the challenger. Results in refund for both (MVP).
     * @param roomId The room ID.
     * @param winner The challenger's claimed winner (different from single-signed winner).
     * @param movesHash The challenger's moves hash.
     * @param nonce Nonce (can reuse the same one since this is a challenge).
     * @param sig The challenger's EIP-712 signature.
     */
    function challenge(uint256 roomId, address winner, bytes32 movesHash, uint256 nonce, bytes calldata sig)
        external
        nonReentrant
    {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (room.singleSignedAt == 0) revert NoPendingSingleSigned();
        if (block.timestamp > room.singleSignedAt + CHALLENGE_WINDOW) {
            revert ChallengeWindowExpired();
        }

        // Caller must be the other player (not the single-signed submitter)
        address challenger = msg.sender;
        if (challenger != room.playerA && challenger != room.playerB) revert NotAPlayer();
        if (challenger == room.singleSignedWinner) revert NotAPlayer();

        // Verify the challenger's signature
        address signer = ECDSA.recover(_computeDigest(roomId, winner, movesHash, nonce), sig);
        if (signer != challenger) revert InvalidSignature();

        // Conflicting results → refund both (MVP approach)
        room.status = RoomStatus.Refunded;
        pendingWithdrawals[room.playerA] += room.stake;
        pendingWithdrawals[room.playerB] += room.stake;

        emit ResultChallenged(roomId);
        emit Refunded(roomId);
    }

    /**
     * @notice Finalize a single-signed result after the challenge window expires
     *         without challenge. Winner gets the full pot.
     * @param roomId The room ID.
     */
    function finalizeSingleSigned(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (room.singleSignedAt == 0) revert NoPendingSingleSigned();
        if (block.timestamp <= room.singleSignedAt + CHALLENGE_WINDOW) {
            revert ChallengeWindowNotExpired();
        }

        room.status = RoomStatus.Settled;
        address winner = room.singleSignedWinner;

        _distribute(room, winner);

        emit Settled(roomId, winner);
    }

    /**
     * @notice Refund both players if the room has been Active too long with no result.
     * @param roomId The room ID.
     */
    function refundOnTimeout(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (block.timestamp < room.startedAt + REFUND_TIMEOUT) revert RefundTooEarly();

        room.status = RoomStatus.Refunded;
        pendingWithdrawals[room.playerA] += room.stake;
        pendingWithdrawals[room.playerB] += room.stake;

        emit Refunded(roomId);
    }

    /**
     * @notice Withdraw accumulated pending balance.
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool success,) = msg.sender.call{ value: amount }("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    // ──────────────────────── View Functions ────────────────────────

    /**
     * @notice Get complete room data.
     */
    function getRoom(uint256 roomId) external view returns (Room memory) {
        return rooms[roomId];
    }

    /**
     * @notice Expose the EIP-712 domain separator for off-chain verification.
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ──────────────────────── Internal ────────────────────────

    /**
     * @dev Distribute the pot: winner takes all, or split on draw.
     */
    function _distribute(Room storage room, address winner) internal {
        uint256 pot = room.stake * 2;
        if (winner == address(0)) {
            // Draw: each player gets their stake back
            pendingWithdrawals[room.playerA] += room.stake;
            pendingWithdrawals[room.playerB] += room.stake;
        } else {
            // Winner takes the full pot
            pendingWithdrawals[winner] += pot;
        }
    }

    /**
     * @dev Compute EIP-712 digest for a Result struct.
     */
    function _computeDigest(uint256 roomId, address winner, bytes32 movesHash, uint256 nonce)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(abi.encode(RESULT_TYPEHASH, roomId, winner, movesHash, nonce));
        return _hashTypedDataV4(structHash);
    }

    /**
     * @dev Verify that two signatures correspond to the two players (in any order).
     */
    function _verifyDualSignatures(
        uint256 roomId,
        address winner,
        bytes32 movesHash,
        uint256 nonce,
        bytes calldata sigA,
        bytes calldata sigB,
        address playerA,
        address playerB
    ) internal view {
        bytes32 digest = _computeDigest(roomId, winner, movesHash, nonce);
        address signerA = ECDSA.recover(digest, sigA);
        address signerB = ECDSA.recover(digest, sigB);

        bool validPair = (signerA == playerA && signerB == playerB) || (signerA == playerB && signerB == playerA);
        if (!validPair) revert InvalidSignature();
    }
}
