"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { type Address, type PublicClient } from "viem";
import {
  COSMETICS_ABI,
  COSMETIC_AUCTION_ABI,
  TOURNAMENT_ABI,
} from "@avaclash/shared";
import {
  AUCTION_ADDRESS,
  CHAIN_ID,
  COSMETICS_ADDRESS,
  TOURNAMENT_ADDRESS,
  cosmeticsEnabled,
} from "@/config/env";

export const collectionContract = {
  get address() {
    return COSMETICS_ADDRESS;
  },
  abi: COSMETICS_ABI,
} as const;
export const auctionContract = {
  get address() {
    return AUCTION_ADDRESS;
  },
  abi: COSMETIC_AUCTION_ABI,
} as const;
const poolContract = {
  get address() {
    return TOURNAMENT_ADDRESS;
  },
  abi: TOURNAMENT_ABI,
} as const;
export const PAGE_SIZE = 12n;

export function useCosmeticQuery<T>(
  key: readonly unknown[],
  read: (client: PublicClient) => Promise<T>,
  enabled = true,
) {
  const client = usePublicClient({ chainId: CHAIN_ID });
  return useQuery({
    queryKey: [
      "cosmetics",
      CHAIN_ID,
      COSMETICS_ADDRESS,
      AUCTION_ADDRESS,
      ...key,
    ],
    enabled: !!client && enabled && cosmeticsEnabled,
    queryFn: () => read(client!),
  });
}

function descendingIds(end: bigint) {
  const length = Number(end < PAGE_SIZE ? end : PAGE_SIZE);
  return Array.from({ length }, (_, i) => end - 1n - BigInt(i));
}

function windowEnd(total: bigint, offset: bigint) {
  return total > offset ? total - offset : 0n;
}

async function getItem(
  client: PublicClient,
  tokenId: bigint,
  blockNumber: bigint,
) {
  const item = await client.readContract({
    ...collectionContract,
    functionName: "getItem",
    args: [tokenId],
    blockNumber,
  });
  return { tokenId, ...item };
}

export type CosmeticItem = Awaited<ReturnType<typeof getItem>>;

export function useCollection(owner: Address | undefined, offset: bigint) {
  return useCosmeticQuery(
    ["collection", owner, String(offset)],
    async (client) => {
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
      const [total, [boardId, piecesId]] = await Promise.all([
        client.readContract({
          ...collectionContract,
          functionName: "balanceOf",
          args: [owner!],
          blockNumber,
        }),
        client.readContract({
          ...collectionContract,
          functionName: "equippedIds",
          args: [owner!],
          blockNumber,
        }),
      ]);
      const items = await Promise.all(
        descendingIds(windowEnd(total, offset)).map(async (index) => {
          const id = await client.readContract({
            ...collectionContract,
            functionName: "tokenOfOwnerByIndex",
            args: [owner!, index],
            blockNumber,
          });
          return getItem(client, id, blockNumber);
        }),
      );
      return { items, total, boardId, piecesId };
    },
    !!owner,
  );
}

export function useTrophies(owner: Address | undefined, offset: bigint) {
  return useCosmeticQuery(
    ["trophies", owner, String(offset)],
    async (client) => {
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
      const total = await client.readContract({
        ...poolContract,
        functionName: "nextTournamentId",
        blockNumber,
      });
      const candidates = await Promise.all(
        descendingIds(windowEnd(total, offset)).map(async (id) => {
          const eligible = await client.readContract({
            ...collectionContract,
            functionName: "canClaim",
            args: [id, owner!],
            blockNumber,
          });
          if (!eligible) return null;
          const official = await client.readContract({
            ...collectionContract,
            functionName: "getOfficial",
            args: [id],
            blockNumber,
          });
          return { id, ...official };
        }),
      );
      return { items: candidates.filter((item) => item !== null), total };
    },
    !!owner,
  );
}

export function useAuctions(cursor: bigint | null) {
  return useCosmeticQuery(["auctions", cursor?.toString()], async (client) => {
    const block = await client.getBlockNumber({ cacheTime: 0 });
    const total = await client.readContract({
      ...auctionContract,
      functionName: "nextAuctionId",
      blockNumber: block,
    });
    const end = cursor === null || cursor > total ? total : cursor;
    const items = await Promise.all(
      descendingIds(end).map(async (id) => {
        const [auction, minimum] = await Promise.all([
          client.readContract({
            ...auctionContract,
            functionName: "getAuction",
            args: [id],
            blockNumber: block,
          }),
          client.readContract({
            ...auctionContract,
            functionName: "minimumBid",
            args: [id],
            blockNumber: block,
          }),
        ]);
        const item = await getItem(client, auction.tokenId, block);
        return { id, ...auction, item, minimum };
      }),
    );
    return { items, end };
  });
}

export type AuctionListing = NonNullable<
  ReturnType<typeof useAuctions>["data"]
>["items"][number];

export function useAuctionFunds(owner?: Address) {
  return useCosmeticQuery(
    ["pending", owner],
    (client) =>
      client.readContract({
        ...auctionContract,
        functionName: "pending",
        args: [owner!],
      }),
    !!owner,
  );
}

export function useAuctionDurations() {
  return useCosmeticQuery(["durations"], (client) =>
    Promise.all([
      client.readContract({ ...auctionContract, functionName: "minDuration" }),
      client.readContract({ ...auctionContract, functionName: "maxDuration" }),
    ]),
  );
}

export async function readEquipped(
  client: PublicClient,
  owner: Address,
  blockNumber: bigint,
) {
  const [boardId, piecesId] = await client.readContract({
    ...collectionContract,
    functionName: "equippedIds",
    args: [owner],
    blockNumber,
  });
  const [board, pieces] = await Promise.all([
    boardId ? getItem(client, boardId, blockNumber) : undefined,
    piecesId ? getItem(client, piecesId, blockNumber) : undefined,
  ]);
  return { board, pieces };
}
