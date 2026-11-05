"use client";

import { isCosmeticsEnabled } from "@/config/cosmetics";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { type Address, type PublicClient } from "viem";
import { TOURNAMENT_ABI } from "@avaclash/shared";
import { CHAIN_ID, COSMETICS_ADDRESS, TOURNAMENT_ADDRESS } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusPill } from "@/components/ui-state";
import { readEquipped } from "@/hooks/use-cosmetic-reads";
import {
  readHideOpponentSkin,
  resolveTheme,
  writeHideOpponentSkin,
  type ResolvedTheme,
} from "@/game/theme";

type MatchStart = { tournamentId: bigint; timestamp: bigint };
type MatchProps = {
  white: Address;
  black: Address;
  viewer: "w" | "b" | "spectator";
  start?: MatchStart;
  children: (theme?: ResolvedTheme) => ReactNode;
};

async function startBlock(
  client: PublicClient,
  start: MatchStart,
  head: bigint,
) {
  // Locate the first block with the on-chain match timestamp. Multiple Anvil
  // blocks can share it, so identify the block by the indexed Started event.
  let low = 0n;
  let high = head;
  while (low < high) {
    const middle = (low + high) / 2n;
    const block = await client.getBlock({
      blockNumber: middle,
      includeTransactions: false,
    });
    if (block.timestamp < start.timestamp) low = middle + 1n;
    else high = middle;
  }
  while (low <= head) {
    const toBlock = low + 63n < head ? low + 63n : head;
    const events = await client.getContractEvents({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      eventName: "Started",
      args: { id: start.tournamentId },
      fromBlock: low,
      toBlock,
      strict: true,
    });
    const blockNumber = events[0]?.blockNumber;
    if (blockNumber != null) return blockNumber;
    if (
      (await client.getBlock({ blockNumber: toBlock })).timestamp >
      start.timestamp
    )
      break;
    low = toBlock + 1n;
  }
  throw Error("Không tìm thấy khối bắt đầu giải.");
}

function subscribePreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function EnabledMatchSkins({
  white,
  black,
  viewer,
  start,
  children,
}: MatchProps) {
  const client = usePublicClient({ chainId: CHAIN_ID });
  const stored = useSyncExternalStore(
    subscribePreference,
    readHideOpponentSkin,
    () => false,
  );
  const [preference, setPreference] = useState<boolean>();
  const hidden = preference ?? stored;
  const equipped = useQuery({
    queryKey: [
      "match-skins",
      CHAIN_ID,
      COSMETICS_ADDRESS,
      TOURNAMENT_ADDRESS,
      white,
      black,
      start?.tournamentId.toString(),
      start?.timestamp.toString(),
    ],
    enabled: !!client,
    staleTime: start ? Infinity : 0,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const head = await client!.getBlockNumber({ cacheTime: 0 });
      const blockNumber = start ? await startBlock(client!, start, head) : head;
      const code = await client!.getCode({
        address: COSMETICS_ADDRESS,
        blockNumber,
      });
      if (start && (!code || code === "0x"))
        return { white: null, black: null };
      const [whiteItems, blackItems] = await Promise.all([
        readEquipped(client!, white, blockNumber),
        readEquipped(client!, black, blockNumber),
      ]);
      return { white: whiteItems, black: blackItems };
    },
  });
  const theme = useMemo(() => {
    if (!equipped.data) return undefined;
    return resolveTheme({
      whitePieces: equipped.data.white?.pieces?.theme,
      blackPieces: equipped.data.black?.pieces?.theme,
      whiteBoard: equipped.data.white?.board?.theme,
      blackBoard: equipped.data.black?.board?.theme,
      hideOpponentSkin: hidden,
      viewerColor: viewer,
    });
  }, [equipped.data, hidden, viewer]);

  const board =
    theme?.boardOwner === "w"
      ? equipped.data?.white?.board
      : theme?.boardOwner === "b"
        ? equipped.data?.black?.board
        : undefined;
  const whiteName = theme?.whiteCustom && equipped.data?.white?.pieces?.name;
  const blackName = theme?.blackCustom && equipped.data?.black?.pieces?.name;
  return (
    <>
      {children(theme)}
      <div className="grid min-w-0 gap-2">
        {!start && (
          <p className="helper-text">Hiển thị theo trang bị hiện tại</p>
        )}
        {equipped.isPending ? (
          <Skeleton label="Đang đọc trang bị" />
        ) : equipped.isError ? (
          <p role="status" className="helper-text">
            Chưa đọc được trang bị. Đang dùng màu mặc định.
          </p>
        ) : (
          <div className="flex min-w-0 flex-wrap gap-2 [overflow-wrap:anywhere]">
            <StatusPill>Trắng · {whiteName || "Mặc định"}</StatusPill>
            <StatusPill>Đen · {blackName || "Mặc định"}</StatusPill>
            <StatusPill>Bàn · {board?.name ?? "Mặc định"}</StatusPill>
          </div>
        )}
        {viewer !== "spectator" && (
          <Button
            className="justify-self-start"
            aria-pressed={hidden}
            onClick={() => {
              setPreference(!hidden);
              writeHideOpponentSkin(!hidden);
            }}
          >
            Tắt skin của đối thủ
          </Button>
        )}
      </div>
    </>
  );
}

export function MatchSkins(props: MatchProps) {
  return isCosmeticsEnabled() ? (
    <EnabledMatchSkins {...props} />
  ) : (
    props.children()
  );
}
