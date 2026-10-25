// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { ChessEscrow } from "../src/ChessEscrow.sol";
import { AvaClashMeta } from "../src/AvaClashMeta.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Optional custom relay signer and treasury, defaulting to deployer address
        address relaySigner = vm.envOr("RELAY_SIGNER_ADDRESS", deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy AvaClashMeta
        AvaClashMeta meta = new AvaClashMeta();
        console.log("AvaClashMeta deployed at:", address(meta));

        // 2. Deploy ChessEscrow
        ChessEscrow escrow = new ChessEscrow(relaySigner, treasury);
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
