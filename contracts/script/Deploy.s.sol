// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { ChessEscrow } from "../src/ChessEscrow.sol";
import { AvaClashMeta } from "../src/AvaClashMeta.sol";

contract DeployScript is Script {
    function run() external {
        require(block.chainid == 31337 || block.chainid == 43113, "Only Anvil or Fuji testnet is supported");
        address relaySigner = vm.envAddress("RELAY_SIGNER_ADDRESS");
        address arbiter = vm.envAddress("ARBITER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        if (relaySigner == address(0)) revert("RELAY_SIGNER_ADDRESS required and cannot be zero");
        if (arbiter == address(0)) revert("ARBITER_ADDRESS required and cannot be zero");
        if (treasury == address(0)) revert("TREASURY_ADDRESS required and cannot be zero");

        if (relaySigner == arbiter || relaySigner == treasury || arbiter == treasury) {
            revert("RELAY_SIGNER_ADDRESS, ARBITER_ADDRESS, and TREASURY_ADDRESS must be distinct");
        }

        vm.startBroadcast();

        // 1. Deploy AvaClashMeta
        AvaClashMeta meta = new AvaClashMeta();
        console.log("AvaClashMeta deployed at:", address(meta));

        // 2. Deploy ChessEscrow
        ChessEscrow escrow = new ChessEscrow(relaySigner, arbiter, treasury);
        console.log("ChessEscrow deployed at:", address(escrow));
        console.log("Domain separator:", vm.toString(escrow.getDomainSeparator()));

        // 3. Bidirectional linking
        meta.setEscrowContract(address(escrow));
        console.log("AvaClashMeta.setEscrowContract linked to:", address(escrow));

        escrow.setMetaContract(address(meta));
        console.log("ChessEscrow.setMetaContract linked to:", address(meta));

        vm.stopBroadcast();
    }
}
