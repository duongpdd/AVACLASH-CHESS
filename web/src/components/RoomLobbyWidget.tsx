"use client";
import { CURRENCY_SYMBOL } from "@/config/env";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { targetChain } from "@/config/wagmi";
import { useCreateRoom } from "@/hooks/useCreateRoom";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import { useRoom } from "@/hooks/useRoom";
import { useOpenRooms } from "@/hooks/useOpenRooms";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useContractBytecodeGuard } from "@/hooks/useContractBytecodeGuard";
import TxStatusAlert from "./TxStatusAlert";
import Icon from "./Icon";
import WalletAction from "./WalletAction";
import { parseRoomId, getGameRoomUrl } from "@/utils/room";
import { useClientMounted } from "@/hooks/useClientMounted";

export default function RoomLobbyWidget() {
  const mounted = useClientMounted();

  const { isConnected } = useAccount();
  const effectiveConnected = mounted && isConnected;
  const chainId = useChainId();
  const isWrongNetwork = effectiveConnected && chainId !== targetChain.id;
  const { isBlocked: isConfigBlocked, errorMessage: configLockReason } =
    useContractBytecodeGuard();

  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  // Create Room Hook
  const [stake, setStake] = useState<string>("0.01");
  const [creatorIsWhite, setCreatorIsWhite] = useState<boolean>(true);
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
  const [inputJoinId, setInputJoinId] = useState<string>("");
  const [targetJoinId, setTargetJoinId] = useState<bigint | number | undefined>(
    undefined,
  );
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
  const [inspectId, setInspectId] = useState<string>("");
  const [targetInspectId, setTargetInspectId] = useState<
    bigint | number | undefined
  >(undefined);
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

  const handleLookupJoin = (val: string) => {
    setInputJoinId(val);
    const parsed = parseRoomId(val);
    if (parsed !== undefined) {
      setTargetJoinId(BigInt(parsed));
      resetJoin();
    } else {
      setTargetJoinId(undefined);
    }
  };

  const handleLookupInspect = (val: string) => {
    setInspectId(val);
    const parsed = parseRoomId(val);
    if (parsed !== undefined) {
      setTargetInspectId(BigInt(parsed));
    } else {
      setTargetInspectId(undefined);
    }
  };

  const handleSelectOpenRoom = (roomId: bigint) => {
    setInputJoinId(roomId.toString());
    setTargetJoinId(roomId);
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
      <ol className="entry-steps" aria-label="Các bước vào trận">
        {["Nối ví đúng mạng", "Tạo hoặc chọn phòng", "Ký vào trận"].map(
          (label, i) => {
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
          },
        )}
      </ol>
      {pendingBalance > 0n && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-sm text-emerald-200">
            Số dư có thể rút{" "}
            <strong className="ml-2 font-mono">
              {pendingBalanceFormatted} {CURRENCY_SYMBOL}
            </strong>
          </p>
          <button
            className="button-secondary"
            onClick={() => void withdraw()}
            disabled={
              !connectedToTarget ||
              isConfigBlocked ||
              withdrawStep === "waiting_wallet" ||
              withdrawStep === "confirming"
            }
          >
            Rút về ví
            <Icon name="arrow" />
          </button>
        </div>
      )}
      <TxStatusAlert
        step={withdrawStep}
        errorMessage={withdrawError}
        txHash={withdrawTxHash}
        onReset={resetWithdraw}
        successMessage="Đã rút số dư khả dụng về ví."
      />
      {isConfigBlocked && configLockReason && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200"
        >
          Chưa thể thực hiện giao dịch. {configLockReason}
        </div>
      )}
      <div className="lobby-layout">
        <section className="surface-card" aria-labelledby="lobby-title">
          <div className="section-heading">
            <h2 id="lobby-title" className="section-title">
              Phòng của bạn
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
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
            aria-label="Thao tác phòng"
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
              Tạo phòng
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
              Vào phòng
            </button>
          </div>
          {activeTab === "create" && (
            <div
              role="tabpanel"
              id="create-panel"
              aria-labelledby="create-tab"
              className="space-y-5"
            >
              <fieldset>
                <legend className="field-label">Chọn quân của bạn</legend>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="seat-choice"
                    aria-pressed={creatorIsWhite}
                    onClick={() => setCreatorIsWhite(true)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="seat-piece text-slate-100"
                        aria-hidden="true"
                      >
                        ♔
                      </span>
                      <span>
                        <strong>Trắng</strong>
                        <small>Đi trước</small>
                      </span>
                    </span>
                    <span className="seat-check" />
                  </button>
                  <button
                    type="button"
                    className="seat-choice"
                    aria-pressed={!creatorIsWhite}
                    onClick={() => setCreatorIsWhite(false)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="seat-piece text-slate-400"
                        aria-hidden="true"
                      >
                        ♚
                      </span>
                      <span>
                        <strong>Đen</strong>
                        <small>Đi sau</small>
                      </span>
                    </span>
                    <span className="seat-check" />
                  </button>
                </div>
              </fieldset>
              <div>
                <label htmlFor="create-stake" className="field-label">
                  Tiền cược mỗi người
                </label>
                <div className="stake-input">
                  <input
                    id="create-stake"
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={minStake}
                    max={uiMaxStake}
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    aria-describedby="stake-limits"
                  />
                  <span>{CURRENCY_SYMBOL}</span>
                </div>
                <div className="stake-presets">
                  {presets.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={stake === value}
                      onClick={() => setStake(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p id="stake-limits" className="helper-text mt-2">
                  Từ {minStake} đến {uiMaxStake} {CURRENCY_SYMBOL} trong giao
                  diện thử nghiệm.
                </p>
              </div>
              <div className="cost-summary" aria-label="Chi phí tạo phòng">
                <div>
                  <span>Bạn gửi vào phòng</span>
                  <strong>
                    {stake || "—"} {CURRENCY_SYMBOL}
                  </strong>
                </div>
                <div>
                  <span>Phí mạng</span>
                  <span>Ví hiển thị trước khi xác nhận</span>
                </div>
                <div>
                  <span>Ký vào trận sau đó</span>
                  <span className="text-emerald-300/90">Không mất phí</span>
                </div>
              </div>
              {connectedToTarget && (
                <button
                  type="button"
                  className="button-primary w-full"
                  disabled={isConfigBlocked || busyCreate}
                  onClick={() => void createRoom(creatorIsWhite, stake)}
                >
                  {createStep === "waiting_wallet" ? (
                    "Xác nhận giao dịch trong ví…"
                  ) : createStep === "confirming" ? (
                    "Đang xác nhận tạo phòng…"
                  ) : (
                    <>
                      Tạo phòng · {stake || "0"} {CURRENCY_SYMBOL}
                      <Icon name="arrow" />
                    </>
                  )}
                </button>
              )}
              <TxStatusAlert
                step={createStep}
                errorMessage={createError}
                txHash={createTxHash}
                onReset={resetCreate}
                successMessage={
                  createdRoomId !== null
                    ? `Đã tạo phòng #${createdRoomId?.toString()}.`
                    : "Đã tạo phòng."
                }
              />
              {createStep === "success" && createdRoomId !== null && (
                <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-emerald-200">
                      Mã phòng{" "}
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
                      {copied ? "Đã sao chép" : "Sao chép mã"}
                    </button>
                  </div>
                  <p className="helper-text">
                    Gửi mã cho đối thủ, sau đó mở bàn chờ.
                  </p>
                  <Link
                    href={getGameRoomUrl(createdRoomId)}
                    className="button-secondary w-full"
                  >
                    Vào bàn chờ
                    <Icon name="arrow" />
                  </Link>
                </div>
              )}
            </div>
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
                  Mã phòng từ bạn bè
                </label>
                <input
                  id="join-room-id"
                  className="form-input"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Ví dụ: 6"
                  value={inputJoinId}
                  onChange={(e) => handleLookupJoin(e.target.value)}
                />
              </div>
              {isLoadingRoom && targetJoinId !== undefined ? (
                <p role="status" className="helper-text">
                  Đang tìm phòng…
                </p>
              ) : previewRoom && isRoomExists && targetJoinId !== undefined ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <strong>Phòng #{inputJoinId}</strong>
                    <span className="text-slate-400">
                      {isJoinOpen ? "Đang chờ đối thủ" : "Không còn mở"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">
                      Chủ phòng{isJoinCreator ? " (bạn)" : ""}
                    </span>
                    <span className="font-mono" title={previewRoom.playerA}>
                      {previewRoom.playerA.slice(0, 6)}…
                      {previewRoom.playerA.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quân của bạn</span>
                    <strong>
                      {joinerColor === "White"
                        ? "Trắng · Đi trước"
                        : "Đen · Đi sau"}
                    </strong>
                  </div>
                  <div className="cost-summary !pb-0">
                    <div>
                      <span>Bạn gửi vào phòng</span>
                      <strong>
                        {joinStakeFormatted} {CURRENCY_SYMBOL}
                      </strong>
                    </div>
                    <div>
                      <span>Phí mạng</span>
                      <span>Ví hiển thị trước khi xác nhận</span>
                    </div>
                    <div>
                      <span>Ký vào trận sau đó</span>
                      <span className="text-emerald-300/90">Không mất phí</span>
                    </div>
                  </div>
                  {!isJoinable && joinableError && (
                    <p role="alert" className="text-sm text-amber-200">
                      {joinableError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                  {inputJoinId
                    ? "Không tìm thấy phòng. Kiểm tra lại mã hoặc chọn phòng đang mở bên cạnh."
                    : "Nhập mã để xem màu quân và tiền cược trước khi tham gia."}
                </div>
              )}
              {connectedToTarget && (
                <button
                  type="button"
                  className="button-primary w-full"
                  disabled={
                    isConfigBlocked ||
                    !previewRoom ||
                    !isRoomExists ||
                    !isJoinable ||
                    targetJoinId === undefined ||
                    busyJoin
                  }
                  onClick={() => void joinRoom(targetJoinId)}
                >
                  {joinStep === "waiting_wallet" ? (
                    "Xác nhận tham gia trong ví…"
                  ) : joinStep === "confirming" ? (
                    "Đang xác nhận vào phòng…"
                  ) : (
                    <>
                      Xác nhận vào phòng
                      <Icon name="arrow" />
                    </>
                  )}
                </button>
              )}
              <TxStatusAlert
                step={joinStep}
                errorMessage={joinError}
                txHash={joinTxHash}
                onReset={resetJoin}
                successMessage={`Đã tham gia phòng #${inputJoinId}.`}
              />
              {joinStep === "success" && targetJoinId !== undefined && (
                <Link
                  href={getGameRoomUrl(targetJoinId)}
                  className="button-secondary w-full"
                >
                  Vào bàn cờ ngay
                  <Icon name="arrow" />
                </Link>
              )}
            </div>
          )}
        </section>
        <section className="surface-card" aria-labelledby="open-rooms-title">
          <div className="section-heading">
            <h2 className="section-title" id="open-rooms-title">
              Phòng đang mở
              <span className="room-count">{openRooms.length}</span>
            </h2>
            <button
              type="button"
              className="button-quiet !min-h-9 !p-1.5"
              onClick={() => refetchOpenRooms()}
              disabled={isLoadingOpenRooms}
              aria-label="Làm mới danh sách phòng"
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
            Chọn một phòng để xem thông tin và tham gia.
          </p>
          {openRoomsError ? (
            <div role="alert" className="room-empty">
              <Icon name="info" />
              <h3>Chưa tải được phòng</h3>
              <p className="helper-text">
                Kiểm tra kết nối mạng rồi bấm làm mới.
              </p>
            </div>
          ) : isLoadingOpenRooms && !openRooms.length ? (
            <div role="status" className="room-empty">
              <Icon name="refresh" className="animate-spin mb-4" />
              <p className="helper-text">Đang tải danh sách phòng…</p>
            </div>
          ) : !openRooms.length ? (
            <div className="room-empty">
              <span className="icon-tile">
                <Icon name="board" className="h-6 w-6" />
              </span>
              <h3>Chưa có ai ngồi vào bàn</h3>
              <p className="helper-text">
                Tạo phòng đầu tiên, rồi gửi mã để rủ một người bạn cùng chơi.
              </p>
              <button
                type="button"
                className="text-link mt-5"
                onClick={() => {
                  setActiveTab("create");
                  document.getElementById("create-tab")?.focus();
                }}
              >
                Tạo phòng của bạn
                <Icon name="arrow" />
              </button>
            </div>
          ) : (
            <div className="room-list custom-scrollbar">
              {openRooms.map((r) => (
                <article key={r.id.toString()} className="room-row">
                  <div>
                    <strong>Phòng #{r.id.toString()}</strong>
                    <p>
                      {r.stakeFormatted} {CURRENCY_SYMBOL}{" "}
                      <span className="mx-1 text-slate-600">·</span> Bạn cầm{" "}
                      {r.creatorIsWhite ? "Đen" : "Trắng"}
                    </p>
                    <p className="font-mono !text-[11px]" title={r.playerA}>
                      {r.playerA.slice(0, 6)}…{r.playerA.slice(-4)}
                    </p>
                  </div>
                  <button
                    className="button-secondary"
                    type="button"
                    aria-label={`Chọn phòng #${r.id}`}
                    onClick={() => {
                      handleSelectOpenRoom(r.id);
                      document.getElementById("join-tab")?.focus();
                    }}
                  >
                    Vào phòng
                    <Icon name="arrow" className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          )}
          <details className="room-inspector">
            <summary>Tra cứu phòng bằng mã</summary>
            <label htmlFor="inspect-id" className="field-label">
              Mã phòng cần xem
            </label>
            <input
              id="inspect-id"
              className="form-input"
              inputMode="numeric"
              placeholder="Ví dụ: 6"
              value={inspectId}
              onChange={(e) => handleLookupInspect(e.target.value)}
            />
            {targetInspectId !== undefined && (
              <div className="mt-3 text-sm">
                {isLoadingInspect ? (
                  <p className="helper-text">Đang tải phòng…</p>
                ) : inspectRoom && inspectExists ? (
                  <div className="space-y-3">
                    <p>
                      Phòng #{inspectId}{" "}
                      <span className="ml-2 text-slate-400">
                        {inspectStatusInfo?.label}
                      </span>
                    </p>
                    <p className="text-slate-400">
                      {inspectStakeFormatted} {CURRENCY_SYMBOL} mỗi người
                    </p>
                    <Link
                      href={getGameRoomUrl(targetInspectId)}
                      className="text-link"
                    >
                      Mở bàn cờ
                      <Icon name="arrow" />
                    </Link>
                  </div>
                ) : (
                  <p className="helper-text">
                    Không tìm thấy phòng #{inspectId}.
                  </p>
                )}
              </div>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}
