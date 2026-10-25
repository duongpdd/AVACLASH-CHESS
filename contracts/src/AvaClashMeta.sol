// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AvaClashMeta
 * @notice Web3 Meta Layer for AvaClash Chess:
 *         - On-Chain ELO (Soulbound reputation, start 1200, anti-win-trading)
 *         - No-Loss Tournament Vault (100% principal protected, season prize pool)
 *         - Spectator Prediction Pool (Parimutuel betting on White/Black/Draw)
 *           Betting locked before match starts (when joinRoom is called).
 *           "Under 40 moves" option removed in Fuji Testnet (Q5 decision).
 */
contract AvaClashMeta is ReentrancyGuard {
    // ──────────────────────── 1. ON-CHAIN ELO ────────────────────────

    uint256 public constant INITIAL_ELO = 1200;
    mapping(address => uint256) public eloRating;
    mapping(bytes32 => uint256) public dailyPairMatches; // Anti-win-trading

    /// @notice Address of ChessEscrow contract, authorized to call updateEloOnSettle.
    address public escrowContract;

    /// @notice Contract owner.
    address public owner;

    // ──────────────────────── 2. NO-LOSS TOURNAMENT VAULT ───────────

    mapping(address => uint256) public noLossPrincipal;
    mapping(address => uint256) public seasonPoints;
    uint256 public totalNoLossStaked;
    uint256 public seasonPrizePool;

    // ──────────────────────── 3. SPECTATOR PREDICTION ───────────────

    struct MatchPrediction {
        bool bettingLocked;     // locked when match starts (joinRoom)
        bool resolved;
        bool cancelled;         // true if match was aborted/refunded
        uint8 winningOption;    // 1: White, 2: Black, 3: Draw
        uint256 totalWhiteBet;
        uint256 totalBlackBet;
        uint256 totalDrawBet;
        mapping(address => uint256) whiteBets;
        mapping(address => uint256) blackBets;
        mapping(address => uint256) drawBets;
        mapping(address => bool) claimed;
        // Player addresses (to prevent self-betting)
        address playerA;
        address playerB;
    }

    mapping(uint256 => MatchPrediction) internal _predictions;

    /// @notice Fee on spectator bets in basis points (500 = 5%).
    uint256 public constant SPECTATOR_FEE_BPS = 500;

    // ──────────────────────── Events ────────────────────────

    event EloUpdated(address indexed winner, uint256 winnerElo, address indexed loser, uint256 loserElo);
    event NoLossStaked(address indexed user, uint256 amount);
    event NoLossWithdrawn(address indexed user, uint256 amount);
    event SpectatorBet(uint256 indexed matchId, address indexed viewer, uint8 option, uint256 amount);
    event PredictionLocked(uint256 indexed matchId);
    event PredictionResolved(uint256 indexed matchId, uint8 winningOption);
    event PredictionCancelled(uint256 indexed matchId);
    event SpectatorRewardClaimed(uint256 indexed matchId, address indexed viewer, uint256 reward);
    event SpectatorRefundClaimed(uint256 indexed matchId, address indexed viewer, uint256 amount);
    event EscrowContractSet(address indexed escrowContract);

    // ──────────────────────── Errors ────────────────────────

    error InvalidOption();
    error ZeroBet();
    error BettingClosed();
    error MinStakeRequired();
    error NothingStaked();
    error TransferFailed();
    error AlreadyResolved();
    error NotResolved();
    error AlreadyClaimed();
    error NoWinningBet();
    error NotOwner();
    error NotEscrow();
    error SelfBetNotAllowed();
    error MatchCancelled();
    error NoRefundAvailable();

    // ──────────────────────── Modifiers ────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert NotEscrow();
        _;
    }

    // ──────────────────────── Constructor ────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ──────────────────────── Admin ────────────────────────

    /**
     * @notice Set the ChessEscrow contract address (one-time or upgradeable by owner).
     */
    function setEscrowContract(address _escrow) external onlyOwner {
        escrowContract = _escrow;
        emit EscrowContractSet(_escrow);
    }

    // ──────────────────────── ELO Logic ────────────────────────

    function getElo(address player) public view returns (uint256) {
        return eloRating[player] == 0 ? INITIAL_ELO : eloRating[player];
    }

    /**
     * @notice Updates ELO ratings after match completion.
     *         Only callable by ChessEscrow contract.
     */
    function updateEloOnSettle(address winner, address loser) external onlyEscrow {
        uint256 wElo = getElo(winner);
        uint256 lElo = getElo(loser);

        bytes32 pairId = winner < loser
            ? keccak256(abi.encodePacked(winner, loser, block.timestamp / 1 days))
            : keccak256(abi.encodePacked(loser, winner, block.timestamp / 1 days));

        uint256 matchesToday = dailyPairMatches[pairId]++;
        // Halve delta if same pair plays repeatedly in a day (anti-win-trading)
        // After >3 matches/day between same pair, ELO gain reduces by 50% per extra match
        uint256 delta = 24 >> (matchesToday > 4 ? 4 : matchesToday);

        if (delta > 0) {
            eloRating[winner] = wElo + delta;
            eloRating[loser] = lElo > (100 + delta) ? lElo - delta : 100;
        }

        // Award season points if winner participates in No-Loss Vault
        if (noLossPrincipal[winner] >= 0.5 ether) {
            seasonPoints[winner] += 15;
        }

        emit EloUpdated(winner, eloRating[winner], loser, eloRating[loser]);
    }

    // ──────────────────────── No-Loss Vault ────────────────────────

    /**
     * @notice Stake AVAX to qualify for No-Loss Championship.
     */
    function enterNoLossVault() external payable nonReentrant {
        if (msg.value < 0.5 ether) revert MinStakeRequired();
        noLossPrincipal[msg.sender] += msg.value;
        totalNoLossStaked += msg.value;
        emit NoLossStaked(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw 100% of principal at any time without loss.
     */
    function exitNoLossVault() external nonReentrant {
        uint256 amount = noLossPrincipal[msg.sender];
        if (amount == 0) revert NothingStaked();

        noLossPrincipal[msg.sender] = 0;
        totalNoLossStaked -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit NoLossWithdrawn(msg.sender, amount);
    }

    // ──────────────────────── Spectator Prediction ────────────────────────

    /**
     * @notice Register match players for self-bet prevention.
     *         Called by Escrow when room becomes Active.
     */
    function registerMatch(uint256 matchId, address pA, address pB) external onlyEscrow {
        MatchPrediction storage p = _predictions[matchId];
        p.playerA = pA;
        p.playerB = pB;
    }

    /**
     * @notice Spectators bet AVAX on White (1), Black (2), or Draw (3).
     *         Must bet BEFORE match starts (before joinRoom — auto-locked).
     *         Players cannot bet on their own match.
     */
    function betOnMatch(uint256 matchId, uint8 option) external payable nonReentrant {
        if (option != 1 && option != 2 && option != 3) revert InvalidOption();
        if (msg.value == 0) revert ZeroBet();

        MatchPrediction storage p = _predictions[matchId];
        if (p.bettingLocked || p.resolved) revert BettingClosed();

        // Prevent players from betting on their own match
        if (msg.sender == p.playerA || msg.sender == p.playerB) revert SelfBetNotAllowed();

        // 5% fee: pumped directly into No-Loss Arena Season Prize Pool
        uint256 fee = (msg.value * SPECTATOR_FEE_BPS) / 10000;
        uint256 netAmount = msg.value - fee;
        seasonPrizePool += fee;

        if (option == 1) {
            p.totalWhiteBet += netAmount;
            p.whiteBets[msg.sender] += netAmount;
        } else if (option == 2) {
            p.totalBlackBet += netAmount;
            p.blackBets[msg.sender] += netAmount;
        } else {
            p.totalDrawBet += netAmount;
            p.drawBets[msg.sender] += netAmount;
        }

        emit SpectatorBet(matchId, msg.sender, option, netAmount);
    }

    /**
     * @notice Lock betting when match starts (called by Escrow on joinRoom).
     */
    function lockBetting(uint256 matchId) external onlyEscrow {
        MatchPrediction storage p = _predictions[matchId];
        if (!p.bettingLocked) {
            p.bettingLocked = true;
            emit PredictionLocked(matchId);
        }
    }

    /**
     * @notice Resolve prediction pool after match.
     *         winningOption: 1=White, 2=Black, 3=Draw.
     */
    function resolvePrediction(uint256 matchId, uint8 winningOption) external onlyEscrow {
        if (winningOption != 1 && winningOption != 2 && winningOption != 3) revert InvalidOption();
        MatchPrediction storage p = _predictions[matchId];
        if (p.resolved) revert AlreadyResolved();

        p.bettingLocked = true;
        p.resolved = true;
        p.winningOption = winningOption;

        emit PredictionResolved(matchId, winningOption);
    }

    /**
     * @notice Cancel prediction pool (match aborted/refunded/challenge default).
     *         All spectators can claim full refund via pull pattern.
     */
    function cancelPrediction(uint256 matchId) external onlyEscrow {
        MatchPrediction storage p = _predictions[matchId];
        if (p.resolved) revert AlreadyResolved();

        p.bettingLocked = true;
        p.cancelled = true;

        emit PredictionCancelled(matchId);
    }

    /**
     * @notice Claim payout for winning prediction.
     */
    function claimSpectatorReward(uint256 matchId) external nonReentrant {
        MatchPrediction storage p = _predictions[matchId];
        if (p.cancelled) revert MatchCancelled();
        if (!p.resolved) revert NotResolved();
        if (p.claimed[msg.sender]) revert AlreadyClaimed();

        uint256 userBet = 0;
        uint256 winningPool = 0;
        uint256 totalPool = p.totalWhiteBet + p.totalBlackBet + p.totalDrawBet;

        if (p.winningOption == 1) {
            userBet = p.whiteBets[msg.sender];
            winningPool = p.totalWhiteBet;
        } else if (p.winningOption == 2) {
            userBet = p.blackBets[msg.sender];
            winningPool = p.totalBlackBet;
        } else if (p.winningOption == 3) {
            userBet = p.drawBets[msg.sender];
            winningPool = p.totalDrawBet;
        }

        if (userBet == 0) revert NoWinningBet();

        p.claimed[msg.sender] = true;
        uint256 reward = (userBet * totalPool) / winningPool;

        (bool success, ) = msg.sender.call{value: reward}("");
        if (!success) revert TransferFailed();

        emit SpectatorRewardClaimed(matchId, msg.sender, reward);
    }

    /**
     * @notice Claim refund when match was cancelled (pull pattern).
     */
    function claimSpectatorRefund(uint256 matchId) external nonReentrant {
        MatchPrediction storage p = _predictions[matchId];
        if (!p.cancelled) revert MatchCancelled();
        if (p.claimed[msg.sender]) revert AlreadyClaimed();

        uint256 total = p.whiteBets[msg.sender] + p.blackBets[msg.sender] + p.drawBets[msg.sender];
        if (total == 0) revert NoRefundAvailable();

        p.claimed[msg.sender] = true;

        (bool success, ) = msg.sender.call{value: total}("");
        if (!success) revert TransferFailed();

        emit SpectatorRefundClaimed(matchId, msg.sender, total);
    }

    /**
     * @notice View match prediction state.
     */
    function getPredictionPool(uint256 matchId)
        external
        view
        returns (
            bool bettingLocked,
            bool resolved,
            bool cancelled,
            uint8 winningOption,
            uint256 totalWhiteBet,
            uint256 totalBlackBet,
            uint256 totalDrawBet
        )
    {
        MatchPrediction storage p = _predictions[matchId];
        return (
            p.bettingLocked,
            p.resolved,
            p.cancelled,
            p.winningOption,
            p.totalWhiteBet,
            p.totalBlackBet,
            p.totalDrawBet
        );
    }

    /**
     * @notice View user's bet on a match.
     */
    function getUserBet(uint256 matchId, address user)
        external
        view
        returns (uint256 whiteBet, uint256 blackBet, uint256 drawBet, bool hasClaimed)
    {
        MatchPrediction storage p = _predictions[matchId];
        return (p.whiteBets[user], p.blackBets[user], p.drawBets[user], p.claimed[user]);
    }
}
