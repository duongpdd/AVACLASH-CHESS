import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { generatePrivateKey } from "viem/accounts";
import { RelayServer } from "../src/RelayServer.js";

let server: RelayServer | undefined;
let socket: WebSocket | undefined;
let directory: string | undefined;
afterEach(async () => {
  vi.useRealTimers();
  socket?.terminate();
  await server?.close();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});
it("keeps the socket open while the user signs, for the full 60-second challenge", async () => {
  vi.useFakeTimers();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-auth-"));
  server = new RelayServer({
    port: 0,
    relayPrivateKey: generatePrivateKey(),
    contractAddress: "0x1111111111111111111111111111111111111111",
    publicClient: {},
    resultsDir: directory,
    allowNoOrigin: true,
  });
  await new Promise<void>((resolve) => server!.wss.on("listening", resolve));
  const bound = server.wss.address();
  if (typeof bound === "string" || !bound) throw Error("Missing port");
  socket = new WebSocket(`ws://127.0.0.1:${bound.port}`);
  await new Promise<void>((resolve) =>
    socket!.once("message", () => resolve()),
  );
  await vi.advanceTimersByTimeAsync(11000);
  expect(socket.readyState).toBe(WebSocket.OPEN);
  const closed = new Promise<number>((resolve) =>
    socket!.once("close", resolve),
  );
  await vi.advanceTimersByTimeAsync(49000);
  expect(await closed).toBe(4001);
});
