// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { AvaClashCosmetics } from "../src/AvaClashCosmetics.sol";

contract DeployCosmetics is Script {
    function run() external {
        address pool = vm.envAddress("TOURNAMENT_ADDRESS");
        address owner = vm.envAddress("COSMETICS_OWNER_ADDRESS");
        vm.startBroadcast();
        AvaClashCosmetics skins = new AvaClashCosmetics(pool, owner);
        vm.stopBroadcast();
        console.log("NEXT_PUBLIC_COSMETICS_ADDRESS=%s", address(skins));
    }
}
