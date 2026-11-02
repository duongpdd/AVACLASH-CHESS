import { createConfig, http } from "wagmi";
import { avalancheFuji, anvil } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { CHAIN_ID, RPC_URL } from "./env";

export const targetChain = CHAIN_ID === 31337 ? anvil : avalancheFuji;

export const config = createConfig({
  chains: [targetChain, targetChain.id === 31337 ? avalancheFuji : anvil],
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http(
      CHAIN_ID === 43113
        ? RPC_URL
        : "https://api.avax-test.network/ext/bc/C/rpc"
    ),
    [anvil.id]: http(
      CHAIN_ID === 31337 ? RPC_URL : "http://127.0.0.1:8545"
    ),
  },
  ssr: true,
});
