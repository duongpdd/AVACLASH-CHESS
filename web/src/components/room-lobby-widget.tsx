"use client";
import { useUiCopy } from "@/i18n/use-ui-copy";
import { CardCustom } from "@/components/ui/card-custom";
import { CURRENCY_SYMBOL } from "@/config/env";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/status/field-error";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { targetChain } from "@/config/wagmi";
import { useCreateRoom } from "@/hooks/use-create-room";
import { useJoinRoom } from "@/hooks/use-join-room";
import { useRoom } from "@/hooks/use-room";
import { useOpenRooms } from "@/hooks/use-open-rooms";
import { useWithdraw } from "@/hooks/use-withdraw";
import { useContractBytecodeGuard } from "@/hooks/use-contract-bytecode-guard";
import TxStatusAlert from "./tx-status-alert";
import Icon from "./app-icon";
import WalletAction from "./wallet-action";
import { parseRoomId, getGameRoomUrl } from "@/utils/room";
import { useClientMounted } from "@/hooks/use-client-mounted";

export default function RoomLobbyWidget() {
  const uiText = useUiCopy();
  const mounted = useClientMounted();

  const { isConnected } = useAccount();
  const effectiveConnected = mounted && isConnected;
  const chainId = useChainId();
  const isWrongNetwork = effectiveConnected && chainId !== targetChain.id;
  const { isBlocked: isConfigBlocked, errorMessage: configLockReason } =
    useContractBytecodeGuard();

  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  // Create Room Hook
  const createForm = useForm({
    defaultValues: { stake: "0.01", creatorIsWhite: true },
  });
  const stake = useWatch({ control: createForm.control, name: "stake" });
  const creatorIsWhite = useWatch({
    control: createForm.control,
    name: "creatorIsWhite",
  });
  const {
    createRoom,
    step: createStep,
    errorMessage: createError,
    txHash: createTxHash,
    createdRoomId,
    minStake,
    uiMaxStake,
    reset: resetCreate,
  } = useCreateRoom();

  // Join Room Hook
  const lookup = useForm({ defaultValues: { joinId: "", inspectId: "" } });
  const inputJoinId = useWatch({ control: lookup.control, name: "joinId" });
  const pendingJoinId = useDebouncedValue(inputJoinId);
  const [selectedJoinId, setSelectedJoinId] = useState<bigint>();
  const joinId = parseRoomId(pendingJoinId);
  const targetJoinId =
    selectedJoinId ?? (joinId === undefined ? undefined : BigInt(joinId));
  const waitingForLookup =
    selectedJoinId === undefined && inputJoinId !== pendingJoinId;
  const {
    joinRoom,
    room: previewRoom,
    exists: isRoomExists,
    joinable: isJoinable,
    joinableError,
    isLoadingRoom,
    joinerColor,
    stakeFormatted: joinStakeFormatted,
    isCreator: isJoinCreator,
    isOpen: isJoinOpen,
    step: joinStep,
    errorMessage: joinError,
    txHash: joinTxHash,
    reset: resetJoin,
  } = useJoinRoom(targetJoinId);

  // Open Rooms Hook
  const {
    openRooms,
    isLoading: isLoadingOpenRooms,
    errorMessage: openRoomsError,
    refetch: refetchOpenRooms,
  } = useOpenRooms(15);

  // Room Inspector Hook
  const inspectId = useWatch({ control: lookup.control, name: "inspectId" });
  const pendingInspectId = useDebouncedValue(inspectId);
  const targetInspectId = parseRoomId(pendingInspectId);
  const {
    room: inspectRoom,
    isLoading: isLoadingInspect,
    statusInfo: inspectStatusInfo,
    stakeFormatted: inspectStakeFormatted,
    exists: inspectExists,
  } = useRoom(targetInspectId);

  // Withdraw Hook
  const {
    withdraw,
    pendingBalance,
    pendingBalanceFormatted,
    step: withdrawStep,
    errorMessage: withdrawError,
    txHash: withdrawTxHash,
    reset: resetWithdraw,
  } = useWithdraw();

  const handleSelectOpenRoom = (roomId: bigint) => {
    lookup.setValue("joinId", roomId.toString());
    setSelectedJoinId(roomId);
    resetJoin();
    setActiveTab("join");
  };

  const roomReady =
    activeTab === "create" ? createStep === "success" : joinStep === "success";
  const connectedToTarget = effectiveConnected && !isWrongNetwork;
  const busyCreate =
    createStep === "waiting_wallet" || createStep === "confirming";
  const busyJoin = joinStep === "waiting_wallet" || joinStep === "confirming";
  const [copied, setCopied] = useState(false);
  const presets = [...new Set([minStake, "0.05", uiMaxStake])].filter(
    (v) => Number(v) > 0 && Number(v) <= Number(uiMaxStake),
  );
  return (
    <div>
      <ol
        className="entry-steps"
        aria-label={uiText("messageStepsToJoinAMatch")}
      >
        {[
          uiText("messageConnectToTheCorrectNetwork"),
          uiText("messageCreateOrChooseARoom"),
          uiText("messageSignToJoinTheMatch"),
        ].map((label, i) => {
          const current = !connectedToTarget ? 0 : roomReady ? 2 : 1;
          return (
            <li
              key={label}
              aria-current={i === current ? "step" : undefined}
              className={i < current ? "step-complete" : ""}
            >
              <span>
                {i < current ? (
                  <Icon name="check" className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      {pendingBalance > 0n && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-success/25 bg-status-success/5 p-4">
          <p className="text-sm text-status-success">
            {uiText("messageWithdrawableBalance2")}{" "}
            <strong className="ml-2 font-mono">
              {pendingBalanceFormatted} {CURRENCY_SYMBOL}
            </strong>
          </p>
          <Button
            onClick={() => void withdraw()}
            disabled={
              !connectedToTarget ||
              isConfigBlocked ||
              withdrawStep === "waiting_wallet" ||
              withdrawStep === "confirming"
            }
          >
            {uiText("messageWithdrawToWallet2")}
            <Icon name="arrow" />
          </Button>
        </div>
      )}
      <TxStatusAlert
        step={withdrawStep}
        errorMessage={withdrawError}
        txHash={withdrawTxHash}
        onReset={resetWithdraw}
        successMessage={uiText("messageTheAvailableBalanceWasWithdrawnTo")}
      />
      {isConfigBlocked && configLockReason && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-status-danger/30 bg-status-danger/5 p-4 text-sm text-status-danger"
        >
          {uiText("messageTheTransactionIsCurrentlyUnavailable")}{" "}
          {uiText.existing(configLockReason)}
        </div>
      )}
      <div className="lobby-layout">
        <CardCustom aria-labelledby="lobby-title">
          <div className="section-heading">
            <h2 id="lobby-title" className="text-description font-semibold">
              {uiText("messageYourRoom")}
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="clock" className="h-3.5 w-3.5" />5 + 0
            </span>
          </div>
          {!connectedToTarget && (
            <div className="mt-5">
              <WalletAction />
            </div>
          )}
          <div
            className="lobby-tabs"
            role="tablist"
            aria-label={uiText("messageRoomActions")}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "create"
                  : event.key === "End"
                    ? "join"
                    : activeTab === "create"
                      ? "join"
                      : "create";
              setActiveTab(next);
              document.getElementById(`${next}-tab`)?.focus();
            }}
          >
            <button
              type="button"
              role="tab"
              tabIndex={activeTab === "create" ? 0 : -1}
              aria-selected={activeTab === "create"}
              aria-controls="create-panel"
              id="create-tab"
              onClick={() => setActiveTab("create")}
            >
              <Icon name="plus" className="h-4 w-4" />
              {uiText("messageCreateRoom")}
            </button>
            <button
              type="button"
              role="tab"
              tabIndex={activeTab === "join" ? 0 : -1}
              aria-selected={activeTab === "join"}
              aria-controls="join-panel"
              id="join-tab"
              onClick={() => setActiveTab("join")}
            >
              <Icon name="arrow" className="h-4 w-4" />
              {uiText("messageJoinRoom")}
            </button>
          </div>
          {activeTab === "create" && (
            <form
              role="tabpanel"
              id="create-panel"
              noValidate
              onSubmit={createForm.handleSubmit(
                async ({ creatorIsWhite, stake }) => {
                  if (connectedToTarget && !isConfigBlocked && !busyCreate) {
                    await createRoom(creatorIsWhite, stake);
                  }
                },
              )}
              aria-labelledby="create-tab"
              className="space-y-5"
            >
              <fieldset>
                <legend className="field-label">
                  {uiText("messageChooseYourSide")}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="seat-choice"
                    aria-pressed={creatorIsWhite}
                    onClick={() => createForm.setValue("creatorIsWhite", true)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="seat-piece text-foreground"
                        aria-hidden="true"
                      >
                        ♔
                      </span>
                      <span>
                        <strong>{uiText("messageWhite")}</strong>
                        <small>{uiText("messageMovesFirst")}</small>
                      </span>
                    </span>
                    <span className="seat-check" />
                  </button>
                  <button
                    type="button"
                    className="seat-choice"
                    aria-pressed={!creatorIsWhite}
                    onClick={() => createForm.setValue("creatorIsWhite", false)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="seat-piece text-muted-foreground"
                        aria-hidden="true"
                      >
                        ♚
                      </span>
                      <span>
                        <strong>{uiText("messageBlack")}</strong>
                        <small>{uiText("messageMovesSecond")}</small>
                      </span>
                    </span>
                    <span className="seat-check" />
                  </button>
                </div>
              </fieldset>
              <div>
                <label htmlFor="create-stake" className="field-label">
                  {uiText("messageStakePerPlayer")}
                </label>
                <div className="stake-input">
                  <Input
                    id="create-stake"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={minStake}
                    max={uiMaxStake}
                    aria-invalid={!!createForm.formState.errors.stake}
                    {...createForm.register("stake", {
                      required: uiText("messageEnterAStake"),
                      min: {
                        value: Number(minStake),
                        message: uiText("messageMinimumStake", {
                          p0: String(minStake),
                        }),
                      },
                      max: {
                        value: Number(uiMaxStake),
                        message: uiText("messageMaximumStake", {
                          p0: String(uiMaxStake),
                        }),
                      },
                    })}
                    aria-describedby="stake-limits"
                  />
                  <span>{CURRENCY_SYMBOL}</span>
                </div>
                <FieldError
                  message={createForm.formState.errors.stake?.message}
                />
                <div className="stake-presets">
                  {presets.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={stake === value}
                      onClick={() =>
                        createForm.setValue("stake", value, {
                          shouldValidate: true,
                        })
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p id="stake-limits" className="helper-text mt-2">
                  {uiText("messageFrom")} {minStake} {uiText("messageTo")}{" "}
                  {uiMaxStake} {CURRENCY_SYMBOL}{" "}
                  {uiText("messageInTheTestInterface")}
                </p>
              </div>
              <div
                className="cost-summary"
                aria-label={uiText("messageRoomCreationCosts")}
              >
                <div>
                  <span>{uiText("messageYourDeposit")}</span>
                  <strong>
                    {stake || "—"} {CURRENCY_SYMBOL}
                  </strong>
                </div>
                <div>
                  <span>{uiText("messageNetworkFee")}</span>
                  <span>
                    {uiText("messageShownInYourWalletBeforeConfirmation")}
                  </span>
                </div>
                <div>
                  <span>{uiText("messageSignToJoinAfterward")}</span>
                  <span className="text-status-success/90">
                    {uiText("messageNoFees")}
                  </span>
                </div>
              </div>
              {connectedToTarget && (
                <Button
                  type="submit"
                  tone="primary"
                  className="w-full"
                  disabled={
                    isConfigBlocked ||
                    busyCreate ||
                    createForm.formState.isSubmitting
                  }
                >
                  {createStep === "waiting_wallet" ? (
                    uiText("messageConfirmTheTransactionInYourWallet")
                  ) : createStep === "confirming" ? (
                    uiText("messageCreatingTheRoom")
                  ) : (
                    <>
                      {uiText("messageCreateRoom2")} {stake || "0"}{" "}
                      {CURRENCY_SYMBOL}
                      <Icon name="arrow" />
                    </>
                  )}
                </Button>
              )}
              <TxStatusAlert
                step={createStep}
                errorMessage={createError}
                txHash={createTxHash}
                onReset={resetCreate}
                successMessage={
                  createdRoomId !== null
                    ? uiText("messageRoomCreated", {
                        p0: String(createdRoomId?.toString()),
                      })
                    : uiText("messageRoomCreated2")
                }
              />
              {createStep === "success" && createdRoomId !== null && (
                <div className="space-y-3 rounded-xl border border-status-success/25 bg-status-success/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-status-success">
                      {uiText("messageRoomCode")}{" "}
                      <strong className="font-mono">
                        #{createdRoomId.toString()}
                      </strong>
                    </p>
                    <button
                      type="button"
                      className="button-quiet text-xs"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            createdRoomId.toString(),
                          );
                          setCopied(true);
                        } catch {
                          setCopied(false);
                        }
                      }}
                    >
                      <Icon name="copy" className="h-4 w-4" />
                      {copied
                        ? uiText("messageCopied")
                        : uiText("messageCopyCode")}
                    </button>
                  </div>
                  <p className="helper-text">
                    {uiText("messageShareTheCodeWithYourOpponent")}
                  </p>
                  <Link
                    href={getGameRoomUrl(createdRoomId)}
                    className="button-secondary w-full"
                  >
                    {uiText("messageOpenTheWaitingRoom")}
                    <Icon name="arrow" />
                  </Link>
                </div>
              )}
            </form>
          )}
          {activeTab === "join" && (
            <div
              role="tabpanel"
              id="join-panel"
              aria-labelledby="join-tab"
              className="space-y-5"
            >
              <div>
                <label htmlFor="join-room-id" className="field-label">
                  {uiText("messageRoomCodeFromAFriend")}
                </label>
                <input
                  id="join-room-id"
                  className="form-input"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder={uiText("messageExample6")}
                  {...lookup.register("joinId", {
                    onChange: () => {
                      setSelectedJoinId(undefined);
                      resetJoin();
                    },
                  })}
                />
              </div>
              {waitingForLookup ||
              (isLoadingRoom && targetJoinId !== undefined) ? (
                <p role="status" className="helper-text">
                  {uiText("messageLookingUpRoom")}
                </p>
              ) : previewRoom && isRoomExists && targetJoinId !== undefined ? (
                <div className="rounded-xl border border-foreground/10 bg-background/30 p-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <strong>
                      {uiText("messageRoom")}
                      {inputJoinId}
                    </strong>
                    <span className="text-muted-foreground">
                      {isJoinOpen
                        ? uiText("messageWaitingForAnOpponent2")
                        : uiText("messageNoLongerOpen")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {uiText("messageRoomCreator")}
                      {isJoinCreator ? uiText("messageYou3") : ""}
                    </span>
                    <span className="font-mono" title={previewRoom.playerA}>
                      {previewRoom.playerA.slice(0, 6)}…
                      {previewRoom.playerA.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {uiText("messageYourSide2")}
                    </span>
                    <strong>
                      {joinerColor === "White"
                        ? uiText("messageWhiteMovesFirst")
                        : uiText("messageBlackMovesSecond")}
                    </strong>
                  </div>
                  <div className="cost-summary !pb-0">
                    <div>
                      <span>{uiText("messageYourDeposit")}</span>
                      <strong>
                        {joinStakeFormatted} {CURRENCY_SYMBOL}
                      </strong>
                    </div>
                    <div>
                      <span>{uiText("messageNetworkFee")}</span>
                      <span>
                        {uiText("messageShownInYourWalletBeforeConfirmation")}
                      </span>
                    </div>
                    <div>
                      <span>{uiText("messageSignToJoinAfterward")}</span>
                      <span className="text-status-success/90">
                        {uiText("messageNoFees")}
                      </span>
                    </div>
                  </div>
                  {!isJoinable && joinableError && (
                    <p role="alert" className="text-sm text-status-warning">
                      {uiText.existing(joinableError)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-foreground/10 p-5 text-sm text-muted-foreground">
                  {inputJoinId
                    ? uiText("messageRoomNotFoundCheckTheCode")
                    : uiText("messageEnterTheCodeToSeeYour")}
                </div>
              )}
              {connectedToTarget && (
                <Button
                  type="button"
                  tone="primary"
                  className="w-full"
                  disabled={
                    isConfigBlocked ||
                    waitingForLookup ||
                    !previewRoom ||
                    !isRoomExists ||
                    !isJoinable ||
                    targetJoinId === undefined ||
                    busyJoin
                  }
                  onClick={() => void joinRoom(targetJoinId)}
                >
                  {joinStep === "waiting_wallet" ? (
                    uiText("messageConfirmJoiningInYourWallet")
                  ) : joinStep === "confirming" ? (
                    uiText("messageJoiningTheRoom")
                  ) : (
                    <>
                      {uiText("messageConfirmJoining")}
                      <Icon name="arrow" />
                    </>
                  )}
                </Button>
              )}
              <TxStatusAlert
                step={joinStep}
                errorMessage={joinError}
                txHash={joinTxHash}
                onReset={resetJoin}
                successMessage={uiText("messageJoinedRoom", {
                  p0: String(inputJoinId),
                })}
              />
              {joinStep === "success" &&
                !waitingForLookup &&
                targetJoinId !== undefined && (
                  <Link
                    href={getGameRoomUrl(targetJoinId)}
                    className="button-secondary w-full"
                  >
                    {uiText("messageOpenTheBoardNow")}
                    <Icon name="arrow" />
                  </Link>
                )}
            </div>
          )}
        </CardCustom>
        <CardCustom aria-labelledby="open-rooms-title">
          <div className="section-heading">
            <h2
              className="text-description font-semibold"
              id="open-rooms-title"
            >
              {uiText("messageOpenRooms")}
              <span className="room-count">{openRooms.length}</span>
            </h2>
            <button
              type="button"
              className="button-quiet !min-h-9 !p-1.5"
              onClick={() => refetchOpenRooms()}
              disabled={isLoadingOpenRooms}
              aria-label={uiText("messageRefreshRooms")}
            >
              <Icon
                name="refresh"
                className={
                  isLoadingOpenRooms ? "animate-spin h-4 w-4" : "h-4 w-4"
                }
              />
            </button>
          </div>
          <p className="helper-text mt-1">
            {uiText("messageChooseARoomToSeeIts")}
          </p>
          {openRoomsError ? (
            <div role="alert" className="room-empty">
              <Icon name="info" />
              <h3>{uiText("messageCouldNotLoadTheRooms")}</h3>
              <p className="helper-text">
                {uiText("messageCheckYourNetworkConnectionAndRefresh")}
              </p>
            </div>
          ) : isLoadingOpenRooms && !openRooms.length ? (
            <div role="status" className="room-empty">
              <Icon name="refresh" className="animate-spin mb-4" />
              <p className="helper-text">{uiText("messageLoadingOpenRooms")}</p>
            </div>
          ) : !openRooms.length ? (
            <div className="room-empty">
              <span className="icon-tile">
                <Icon name="board" className="h-6 w-6" />
              </span>
              <h3>{uiText("messageNoOpenRoomsYet")}</h3>
              <p className="helper-text">
                {uiText("messageCreateTheFirstRoomAndShare")}
              </p>
              <button
                type="button"
                className="text-link mt-5"
                onClick={() => {
                  setActiveTab("create");
                  document.getElementById("create-tab")?.focus();
                }}
              >
                {uiText("messageCreateYourRoom")}
                <Icon name="arrow" />
              </button>
            </div>
          ) : (
            <div className="room-list custom-scrollbar">
              {openRooms.map((r) => (
                <article key={r.id.toString()} className="room-row">
                  <div>
                    <strong>
                      {uiText("messageRoom")}
                      {r.id.toString()}
                    </strong>
                    <p>
                      {r.stakeFormatted} {CURRENCY_SYMBOL}{" "}
                      <span className="mx-1 text-muted-foreground">·</span>{" "}
                      {uiText("messageYouPlay")}{" "}
                      {r.creatorIsWhite
                        ? uiText("messageBlack")
                        : uiText("messageWhite")}
                    </p>
                    <p className="font-mono !text-[11px]" title={r.playerA}>
                      {r.playerA.slice(0, 6)}…{r.playerA.slice(-4)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    aria-label={uiText("messageChooseRoom", {
                      p0: String(r.id),
                    })}
                    onClick={() => {
                      handleSelectOpenRoom(r.id);
                      document.getElementById("join-tab")?.focus();
                    }}
                  >
                    {uiText("messageJoinRoom")}
                    <Icon name="arrow" className="h-4 w-4" />
                  </Button>
                </article>
              ))}
            </div>
          )}
          <details className="room-inspector">
            <summary>{uiText("messageLookUpARoomByCode")}</summary>
            <label htmlFor="inspect-id" className="field-label">
              {uiText("messageRoomCodeToLookUp")}
            </label>
            <input
              id="inspect-id"
              className="form-input"
              inputMode="numeric"
              placeholder={uiText("messageExample6")}
              {...lookup.register("inspectId")}
            />
            {(targetInspectId !== undefined || !!inspectId) && (
              <div className="mt-3 text-sm">
                {inspectId !== pendingInspectId || isLoadingInspect ? (
                  <p className="helper-text">{uiText("messageLoadingRoom")}</p>
                ) : inspectRoom && inspectExists ? (
                  <div className="space-y-3">
                    <p>
                      {uiText("messageRoom")}
                      {inspectId}{" "}
                      <span className="ml-2 text-muted-foreground">
                        {inspectStatusInfo &&
                          uiText.existing(inspectStatusInfo.label)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {inspectStakeFormatted} {CURRENCY_SYMBOL}{" "}
                      {uiText("messagePerPlayer")}
                    </p>
                    <Link
                      href={getGameRoomUrl(targetInspectId!)}
                      className="text-link"
                    >
                      {uiText("messageOpenBoard")}
                      <Icon name="arrow" />
                    </Link>
                  </div>
                ) : (
                  <p className="helper-text">
                    {uiText("messageRoomNotFound")}
                    {inspectId}.
                  </p>
                )}
              </div>
            )}
          </details>
        </CardCustom>
      </div>
    </div>
  );
}
