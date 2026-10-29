"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { targetChain } from "@/config/wagmi";
import { useCreateRoom } from "@/hooks/useCreateRoom";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import { useRoom } from "@/hooks/useRoom";
import { useOpenRooms } from "@/hooks/useOpenRooms";
import { useWithdraw } from "@/hooks/useWithdraw";
import TxStatusAlert from "./TxStatusAlert";

export default function RoomLobbyWidget() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== targetChain.id;

  const [activeTab, setActiveTab] = useState<
    "create" | "join" | "open_rooms" | "inspect"
  >("create");

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
  const [inputJoinId, setInputJoinId] = useState<string>("0");
  const [targetJoinId, setTargetJoinId] = useState<bigint | number | undefined>(
    0
  );
  const {
    joinRoom,
    room: previewRoom,
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
    refetch: refetchOpenRooms,
  } = useOpenRooms(15);

  // Room Inspector Hook
  const [inspectId, setInspectId] = useState<string>("0");
  const [targetInspectId, setTargetInspectId] = useState<
    bigint | number | undefined
  >(0);
  const {
    room: inspectRoom,
    isLoading: isLoadingInspect,
    statusInfo: inspectStatusInfo,
    stakeFormatted: inspectStakeFormatted,
    whitePlayer: inspectWhitePlayer,
    blackPlayer: inspectBlackPlayer,
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
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setTargetJoinId(BigInt(parsed));
      resetJoin();
    } else {
      setTargetJoinId(undefined);
    }
  };

  const handleLookupInspect = (val: string) => {
    setInspectId(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
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

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl flex flex-col gap-5 text-left text-slate-100 animate-fade-in">
      {/* Pending Withdrawals Notification Box */}
      {pendingBalance > BigInt(0) && (
        <div className="w-full rounded-xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-bounce">🎁</span>
            <div>
              <div className="text-xs font-bold text-emerald-300">
                Bạn có tiền thưởng / tiền hoàn khả dụng!
              </div>
              <div className="text-sm font-mono font-black text-emerald-200">
                {pendingBalanceFormatted} AVAX
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => withdraw()}
            disabled={
              withdrawStep === "waiting_wallet" ||
              withdrawStep === "confirming"
            }
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-xl shadow-md transition-all whitespace-nowrap"
          >
            {withdrawStep === "waiting_wallet"
              ? "Chờ xác nhận ví..."
              : withdrawStep === "confirming"
                ? "Đang rút..."
                : "Rút tiền về ví ngay"}
          </button>
        </div>
      )}

      {/* Withdraw status alert if active */}
      <TxStatusAlert
        step={withdrawStep}
        errorMessage={withdrawError}
        txHash={withdrawTxHash}
        onReset={resetWithdraw}
        successMessage={`Rút tiền thành công! ${pendingBalanceFormatted} AVAX đã được chuyển về ví của bạn.`}
      />

      {/* Tabs Header */}
      <div className="grid grid-cols-4 rounded-xl border border-white/10 bg-slate-950/80 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("create")}
          className={`py-2 rounded-lg transition-all text-center ${
            activeTab === "create"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          ⚔️ Tạo phòng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("join")}
          className={`py-2 rounded-lg transition-all text-center ${
            activeTab === "join"
              ? "bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🚪 Vào phòng
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("open_rooms");
            refetchOpenRooms();
          }}
          className={`py-2 rounded-lg transition-all text-center ${
            activeTab === "open_rooms"
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📋 Đang mở
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inspect")}
          className={`py-2 rounded-lg transition-all text-center ${
            activeTab === "inspect"
              ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🔍 Xem phòng
        </button>
      </div>

      {/* TAB 1: CREATE ROOM */}
      {activeTab === "create" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Chọn màu cờ (Lưu trên Blockchain)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreatorIsWhite(true)}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                  creatorIsWhite
                    ? "bg-amber-100 text-slate-950 border-amber-400 ring-2 ring-amber-400/50 shadow-lg"
                    : "bg-slate-950 text-slate-300 border-white/10 hover:border-white/30"
                }`}
              >
                <span className="text-xl">♔</span>
                <span>Trắng (Đi trước)</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatorIsWhite(false)}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                  !creatorIsWhite
                    ? "bg-slate-800 text-white border-amber-400 ring-2 ring-amber-400/50 shadow-lg"
                    : "bg-slate-950 text-slate-300 border-white/10 hover:border-white/30"
                }`}
              >
                <span className="text-xl">♚</span>
                <span>Đen (Đi sau)</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Mức cược AVAX (Tối thiểu {minStake} AVAX, tối đa {uiMaxStake} AVAX)
              </label>
              <span className="text-[11px] text-amber-400/90 font-medium">
                Giao diện giới hạn &le; {uiMaxStake} AVAX
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min={minStake}
                max={uiMaxStake}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                placeholder="0.01"
              />
              <button
                type="button"
                onClick={() => setStake("0.01")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-all"
              >
                Min (0.01)
              </button>
              <button
                type="button"
                onClick={() => setStake(uiMaxStake)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-all"
              >
                Max ({uiMaxStake})
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={
              !isConnected ||
              isWrongNetwork ||
              createStep === "waiting_wallet" ||
              createStep === "confirming"
            }
            onClick={() => createRoom(creatorIsWhite, stake)}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-xl transition-all ${
              !isConnected
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : isWrongNetwork
                  ? "bg-rose-900/60 text-rose-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950"
            }`}
          >
            {!isConnected
              ? "Vui lòng nối ví trước"
              : isWrongNetwork
                ? "Vui lòng chuyển sang đúng mạng"
                : createStep === "waiting_wallet"
                  ? "Đang chờ ví ký..."
                  : createStep === "confirming"
                    ? "Đang xác nhận trên Avalanche..."
                    : `Tạo phòng & Cược ${stake} AVAX`}
          </button>

          <TxStatusAlert
            step={createStep}
            errorMessage={createError}
            txHash={createTxHash}
            onReset={resetCreate}
            successMessage={
              createdRoomId !== null
                ? `Tạo phòng thành công! Room ID: ${createdRoomId.toString()}`
                : "Tạo phòng thành công!"
            }
          />

          {createStep === "success" && createdRoomId !== null && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
              <span className="text-emerald-300">
                Phòng <strong>#{createdRoomId.toString()}</strong> đã được tạo trên blockchain!
              </span>
              <Link
                href={`/game?roomId=${createdRoomId.toString()}`}
                className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all shadow-sm"
              >
                Vào bàn chờ &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: JOIN ROOM */}
      {activeTab === "join" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Nhập mã phòng (Room ID)
            </label>
            <input
              type="number"
              min="0"
              value={inputJoinId}
              onChange={(e) => handleLookupJoin(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-all"
              placeholder="VD: 0, 1, 2..."
            />
          </div>

          {/* Room Preview Box: HIỂN THỊ MÀU VÀ MỨC CƯỢC TRƯỚC KHI XÁC NHẬN */}
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 flex flex-col gap-2.5 text-xs">
            <div className="font-bold text-amber-300 border-b border-white/10 pb-2 flex items-center justify-between">
              <span>Thông Tin Phòng #{inputJoinId} (Đọc từ Blockchain)</span>
              {isLoadingRoom && (
                <span className="text-[11px] text-slate-400 animate-pulse">
                  Đang tải dữ liệu...
                </span>
              )}
            </div>

            {previewRoom ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Trạng thái phòng:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      isJoinOpen
                        ? "text-amber-300 bg-amber-500/10 border border-amber-500/30"
                        : "text-slate-400 bg-slate-800"
                    }`}
                  >
                    {isJoinOpen ? "Đang mở (Open)" : `Đã đóng (status=${previewRoom.status})`}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Người tạo (Player A):</span>
                  <span
                    className="font-mono text-slate-300"
                    title={previewRoom.playerA}
                  >
                    {previewRoom.playerA.slice(0, 6)}...{previewRoom.playerA.slice(-4)}
                    {isJoinCreator && (
                      <span className="ml-1.5 text-rose-400 font-bold">(Bạn)</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Màu cờ người tạo:</span>
                  <span className="font-bold text-slate-200">
                    {previewRoom.creatorIsWhite ? "♔ Trắng" : "♚ Đen"}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-indigo-950/40 border border-indigo-500/30 p-2 rounded-lg">
                  <span className="text-indigo-300 font-bold">Màu cờ của BẠN:</span>
                  <span className="font-extrabold text-sm text-indigo-200">
                    {joinerColor === "White" ? "♔ Trắng (Đi trước)" : "♚ Đen (Đi sau)"}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-amber-950/40 border border-amber-500/30 p-2 rounded-lg">
                  <span className="text-amber-300 font-bold">Mức cược cần nạp:</span>
                  <span className="font-mono font-extrabold text-sm text-amber-200">
                    {joinStakeFormatted} AVAX
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 italic py-2 text-center">
                Chưa tìm thấy phòng này hoặc chưa nhập ID hợp lệ.
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={
              !isConnected ||
              isWrongNetwork ||
              !previewRoom ||
              !isJoinOpen ||
              isJoinCreator ||
              joinStep === "waiting_wallet" ||
              joinStep === "confirming"
            }
            onClick={() => joinRoom(targetJoinId)}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-xl transition-all ${
              !isConnected
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : isWrongNetwork
                  ? "bg-rose-900/60 text-rose-300 cursor-not-allowed"
                  : !isJoinOpen || isJoinCreator
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-slate-950"
            }`}
          >
            {!isConnected
              ? "Vui lòng nối ví trước"
              : isWrongNetwork
                ? "Vui lòng chuyển sang đúng mạng"
                : isJoinCreator
                  ? "Không thể vào phòng do chính bạn tạo"
                  : !isJoinOpen
                    ? "Phòng không ở trạng thái mở"
                    : joinStep === "waiting_wallet"
                      ? "Đang chờ ví ký..."
                      : joinStep === "confirming"
                        ? "Đang xác nhận vào phòng..."
                        : `Xác nhận vào phòng (${joinerColor}) & Cược ${joinStakeFormatted} AVAX`}
          </button>

          <TxStatusAlert
            step={joinStep}
            errorMessage={joinError}
            txHash={joinTxHash}
            onReset={resetJoin}
            successMessage={`Vào phòng #${inputJoinId} thành công!`}
          />

          {joinStep === "success" && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
              <span className="text-emerald-300">
                Bạn đã sẵn sàng tham gia phòng #{inputJoinId}!
              </span>
              <Link
                href={`/game?roomId=${inputJoinId}`}
                className="bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-all shadow-sm"
              >
                Vào bàn cờ ngay &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OPEN ROOMS LIST */}
      {activeTab === "open_rooms" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="text-slate-300 font-semibold">
              Các phòng đang chờ đối thủ (Quét tự động)
            </span>
            <button
              type="button"
              onClick={() => refetchOpenRooms()}
              disabled={isLoadingOpenRooms}
              className="text-amber-400 hover:text-amber-300 underline font-bold"
            >
              {isLoadingOpenRooms ? "Đang quét..." : "Làm mới ↻"}
            </button>
          </div>

          {isLoadingOpenRooms && openRooms.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Đang quét các phòng gần nhất từ Smart Contract...
            </div>
          ) : openRooms.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              Hiện không có phòng nào đang mở. Hãy là người đầu tiên tạo phòng cược!
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {openRooms.map((r) => (
                <div
                  key={r.id.toString()}
                  className="rounded-xl border border-white/10 bg-slate-950/70 p-3 flex items-center justify-between gap-2 hover:border-amber-400/40 transition-all"
                >
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400">
                        Phòng #{r.id.toString()}
                      </span>
                      <span className="text-slate-400">
                        Chủ phòng: {r.playerA.slice(0, 5)}...{r.playerA.slice(-3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-300">
                      <span>
                        Cược:{" "}
                        <strong className="text-amber-300">
                          {r.stakeFormatted} AVAX
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Bạn sẽ là:{" "}
                        <strong className="text-indigo-300">
                          {r.creatorIsWhite ? "♚ Đen" : "♔ Trắng"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectOpenRoom(r.id)}
                    className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-sm"
                  >
                    Chọn phòng
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ROOM INSPECTOR */}
      {activeTab === "inspect" && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Nhập Room ID để xem thông tin hợp đồng
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={inspectId}
                onChange={(e) => handleLookupInspect(e.target.value)}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all"
                placeholder="0"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 flex flex-col gap-2 text-xs">
            {isLoadingInspect ? (
              <div className="text-center py-4 text-slate-400 animate-pulse">
                Đang đọc dữ liệu getRoom({inspectId})...
              </div>
            ) : inspectRoom ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="font-bold text-slate-300">Trạng thái:</span>
                  {inspectStatusInfo && (
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] border ${inspectStatusInfo.color}`}
                    >
                      {inspectStatusInfo.label}
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Mô tả:</span>
                  <span className="text-slate-300 text-right">
                    {inspectStatusInfo?.desc}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mức cược mỗi bên:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {inspectStakeFormatted} AVAX
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Người tạo (Player A):</span>
                  <span
                    className="font-mono text-slate-300"
                    title={inspectRoom.playerA}
                  >
                    {inspectRoom.playerA.slice(0, 8)}...{inspectRoom.playerA.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Đối thủ (Player B):</span>
                  <span
                    className="font-mono text-slate-300"
                    title={inspectRoom.playerB}
                  >
                    {inspectRoom.playerB ===
                    "0x0000000000000000000000000000000000000000"
                      ? "Chưa có (Đang mở)"
                      : `${inspectRoom.playerB.slice(0, 8)}...${inspectRoom.playerB.slice(-6)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quân Trắng (White):</span>
                  <span className="font-mono text-slate-200">
                    {inspectWhitePlayer?.slice(0, 8)}...{inspectWhitePlayer?.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trận đấu bắt đầu:</span>
                  <span className="text-slate-200">
                    {inspectRoom.gameStarted ? "Đã phát tín hiệu (gameStarted=true)" : "Chưa phát tín hiệu"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-500 italic">
                Không tìm thấy thông tin phòng #{inspectId}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
