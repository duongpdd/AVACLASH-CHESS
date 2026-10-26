// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

interface IAvaClashMeta {
    function registerMatch(uint256 matchId, address pA, address pB) external;
    function lockBetting(uint256 matchId) external;
    function updateEloOnSettle(address winner, address loser) external;
    function resolvePrediction(uint256 matchId, uint8 winningOption) external;
    function cancelPrediction(uint256 matchId) external;
}

/**
 * @title ChessEscrow
 * @notice Escrow contract for AvaClash Chess 1v1 matches on Avalanche Fuji Testnet.
 *         Players stake equal AVAX; the winner (or both in draw) gets paid out
 *         after result is signed via EIP-712 (2-of-3 scheme: PlayerA, PlayerB, Relay).
 *         Supports single-signed submissions with challenge+bond, abort, timeout,
 *         and a 5% protocol fee on settlements.
 */
contract ChessEscrow is EIP712, ReentrancyGuard, Pausable {
    // ──────────────────────── Constants ────────────────────────

    /// @notice Minimum stake per player (0.01 AVAX).
    uint256 public constant MIN_STAKE = 0.01 ether;

    /// @notice Maximum stake per room (1 AVAX).
    uint256 public constant MAX_STAKE = 1 ether;

    /// @notice Window after submitSingleSigned during which opponent can challenge (10 min).
    uint256 public constant CHALLENGE_WINDOW = 10 minutes;

    /// @notice If room stays Active with no result for this long, anyone can trigger refund (60 min).
    uint256 public constant REFUND_TIMEOUT = 60 minutes;

    /// @notice Abort timeout: if no moves within this period after room becomes Active (3 min).
    uint256 public constant ABORT_TIMEOUT = 3 minutes;

    /// @notice Protocol fee in basis points (500 = 5%).
    uint256 public constant PROTOCOL_FEE_BPS = 500;

    /// @notice Minimum challenge bond (0.01 AVAX).
    uint256 public constant MIN_CHALLENGE_BOND = 0.01 ether;

    /// @notice Challenge bond rate in basis points (2000 = 20% of stake).
    uint256 public constant CHALLENGE_BOND_BPS = 2000;

    /// @notice Arbiter ruling deadline after challenge (24 hours).
    uint256 public constant ARBITER_DEADLINE = 24 hours;

    // ──────────────────────── Types ────────────────────────

    enum RoomStatus {
        Open,       // 0 — created, waiting for opponent
        Active,     // 1 — both players joined, game in progress
        Settled,    // 2 — result submitted and paid out
        Cancelled,  // 3 — creator cancelled before opponent joined
        Refunded,   // 4 — timed out, both refunded
        Challenged, // 5 — challenge submitted, awaiting arbiter
        Aborted     // 6 — aborted before game started
    }

    struct Room {
        address playerA;            // creator
        address playerB;            // joiner
        uint256 stake;              // amount each player staked
        RoomStatus status;
        uint256 startedAt;          // timestamp when playerB joined
        bool gameStarted;           // relay signals first move was made
        bool creatorIsWhite;        // true if creator chose White, false if Black
        // Single-signed submission fields
        address singleSignedWinner;
        bytes32 singleSignedMovesHash;
        uint256 singleSignedNonce;
        uint256 singleSignedAt;     // timestamp of submitSingleSigned
        uint256 singleSignedBond;   // submitter bond
        // Challenge fields
        address challenger;
        uint256 challengeBond;
        uint256 challengedAt;
    }

    // EIP-712 typehash for expanded Result struct
    // Result(uint256 matchId, address winner, uint8 outcome, uint8 reason,
    //        uint16 moveCount, bytes32 movesHash, uint256 nonce, uint256 deadline)
    bytes32 public constant RESULT_TYPEHASH =
        keccak256("Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)");

    // ──────────────────────── State ────────────────────────

    /// @notice Auto-incrementing room ID counter.
    uint256 public nextRoomId;

    /// @notice Room data by ID.
    mapping(uint256 => Room) public rooms;

    /// @notice Pending withdrawal balances (pull payment pattern).
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Used nonces for single-signed claims (roomId => signer => nonce => used).
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public usedNonces;

    /// @notice Relay signer address (trusted for 2-of-3 scheme).
    address public relaySigner;

    /// @notice Pending relay signer change (timelock).
    address public pendingRelaySigner;
    uint256 public relaySignerChangeAt;
    uint256 public constant RELAY_TIMELOCK = 2 days;

    /// @notice Arbiter address (dispute resolution).
    address public arbiter;

    /// @notice Pending arbiter change (timelock).
    address public pendingArbiter;
    uint256 public arbiterChangeAt;
    uint256 public constant ARBITER_TIMELOCK = 2 days;

    /// @notice Treasury address for protocol fees.
    address public treasury;

    /// @notice AvaClashMeta contract for ELO and spectator pool integration.
    address public metaContract;

    /// @notice Tracks whether prediction resolution failed during settle for a room.
    mapping(uint256 => bool) public metaResolutionFailed;

    /// @notice Tracks intended winning option (1=White, 2=Black, 3=Draw) when resolution failed.
    mapping(uint256 => uint8) public metaWinningOption;

    /// @notice Accumulated protocol fees not yet withdrawn.
    uint256 public protocolFees;

    /// @notice Contract owner.
    address public owner;

    // ──────────────────────── Events ────────────────────────

    event RoomCreated(uint256 indexed roomId, address indexed creator, uint256 stake, bool creatorIsWhite);
    event RoomJoined(uint256 indexed roomId, address indexed joiner);
    event RoomCancelled(uint256 indexed roomId);
    event RoomAborted(uint256 indexed roomId);
    event GameStarted(uint256 indexed roomId);
    event ResultSubmitted(uint256 indexed roomId, address winner, bytes32 movesHash);
    event ResultChallenged(uint256 indexed roomId, address challenger, uint256 bond);
    event SingleSignedSubmitted(uint256 indexed roomId, address claimedWinner);
    event Settled(uint256 indexed roomId, address winner, uint256 fee);
    event Refunded(uint256 indexed roomId);
    event Withdrawn(address indexed account, uint256 amount);
    event RelaySignerChangeProposed(address indexed newSigner, uint256 effectiveAt);
    event RelaySignerChanged(address indexed oldSigner, address indexed newSigner);
    event ArbiterChangeProposed(address indexed newArbiter, uint256 effectiveAt);
    event ArbiterChanged(address indexed oldArbiter, address indexed newArbiter);
    event ChallengeResolved(uint256 indexed roomId, address winner);
    event MetaContractSet(address indexed metaContract);
    event MetaCallFailed(uint256 indexed roomId, bytes4 selector);

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
    error AbortTooEarly();
    error GameAlreadyStarted();
    error ChallengeWindowExpired();
    error ChallengeWindowNotExpired();
    error NoPendingSingleSigned();
    error NothingToWithdraw();
    error AlreadySettled();
    error NotTheWinner();
    error DeadlineExpired();
    error InsufficientBond();
    error NotOwner();
    error TimelockNotReady();
    error NoPendingChange();
    error RoomNotChallenged();
    error ArbiterDeadlineNotReached();
    error NoFailedResolution();
    error MetaNotConfigured();
    error NotArbiter();
    error SingleSignedAlreadySubmitted();
    error InvalidAddress();

    // ──────────────────────── Modifiers ────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ──────────────────────── Constructor ────────────────────────

    constructor(address _relaySigner, address _arbiter, address _treasury) EIP712("AvaClashChess", "2") {
        if (_relaySigner == address(0) || _arbiter == address(0) || _treasury == address(0)) revert InvalidAddress();
        if (_arbiter == _relaySigner) revert InvalidAddress();
        owner = msg.sender;
        relaySigner = _relaySigner;
        arbiter = _arbiter;
        treasury = _treasury;
    }

    // ──────────────────────── External Functions ────────────────────────

    /**
     * @notice Create a new room, choose piece color, and stake AVAX.
     * @param creatorIsWhite True if creator plays White, false if Black.
     * @return roomId The ID of the newly created room.
     */
    function createRoom(bool creatorIsWhite) external payable whenNotPaused returns (uint256 roomId) {
        if (msg.value < MIN_STAKE) revert StakeTooLow();
        if (msg.value > MAX_STAKE) revert StakeTooHigh();

        roomId = nextRoomId++;
        Room storage room = rooms[roomId];
        room.playerA = msg.sender;
        room.stake = msg.value;
        room.status = RoomStatus.Open;
        room.creatorIsWhite = creatorIsWhite;

        emit RoomCreated(roomId, msg.sender, msg.value, creatorIsWhite);
    }

    /**
     * @notice Join an open room by matching the stake.
     * @param roomId The room to join.
     */
    function joinRoom(uint256 roomId) external payable whenNotPaused {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Open) revert RoomNotOpen();
        if (msg.sender == room.playerA) revert CannotJoinOwnRoom();
        if (msg.value != room.stake) revert WrongStakeAmount();

        room.playerB = msg.sender;
        room.status = RoomStatus.Active;
        room.startedAt = block.timestamp;

        if (metaContract != address(0)) {
            IAvaClashMeta(metaContract).registerMatch(roomId, room.playerA, msg.sender);
            IAvaClashMeta(metaContract).lockBetting(roomId);
        }

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

        if (metaContract != address(0)) {
            try IAvaClashMeta(metaContract).cancelPrediction(roomId) {}
            catch {
                emit MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);
            }
        }

        emit RoomCancelled(roomId);
    }

    /**
     * @notice Abort a room before the game actually starts (before first moves).
     *         Refunds both players with a small anti-spam fee deducted from aborter.
     * @param roomId The room to abort.
     */
    function abortRoom(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (room.gameStarted) revert GameAlreadyStarted();
        if (block.timestamp < room.startedAt + ABORT_TIMEOUT) revert AbortTooEarly();

        room.status = RoomStatus.Aborted;
        // Full refund for both — timeout means no one moved
        pendingWithdrawals[room.playerA] += room.stake;
        pendingWithdrawals[room.playerB] += room.stake;

        if (metaContract != address(0)) {
            try IAvaClashMeta(metaContract).cancelPrediction(roomId) {}
            catch {
                emit MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);
            }
        }

        emit RoomAborted(roomId);
    }

    /**
     * @notice Signal that the game has started (first move made).
     *         Can only be called by relay signer.
     * @param roomId The room where game started.
     */
    function signalGameStarted(uint256 roomId) external {
        if (msg.sender != relaySigner) revert InvalidSignature();
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();

        room.gameStarted = true;
        emit GameStarted(roomId);
    }

    /**
     * @notice Submit result with 2-of-3 signatures (PlayerA, PlayerB, Relay).
     *         Any two valid signatures from the set {PlayerA, PlayerB, RelaySigner} are accepted.
     * @param roomId The room ID (= matchId in the signed struct).
     * @param winner Address of the winner, or address(0) for draw.
     * @param outcome Outcome code (0=WhiteWin, 1=BlackWin, 2=Draw).
     * @param reason Reason code (0=Checkmate, 1=Resign, ..., 7=Agreement).
     * @param moveCount Total half-moves played.
     * @param movesHash keccak256 of the UCI moves string.
     * @param nonce Unique nonce for this result submission.
     * @param deadline Timestamp after which signatures expire.
     * @param sigA First signature.
     * @param sigB Second signature.
     */
    function submitResult(
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sigA,
        bytes calldata sigB
    ) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        _validateOutcomeAndWinner(room, winner, outcome);
        if (block.timestamp > deadline) revert DeadlineExpired();

        // Verify 2-of-3 signatures
        _verify2of3Signatures(roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline, sigA, sigB, room.playerA, room.playerB);

        room.status = RoomStatus.Settled;

        uint256 fee = _distribute(roomId, room, winner);

        emit ResultSubmitted(roomId, winner, movesHash);
        emit Settled(roomId, winner, fee);
    }

    /**
     * @notice Submit result with only the winner's signature (when loser refuses to sign).
     *         Opens a challenge window for the opponent.
     * @param roomId The room ID.
     * @param winner Must be msg.sender (the winner claiming the result).
     * @param outcome Outcome code.
     * @param reason Reason code.
     * @param moveCount Total half-moves.
     * @param movesHash keccak256 of the UCI moves string.
     * @param nonce Unique nonce.
     * @param deadline Signature expiry timestamp.
     * @param sig The caller's EIP-712 signature.
     */
    function submitSingleSigned(
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external payable nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (room.singleSignedAt != 0) revert SingleSignedAlreadySubmitted();
        if (winner != msg.sender) revert NotTheWinner();
        _validateOutcomeAndWinner(room, winner, outcome);
        if (usedNonces[roomId][msg.sender][nonce]) revert NonceAlreadyUsed();
        if (block.timestamp > deadline) revert DeadlineExpired();

        uint256 requiredBond = _computeChallengeBond(room.stake);
        if (msg.value != requiredBond) revert InsufficientBond();

        // Verify the caller's signature
        address signer = ECDSA.recover(
            _computeDigest(roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline),
            sig
        );
        if (signer != msg.sender) revert InvalidSignature();

        usedNonces[roomId][msg.sender][nonce] = true;

        room.singleSignedWinner = winner;
        room.singleSignedMovesHash = movesHash;
        room.singleSignedNonce = nonce;
        room.singleSignedAt = block.timestamp;
        room.singleSignedBond = msg.value;

        emit SingleSignedSubmitted(roomId, winner);
    }

    /**
     * @notice Challenge a single-signed result. Challenger must post a bond.
     *         Bond = max(20% of stake, 0.01 AVAX).
     * @param roomId The room ID.
     * @param winner The challenger's claimed winner (different from single-signed winner).
     * @param movesHash The challenger's moves hash.
     * @param nonce Nonce for the challenge signature.
     * @param deadline Signature expiry.
     * @param sig The challenger's EIP-712 signature.
     */
    function challenge(
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external payable nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (room.singleSignedAt == 0) revert NoPendingSingleSigned();
        if (block.timestamp > room.singleSignedAt + CHALLENGE_WINDOW) {
            revert ChallengeWindowExpired();
        }

        // Caller must be the other player (not the single-signed submitter)
        address challengerAddr = msg.sender;
        if (challengerAddr != room.playerA && challengerAddr != room.playerB) revert NotAPlayer();
        if (challengerAddr == room.singleSignedWinner) revert NotAPlayer();

        _validateOutcomeAndWinner(room, winner, outcome);

        // Verify bond
        uint256 requiredBond = _computeChallengeBond(room.stake);
        if (msg.value < requiredBond) revert InsufficientBond();

        // Verify the challenger's signature
        if (block.timestamp > deadline) revert DeadlineExpired();
        address signer = ECDSA.recover(
            _computeDigest(roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline),
            sig
        );
        if (signer != challengerAddr) revert InvalidSignature();

        // Move to Challenged status, awaiting arbiter
        room.status = RoomStatus.Challenged;
        room.challenger = challengerAddr;
        room.challengeBond = msg.value;
        room.challengedAt = block.timestamp;

        emit ResultChallenged(roomId, challengerAddr, msg.value);
    }

    /**
     * @notice Arbiter resolves a challenge by declaring the valid winner.
     *         Loser's bond goes to the winner.
     * @param roomId The room ID.
     * @param validWinner The arbiter's determined winner (address(0) for draw).
     */
    function resolveChallenge(uint256 roomId, address validWinner) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Challenged) revert RoomNotChallenged();
        if (validWinner != room.playerA && validWinner != room.playerB && validWinner != address(0)) {
            revert InvalidWinner();
        }

        room.status = RoomStatus.Settled;

        // Determine who was right
        bool challengerWasRight = (validWinner != room.singleSignedWinner)
            || (validWinner == address(0) && room.singleSignedWinner != address(0));

        if (challengerWasRight) {
            // Challenger was right: challenger receives their bond + submitter's bond
            pendingWithdrawals[room.challenger] += room.challengeBond + room.singleSignedBond;
        } else {
            // Challenger was wrong: submitter receives their bond + challenger's bond
            pendingWithdrawals[room.singleSignedWinner] += room.singleSignedBond + room.challengeBond;
        }

        uint256 fee = _distribute(roomId, room, validWinner);

        emit ChallengeResolved(roomId, validWinner);
        emit Settled(roomId, validWinner, fee);
    }

    /**
     * @notice If arbiter does not resolve within deadline, default to refund both.
     * @param roomId The room ID.
     */
    function resolveDefaultChallenge(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Challenged) revert RoomNotChallenged();
        if (block.timestamp < room.challengedAt + ARBITER_DEADLINE) revert ArbiterDeadlineNotReached();

        room.status = RoomStatus.Refunded;

        // Refund stakes
        pendingWithdrawals[room.playerA] += room.stake;
        pendingWithdrawals[room.playerB] += room.stake;
        // Refund submitter bond (Q11)
        pendingWithdrawals[room.singleSignedWinner] += room.singleSignedBond;
        // Default challenge resolution (Q8): 50% challenger bond to submitter as compensation, 50% refunded to challenger
        uint256 submitterCompensation = room.challengeBond / 2;
        uint256 challengerRefund = room.challengeBond - submitterCompensation;
        pendingWithdrawals[room.singleSignedWinner] += submitterCompensation;
        pendingWithdrawals[room.challenger] += challengerRefund;

        if (metaContract != address(0)) {
            try IAvaClashMeta(metaContract).cancelPrediction(roomId) {}
            catch {
                emit MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);
            }
        }

        emit Refunded(roomId);
    }

    /**
     * @notice Finalize a single-signed result after the challenge window expires
     *         without challenge. Winner gets the full pot (minus fee) plus submitter bond refund.
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

        // Refund submitter bond (Q11)
        pendingWithdrawals[winner] += room.singleSignedBond;

        uint256 fee = _distribute(roomId, room, winner);

        emit Settled(roomId, winner, fee);
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

        if (metaContract != address(0)) {
            try IAvaClashMeta(metaContract).cancelPrediction(roomId) {}
            catch {
                emit MetaCallFailed(roomId, IAvaClashMeta.cancelPrediction.selector);
            }
        }

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

    // ──────────────────────── Owner Functions ────────────────────────

    /**
     * @notice Propose a relay signer change (timelock enforced).
     * @param newSigner The new relay signer address.
     */
    function proposeRelaySigner(address newSigner) external onlyOwner {
        pendingRelaySigner = newSigner;
        relaySignerChangeAt = block.timestamp + RELAY_TIMELOCK;
        emit RelaySignerChangeProposed(newSigner, relaySignerChangeAt);
    }

    /**
     * @notice Execute relay signer change after timelock.
     */
    function executeRelaySignerChange() external onlyOwner {
        if (pendingRelaySigner == address(0)) revert NoPendingChange();
        if (block.timestamp < relaySignerChangeAt) revert TimelockNotReady();

        address oldSigner = relaySigner;
        relaySigner = pendingRelaySigner;
        pendingRelaySigner = address(0);
        relaySignerChangeAt = 0;

        emit RelaySignerChanged(oldSigner, relaySigner);
    }

    /**
     * @notice Propose an arbiter change (timelock enforced).
     * @param newArbiter The new arbiter address.
     */
    function proposeArbiter(address newArbiter) external onlyOwner {
        pendingArbiter = newArbiter;
        arbiterChangeAt = block.timestamp + ARBITER_TIMELOCK;
        emit ArbiterChangeProposed(newArbiter, arbiterChangeAt);
    }

    /**
     * @notice Execute an arbiter change after timelock.
     */
    function executeArbiterChange() external onlyOwner {
        if (pendingArbiter == address(0)) revert NoPendingChange();
        if (block.timestamp < arbiterChangeAt) revert TimelockNotReady();

        address oldArbiter = arbiter;
        arbiter = pendingArbiter;
        pendingArbiter = address(0);
        arbiterChangeAt = 0;

        emit ArbiterChanged(oldArbiter, arbiter);
    }

    /**
     * @notice Pause new room creation and joining in an emergency.
     *         Existing rooms can still abort, refund, settle, and withdraw.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw accumulated protocol fees to treasury.
     */
    function withdrawProtocolFees() external nonReentrant onlyOwner {
        uint256 amount = protocolFees;
        if (amount == 0) revert NothingToWithdraw();
        protocolFees = 0;

        (bool success,) = treasury.call{ value: amount }("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Set the AvaClashMeta contract address.
     * @param _meta The address of AvaClashMeta.
     */
    function setMetaContract(address _meta) external onlyOwner {
        metaContract = _meta;
        emit MetaContractSet(_meta);
    }

    /**
     * @notice Retry resolving spectator prediction pool on Meta if it failed during settle.
     * @param roomId The room ID.
     */
    function retryResolvePrediction(uint256 roomId) external {
        if (!metaResolutionFailed[roomId]) revert NoFailedResolution();
        if (metaContract == address(0)) revert MetaNotConfigured();
        uint8 option = metaWinningOption[roomId];
        delete metaResolutionFailed[roomId];
        delete metaWinningOption[roomId];
        IAvaClashMeta(metaContract).resolvePrediction(roomId, option);
    }

    /**
     * @notice Fallback to cancel spectator prediction pool if resolution permanently failed,
     *         allowing all spectators to claim 100% refund.
     * @param roomId The room ID.
     */
    function fallbackCancelPrediction(uint256 roomId) external {
        if (!metaResolutionFailed[roomId]) revert NoFailedResolution();
        if (metaContract == address(0)) revert MetaNotConfigured();
        delete metaResolutionFailed[roomId];
        delete metaWinningOption[roomId];
        IAvaClashMeta(metaContract).cancelPrediction(roomId);
    }

    // ──────────────────────── View Functions ────────────────────────

    /**
     * @notice Get complete room data.
     */
    function getRoom(uint256 roomId) external view returns (Room memory) {
        return rooms[roomId];
    }

    /**
     * @notice Get white player address (address(0) if not yet joined/assigned).
     */
    function getWhitePlayer(uint256 roomId) external view returns (address) {
        Room storage room = rooms[roomId];
        return room.creatorIsWhite ? room.playerA : room.playerB;
    }

    /**
     * @notice Get black player address (address(0) if not yet joined/assigned).
     */
    function getBlackPlayer(uint256 roomId) external view returns (address) {
        Room storage room = rooms[roomId];
        return room.creatorIsWhite ? room.playerB : room.playerA;
    }

    /**
     * @notice Expose the EIP-712 domain separator for off-chain verification.
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Compute challenge bond for a given stake.
     */
    function getChallengeBond(uint256 stake) external pure returns (uint256) {
        return _computeChallengeBond(stake);
    }

    // ──────────────────────── Internal ────────────────────────

    /**
     * @dev Distribute the pot: winner takes all minus fee, or refund both on draw.
     *      Draw = no fee, full refund. Win = 5% fee, rest to winner.
     *      If metaContract is configured, updates on-chain ELO and resolves spectator predictions.
     */
    function _distribute(uint256 roomId, Room storage room, address winner) internal returns (uint256 fee) {
        uint256 pot = room.stake * 2;
        if (winner == address(0)) {
            // Draw: each player gets their stake back (no fee on draw)
            pendingWithdrawals[room.playerA] += room.stake;
            pendingWithdrawals[room.playerB] += room.stake;
            fee = 0;
            if (metaContract != address(0)) {
                try IAvaClashMeta(metaContract).resolvePrediction(roomId, 3) {}
                catch {
                    metaResolutionFailed[roomId] = true;
                    metaWinningOption[roomId] = 3;
                    emit MetaCallFailed(roomId, IAvaClashMeta.resolvePrediction.selector);
                }
            }
        } else {
            // Winner: deduct protocol fee
            fee = (pot * PROTOCOL_FEE_BPS) / 10000;
            protocolFees += fee;
            pendingWithdrawals[winner] += pot - fee;
            if (metaContract != address(0)) {
                address loser = (winner == room.playerA) ? room.playerB : room.playerA;
                try IAvaClashMeta(metaContract).updateEloOnSettle(winner, loser) {}
                catch {
                    emit MetaCallFailed(roomId, IAvaClashMeta.updateEloOnSettle.selector);
                }
                address whitePlayer = room.creatorIsWhite ? room.playerA : room.playerB;
                uint8 winningOption = (winner == whitePlayer) ? 1 : 2;
                try IAvaClashMeta(metaContract).resolvePrediction(roomId, winningOption) {}
                catch {
                    metaResolutionFailed[roomId] = true;
                    metaWinningOption[roomId] = winningOption;
                    emit MetaCallFailed(roomId, IAvaClashMeta.resolvePrediction.selector);
                }
            }
        }
    }

    /**
     * @dev Validate consistency between outcome and winner:
     *      - outcome == 0 (WhiteWin) requires winner == whitePlayer.
     *      - outcome == 1 (BlackWin) requires winner == blackPlayer.
     *      - outcome == 2 (Draw) requires winner == address(0).
     *      - outcome > 2 reverts InvalidWinner.
     */
    function _validateOutcomeAndWinner(Room storage room, address winner, uint8 outcome) internal view {
        address whitePlayer = room.creatorIsWhite ? room.playerA : room.playerB;
        address blackPlayer = room.creatorIsWhite ? room.playerB : room.playerA;

        if (outcome == 0) {
            if (winner != whitePlayer || winner == address(0)) revert InvalidWinner();
        } else if (outcome == 1) {
            if (winner != blackPlayer || winner == address(0)) revert InvalidWinner();
        } else if (outcome == 2) {
            if (winner != address(0)) revert InvalidWinner();
        } else {
            revert InvalidWinner();
        }
    }

    /**
     * @dev Compute the challenge bond = max(20% of stake, 0.01 AVAX).
     */
    function _computeChallengeBond(uint256 stake) internal pure returns (uint256) {
        uint256 bondFromStake = (stake * CHALLENGE_BOND_BPS) / 10000;
        return bondFromStake > MIN_CHALLENGE_BOND ? bondFromStake : MIN_CHALLENGE_BOND;
    }

    /**
     * @dev Compute EIP-712 digest for the expanded Result struct.
     */
    function _computeDigest(
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            RESULT_TYPEHASH, roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline
        ));
        return _hashTypedDataV4(structHash);
    }

    /**
     * @dev Verify that two signatures come from 2 of 3 authorized signers (playerA, playerB, relaySigner).
     */
    function _verify2of3Signatures(
        uint256 roomId,
        address winner,
        uint8 outcome,
        uint8 reason,
        uint16 moveCount,
        bytes32 movesHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sigA,
        bytes calldata sigB,
        address playerA,
        address playerB
    ) internal view {
        bytes32 digest = _computeDigest(roomId, winner, outcome, reason, moveCount, movesHash, nonce, deadline);
        address signerA = ECDSA.recover(digest, sigA);
        address signerB = ECDSA.recover(digest, sigB);

        // Both signers must be different
        if (signerA == signerB) revert InvalidSignature();

        // Each signer must be one of {playerA, playerB, relaySigner}
        bool aValid = (signerA == playerA || signerA == playerB || signerA == relaySigner);
        bool bValid = (signerB == playerA || signerB == playerB || signerB == relaySigner);

        if (!aValid || !bValid) revert InvalidSignature();
    }
}
