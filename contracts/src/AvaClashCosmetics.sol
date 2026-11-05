// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { TournamentPrizePool } from "./TournamentPrizePool.sol";

contract AvaClashCosmetics is ERC721Enumerable, Ownable {
    enum Kind {
        Board,
        Pieces
    }

    struct Theme {
        uint24 light;
        uint24 dark;
        uint24 lastLight;
        uint24 lastDark;
        uint24 whiteFill;
        uint24 whiteStroke;
        uint8 whiteWidth;
        uint24 blackFill;
        uint24 blackStroke;
        uint8 blackWidth;
        bool shadow;
    }

    struct Item {
        Kind kind;
        Theme theme;
        string name;
        uint256 tournamentId;
        uint32 serial;
        address firstOwner;
    }

    struct Official {
        bool exists;
        Kind kind;
        Theme theme;
        string name;
    }

    TournamentPrizePool public immutable pool;
    uint256 public nextTokenId = 1; // Zero represents an empty equipment slot.
    mapping(uint256 => Official) private officials;
    mapping(uint256 => Item) private items;
    mapping(uint256 => uint32) public minted;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256) public equippedBoard;
    mapping(address => uint256) public equippedPieces;

    error InvalidInput();
    error NotEligible();
    error NotTokenOwner();

    event OfficialSet(uint256 indexed tournamentId, Kind kind, string name);
    event TrophyClaimed(uint256 indexed tournamentId, address indexed winner, uint256 indexed tokenId, uint32 serial);
    event Equipped(address indexed player, Kind indexed kind, uint256 tokenId);

    constructor(address tournamentPool, address initialOwner)
        ERC721("AvaClash Cosmetics", "AVASKIN")
        Ownable(initialOwner)
    {
        if (block.chainid != 31337 && block.chainid != 43113) {
            revert InvalidInput();
        }
        if (tournamentPool == address(0)) revert InvalidInput();
        pool = TournamentPrizePool(tournamentPool);
    }

    function setOfficial(uint256 tournamentId, Kind kind, Theme calldata theme, string calldata name_)
        external
        onlyOwner
    {
        TournamentPrizePool.Tournament memory tournament = pool.getTournament(tournamentId);
        if (
            officials[tournamentId].exists
                || (tournament.phase != TournamentPrizePool.Phase.Registration
                    && tournament.phase != TournamentPrizePool.Phase.Running) || tournament.reviewUntil != 0
        ) revert InvalidInput();
        _validate(kind, theme, name_);
        officials[tournamentId] = Official(true, kind, theme, name_);
        emit OfficialSet(tournamentId, kind, name_);
    }

    function getOfficial(uint256 tournamentId) external view returns (Official memory) {
        return officials[tournamentId];
    }

    function getItem(uint256 tokenId) external view returns (Item memory) {
        _requireOwned(tokenId);
        return items[tokenId];
    }

    function canClaim(uint256 tournamentId, address player) public view returns (bool) {
        if (!officials[tournamentId].exists || claimed[tournamentId][player]) return false;
        if (pool.getTournament(tournamentId).phase != TournamentPrizePool.Phase.Finalized) return false;

        (address[] memory players, uint256[] memory points) = pool.standings(tournamentId);
        uint256 best;
        uint256 playerPoints;
        bool entered;
        for (uint256 i; i < players.length; ++i) {
            if (points[i] > best) best = points[i];
            if (players[i] == player) {
                entered = true;
                playerPoints = points[i];
            }
        }
        return entered && playerPoints == best;
    }

    function claimTrophy(uint256 tournamentId) external returns (uint256 tokenId) {
        if (!canClaim(tournamentId, msg.sender)) revert NotEligible();
        claimed[tournamentId][msg.sender] = true;
        uint32 serial = ++minted[tournamentId];
        tokenId = nextTokenId++;
        Official storage official = officials[tournamentId];
        items[tokenId] = Item(official.kind, official.theme, official.name, tournamentId, serial, msg.sender);
        _mint(msg.sender, tokenId);
        emit TrophyClaimed(tournamentId, msg.sender, tokenId, serial);
    }

    function equip(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _equip(msg.sender, items[tokenId].kind, tokenId);
    }

    function unequip(Kind kind) external {
        _equip(msg.sender, kind, 0);
    }

    function equippedIds(address player) public view returns (uint256 boardId, uint256 piecesId) {
        boardId = equippedBoard[player];
        piecesId = equippedPieces[player];
        if (player == address(0) || _ownerOf(boardId) != player) boardId = 0;
        if (player == address(0) || _ownerOf(piecesId) != player) piecesId = 0;
    }

    function equippedOf(address player)
        external
        view
        returns (bool hasBoard, Theme memory board, bool hasPieces, Theme memory pieces)
    {
        (uint256 boardId, uint256 piecesId) = equippedIds(player);
        return (boardId != 0, items[boardId].theme, piecesId != 0, items[piecesId].theme);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && from != to) {
            Kind kind = items[tokenId].kind;
            uint256 equipped = kind == Kind.Board ? equippedBoard[from] : equippedPieces[from];
            if (equipped == tokenId) _equip(from, kind, 0);
        }
    }

    function _equip(address player, Kind kind, uint256 tokenId) private {
        if (kind == Kind.Board) equippedBoard[player] = tokenId;
        else equippedPieces[player] = tokenId;
        emit Equipped(player, kind, tokenId);
    }

    function _validate(Kind kind, Theme calldata t, string calldata name_) private pure {
        _validateName(bytes(name_));
        if (t.whiteWidth > 6 || t.blackWidth > 6) revert InvalidInput();

        if (kind == Kind.Board) {
            if (
                t.whiteFill != 0 || t.whiteStroke != 0 || t.whiteWidth != 0 || t.blackFill != 0 || t.blackStroke != 0
                    || t.blackWidth != 0 || t.shadow
            ) revert InvalidInput();
        } else if (t.light != 0 || t.dark != 0 || t.lastLight != 0 || t.lastDark != 0) {
            revert InvalidInput();
        }
    }

    function _validateName(bytes calldata raw) private pure {
        if (raw.length == 0 || raw.length > 40) revert InvalidInput();
        for (uint256 i; i < raw.length;) {
            bytes1 c = raw[i];
            if (c < 0x80) {
                if (c < 0x20 || c == '"' || c == "\\" || c == "<" || c == ">" || c == "&") revert InvalidInput();
                ++i;
                continue;
            }
            // Reject truncated UTF-8, overlong encodings, surrogate halves and
            // values above U+10FFFF before embedding the name in JSON.
            uint256 width = c < 0xe0 ? 2 : c < 0xf0 ? 3 : 4;
            if (c < 0xc2 || c > 0xf4 || i + width > raw.length) revert InvalidInput();
            bytes1 second = raw[i + 1];
            if (
                (c == 0xe0 && second < 0xa0) || (c == 0xed && second >= 0xa0) || (c == 0xf0 && second < 0x90)
                    || (c == 0xf4 && second >= 0x90)
            ) revert InvalidInput();
            for (uint256 j = 1; j < width; ++j) {
                if (raw[i + j] < 0x80 || raw[i + j] > 0xbf) revert InvalidInput();
            }
            i += width;
        }
    }

    function _hex(uint24 value) private pure returns (string memory) {
        bytes memory hexValue = bytes(Strings.toHexString(value, 3));
        return string(abi.encodePacked("#", bytes6(bytes8(hexValue) << 16)));
    }

    function _colorAttribute(string memory label, uint24 value) private pure returns (string memory) {
        return string.concat(',{"trait_type":"', label, '","value":"', _hex(value), '"}');
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Item storage item = items[tokenId];
        Theme storage t = item.theme;
        bool board = item.kind == Kind.Board;
        string memory colors = board
            ? string.concat(
                _colorAttribute("Light", t.light),
                _colorAttribute("Dark", t.dark),
                _colorAttribute("Last light", t.lastLight),
                _colorAttribute("Last dark", t.lastDark)
            )
            : string.concat(
                _colorAttribute("White fill", t.whiteFill),
                _colorAttribute("White stroke", t.whiteStroke),
                _colorAttribute("Black fill", t.blackFill),
                _colorAttribute("Black stroke", t.blackStroke)
            );
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(
                bytes(
                    string.concat(
                        '{"name":"',
                        item.name,
                        '","image":"data:image/svg+xml;base64,',
                        _image(t, board),
                        '","attributes":[{"trait_type":"Kind","value":"',
                        board ? "Board" : "Pieces",
                        '"},{"trait_type":"Serial","value":',
                        Strings.toString(item.serial),
                        '},{"trait_type":"Tournament","value":',
                        Strings.toString(item.tournamentId),
                        "}",
                        colors,
                        "]}"
                    )
                )
            )
        );
    }

    function _image(Theme storage t, bool board) private view returns (string memory) {
        return Base64.encode(
            bytes(
                string.concat(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">',
                    '<path d="M0 0h80v80H0z" fill="',
                    _hex(board ? t.light : 0xead9b5),
                    '"/><path d="M40 0h40v40H40zM0 40h40v40H0z" fill="',
                    _hex(board ? t.dark : 0xb58863),
                    '"/><text x="40" y="57" text-anchor="middle" font-size="56" paint-order="stroke" fill="',
                    _hex(board ? 0xfffbeb : t.whiteFill),
                    '" stroke="',
                    _hex(board ? 0x0f172a : t.whiteStroke),
                    '" stroke-width="',
                    Strings.toString(board ? 4 : t.whiteWidth),
                    '">&#9822;</text></svg>'
                )
            )
        );
    }
}
