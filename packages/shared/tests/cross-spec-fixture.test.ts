import { describe, it, expect } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hashTypedData, keccak256, toHex, recoverTypedDataAddress } from "viem";
import { getEip712Domain, EIP712_TYPES } from "../src/eip712.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Cross-Spec EIP-712 Signature Generation", () => {
  it("should generate random keys, sign with viem, verify recovery, and write fixture for Foundry", async () => {
    // Generate random keys for Player A and Player B (no fixed constants)
    const privKeyA = generatePrivateKey();
    const privKeyB = generatePrivateKey();

    const accountA = privateKeyToAccount(privKeyA);
    const accountB = privateKeyToAccount(privKeyB);

    const chainId = 31337;
    // Expected address of escrow deployed as first contract in ChessEscrowTest setUp()
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

    // Verify recovery using viem
    const recoveredA = await recoverTypedDataAddress({
      domain,
      types: EIP712_TYPES,
      primaryType: "Result",
      message,
      signature: sigA,
    });
    const recoveredB = await recoverTypedDataAddress({
      domain,
      types: EIP712_TYPES,
      primaryType: "Result",
      message,
      signature: sigB,
    });

    expect(recoveredA.toLowerCase()).toBe(accountA.address.toLowerCase());
    expect(recoveredB.toLowerCase()).toBe(accountB.address.toLowerCase());

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

    const fixturesDir = path.resolve(__dirname, "../../../contracts/test/fixtures");
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    const fixturePath = path.join(fixturesDir, "cross_spec_result.json");
    fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), "utf8");

    expect(fs.existsSync(fixturePath)).toBe(true);
  });
});
