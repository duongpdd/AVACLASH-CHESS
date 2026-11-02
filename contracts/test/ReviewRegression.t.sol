// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ChessEscrow } from "../src/ChessEscrow.sol";
import { AvaClashMeta } from "../src/AvaClashMeta.sol";

contract ReviewRegressionTest is Test {
    ChessEscrow escrow;
    AvaClashMeta meta;
    address relay = makeAddr("relay");
    address arbiter = makeAddr("arbiter");

    function setUp() public {
        escrow = new ChessEscrow(relay, arbiter, makeAddr("treasury"));
        meta = new AvaClashMeta();
    }

    function test_MetaBindingCannotRedirectExistingPredictions() public {
        meta.setEscrowContract(address(escrow));
        vm.expectRevert(AvaClashMeta.EscrowAlreadyConfigured.selector);
        meta.setEscrowContract(address(this));
        assertEq(meta.escrowContract(), address(escrow));
    }

    function test_MetaBindingRejectsZeroAndExternallyOwnedAccounts() public {
        vm.expectRevert(AvaClashMeta.InvalidEscrow.selector);
        meta.setEscrowContract(address(0));
        vm.expectRevert(AvaClashMeta.InvalidEscrow.selector);
        meta.setEscrowContract(relay);
    }

    function test_RoleProposalsPreserveSeparation() public {
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        escrow.proposeRelaySigner(arbiter);
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        escrow.proposeArbiter(relay);
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        escrow.proposeRelaySigner(address(0));
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        escrow.proposeArbiter(address(0));
    }

    function test_ConcurrentRotationsCannotMergeRoles() public {
        address nextRole = makeAddr("nextRole");
        escrow.proposeRelaySigner(nextRole);
        escrow.proposeArbiter(nextRole);
        vm.warp(block.timestamp + 2 days);
        escrow.executeRelaySignerChange();
        vm.expectRevert(ChessEscrow.InvalidAddress.selector);
        escrow.executeArbiterChange();
        assertTrue(escrow.relaySigner() != escrow.arbiter());
    }
}
