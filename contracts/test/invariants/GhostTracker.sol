// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { console } from "forge-std/Test.sol";

/**
 * @title GhostTracker
 * @notice Persistent counter tracking successful executions of every invariant handler action.
 *         Marked persistent across fuzzing runs so counters accurately reflect total coverage
 *         across the entire invariant test suite (128,000 calls).
 */
contract GhostTracker {
    uint256 public totalCalls;

    uint256 public ghost_createRoom;
    uint256 public ghost_joinRoom;
    uint256 public ghost_cancelRoom;
    uint256 public ghost_abortRoom;
    uint256 public ghost_signalGameStarted;
    uint256 public ghost_submitResultDual;
    uint256 public ghost_submitResultRelay;
    uint256 public ghost_submitSingleSigned;
    uint256 public ghost_challenge;
    uint256 public ghost_resolveChallenge;
    uint256 public ghost_resolveDefaultChallenge;
    uint256 public ghost_finalizeSingleSigned;
    uint256 public ghost_refundOnTimeout;
    uint256 public ghost_withdraw;
    uint256 public ghost_withdrawProtocolFees;
    uint256 public ghost_pause;
    uint256 public ghost_unpause;
    uint256 public ghost_setSingleSignedEnabled;
    uint256 public ghost_invariantChallengedSampled;
    uint256 public ghost_nonExistentRoomRevert;

    function incCall() external {
        totalCalls++;
    }

    function inc_createRoom() external { ghost_createRoom++; }
    function inc_joinRoom() external { ghost_joinRoom++; }
    function inc_cancelRoom() external { ghost_cancelRoom++; }
    function inc_abortRoom() external { ghost_abortRoom++; }
    function inc_signalGameStarted() external { ghost_signalGameStarted++; }
    function inc_submitResultDual() external { ghost_submitResultDual++; }
    function inc_submitResultRelay() external { ghost_submitResultRelay++; }
    function inc_submitSingleSigned() external { ghost_submitSingleSigned++; }
    function inc_challenge() external { ghost_challenge++; }
    function inc_resolveChallenge() external { ghost_resolveChallenge++; }
    function inc_resolveDefaultChallenge() external { ghost_resolveDefaultChallenge++; }
    function inc_finalizeSingleSigned() external { ghost_finalizeSingleSigned++; }
    function inc_refundOnTimeout() external { ghost_refundOnTimeout++; }
    function inc_withdraw() external { ghost_withdraw++; }
    function inc_withdrawProtocolFees() external { ghost_withdrawProtocolFees++; }
    function inc_pause() external { ghost_pause++; }
    function inc_unpause() external { ghost_unpause++; }
    function inc_setSingleSignedEnabled() external { ghost_setSingleSignedEnabled++; }
    function inc_invariantChallengedSampled() external { ghost_invariantChallengedSampled++; }
    function inc_nonExistentRoomRevert() external { ghost_nonExistentRoomRevert++; }

    function printSummary() external view {
        console.log("================================================================================");
        console.log("                CHESS ESCROW INVARIANT GHOST COUNTERS SUMMARY                   ");
        console.log("================================================================================");
        console.log("Total Invariant Calls Executed :", totalCalls);
        console.log("--------------------------------------------------------------------------------");
        console.log("createRoom                     :", ghost_createRoom);
        console.log("joinRoom                       :", ghost_joinRoom);
        console.log("signalGameStarted              :", ghost_signalGameStarted);
        console.log("cancelRoom                     :", ghost_cancelRoom);
        console.log("abortRoom                      :", ghost_abortRoom);
        console.log("submitResult (Dual Player Sigs):", ghost_submitResultDual);
        console.log("submitResult (Player + Relay)  :", ghost_submitResultRelay);
        console.log("submitSingleSigned (Bond Sub)  :", ghost_submitSingleSigned);
        console.log("challenge (Bond Challenge)     :", ghost_challenge);
        console.log("resolveChallenge (Arbiter Bond):", ghost_resolveChallenge);
        console.log("resolveDefaultChallenge (Bond) :", ghost_resolveDefaultChallenge);
        console.log("finalizeSingleSigned (Bond Payout):", ghost_finalizeSingleSigned);
        console.log("refundOnTimeout                :", ghost_refundOnTimeout);
        console.log("withdraw (Pull Payment)        :", ghost_withdraw);
        console.log("withdrawProtocolFees           :", ghost_withdrawProtocolFees);
        console.log("pause                          :", ghost_pause);
        console.log("unpause                        :", ghost_unpause);
        console.log("setSingleSignedEnabled         :", ghost_setSingleSignedEnabled);
        console.log("invariant (Challenged sampled) :", ghost_invariantChallengedSampled);
        console.log("nonExistentRoomRevert          :", ghost_nonExistentRoomRevert);
        console.log("================================================================================");
    }
}
