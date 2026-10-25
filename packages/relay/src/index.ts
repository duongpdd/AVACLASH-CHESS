import { RelayServer } from "./RelayServer.js";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const relayPrivateKey = process.env.RELAY_PRIVATE_KEY as `0x${string}` | undefined;
if (!relayPrivateKey) {
  console.error("FATAL: RELAY_PRIVATE_KEY environment variable is required.");
  process.exit(1);
}
const contractAddress = (process.env.CHESS_ESCROW_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 43113;

const server = new RelayServer({
  port,
  relayPrivateKey,
  contractAddress,
  chainId,
});

console.log(`[AvaClash Relay] Running on ws://localhost:${port}`);
console.log(`[AvaClash Relay] Signer address: ${server.relayAddress}`);
console.log(`[AvaClash Relay] Contract: ${contractAddress} (Chain: ${chainId})`);

export { RelayServer };
