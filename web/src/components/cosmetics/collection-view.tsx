"use client";

import { useId, useState } from "react";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import WalletAction from "@/components/wallet-action";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { EmptyState, StatusPill } from "@/components/ui-state";
import { AUCTION_ADDRESS, CHAIN_ID, CURRENCY_SYMBOL } from "@/config/env";
import {
  collectionContract,
  PAGE_SIZE,
  useAuctionDurations,
  useCollection,
  useCosmeticQuery,
  useTrophies,
  type CosmeticItem,
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

function ListingForm({
  item,
  onCancel,
  tx,
}: {
  item: CosmeticItem;
  onCancel: () => void;
  tx: CosmeticTx;
}) {
  const id = useId();
  const approval = useCosmeticQuery(
    ["approval", item.tokenId.toString()],
    (client) =>
      client.readContract({
        ...collectionContract,
        functionName: "getApproved",
        args: [item.tokenId],
      }),
  );
  const approved =
    approval.data?.toLowerCase() === AUCTION_ADDRESS.toLowerCase();
  const durations = useAuctionDurations();
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const reserve = nativeAmount(price.trim());
  const seconds = /^\d{1,12}$/.test(duration) ? BigInt(duration) : 0n;
  const validDuration =
    durations.data &&
    seconds >= durations.data[0] &&
    seconds <= durations.data[1];

  return (
    <QueryState query={approval} label="Đang kiểm tra phê duyệt">
      <QueryState query={durations} label="Đang đọc thời lượng phiên">
        <form
          className="grid gap-3 border-t border-border pt-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              approved &&
              reserve &&
              validDuration &&
              (await tx.send({
                contract: "auction",
                functionName: "create",
                args: [item.tokenId, reserve, seconds],
              }))
            )
              onCancel();
          }}
        >
          <ol
            className="grid gap-1 text-sm"
            aria-label="Tiến trình rao đấu giá"
          >
            <li aria-current={!approved ? "step" : undefined}>
              {approved ? "1. Đã phê duyệt NFT" : "1. Phê duyệt NFT cho chợ"}
            </li>
            <li aria-current={approved ? "step" : undefined}>
              2. Tạo phiên và ký gửi NFT
            </li>
          </ol>
          <label htmlFor={`${id}-price`}>
            Giá khởi điểm ({CURRENCY_SYMBOL} thử nghiệm)
          </label>
          <input
            id={`${id}-price`}
            className="input-field min-h-11 min-w-0 w-full rounded-md border border-border bg-background px-3"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.01"
            required
          />
          <label htmlFor={`${id}-duration`}>Thời lượng (giây)</label>
          <input
            id={`${id}-duration`}
            className="input-field min-h-11 min-w-0 w-full rounded-md border border-border bg-background px-3"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder={durations.data?.[0].toString()}
            required
            aria-describedby={`${id}-range`}
          />
          <p className="helper-text" id={`${id}-range`}>
            Từ {durations.data?.[0].toString()} đến{" "}
            {durations.data?.[1].toString()} giây. NFT đang ký gửi sẽ được bỏ
            trang bị.
          </p>
          <div className="flex flex-wrap gap-2">
            {approved ? (
              <Button
                type="submit"
                tone="primary"
                disabled={tx.busy || !reserve || !validDuration}
              >
                Tạo phiên
              </Button>
            ) : (
              <Button
                tone="primary"
                disabled={tx.busy}
                onClick={() =>
                  void tx.send({
                    contract: "cosmetics",
                    functionName: "approve",
                    args: [AUCTION_ADDRESS, item.tokenId],
                  })
                }
              >
                Phê duyệt NFT
              </Button>
            )}
            <Button disabled={tx.busy} onClick={onCancel}>
              Đóng biểu mẫu
            </Button>
          </div>
        </form>
      </QueryState>
    </QueryState>
  );
}

function WalletCollection({
  address,
  canWrite,
}: {
  address: Address;
  canWrite: boolean;
}) {
  const [collectionOffset, setCollectionOffset] = useState(0n);
  const [trophyOffset, setTrophyOffset] = useState(0n);
  const [listing, setListing] = useState<bigint>();
  const collection = useCollection(address, collectionOffset);
  const trophies = useTrophies(address, trophyOffset);
  const tx = useCosmeticTx();

  return (
    <div className="grid min-w-0 gap-6">
      {!canWrite && <WalletAction />}
      <TxMessage tx={tx} />
      <section aria-labelledby="cosmetics-owned" className="grid min-w-0 gap-3">
        <h2 id="cosmetics-owned" className="text-lg font-semibold">
          Vật phẩm của bạn
        </h2>
        <QueryState
          query={collection}
          label="Đang đọc bộ sưu tập"
          empty={
            !collection.data?.items.length
              ? "Trang này chưa có vật phẩm"
              : undefined
          }
        >
          <div className={cards}>
            {collection.data?.items.map((item) => {
              const equipped =
                item.tokenId ===
                (item.kind === 0
                  ? collection.data?.boardId
                  : collection.data?.piecesId);
              return (
                <CardCustom
                  as="article"
                  key={item.tokenId}
                  className="grid min-w-0 content-start gap-3"
                >
                  <SkinPreview kind={item.kind} theme={item.theme} />
                  <h3 className="break-words font-semibold">{item.name}</h3>
                  <p className="helper-text">
                    {kindName(item.kind)} · Bản số {item.serial} · Giải #
                    {item.tournamentId.toString()}
                  </p>
                  {equipped && (
                    <StatusPill tone="success">Đang trang bị</StatusPill>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!canWrite || tx.busy}
                      onClick={() =>
                        void tx.send(
                          equipped
                            ? {
                                contract: "cosmetics",
                                functionName: "unequip",
                                args: [item.kind],
                              }
                            : {
                                contract: "cosmetics",
                                functionName: "equip",
                                args: [item.tokenId],
                              },
                        )
                      }
                    >
                      {equipped ? "Bỏ trang bị" : "Trang bị"}
                    </Button>
                    <Button
                      disabled={!canWrite || tx.busy}
                      aria-expanded={listing === item.tokenId}
                      onClick={() =>
                        setListing(
                          listing === item.tokenId ? undefined : item.tokenId,
                        )
                      }
                    >
                      Rao đấu giá
                    </Button>
                  </div>
                  {canWrite && listing === item.tokenId && (
                    <ListingForm
                      item={item}
                      tx={tx}
                      onCancel={() => setListing(undefined)}
                    />
                  )}
                </CardCustom>
              );
            })}
          </div>
        </QueryState>
        <Pager
          newer={
            collectionOffset > 0n
              ? () => setCollectionOffset(collectionOffset - PAGE_SIZE)
              : undefined
          }
          older={
            collection.data &&
            collectionOffset + PAGE_SIZE < collection.data.total
              ? () => setCollectionOffset(collectionOffset + PAGE_SIZE)
              : undefined
          }
        />
      </section>
      <section
        aria-labelledby="cosmetics-trophies"
        className="grid min-w-0 gap-3"
      >
        <h2 id="cosmetics-trophies" className="text-lg font-semibold">
          Cúp có thể nhận
        </h2>
        <QueryState
          query={trophies}
          label="Đang đọc các cúp"
          empty={
            !trophies.data?.items.length
              ? "Trang này chưa có cúp đủ điều kiện"
              : undefined
          }
        >
          <div className={cards}>
            {trophies.data?.items.map((item) => (
              <CardCustom
                as="article"
                key={item.id}
                className="grid min-w-0 content-start gap-3"
              >
                <SkinPreview kind={item.kind} theme={item.theme} />
                <h3 className="break-words font-semibold">{item.name}</h3>
                <p className="helper-text">
                  {kindName(item.kind)} · Giải #{item.id.toString()}
                </p>
                <Button
                  tone="primary"
                  disabled={!canWrite || tx.busy}
                  onClick={() =>
                    void tx.send({
                      contract: "cosmetics",
                      functionName: "claimTrophy",
                      args: [item.id],
                    })
                  }
                >
                  Nhận skin
                </Button>
              </CardCustom>
            ))}
          </div>
        </QueryState>
        <Pager
          newer={
            trophyOffset > 0n
              ? () => setTrophyOffset(trophyOffset - PAGE_SIZE)
              : undefined
          }
          older={
            trophies.data && trophyOffset + PAGE_SIZE < trophies.data.total
              ? () => setTrophyOffset(trophyOffset + PAGE_SIZE)
              : undefined
          }
        />
      </section>
    </div>
  );
}

function CollectionContent() {
  const { address, chainId } = useAccount();
  if (!address) {
    return (
      <EmptyState
        title="Kết nối ví để xem bộ sưu tập"
        action={<WalletAction />}
      />
    );
  }
  return (
    <WalletCollection
      key={address}
      address={address}
      canWrite={chainId === CHAIN_ID}
    />
  );
}

export default function CollectionView() {
  return (
    <CosmeticPage page="collection">
      <CollectionContent />
    </CosmeticPage>
  );
}
