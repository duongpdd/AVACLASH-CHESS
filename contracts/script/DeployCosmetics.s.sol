// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { AvaClashCosmetics } from "../src/AvaClashCosmetics.sol";
import { CosmeticAuction } from "../src/CosmeticAuction.sol";

contract DeployCosmetics is Script {
    function run() external {
        address pool = vm.envAddress("TOURNAMENT_ADDRESS");
        address owner = vm.envAddress("COSMETICS_OWNER_ADDRESS");
        bool local = block.chainid == 31337;
        vm.startBroadcast();
        AvaClashCosmetics skins = new AvaClashCosmetics(pool, owner);
        CosmeticAuction auction = new CosmeticAuction(
            address(skins),
            local ? 60 seconds : 1 hours,
            7 days,
            local ? 15 seconds : 10 minutes,
            local ? 60 seconds : 24 hours
        );
        vm.stopBroadcast();
        console.log("NEXT_PUBLIC_COSMETICS_ADDRESS=%s", address(skins));
        console.log("NEXT_PUBLIC_AUCTION_ADDRESS=%s", address(auction));
    }
}
