import { describe, it, expect } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hashTypedData, keccak256, toHex, recoverTypedDataAddress, type Hex } from "viem";
import { getEip712Domain, EIP712_TYPES } from "../src/eip712.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Cross-Spec EIP-712 Signature Generation", () => {
  it("should verify committed cross_spec_result.json fixture and only overwrite when UPDATE_FIXTURE=1", async () => {
    const fixturesDir = path.resolve(__dirname, "../../../contracts/test/fixtures");
    const fixturePath = path.join(fixturesDir, "cross_spec_result.json");

    if (process.env.UPDATE_FIXTURE === "1") {
      // Generate random keys for Player A and Player B
      const privKeyA = generatePrivateKey();
      const privKeyB = generatePrivateKey();

      const accountA = privateKeyToAccount(privKeyA);
      const accountB = privateKeyToAccount(privKeyB);

      const chainId = 31337;
      const verifyingContract = "0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f" as const;

      const matchId = 0n;
      const winner = accountA.address;
      const outcome = 0; // WhiteWin
      const reason = 0; // Checkmate
      const moveCount = 42;
      const movesHash = keccak256(toHex("e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5"));
      const nonce = 101n;
      const deadline = 1893456000n; // 2030-01-01

      const domain = getEip712Domain(verifyingContract, chainId);
      const message = {
        matchId,
        winner,
        outcome,
        reason,
        moveCount,
        movesHash,
        nonce,
        deadline,
      };

      const digest = hashTypedData({
        domain,
        types: EIP712_TYPES,
        primaryType: "Result",
        message,
      });

      const sigA = await accountA.signTypedData({
        domain,
        types: EIP712_TYPES,
        primaryType: "Result",
        message,
      });

      const sigB = await accountB.signTypedData({
        domain,
        types: EIP712_TYPES,
        primaryType: "Result",
        message,
      });

      const fixture = {
        chainId,
        verifyingContract,
        signerA: accountA.address,
        signerB: accountB.address,
        winner,
        matchId: Number(matchId),
        outcome,
        reason,
        moveCount,
        movesHash,
        nonce: Number(nonce),
        deadline: Number(deadline),
        digest,
        sigA,
        sigB,
      };

      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), "utf8");
      expect(fs.existsSync(fixturePath)).toBe(true);
    } else {
      // Default: verify committed fixture WITHOUT overwriting
      expect(fs.existsSync(fixturePath)).toBe(true);
      const content = fs.readFileSync(fixturePath, "utf8");
      const fixture = JSON.parse(content);

      const domain = getEip712Domain(fixture.verifyingContract as `0x${string}`, fixture.chainId);
      const message = {
        matchId: BigInt(fixture.matchId),
        winner: fixture.winner as `0x${string}`,
        outcome: fixture.outcome,
        reason: fixture.reason,
        moveCount: fixture.moveCount,
        movesHash: fixture.movesHash as `0x${string}`,
        nonce: BigInt(fixture.nonce),
        deadline: BigInt(fixture.deadline),
      };

      const digest = hashTypedData({
        domain,
        types: EIP712_TYPES,
        primaryType: "Result",
        message,
      });

      expect(digest.toLowerCase()).toBe(fixture.digest.toLowerCase());

      const recoveredA = await recoverTypedDataAddress({
        domain,
        types: EIP712_TYPES,
        primaryType: "Result",
        message,
        signature: fixture.sigA as Hex,
      });
      const recoveredB = await recoverTypedDataAddress({
        domain,
        types: EIP712_TYPES,
        primaryType: "Result",
        message,
        signature: fixture.sigB as Hex,
      });

      expect(recoveredA.toLowerCase()).toBe(fixture.signerA.toLowerCase());
      expect(recoveredB.toLowerCase()).toBe(fixture.signerB.toLowerCase());

      // Ensure file content was not modified
      const contentAfter = fs.readFileSync(fixturePath, "utf8");
      expect(contentAfter).toBe(content);
    }
  });
});
