// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TournamentPrizePool as Pool } from "../src/TournamentPrizePool.sol";
import { AvaClashCosmetics as Skins } from "../src/AvaClashCosmetics.sol";

abstract contract CosmeticsFixture is Test {
    Pool internal pool;
    Skins internal skins;
    address internal constant REVIEWER = address(20);
    address internal constant WHITE = address(100);
    address internal constant BLACK = address(101);

    function setUp() public virtual {
        vm.chainId(31337);
        pool = new Pool(address(22));
        skins = new Skins(address(pool), address(this));
    }

    function _create() internal returns (uint256) {
        return pool.createTournament(
            "Campus Cup",
            "5+0 round robin",
            2,
            REVIEWER,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 3 days),
            1 hours
        );
    }

    function _board() internal pure returns (Skins.Theme memory t) {
        t.light = 0xead9b5;
        t.dark = 0x426879;
        t.lastLight = 0xf7ec59;
        t.lastDark = 0xdac331;
    }

    function _start(uint256 id, address white) internal {
        pool.fund{ value: 1 wei }(id);
        vm.prank(white);
        pool.register(id);
        vm.prank(BLACK);
        pool.register(id);
        pool.start(id);
    }

    function _review(uint256 id, uint8 outcome) internal {
        uint256 room = pool.getMatches(id)[0];
        vm.prank(REVIEWER);
        pool.review(room, outcome, keccak256("reviewed replay"));
    }

    function _finalize(uint256 id) internal {
        vm.warp(pool.getTournament(id).reviewUntil);
        pool.finalize(id);
    }

    function _mintBoard(address player) internal returns (uint256) {
        uint256 id = _create();
        skins.setOfficial(id, Skins.Kind.Board, _board(), "Blue Cup");
        _start(id, player);
        _review(id, 0);
        _finalize(id);
        vm.prank(player);
        return skins.claimTrophy(id);
    }
}
