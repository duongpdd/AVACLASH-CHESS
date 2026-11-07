import { expect, it } from "vitest";
import { hashTypedData, recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildBoundJoinTypedData } from "../src/relay-auth.js";
it("binds a Join signature to chain, contract, origin, room, nonce and expiration", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const base = buildBoundJoinTypedData(
    6,
    account.address,
    `0x${"11".repeat(32)}`,
    2000000000,
    31337,
    {
      escrowAddress: "0x1111111111111111111111111111111111111111",
      origin: "http://127.0.0.1:3000",
    },
  );
  const signature = await account.signTypedData(base);
  expect(await recoverTypedDataAddress({ ...base, signature })).toBe(
    account.address,
  );
  for (const other of [
    { ...base, domain: { ...base.domain, chainId: 43113n } },
    {
      ...base,
      domain: {
        ...base.domain,
        verifyingContract:
          "0x2222222222222222222222222222222222222222" as const,
      },
    },
    { ...base, message: { ...base.message, origin: "https://other.example" } },
    { ...base, message: { ...base.message, roomId: 7n } },
    { ...base, message: { ...base.message, expiresAt: 2000000001n } },
    {
      ...base,
      message: {
        ...base.message,
        nonce: `0x${"22".repeat(32)}` as `0x${string}`,
      },
    },
  ]) {
    expect(hashTypedData(other)).not.toBe(hashTypedData(base));
    expect(
      (await recoverTypedDataAddress({ ...other, signature })).toLowerCase(),
    ).not.toBe(account.address.toLowerCase());
  }
});
