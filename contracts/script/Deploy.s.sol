// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { ChessEscrow } from "../src/ChessEscrow.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ChessEscrow escrow = new ChessEscrow();
        console.log("ChessEscrow deployed at:", address(escrow));
        console.log("Domain separator:", vm.toString(escrow.getDomainSeparator()));

        vm.stopBroadcast();
    }
}
