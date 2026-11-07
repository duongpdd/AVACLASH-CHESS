import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkReadiness } from "../src/readiness.js";
import type { RelayServer } from "../src/RelayServer.js";
let directory: string;
const publicClient = {
  getChainId: vi.fn(),
  getCode: vi.fn(),
  readContract: vi.fn(),
  getBalance: vi.fn(),
};
let server: RelayServer;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-readiness-"));
  publicClient.getChainId.mockResolvedValue(31337);
  publicClient.getCode.mockResolvedValue("0x6000");
  publicClient.readContract.mockResolvedValue(
    "0x1111111111111111111111111111111111111111",
  );
  publicClient.getBalance.mockResolvedValue(10n);
  server = {
    publicClient,
    chainId: 31337,
    relayAddress: "0x1111111111111111111111111111111111111111",
    contractAddress: "0x2222222222222222222222222222222222222222",
    minRelayBalance: 1n,
    resultsDir: directory,
    activeDir: path.join(directory, "active"),
  } as unknown as RelayServer;
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});
it("checks dependencies and storage without leaving probe files", async () => {
  await checkReadiness(server);
  expect(fs.readdirSync(directory)).toEqual(["active"]);
  expect(fs.readdirSync(server.activeDir)).toEqual([]);
});
it.each(["chain", "code", "signer", "gas", "rpc"])(
  "fails closed on %s",
  async (failure) => {
    if (failure === "chain") publicClient.getChainId.mockResolvedValue(1);
    if (failure === "code") publicClient.getCode.mockResolvedValue("0x");
    if (failure === "signer")
      publicClient.readContract.mockResolvedValue(server.contractAddress);
    if (failure === "gas") publicClient.getBalance.mockResolvedValue(0n);
    if (failure === "rpc")
      publicClient.getChainId.mockRejectedValue(Error("RPC unavailable"));
    await expect(checkReadiness(server)).rejects.toThrow();
  },
);
