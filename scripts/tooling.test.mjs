import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRewards } from "./season-rewards.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "web/package.json"));
const { keccak256, concatHex, encodeAbiParameters } = require("viem");
test("reward generator produces valid proofs for odd-sized allocations and rejects duplicate beneficiaries", () => {
  const input = {
    chainId: 31337,
    metaAddress: "0x1111111111111111111111111111111111111111",
    seasonId: "0",
    allocations: ["2", "3", "4"].map((n) => ({
      address: `0x${n.repeat(40)}`,
      amountWei: "100",
    })),
  };
  const output = makeRewards(input);
  assert.equal(output.totalWei, "300");
  for (const item of output.allocations) {
    let hash = keccak256(
      keccak256(
        encodeAbiParameters(
          [
            { type: "uint256" },
            { type: "address" },
            { type: "uint256" },
            { type: "address" },
            { type: "uint256" },
          ],
          [31337n, input.metaAddress, 0n, item.address, 100n],
        ),
      ),
    );
    for (const sibling of item.proof)
      hash = keccak256(
        concatHex(
          hash.toLowerCase() < sibling.toLowerCase()
            ? [hash, sibling]
            : [sibling, hash],
        ),
      );
    assert.equal(hash, output.merkleRoot);
  }
  assert.throws(() =>
    makeRewards({
      ...input,
      allocations: [input.allocations[0], input.allocations[0]],
    }),
  );
  assert.throws(() => makeRewards({ ...input, chainId: 1 }));
});
test("backup restores JSON exactly, excludes secrets, verifies integrity and refuses overwrite", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "avaclash-storage-test-"),
  );
  try {
    const source = path.join(directory, "source"),
      backup = path.join(directory, "backup"),
      restored = path.join(directory, "restored");
    fs.mkdirSync(path.join(source, "active"), { recursive: true });
    fs.writeFileSync(path.join(source, "room.json"), '{"roomId":6}');
    fs.writeFileSync(
      path.join(source, "active/snapshot.json"),
      '{"moves":["e2e4"]}',
    );
    fs.writeFileSync(path.join(source, ".env.local"), "test secret");
    const run = (...args) =>
      execFileSync(
        process.execPath,
        [path.join(root, "scripts/relay-storage.mjs"), ...args],
        { stdio: "pipe" },
      );
    run("backup", source, backup);
    run("restore", backup, restored);
    assert.equal(
      fs.readFileSync(path.join(restored, "room.json"), "utf8"),
      '{"roomId":6}',
    );
    assert.equal(fs.existsSync(path.join(restored, ".env.local")), false);
    assert.throws(() => run("restore", backup, restored));
    fs.writeFileSync(path.join(backup, "room.json"), '{"roomId":7}');
    assert.throws(() =>
      run("restore", backup, path.join(directory, "corrupt")),
    );
    assert.equal(fs.existsSync(path.join(directory, "corrupt")), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
