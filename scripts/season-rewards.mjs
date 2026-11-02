#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "web/package.json"));
const {
  isAddress,
  encodeAbiParameters,
  keccak256,
  concatHex,
  toHex,
} = require("viem");
export function makeRewards(input) {
  const { chainId, metaAddress, seasonId } = input;
  if (
    ![31337, 43113].includes(chainId) ||
    !isAddress(metaAddress) ||
    /^0x0{40}$/i.test(metaAddress) ||
    !/^\d+$/.test(String(seasonId))
  )
    throw Error("Invalid testnet, Meta or season ID");
  if (!Array.isArray(input.allocations) || !input.allocations.length)
    throw Error("Allocations required");
  const seen = new Set();
  const allocations = input.allocations.map(({ address, amountWei }) => {
    if (
      !isAddress(address) ||
      /^0x0{40}$/i.test(address) ||
      seen.has(address.toLowerCase()) ||
      !/^\d+$/.test(amountWei) ||
      BigInt(amountWei) <= 0n
    )
      throw Error("Invalid or duplicate allocation");
    seen.add(address.toLowerCase());
    return {
      address,
      amountWei,
      leaf: keccak256(
        keccak256(
          encodeAbiParameters(
            [
              { type: "uint256" },
              { type: "address" },
              { type: "uint256" },
              { type: "address" },
              { type: "uint256" },
            ],
            [
              BigInt(chainId),
              metaAddress,
              BigInt(seasonId),
              address,
              BigInt(amountWei),
            ],
          ),
        ),
      ),
    };
  });
  const pair = (a, b) =>
    keccak256(concatHex(a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]));
  const levels = [allocations.map((a) => a.leaf)];
  while (levels.at(-1).length > 1) {
    const layer = levels.at(-1),
      next = [];
    for (let i = 0; i < layer.length; i += 2)
      next.push(pair(layer[i], layer[i + 1] ?? layer[i]));
    levels.push(next);
  }
  const canonical = JSON.stringify({
    chainId,
    metaAddress,
    seasonId: String(seasonId),
    allocations: allocations.map(({ address, amountWei }) => ({
      address,
      amountWei,
    })),
  });
  return {
    chainId,
    metaAddress,
    seasonId: String(seasonId),
    merkleRoot: levels.at(-1)[0],
    allocationHash: keccak256(toHex(canonical)),
    totalWei: allocations
      .reduce((sum, a) => sum + BigInt(a.amountWei), 0n)
      .toString(),
    allocations: allocations.map((allocation, index) => {
      const proof = [];
      for (let depth = 0; depth < levels.length - 1; depth++) {
        const layer = levels[depth];
        proof.push(layer[index ^ 1] ?? layer[index]);
        index = Math.floor(index / 2);
      }
      return {
        address: allocation.address,
        amountWei: allocation.amountWei,
        proof,
      };
    }),
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [, , source, destination] = process.argv;
  if (!source || !destination)
    throw Error(
      "Usage: node scripts/season-rewards.mjs allocation.json claims.json",
    );
  fs.writeFileSync(
    destination,
    JSON.stringify(
      makeRewards(JSON.parse(fs.readFileSync(source, "utf8"))),
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    "Created public claims file. Review and publish it before scheduling its immutable root.",
  );
}
