// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ChessEscrow } from "../../src/ChessEscrow.sol";
import { ChessEscrowHandler } from "./ChessEscrowHandler.sol";

/**
 * @title ChessEscrowInvariantTest
 * @notice Invariant test verifying that ChessEscrow strictly conserves all funds.
 *
 * Invariant:
 *   address(escrow).balance == totalPendingWithdrawals + protocolFees + totalActiveStakesAndBonds
 *
 * How to run:
 *   forge test --match-contract ChessEscrowInvariantTest
 */
contract ChessEscrowInvariantTest is Test {
    ChessEscrow public escrow;
    ChessEscrowHandler public handler;

    function setUp() public {
        address relay = makeAddr("relay");
        address arbiter = makeAddr("arbiter");
        address treasury = makeAddr("treasury");

        escrow = new ChessEscrow(relay, arbiter, treasury);
        escrow.setSingleSignedEnabled(true);

        handler = new ChessEscrowHandler(escrow);

        // Target handler for invariant fuzzing
        targetContract(address(handler));
    }

    /**
     * @notice Invariant: Solvency and fund conservation.
     *         At all times and after any valid random sequences:
     *         address(escrow).balance == sum(pendingWithdrawals) + protocolFees + active room stakes & bonds
     */
    function invariant_solvencyConservation() public view {
        uint256 totalPending = 0;
        for (uint256 i = 0; i < handler.actorsCount(); i++) {
            totalPending += escrow.pendingWithdrawals(handler.getActor(i));
        }
        totalPending += escrow.pendingWithdrawals(escrow.treasury());
        totalPending += escrow.pendingWithdrawals(escrow.arbiter());
        totalPending += escrow.pendingWithdrawals(escrow.relaySigner());

        uint256 fees = escrow.protocolFees();

        uint256 activeStakesAndBonds = 0;
        uint256 nextId = escrow.nextRoomId();
        for (uint256 id = 0; id < nextId; id++) {
            ChessEscrow.Room memory r = escrow.getRoom(id);
            if (r.status == ChessEscrow.RoomStatus.Open) {
                activeStakesAndBonds += r.stake;
            } else if (r.status == ChessEscrow.RoomStatus.Active) {
                activeStakesAndBonds += (r.stake * 2) + r.singleSignedBond;
            } else if (r.status == ChessEscrow.RoomStatus.Challenged) {
                activeStakesAndBonds += (r.stake * 2) + r.singleSignedBond + r.challengeBond;
            }
        }

        uint256 expectedBalance = totalPending + fees + activeStakesAndBonds;
        assertEq(
            address(escrow).balance,
            expectedBalance,
            "Invariant failed: escrow.balance != sum(pendingWithdrawals) + protocolFees + activeStakesAndBonds"
        );
    }
}
