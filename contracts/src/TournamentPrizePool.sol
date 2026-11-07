// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ChessEscrow } from "./ChessEscrow.sol";

/// @notice Testnet-only, free-entry round robin. Relay reports are provisional;
/// an independent reviewer is trusted for Fair Play and adjudication.
contract TournamentPrizePool is EIP712, ReentrancyGuard {
    enum Phase {
        Registration,
        Running,
        Finalized,
        Cancelled
    }

    struct Tournament {
        address organizer;
        address reviewer;
        string title;
        string rules;
        bytes32 rulesHash;
        uint8 capacity;
        Phase phase;
        uint64 registrationEnds;
        uint64 completionDeadline;
        uint64 reviewSeconds;
        uint64 reviewUntil;
        uint64 claimUntil;
        uint256 funded;
        uint256 paid;
        uint256 remainder;
        uint256 openAppeals;
        bool cancellationRequested;
    }

    struct MatchResult {
        uint256 tournamentId;
        uint8 outcome; // 0 = white, 1 = black, 2 = draw (shared Result v2)
        bool reported;
        bool approved;
        bytes32 movesHash;
        bytes32 decisionHash;
    }

    struct MatchView {
        uint256 roomId;
        address white;
        address black;
        MatchResult result;
    }

    struct Result {
        uint256 matchId;
        address winner;
        uint8 outcome;
        uint8 reason;
        uint16 moveCount;
        bytes32 movesHash;
        uint256 nonce;
        uint256 deadline;
    }
    bytes32 public constant RESULT_TYPEHASH = keccak256(
        "Result(uint256 matchId,address winner,uint8 outcome,uint8 reason,uint16 moveCount,bytes32 movesHash,uint256 nonce,uint256 deadline)"
    );
    address public immutable relaySigner;
    uint256 public nextTournamentId;
    uint256 public nextRoomId;
    mapping(uint256 => Tournament) private tournaments;
    mapping(uint256 => address[]) private entrants;
    mapping(uint256 => uint256[]) private matchIds;
    mapping(uint256 => ChessEscrow.Room) private rooms;
    mapping(uint256 => MatchResult) public results;
    mapping(uint256 => mapping(address => bool)) public registered;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    mapping(uint256 => mapping(address => uint256)) public awards;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => mapping(address => bool)) public refunded;
    mapping(uint256 => mapping(address => bool)) public appealUsed;
    mapping(uint256 => mapping(address => bool)) public appealOpen;
    error InvalidInput();
    error WrongPhase();
    error Unauthorized();
    error NotReady();
    error TransferFailed();
    event TournamentCreated(uint256 indexed id, address indexed organizer, address reviewer, bytes32 rulesHash);
    event Funded(uint256 indexed id, address indexed sponsor, uint256 amount);
    event Registered(uint256 indexed id, address indexed player);
    event Started(uint256 indexed id, uint256[] roomIds);
    event ResultReported(uint256 indexed roomId, uint8 outcome, bytes32 movesHash);
    event Reviewed(uint256 indexed roomId, uint8 outcome, bytes32 decisionHash);
    event Appealed(uint256 indexed roomId, address indexed player, bytes32 evidenceHash);
    event AppealResolved(uint256 indexed roomId, address indexed player, bytes32 decisionHash);
    event Finalized(uint256 indexed id, uint64 claimUntil, bytes32 allocationHash);
    event Claimed(uint256 indexed id, address indexed player, uint256 amount);
    event CancellationRequested(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event Refunded(uint256 indexed id, address indexed sponsor, uint256 amount);

    constructor(address relay) EIP712("AvaClashChess", "2") {
        if (block.chainid != 31337 && block.chainid != 43113) revert InvalidInput();
        if (relay == address(0)) revert InvalidInput();
        relaySigner = relay;
    }

    function createTournament(
        string calldata title,
        string calldata rules,
        uint8 capacity,
        address reviewer,
        uint64 registrationEnds,
        uint64 completionDeadline,
        uint64 reviewSeconds
    ) external returns (uint256 id) {
        if (
            bytes(title).length == 0 || bytes(title).length > 120 || bytes(rules).length == 0
                || bytes(rules).length > 3000 || capacity < 2 || capacity > 8 || reviewer == address(0)
                || reviewer == msg.sender || reviewer == relaySigner || msg.sender == relaySigner
                || reviewSeconds < 1 hours || reviewSeconds > 7 days || registrationEnds <= block.timestamp
                || registrationEnds > block.timestamp + 30 days
                || completionDeadline <= registrationEnds + reviewSeconds
                || completionDeadline > block.timestamp + 60 days
        ) revert InvalidInput();
        id = nextTournamentId++;
        Tournament storage t = tournaments[id];
        t.organizer = msg.sender;
        t.reviewer = reviewer;
        t.title = title;
        t.rules = rules;
        t.rulesHash = keccak256(bytes(rules));
        t.capacity = capacity;
        t.registrationEnds = registrationEnds;
        t.completionDeadline = completionDeadline;
        t.reviewSeconds = reviewSeconds;
        emit TournamentCreated(id, msg.sender, reviewer, t.rulesHash);
    }

    function getTournament(uint256 id) public view returns (Tournament memory) {
        if (id >= nextTournamentId) revert InvalidInput();
        return tournaments[id];
    }

    function getEntrants(uint256 id) external view returns (address[] memory) {
        return entrants[id];
    }

    function getMatches(uint256 id) external view returns (uint256[] memory) {
        return matchIds[id];
    }

    function getMatchViews(uint256 id) external view returns (MatchView[] memory views) {
        views = new MatchView[](matchIds[id].length);
        for (uint256 i; i < views.length; i++) {
            uint256 roomId = matchIds[id][i];
            ChessEscrow.Room storage room = rooms[roomId];
            views[i] = MatchView(
                roomId,
                room.creatorIsWhite ? room.playerA : room.playerB,
                room.creatorIsWhite ? room.playerB : room.playerA,
                results[roomId]
            );
        }
    }

    function getOpenAppeals(uint256 roomId) external view returns (address[] memory players) {
        if (roomId >= nextRoomId) revert InvalidInput();
        address[] storage all = entrants[results[roomId].tournamentId];
        uint256 count;
        for (uint256 i; i < all.length; i++) {
            if (appealOpen[roomId][all[i]]) count++;
        }
        players = new address[](count);
        uint256 next;
        for (uint256 i; i < all.length; i++) {
            if (appealOpen[roomId][all[i]]) players[next++] = all[i];
        }
    }

    function getAllocation(uint256 id) external view returns (uint256[] memory amounts, bool[] memory withdrawn) {
        address[] storage players = entrants[id];
        amounts = new uint256[](players.length);
        withdrawn = new bool[](players.length);
        for (uint256 i; i < players.length; i++) {
            amounts[i] = awards[id][players[i]];
            withdrawn[i] = claimed[id][players[i]];
        }
    }

    function fund(uint256 id) external payable {
        Tournament storage t = _t(id);
        if (t.phase != Phase.Registration || block.timestamp >= t.registrationEnds) revert WrongPhase();
        if (msg.value == 0 || registered[id][msg.sender] || msg.sender == t.reviewer || msg.sender == relaySigner) {
            revert InvalidInput();
        }
        t.funded += msg.value;
        contributions[id][msg.sender] += msg.value;
        emit Funded(id, msg.sender, msg.value);
    }

    /// @notice No payable entry point: players pay only network gas, never a stake or entry fee.
    function register(uint256 id) external {
        Tournament storage t = _t(id);
        if (t.phase != Phase.Registration || block.timestamp >= t.registrationEnds) revert WrongPhase();
        if (t.funded == 0) revert NotReady();
        if (
            registered[id][msg.sender] || contributions[id][msg.sender] != 0 || entrants[id].length >= t.capacity
                || msg.sender == t.organizer || msg.sender == t.reviewer || msg.sender == relaySigner
        ) revert InvalidInput();
        registered[id][msg.sender] = true;
        entrants[id].push(msg.sender);
        emit Registered(id, msg.sender);
    }

    function start(uint256 id) external {
        Tournament storage t = _t(id);
        if (msg.sender != t.organizer) revert Unauthorized();
        if (t.phase != Phase.Registration || block.timestamp >= t.registrationEnds) revert WrongPhase();
        if (t.funded == 0 || entrants[id].length != t.capacity) revert NotReady();
        t.phase = Phase.Running;
        address[] storage players = entrants[id];
        for (uint256 a; a < players.length; a++) {
            for (uint256 b = a + 1; b < players.length; b++) {
                uint256 roomId = nextRoomId++;
                ChessEscrow.Room storage room = rooms[roomId];
                room.playerA = players[a];
                room.playerB = players[b];
                room.creatorIsWhite = (a + b) % 2 == 1;
                room.status = ChessEscrow.RoomStatus.Active;
                room.startedAt = block.timestamp;
                results[roomId].tournamentId = id;
                matchIds[id].push(roomId);
            }
        }
        emit Started(id, matchIds[id]);
    }

    /// @notice ABI-compatible room adapter for the existing durable chess relay.
    function getRoom(uint256 roomId) external view returns (ChessEscrow.Room memory room) {
        if (roomId >= nextRoomId) revert InvalidInput();
        room = rooms[roomId];
        Tournament storage t = tournaments[results[roomId].tournamentId];
        if (t.phase != Phase.Running || block.timestamp + t.reviewSeconds >= t.completionDeadline) {
            room.status = ChessEscrow.RoomStatus.Cancelled;
        } else if (results[roomId].reported) {
            room.status = ChessEscrow.RoomStatus.Settled;
        }
    }

    function signalGameStarted(uint256 roomId) external {
        if (msg.sender != relaySigner) revert Unauthorized();
        _running(roomId);
        rooms[roomId].gameStarted = true;
        rooms[roomId].gameStartedAt = block.timestamp;
    }

    function reportResult(Result calldata r, bytes calldata signature) external {
        Tournament storage t = _running(r.matchId);
        MatchResult storage result = results[r.matchId];
        if (
            result.reported || block.timestamp > r.deadline || block.timestamp + t.reviewSeconds >= t.completionDeadline
        ) revert NotReady();
        _checkWinner(r.matchId, r.outcome, r.winner);
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RESULT_TYPEHASH, r)));
        if (ECDSA.recover(digest, signature) != relaySigner) revert Unauthorized();
        result.outcome = r.outcome;
        result.movesHash = r.movesHash;
        result.reported = true;
        t.reviewUntil = uint64(block.timestamp) + t.reviewSeconds;
        emit ResultReported(r.matchId, r.outcome, r.movesHash);
    }

    /// @notice Trusted reviewer can adjudicate a forfeit/server failure without a relay report.
    /// Decision hash and event are required; this is not a trustless anti-cheat verdict.
    function review(uint256 roomId, uint8 outcome, bytes32 decisionHash) external {
        Tournament storage t = _running(roomId);
        if (msg.sender != t.reviewer) revert Unauthorized();
        if (outcome > 2 || decisionHash == bytes32(0) || block.timestamp + t.reviewSeconds >= t.completionDeadline) {
            revert InvalidInput();
        }
        MatchResult storage r = results[roomId];
        if (r.approved) revert NotReady();
        r.outcome = outcome;
        r.reported = true;
        r.approved = true;
        r.decisionHash = decisionHash;
        t.reviewUntil = uint64(block.timestamp) + t.reviewSeconds;
        emit Reviewed(roomId, outcome, decisionHash);
    }

    function appeal(uint256 roomId, bytes32 evidenceHash) external {
        Tournament storage t = _running(roomId);
        MatchResult storage r = results[roomId];
        if (!registered[r.tournamentId][msg.sender]) revert Unauthorized();
        if (
            !r.reported || block.timestamp >= t.reviewUntil || appealUsed[roomId][msg.sender]
                || evidenceHash == bytes32(0)
        ) revert NotReady();
        appealUsed[roomId][msg.sender] = true;
        appealOpen[roomId][msg.sender] = true;
        t.openAppeals++;
        emit Appealed(roomId, msg.sender, evidenceHash);
    }

    function resolveAppeal(uint256 roomId, address player, uint8 outcome, bytes32 decisionHash) external {
        Tournament storage t = _running(roomId);
        if (msg.sender != t.reviewer) revert Unauthorized();
        if (!appealOpen[roomId][player] || outcome > 2 || decisionHash == bytes32(0)) revert InvalidInput();
        appealOpen[roomId][player] = false;
        t.openAppeals--;
        MatchResult storage r = results[roomId];
        r.outcome = outcome;
        r.approved = true;
        r.decisionHash = decisionHash;
        // Give other entrants a fresh window to challenge an amended ruling.
        t.reviewUntil = uint64(block.timestamp) + t.reviewSeconds;
        if (t.reviewUntil >= t.completionDeadline) revert NotReady();
        emit AppealResolved(roomId, player, decisionHash);
        emit Reviewed(roomId, outcome, decisionHash);
    }

    function standings(uint256 id) public view returns (address[] memory players, uint256[] memory points) {
        players = entrants[id];
        points = new uint256[](players.length);
        for (uint256 m; m < matchIds[id].length; m++) {
            uint256 roomId = matchIds[id][m];
            MatchResult storage r = results[roomId];
            if (!r.approved) continue;
            ChessEscrow.Room storage room = rooms[roomId];
            address white = room.creatorIsWhite ? room.playerA : room.playerB;
            for (uint256 p; p < players.length; p++) {
                if (players[p] != room.playerA && players[p] != room.playerB) continue;
                if (r.outcome == 2) {
                    points[p]++;
                } else if ((r.outcome == 0 && players[p] == white) || (r.outcome == 1 && players[p] != white)) {
                    points[p] += 2;
                }
            }
        }
    }

    function finalize(uint256 id) external {
        Tournament storage t = _t(id);
        if (t.phase != Phase.Running || !_ready(id)) revert NotReady();
        (address[] memory players, uint256[] memory points) = standings(id);
        uint256[] memory amounts = new uint256[](players.length);
        for (uint256 p; p < players.length; p++) {
            uint256 rank;
            uint256 ties;
            for (uint256 q; q < players.length; q++) {
                if (points[q] > points[p]) rank++;
                if (points[q] == points[p]) ties++;
            }
            uint256 bps;
            for (uint256 k = rank; k < rank + ties; k++) {
                bps += _prizeBps(k, players.length);
            }
            amounts[p] = t.funded * bps / 10000 / ties;
            awards[id][players[p]] = amounts[p];
        }
        t.phase = Phase.Finalized;
        t.claimUntil = uint64(block.timestamp + 30 days);
        emit Finalized(id, t.claimUntil, keccak256(abi.encode(block.chainid, address(this), id, players, amounts)));
    }

    function claim(uint256 id) external nonReentrant {
        Tournament storage t = _t(id);
        if (
            t.phase != Phase.Finalized || block.timestamp >= t.claimUntil || claimed[id][msg.sender]
                || awards[id][msg.sender] == 0
        ) revert NotReady();
        claimed[id][msg.sender] = true;
        uint256 amount = awards[id][msg.sender];
        t.paid += amount;
        _send(msg.sender, amount);
        emit Claimed(id, msg.sender, amount);
    }

    function requestCancellation(uint256 id) external {
        Tournament storage t = _t(id);
        if (msg.sender != t.organizer) revert Unauthorized();
        if (t.phase == Phase.Registration) {
            _cancel(id);
            return;
        }
        if (t.phase != Phase.Running) revert WrongPhase();
        t.cancellationRequested = true;
        emit CancellationRequested(id);
    }

    function approveCancellation(uint256 id) external {
        Tournament storage t = _t(id);
        if (msg.sender != t.reviewer) revert Unauthorized();
        if (t.phase != Phase.Running || !t.cancellationRequested || _ready(id)) revert NotReady();
        _cancel(id);
    }

    function cancelExpired(uint256 id) external {
        Tournament storage t = _t(id);
        if (t.phase == Phase.Registration) {
            if (block.timestamp < t.registrationEnds) revert NotReady();
        } else if (t.phase == Phase.Running) {
            if (block.timestamp < t.completionDeadline || _ready(id)) revert NotReady();
        } else {
            revert WrongPhase();
        }
        _cancel(id);
    }

    function refund(uint256 id) external nonReentrant {
        Tournament storage t = _t(id);
        if (refunded[id][msg.sender] || contributions[id][msg.sender] == 0) revert NotReady();
        uint256 amount;
        if (t.phase == Phase.Cancelled) {
            amount = contributions[id][msg.sender];
        } else if (t.phase == Phase.Finalized && block.timestamp >= t.claimUntil) {
            if (t.remainder == 0) t.remainder = t.funded - t.paid;
            amount = t.remainder * contributions[id][msg.sender] / t.funded;
        } else {
            revert WrongPhase();
        }
        refunded[id][msg.sender] = true;
        _send(msg.sender, amount);
        emit Refunded(id, msg.sender, amount);
    }

    function _t(uint256 id) private view returns (Tournament storage t) {
        if (id >= nextTournamentId) revert InvalidInput();
        return tournaments[id];
    }

    function _running(uint256 roomId) private view returns (Tournament storage t) {
        if (roomId >= nextRoomId) revert InvalidInput();
        t = tournaments[results[roomId].tournamentId];
        if (t.phase != Phase.Running || block.timestamp >= t.completionDeadline) revert WrongPhase();
    }

    function _ready(uint256 id) private view returns (bool) {
        Tournament storage t = tournaments[id];
        if (t.openAppeals != 0 || t.reviewUntil == 0 || block.timestamp < t.reviewUntil) return false;
        for (uint256 i; i < matchIds[id].length; i++) {
            if (!results[matchIds[id][i]].approved) return false;
        }
        return true;
    }

    function _checkWinner(uint256 roomId, uint8 outcome, address winner) private view {
        ChessEscrow.Room storage room = rooms[roomId];
        address white = room.creatorIsWhite ? room.playerA : room.playerB;
        address black = room.creatorIsWhite ? room.playerB : room.playerA;
        if (outcome > 2 || winner != (outcome == 2 ? address(0) : outcome == 0 ? white : black)) revert InvalidInput();
    }

    function _prizeBps(uint256 rank, uint256 count) private pure returns (uint256) {
        if (count == 2) return rank == 0 ? 7000 : rank == 1 ? 3000 : 0;
        return rank == 0 ? 6000 : rank == 1 ? 3000 : rank == 2 ? 1000 : 0;
    }

    function _cancel(uint256 id) private {
        tournaments[id].phase = Phase.Cancelled;
        emit Cancelled(id);
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }
}
