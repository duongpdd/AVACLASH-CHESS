import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generatePrivateKey } from "viem/accounts";
import { RelayServer, type SavedGameResult } from "../src/RelayServer.js";

const servers: RelayServer[] = [];
const directories: string[] = [];
const contract = "0x1111111111111111111111111111111111111111";
function server(resultsDir: string) {
  const instance = new RelayServer({
    port: 0,
    contractAddress: contract,
    chainId: 31337,
    relayPrivateKey: generatePrivateKey(),
    resultsDir,
    signalGameStartedEnabled: false,
    publicClient: { readContract: vi.fn() },
    allowNoOrigin: true,
  });
  servers.push(instance);
  return instance;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((instance) => instance.close()));
  directories
    .splice(0)
    .forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});
describe("Durable terminal result storage", () => {
  it("loads a terminal checkpoint after the final result rename fails", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-durability-"));
    directories.push(dir);
    const original = server(dir);
    const result: SavedGameResult = {
      chainId: 31337,
      contractAddress: contract,
      roomId: 0,
      moves: [],
      outcome: "draw",
      reason: "draw_agreed",
      winner: "0x0000000000000000000000000000000000000000",
      timestamp: Date.now(),
    };
    const rename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (path.dirname(String(to)) === dir)
        throw new Error("Simulated result write failure");
      rename(from, to);
    });
    expect(original.saveGameResult(result)).toBe(false);
    vi.restoreAllMocks();
    const restarted = server(dir);
    expect(restarted.savedResults.get(restarted.getResultKey(0))).toEqual(
      result,
    );
  });
  it("retains old terminal records so an un-settled room cannot start a second game", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-expired-"));
    directories.push(dir);
    const original = server(dir);
    original.saveGameResult({
      chainId: 31337,
      contractAddress: contract,
      roomId: 0,
      moves: [],
      outcome: "draw",
      reason: "draw_agreed",
      winner: "0x0000000000000000000000000000000000000000",
      timestamp: Date.now() - 49 * 3600000,
    });
    const restarted = server(dir);
    expect(restarted.savedResults.has(restarted.getResultKey(0))).toBe(true);
  });
});
