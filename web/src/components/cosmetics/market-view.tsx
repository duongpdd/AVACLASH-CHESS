"use client";

import { useEffect, useId, useState } from "react";
import { formatEther, type Address } from "viem";
import { useAccount, useBlock } from "wagmi";
import Tabs from "@/components/section-tabs";
import WalletAction from "@/components/wallet-action";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { EmptyState, Skeleton, StatusPill } from "@/components/ui-state";
import { CHAIN_ID, CURRENCY_SYMBOL } from "@/config/env";
import {
  useAuctionFunds,
  useAuctions,
  PAGE_SIZE,
  type AuctionListing,
} from "@/hooks/use-cosmetic-reads";
import { useCosmeticTx, type CosmeticTx } from "@/hooks/use-cosmetic-tx";
import {
  cards,
  CosmeticPage,
  kindName,
  nativeAmount,
  Pager,
  QueryState,
  SkinPreview,
  TxMessage,
} from "./cosmetic-ui";

const tabs = [
  { id: "open", label: "Đang diễn ra" },
  { id: "ended", label: "Đã kết thúc" },
  { id: "mine", label: "Của tôi" },
] as const;
type Tab = (typeof tabs)[number]["id"];

function money(amount: bigint) {
  return `${formatEther(amount)} ${CURRENCY_SYMBOL}`;
}

function remaining(seconds: bigint) {
  const hours = seconds / 3600n;
  const minutes = (seconds / 60n) % 60n;
  return `${hours} giờ ${minutes} phút ${seconds % 60n} giây`;
}

function BidForm({ auction, tx }: { auction: AuctionListing; tx: CosmeticTx }) {
  const id = useId();
  const [price, setPrice] = useState("");
  const amount = nativeAmount(price.trim());
  return (
    <form
      className="grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          amount &&
          amount >= auction.minimum &&
          (await tx.send({
            contract: "auction",
            functionName: "bid",
            args: [auction.id],
            value: amount,
          }))
        )
          setPrice("");
      }}
    >
      <label htmlFor={id}>Giá đặt ({CURRENCY_SYMBOL} thử nghiệm)</label>
      <input
        id={id}
        value={price}
        inputMode="decimal"
        required
        placeholder={formatEther(auction.minimum)}
        onChange={(e) => setPrice(e.target.value)}
        className="input-field min-h-11 min-w-0 w-full rounded-md border border-border bg-background px-3"
      />
      <Button
        tone="primary"
        type="submit"
        disabled={tx.busy || !amount || amount < auction.minimum}
      >
        Đặt giá
      </Button>
    </form>
  );
}

const isAddress = (a: Address | undefined, b: Address) =>
  a?.toLowerCase() === b.toLowerCase();

function AuctionCard({
  auction,
  timestamp,
  address,
  canWrite,
  tx,
}: {
  auction: AuctionListing;
  timestamp: bigint;
  address?: Address;
  canWrite: boolean;
  tx: CosmeticTx;
}) {
  const owner = isAddress(address, auction.seller);
  const held = auction.status === 0;
  const live = held && timestamp < auction.endTime;
  return (
    <CardCustom as="article" className="grid min-w-0 content-start gap-3">
      <SkinPreview kind={auction.item.kind} theme={auction.item.theme} />
      <h2 className="break-words font-semibold">{auction.item.name}</h2>
      <p className="helper-text">
        {kindName(auction.item.kind)} · Bản số {auction.item.serial} · Giải #
        {auction.item.tournamentId.toString()} · Phiên #{auction.id.toString()}
      </p>
      <StatusPill tone={live ? "success" : held ? "warning" : "neutral"}>
        {live
          ? "Đang diễn ra"
          : held
            ? "Chờ kết toán"
            : auction.status === 1
              ? "Đã kết toán"
              : "Đã hủy"}
      </StatusPill>
      <dl className="grid gap-1 text-sm [overflow-wrap:anywhere]">
        <div>
          <dt className="inline">
            {auction.highestBid ? "Giá cao nhất" : "Giá khởi điểm"}
          </dt>{" "}
          <dd className="inline font-semibold">
            {money(auction.highestBid || auction.reserve)}
          </dd>
        </div>
        {live && (
          <>
            <div>
              <dt className="inline">Mức đặt tiếp theo từ</dt>{" "}
              <dd className="inline font-semibold">{money(auction.minimum)}</dd>
            </div>
            <div>
              <dt className="inline">Còn lại theo thời gian khối</dt>{" "}
              <dd className="inline">
                {remaining(auction.endTime - timestamp)}
              </dd>
            </div>
          </>
        )}
      </dl>
      {canWrite && live && !owner && <BidForm auction={auction} tx={tx} />}
      <div className="flex flex-wrap gap-2">
        {held && !live && (
          <Button
            disabled={!canWrite || tx.busy}
            onClick={() =>
              void tx.send({
                contract: "auction",
                functionName: "settle",
                args: [auction.id],
              })
            }
          >
            Kết toán
          </Button>
        )}
        {held && owner && auction.highestBid === 0n && (
          <Button
            disabled={!canWrite || tx.busy}
            onClick={() =>
              void tx.send({
                contract: "auction",
                functionName: "cancel",
                args: [auction.id],
              })
            }
          >
            Hủy phiên
          </Button>
        )}
      </div>
    </CardCustom>
  );
}

function MarketContent() {
  const { address, chainId } = useAccount();
  const canWrite = !!address && chainId === CHAIN_ID;
  const [tab, setTab] = useState<Tab>("open");
  const [cursors, setCursors] = useState<(bigint | null)[]>([null]);
  const cursor = cursors.at(-1) ?? null;
  const chainBlock = useBlock({ chainId: CHAIN_ID, watch: true });
  const auctions = useAuctions(cursor);
  const pending = useAuctionFunds(address);
  const tx = useCosmeticTx();
  const timestamp = chainBlock.data?.timestamp;
  const blockNumber = chainBlock.data?.number;
  const { refetch: refreshAuctions } = auctions;
  const { refetch: refreshFunds } = pending;

  useEffect(() => {
    if (blockNumber === undefined || blockNumber === null) return;
    void refreshAuctions();
    if (address) void refreshFunds();
  }, [blockNumber, address, refreshAuctions, refreshFunds]);

  function renderPanel(kind: Tab) {
    if (kind === "mine" && !address)
      return <EmptyState title="Kết nối ví để xem các phiên của bạn" />;
    if (timestamp === undefined) {
      return chainBlock.isError ? (
        <EmptyState
          title="Chưa đọc được thời gian khối"
          action={
            <Button onClick={() => void chainBlock.refetch()}>Thử lại</Button>
          }
        />
      ) : (
        <Skeleton label="Đang đọc thời gian khối" />
      );
    }

    const items = auctions.data?.items.filter((auction) => {
      const live = auction.status === 0 && timestamp < auction.endTime;
      if (kind === "open") return live;
      if (kind === "ended") return !live;
      return (
        isAddress(address, auction.seller) ||
        isAddress(address, auction.highestBidder)
      );
    });
    return (
      <div className="grid min-w-0 gap-3">
        {kind === "mine" && (
          <p className="helper-text">
            Các phiên bạn rao hoặc đang giữ giá cao nhất.
          </p>
        )}
        <QueryState
          query={auctions}
          label="Đang đọc các phiên đấu giá"
          empty={!items?.length ? "Trang này chưa có phiên phù hợp" : undefined}
        >
          <div className={cards}>
            {items?.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                timestamp={timestamp}
                address={address}
                canWrite={canWrite}
                tx={tx}
              />
            ))}
          </div>
        </QueryState>
        <Pager
          newer={
            cursors.length > 1
              ? () => setCursors(cursors.slice(0, -1))
              : undefined
          }
          older={
            auctions.data && auctions.data.end > PAGE_SIZE
              ? () => setCursors([...cursors, auctions.data!.end - PAGE_SIZE])
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <>
      {!canWrite && (
        <EmptyState
          title="Kết nối ví thử nghiệm để giao dịch"
          action={<WalletAction />}
        />
      )}
      {address && (
        <CardCustom className="grid min-w-0 gap-2">
          <h2 className="font-semibold">Số dư có thể rút</h2>
          <QueryState query={pending} label="Đang đọc số dư">
            <p className="[overflow-wrap:anywhere]">
              {money(pending.data ?? 0n)}
            </p>
            <Button
              className="justify-self-start"
              disabled={!canWrite || !pending.data || tx.busy}
              onClick={() =>
                void tx.send({ contract: "auction", functionName: "withdraw" })
              }
            >
              Rút tiền được hoàn hoặc tiền từ phiên đã kết toán
            </Button>
          </QueryState>
        </CardCustom>
      )}
      <TxMessage tx={tx} />
      <Tabs
        label="Các phiên đấu giá"
        tabs={tabs}
        selected={tab}
        onChange={(next) => {
          setTab(next);
          setCursors([null]);
        }}
        panels={{
          open: renderPanel("open"),
          ended: renderPanel("ended"),
          mine: renderPanel("mine"),
        }}
      />
    </>
  );
}

export default function MarketView() {
  return (
    <CosmeticPage page="market">
      <MarketContent />
    </CosmeticPage>
  );
}
