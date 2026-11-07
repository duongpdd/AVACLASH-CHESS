// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { TournamentPrizePool } from "../src/TournamentPrizePool.sol";

contract DeployTournament is Script {
    function run() external {
        address signer = vm.envAddress("RELAY_SIGNER_ADDRESS");
        vm.startBroadcast();
        TournamentPrizePool pool = new TournamentPrizePool(signer);
        vm.stopBroadcast();
        console.log("TournamentPrizePool deployed at:", address(pool));
    }
}
