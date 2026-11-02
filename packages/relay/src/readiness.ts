import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import type { RelayServer } from "./RelayServer.js";

/** Readiness checks real dependencies; no key or RPC credential is returned. */
export async function checkReadiness(server: RelayServer): Promise<void> {
  if (server.storageFailed) throw Error("Storage failed; restart required.");
  const [chainId, code, signer, balance] = await Promise.all([
    server.publicClient.getChainId(),
    server.publicClient.getCode({ address: server.contractAddress }),
    server.publicClient.readContract({
      address: server.contractAddress,
      abi: CHESS_ESCROW_ABI,
      functionName: "relaySigner",
    }),
    server.publicClient.getBalance({ address: server.relayAddress }),
  ]);
  if (chainId !== server.chainId) throw Error("RPC chain mismatch");
  if (!code || code === "0x") throw Error("Escrow bytecode missing");
  if (String(signer).toLowerCase() !== server.relayAddress.toLowerCase())
    throw Error("Relay signer mismatch");
  if (balance < server.minRelayBalance)
    throw Error("Relay gas balance below threshold");
  if (server.store) {
    await server.store.check();
    return;
  }
  for (const directory of [server.resultsDir, server.activeDir]) {
    fs.mkdirSync(directory, { recursive: true });
    const probe = path.join(directory, `.ready-${crypto.randomUUID()}`);
    try {
      fs.writeFileSync(probe, "probe", { flag: "wx" });
      fs.renameSync(probe, `${probe}.renamed`);
    } finally {
      for (const file of [probe, `${probe}.renamed`]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  }
}
