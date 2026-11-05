// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { Bytes } from "@openzeppelin/contracts/utils/Bytes.sol";
import { CosmeticsFixture, Skins, Pool } from "./CosmeticsFixture.sol";

contract AvaClashCosmeticsTest is CosmeticsFixture {
    using Bytes for bytes;

    function testWinnerCanClaimOnceEvenWithZeroAward() public {
        uint256 token = _mintBoard(WHITE);
        assertEq(pool.awards(0, WHITE), 0);
        assertEq(skins.ownerOf(token), WHITE);
        assertEq(skins.getItem(token).firstOwner, WHITE);
        assertEq(skins.getItem(token).serial, 1);
        vm.prank(WHITE);
        vm.expectRevert(Skins.NotEligible.selector);
        skins.claimTrophy(0);
        vm.prank(BLACK);
        vm.expectRevert(Skins.NotEligible.selector);
        skins.claimTrophy(0);
    }

    function testTiedChampionsClaimDistinctSerials() public {
        uint256 id = _create();
        skins.setOfficial(id, Skins.Kind.Board, _board(), "Draw");
        _start(id, WHITE);
        _review(id, 2);
        _finalize(id);
        vm.prank(WHITE);
        uint256 first = skins.claimTrophy(id);
        vm.prank(BLACK);
        uint256 second = skins.claimTrophy(id);
        assertEq(skins.getItem(first).serial, 1);
        assertEq(skins.getItem(second).serial, 2);
        assertEq(skins.tokenOfOwnerByIndex(BLACK, 0), second);
    }

    function testClaimsRejectUnofficialUnfinishedAndCancelled() public {
        uint256 unofficial = _create();
        _start(unofficial, WHITE);
        _review(unofficial, 0);
        _finalize(unofficial);
        vm.prank(WHITE);
        vm.expectRevert(Skins.NotEligible.selector);
        skins.claimTrophy(unofficial);

        uint256 id = _create();
        skins.setOfficial(id, Skins.Kind.Board, _board(), "Cup");
        _start(id, WHITE);
        vm.prank(WHITE);
        vm.expectRevert(Skins.NotEligible.selector);
        skins.claimTrophy(id);
        pool.requestCancellation(id);
        vm.prank(REVIEWER);
        pool.approveCancellation(id);
        vm.prank(WHITE);
        vm.expectRevert(Skins.NotEligible.selector);
        skins.claimTrophy(id);
    }

    function testOfficialRequiresOwnerAndValidTiming() public {
        uint256 id = _create();
        vm.prank(WHITE);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, WHITE));
        skins.setOfficial(id, Skins.Kind.Board, _board(), "Cup");
        vm.expectRevert(Pool.InvalidInput.selector);
        skins.setOfficial(id + 1, Skins.Kind.Board, _board(), "Cup");
        _start(id, WHITE);
        skins.setOfficial(id, Skins.Kind.Board, _board(), "Cup");
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Board, _board(), "Cup");

        uint256 late = _create();
        _start(late, WHITE);
        _review(late, 0);
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(late, Skins.Kind.Board, _board(), "Cup");
        _finalize(late);
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(late, Skins.Kind.Board, _board(), "Cup");
    }

    function testRejectsBadNameAndMixedTheme() public {
        uint256 id = _create();
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Board, _board(), "bad\nname");
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Board, _board(), "bad&name");
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Board, _board(), string(abi.encodePacked(hex"c0af")));
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Board, _board(), "12345678901234567890123456789012345678901");
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Pieces, _board(), "Cup");
        Skins.Theme memory t = _board();
        t.shadow = true;
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Board, t, "Cup");
        delete t;
        t.blackWidth = 7;
        vm.expectRevert(Skins.InvalidInput.selector);
        skins.setOfficial(id, Skins.Kind.Pieces, t, "Cup");
    }

    function testEquipmentClearedOnTransferAndCanUnequip() public {
        uint256 token = _mintBoard(WHITE);
        vm.prank(BLACK);
        vm.expectRevert(Skins.NotTokenOwner.selector);
        skins.equip(token);
        vm.startPrank(WHITE);
        skins.equip(token);
        (bool equipped, Skins.Theme memory board,,) = skins.equippedOf(WHITE);
        assertTrue(equipped);
        assertEq(board.dark, _board().dark);
        skins.transferFrom(WHITE, BLACK, token);
        vm.stopPrank();
        (equipped,,,) = skins.equippedOf(WHITE);
        assertFalse(equipped);
        vm.startPrank(BLACK);
        skins.equip(token);
        skins.unequip(Skins.Kind.Board);
        vm.stopPrank();
        (equipped,,,) = skins.equippedOf(BLACK);
        assertFalse(equipped);
    }

    function testTokenUriContainsMetadata() public {
        string memory uri = skins.tokenURI(_mintBoard(WHITE));
        assertEq(string(bytes(uri).slice(0, 29)), "data:application/json;base64,");
        string memory json = string(Base64.decode(string(bytes(uri).slice(29))));
        assertEq(vm.parseJsonString(json, ".name"), "Blue Cup");
        assertEq(vm.parseJsonString(json, ".attributes[3].value"), "#ead9b5");
        string memory image = vm.parseJsonString(json, ".image");
        assertEq(string(bytes(image).slice(0, 26)), "data:image/svg+xml;base64,");
    }

    function testRejectsMainnet() public {
        vm.chainId(1);
        vm.expectRevert(Skins.InvalidInput.selector);
        new Skins(address(pool), address(this));
    }
}
