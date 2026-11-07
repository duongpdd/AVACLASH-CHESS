"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import AppHeader from "@/components/app-header";
import WalletAction from "@/components/wallet-action";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, StatusPill } from "@/components/ui-state";
import { CHAIN_ID, cosmeticsEnabled } from "@/config/env";
import {
  PAGE_SIZE,
  useCollection,
  useTrophies,
} from "@/hooks/use-cosmetic-reads";
import { useCosmeticTx } from "@/hooks/use-cosmetic-tx";
import {
  cards,
  CosmeticNotice,
  Pager,
  QueryState,
  SkinPreview,
  TxMessage,
  useKindName,
} from "./cosmetic-ui";

function WalletCollection({
  address,
  canWrite,
}: {
  address: Address;
  canWrite: boolean;
}) {
  const t = useTranslations("cosmetics");
  const kindName = useKindName();
  const [collectionOffset, setCollectionOffset] = useState(0n);
  const [trophyOffset, setTrophyOffset] = useState(0n);
  const collection = useCollection(address, collectionOffset);
  const trophies = useTrophies(address, trophyOffset);
  const tx = useCosmeticTx();

  return (
    <div className="grid min-w-0 gap-6">
      {!canWrite && <WalletAction />}
      <TxMessage tx={tx} />
      <section aria-labelledby="cosmetics-owned" className="grid min-w-0 gap-3">
        <h2 id="cosmetics-owned" className="text-lg font-semibold">
          {t("owned")}
        </h2>
        <QueryState
          query={collection}
          label={t("loadingCollection")}
          empty={
            !collection.data?.items.length ? t("emptyCollection") : undefined
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
                    {t("itemLine", {
                      kind: kindName(item.kind),
                      serial: String(item.serial),
                      tournament: item.tournamentId.toString(),
                    })}
                  </p>
                  {equipped && (
                    <StatusPill tone="success">{t("equipped")}</StatusPill>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!canWrite || tx.busy}
                      onClick={() =>
                        void tx.send(
                          equipped
                            ? {
                                functionName: "unequip",
                                args: [item.kind],
                              }
                            : {
                                functionName: "equip",
                                args: [item.tokenId],
                              },
                        )
                      }
                    >
                      {t(equipped ? "unequip" : "equip")}
                    </Button>
                  </div>
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
          {t("trophies")}
        </h2>
        <QueryState
          query={trophies}
          label={t("loadingTrophies")}
          empty={!trophies.data?.items.length ? t("emptyTrophies") : undefined}
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
                  {t("trophyLine", {
                    kind: kindName(item.kind),
                    tournament: item.id.toString(),
                  })}
                </p>
                <Button
                  tone="primary"
                  disabled={!canWrite || tx.busy}
                  onClick={() =>
                    void tx.send({
                      functionName: "claimTrophy",
                      args: [item.id],
                    })
                  }
                >
                  {t("claim")}
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
  const t = useTranslations("cosmetics");
  const { address, chainId } = useAccount();
  if (!address) {
    return <EmptyState title={t("connectPrompt")} action={<WalletAction />} />;
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
  const t = useTranslations("cosmetics");
  return (
    <div className="app-shell">
      <AppHeader active="collection" />
      <main className="site-container grid min-w-0 gap-4 py-6">
        <PageHeader
          title={t("title")}
          description={
            <>
              <CosmeticNotice /> {t("boundNotice")}
            </>
          }
        />
        {cosmeticsEnabled ? (
          <CollectionContent />
        ) : (
          <EmptyState title={t("notEnabled")} />
        )}
      </main>
    </div>
  );
}
