"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBlock, useReadContract } from "wagmi";
import { ChessGame, computeMovesHash } from "@avaclash/shared";
import { keccak256, toHex, zeroHash, type Address, type Hex } from "viem";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import Dialog from "@/components/Dialog";
import MatchActions from "@/components/TournamentMatchActions";
import {
  CHAIN_ID,
  NETWORK_NAME,
  RELAY_URL,
  TOURNAMENT_ADDRESS,
  tournamentEnabled,
  ZERO_ADDRESS,
} from "@/config/env";
import { useRelaySession } from "@/hooks/useRelaySession";
import { tournamentContract, useTournamentTx } from "@/hooks/useTournamentTx";
import { parseRoomId } from "@/utils/room";
import { buildTournamentRecord } from "@/utils/tournament-pgn";

const Board = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
  loading: () => <p role="status">Đang mở bàn cờ…</p>,
});
const outcomeLabels = ["Trắng thắng", "Đen thắng", "Hòa"];
const clock = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function History({ moves }: { moves: string[] }) {
  const sans = useMemo(() => {
    const game = new ChessGame();
    return moves.map((move) => game.makeMove(move)?.san ?? move);
  }, [moves]);
  return (
    <p className="break-words font-mono text-sm leading-loose text-slate-300">
      {sans.length
        ? sans
            .map((move, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${move}` : move))
            .join(" ")
        : "Chưa có nước đi."}
    </p>
  );
}

function LiveMatch({
  roomId,
  tournamentId,
  white,
  black,
  onReported,
}: {
  roomId: number;
  tournamentId: bigint;
  white: Address;
  black: Address;
  onReported: () => void;
}) {
  const tx = useTournamentTx();
  const [reviewOpen, setReviewOpen] = useState(false);
  const session = useRelaySession(roomId, {
    contractAddress: TOURNAMENT_ADDRESS,
  });
  const { resultProposal, relaySignature } = session;
  const validTranscript = useMemo(
    () =>
      !!resultProposal &&
      resultProposal.moveCount === session.moves.length &&
      computeMovesHash(session.moves) === resultProposal.movesHash,
    [resultProposal, session.moves],
  );
  const preview = useMemo(
    () =>
      reviewOpen && resultProposal && validTranscript
        ? buildTournamentRecord(session.moves, {
            roomId,
            tournamentId,
            white,
            black,
            outcome: resultProposal.outcome,
          })
        : null,
    [
      reviewOpen,
      resultProposal,
      validTranscript,
      session.moves,
      roomId,
      tournamentId,
      white,
      black,
    ],
  );
  async function report() {
    if (!resultProposal || !relaySignature || !validTranscript || !preview)
      return;
    const { winner, outcome, reason, moveCount, movesHash, nonce, deadline } =
      resultProposal;
    if (
      await tx.send({
        functionName: "reportResult",
        args: [
          {
            matchId: BigInt(roomId),
            winner: winner as Hex,
            outcome,
            reason,
            moveCount,
            movesHash: movesHash as Hex,
            nonce: BigInt(nonce),
            deadline: BigInt(deadline),
          },
          relaySignature,
        ],
      })
    ) {
      setReviewOpen(false);
      onReported();
    }
  }
  return (
    <div className="hotseat-layout">
      <div className="game-board-column space-y-2">
        <div className="flex justify-between rounded-lg border border-white/10 p-3 font-mono">
          <span>♔ {clock(session.whiteMs)}</span>
          <span>♚ {clock(session.blackMs)}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-2">
          <Board
            boardSize={560}
            moves={session.moves}
            playerColor={session.myColor}
            flipBoard={session.myColor === "b"}
            canMove={
              session.roomState?.status === "active" &&
              session.isMyTurn &&
              session.isConnected &&
              !session.gameFinished
            }
            onMove={session.sendMove}
          />
        </div>
      </div>
      <aside className="surface-card space-y-4">
        <p className="eyebrow">VÁN #{roomId} · 5+0</p>
        <p role="status">
          {session.gameFinished
            ? "Ván đã kết thúc. Kết quả vẫn cần trọng tài duyệt."
            : session.roomState?.status === "active"
              ? "Đang thi đấu."
              : session.isConnected
                ? "Đang đợi đối thủ vào bàn."
                : "Đang kết nối. Hãy ký xác thực khi ví yêu cầu."}
        </p>
        {session.error && (
          <div role="alert" className="text-rose-300">
            {session.error.message}
            <button
              className="ml-2 underline"
              onClick={() => {
                session.clearError();
                session.reconnect();
              }}
            >
              Kết nối lại
            </button>
          </div>
        )}
        {session.isDisconnected && !session.error && (
          <button className="button-secondary" onClick={session.reconnect}>
            Kết nối lại
          </button>
        )}
        {session.roomState?.status === "active" && !session.gameFinished && (
          <div className="flex flex-wrap gap-2">
            <button
              className="button-secondary"
              onClick={() => {
                if (window.confirm("Bạn muốn đầu hàng ván này?"))
                  session.sendResign();
              }}
            >
              Đầu hàng
            </button>
            {!session.incomingDrawOffer && (
              <button
                className="button-secondary"
                onClick={session.sendDrawOffer}
              >
                Đề nghị hòa
              </button>
            )}
            {session.incomingDrawOffer && (
              <>
                <button
                  className="button-secondary"
                  onClick={session.sendDrawAccept}
                >
                  Đồng ý hòa
                </button>
                <button
                  className="button-secondary"
                  onClick={session.sendDrawDecline}
                >
                  Từ chối hòa
                </button>
              </>
            )}
          </div>
        )}
        {session.gameFinished && (
          <div className="grid gap-2">
            {resultProposal && (
              <strong>{outcomeLabels[resultProposal.outcome]}</strong>
            )}
            <button
              className="button-primary"
              disabled={!relaySignature || !validTranscript || tx.busy}
              onClick={() => setReviewOpen(true)}
            >
              Xem và gửi biên bản
            </button>
            <button
              className="button-secondary"
              onClick={session.requestResult}
            >
              Tải lại chữ ký kết quả
            </button>
            <p role="status" className="text-sm text-amber-100">
              {tx.message}
            </p>
          </div>
        )}
        <History moves={session.moves} />
      </aside>
      {reviewOpen && (
        <Dialog
          titleId="result-proof-title"
          onClose={() => {
            if (!tx.busy) setReviewOpen(false);
          }}
        >
          <div className="surface-card max-h-[85vh] w-full max-w-2xl space-y-3 overflow-y-auto">
            <h2 id="result-proof-title" className="section-title">
              Xác nhận biên bản ván #{roomId}
            </h2>
            {preview && resultProposal ? (
              <>
                <p>
                  {outcomeLabels[resultProposal.outcome]} ·{" "}
                  {session.moves.length} nửa nước
                </p>
                <p className="text-sm text-slate-300">
                  Ví gửi kết quả tạm và chữ ký relay lên {NETWORK_NAME}. Hợp
                  đồng ghi mã băm chuỗi nước đi UCI. Trọng tài sẽ duyệt kết quả
                  sau khi gửi.
                </p>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt>Hash nước đi UCI</dt>
                    <dd className="break-all font-mono text-amber-100">
                      {resultProposal.movesHash}
                    </dd>
                  </div>
                  <div>
                    <dt>FEN cuối ván</dt>
                    <dd className="break-all font-mono">{preview.fen}</dd>
                  </div>
                </dl>
                <details open>
                  <summary className="cursor-pointer">
                    PGN của kết quả tạm
                  </summary>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-2 text-xs">
                    {preview.pgn}
                  </pre>
                </details>
              </>
            ) : (
              <p role="status">Chưa đối chiếu được biên bản và chữ ký relay.</p>
            )}
            {tx.message && (
              <p role="status" className="text-sm text-amber-100">
                {tx.message}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="button-secondary"
                disabled={tx.busy}
                onClick={() => setReviewOpen(false)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="button-primary"
                disabled={!preview || !relaySignature || tx.busy}
                onClick={() => void report()}
              >
                Ký và gửi lên {NETWORK_NAME}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Replay({
  roomId,
  tournamentId,
  white,
  black,
  outcome,
  committed,
}: {
  roomId: number;
  tournamentId: bigint;
  white: Address;
  black: Address;
  outcome?: number;
  committed: Hex;
}) {
  const replay = useQuery({
    queryKey: [
      "tournament-replay",
      CHAIN_ID,
      TOURNAMENT_ADDRESS,
      RELAY_URL,
      roomId,
    ],
    queryFn: async ({ signal }) => {
      const url = new URL(RELAY_URL);
      url.protocol = url.protocol === "wss:" ? "https:" : "http:";
      url.pathname = `/tournament/replay/${roomId}`;
      url.search = "";
      const res = await fetch(url, { signal });
      if (res.status === 404) return null;
      if (!res.ok) throw Error("Không tải được biên bản ván cờ.");
      const body: { moves?: unknown } = await res.json();
      if (
        !Array.isArray(body.moves) ||
        !body.moves.every(
          (m: unknown) =>
            typeof m === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m),
        )
      )
        throw Error("Biên bản ván cờ không hợp lệ.");
      return body.moves as string[];
    },
    retry: false,
  });
  const [ply, setPly] = useState<number>();
  const moves = replay.data;
  const computed = useMemo(() => moves && computeMovesHash(moves), [moves]);
  const matches = computed === committed;
  const anchored = committed !== zeroHash;
  const pgnOutcome = anchored && matches ? outcome : undefined;
  const record = useMemo(
    () =>
      moves &&
      buildTournamentRecord(moves, {
        roomId,
        tournamentId,
        white,
        black,
        outcome: pgnOutcome,
      }),
    [moves, roomId, tournamentId, white, black, pgnOutcome],
  );
  if (!moves)
    return (
      <div className="surface-card space-y-2">
        <p role="status">
          {replay.isPending
            ? "Đang tải biên bản…"
            : replay.isError
              ? "Không tải được biên bản từ máy chủ."
              : "Chưa có biên bản relay cho ván này."}
        </p>
        <button
          className="button-secondary"
          onClick={() => void replay.refetch()}
        >
          Tải lại
        </button>
      </div>
    );
  if (!record)
    return (
      <p role="alert" className="surface-card">
        Biên bản chứa nước đi không hợp lệ.
      </p>
    );
  const at = Math.min(ply ?? moves.length, moves.length);
  function downloadPgn() {
    if (!record || (anchored && !matches)) return;
    const url = URL.createObjectURL(
      new Blob([record.pgn], { type: "application/x-chess-pgn" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `avaclash-cup-${tournamentId}-van-${roomId}.pgn`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="hotseat-layout">
      <div className="game-board-column rounded-xl border border-white/10 bg-slate-900 p-2">
        <Board boardSize={560} moves={moves.slice(0, at)} />
      </div>
      <aside className="surface-card space-y-4">
        <h2 className="section-title">Biên bản ván cờ</h2>
        <p role="status" className="text-sm text-slate-300">
          {!anchored
            ? `Bản ghi relay chưa có mã đối chiếu trên ${NETWORK_NAME}.`
            : matches
              ? `Biên bản khớp mã nước đi đã công bố trên ${NETWORK_NAME}.`
              : "Biên bản không khớp mã đã công bố. Tải lại trước khi sử dụng."}
        </p>
        <dl className="grid gap-2 text-xs text-slate-300">
          <div>
            <dt>Hash trên chuỗi</dt>
            <dd className="break-all font-mono">
              {anchored ? committed : "Chưa ghi nhận"}
            </dd>
          </div>
          <div>
            <dt>Hash tính từ biên bản relay</dt>
            <dd className="break-all font-mono">{computed}</dd>
          </div>
          <div>
            <dt>FEN cuối ván</dt>
            <dd className="break-all font-mono">{record.fen}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-400">
          Hash đối chiếu chuỗi nước đi UCI. Kết quả trong PGN lấy từ phán quyết
          đã duyệt khi biên bản khớp.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="button-secondary"
            disabled={anchored && !matches}
            onClick={downloadPgn}
          >
            {anchored ? "Tải PGN" : "Tải PGN chưa đối chiếu"}
          </button>
          {anchored && !matches && (
            <button
              className="button-secondary"
              disabled={replay.isFetching}
              onClick={() => void replay.refetch()}
            >
              Tải lại biên bản
            </button>
          )}
        </div>
        <label className="block">
          Nước đi {at}/{moves.length}
          <input
            className="block w-full"
            type="range"
            min={0}
            max={moves.length}
            value={at}
            onChange={(e) => setPly(Number(e.target.value))}
          />
        </label>
        <History moves={moves.slice(0, at)} />
      </aside>
    </div>
  );
}

function ReviewPanel({
  roomId,
  tournamentId,
  result,
  refresh,
}: {
  roomId: bigint;
  tournamentId: bigint;
  result: {
    outcome: number;
    approved: boolean;
    reported: boolean;
    decisionHash: Hex;
  };
  refresh: () => void;
}) {
  const { address } = useAccount();
  const tx = useTournamentTx();
  const [note, setNote] = useState("");
  const query = { refetchInterval: 6000 } as const;
  const { data: tournament, refetch } = useReadContract({
    ...tournamentContract,
    functionName: "getTournament",
    args: [tournamentId],
    query,
  });
  const { data: registered } = useReadContract({
    ...tournamentContract,
    functionName: "registered",
    args: [tournamentId, address ?? ZERO_ADDRESS],
    query: { ...query, enabled: !!address },
  });
  const { data: block } = useBlock({
    chainId: CHAIN_ID,
    query: { ...query, enabled: !!address },
  });
  const reviewer =
    !!address && address.toLowerCase() === tournament?.reviewer.toLowerCase();
  const active =
    !!block &&
    tournament?.phase === 1 &&
    block.timestamp < tournament.completionDeadline;
  const appealAllowed = active && block.timestamp < tournament.reviewUntil;
  const hasDecision = result.decisionHash !== zeroHash;
  return (
    <section className="surface-card grid gap-3" aria-labelledby="review-title">
      <h2 id="review-title" className="section-title">
        Hồ sơ trọng tài
      </h2>
      <p>
        {result.approved
          ? "Đã duyệt"
          : result.reported
            ? "Chờ duyệt kết quả tạm"
            : "Chưa có kết quả"}
      </p>
      {tournament && (
        <p className="break-all text-sm text-slate-300">
          Ví trọng tài {tournament.reviewer}
        </p>
      )}
      {hasDecision && (
        <div className="grid gap-2 text-sm">
          <p>
            Mã quyết định{" "}
            <code className="break-all">{result.decisionHash}</code>
          </p>
          <label className="grid gap-1">
            Đối chiếu nội dung quyết định gốc
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          {note.trim() && (
            <p role="status">
              {keccak256(toHex(note.trim())) === result.decisionHash
                ? "Nội dung khớp mã quyết định."
                : "Nội dung không khớp mã quyết định."}
            </p>
          )}
        </div>
      )}
      <MatchActions
        match={{ roomId, result }}
        reviewer={reviewer}
        participant={registered === true}
        active={active}
        appealAllowed={appealAllowed}
        tx={tx}
        refresh={() => {
          refresh();
          void refetch();
        }}
      />
      {tx.message && (
        <p role="status" className="text-sm text-amber-100">
          {tx.message}
        </p>
      )}
    </section>
  );
}

function MatchContent() {
  const params = useSearchParams();
  const roomId = parseRoomId(params.get("room"));
  const { address, chainId } = useAccount();
  const query = {
    enabled: tournamentEnabled && roomId !== undefined,
    refetchInterval: 5000,
  } as const;
  const { data: room, isError } = useReadContract({
    ...tournamentContract,
    functionName: "getRoom",
    args: [BigInt(roomId ?? 0)],
    query,
  });
  const { data: result, refetch } = useReadContract({
    ...tournamentContract,
    functionName: "results",
    args: [BigInt(roomId ?? 0)],
    query,
  });
  if (!tournamentEnabled || roomId === undefined || isError)
    return <p role="alert">Không tìm thấy ván thuộc giải thử nghiệm.</p>;
  if (!room || !result) return <p role="status">Đang tải ván…</p>;
  const [tournamentId, outcome, reported, approved, movesHash, decisionHash] =
    result;
  const isPlayer = [room.playerA, room.playerB].some(
    (player) => player.toLowerCase() === address?.toLowerCase(),
  );
  const canPlay =
    isPlayer && chainId === CHAIN_ID && room.status === 1 && !reported;
  return (
    <div className="grid gap-4">
      <Link
        className="text-link w-fit"
        href={`/tournaments?id=${tournamentId}`}
      >
        ← Về giải #{tournamentId.toString()}
      </Link>
      <h1 className="text-3xl font-bold">Ván đấu #{roomId}</h1>
      {reported && (
        <p className="text-amber-200">
          {outcomeLabels[outcome]} · {approved ? "Đã duyệt" : "Kết quả tạm"}
        </p>
      )}
      {!reported && room.status === 1 && !canPlay && (
        <p className="text-slate-300">
          Kỳ thủ cần dùng đúng ví đăng ký và mạng thử nghiệm để vào bàn.
        </p>
      )}
      {canPlay ? (
        <LiveMatch
          key={`${roomId}:${address}`}
          roomId={roomId}
          tournamentId={tournamentId}
          white={room.creatorIsWhite ? room.playerA : room.playerB}
          black={room.creatorIsWhite ? room.playerB : room.playerA}
          onReported={() => void refetch()}
        />
      ) : (
        <>
          <Replay
            key={roomId}
            roomId={roomId}
            tournamentId={tournamentId}
            white={room.creatorIsWhite ? room.playerA : room.playerB}
            black={room.creatorIsWhite ? room.playerB : room.playerA}
            outcome={approved ? outcome : undefined}
            committed={movesHash}
          />
          <ReviewPanel
            key={`${roomId}:${address ?? "viewer"}`}
            roomId={BigInt(roomId)}
            tournamentId={tournamentId}
            result={{ outcome, reported, approved, decisionHash }}
            refresh={() => void refetch()}
          />
        </>
      )}
    </div>
  );
}

export default function TournamentPlayPage() {
  return (
    <div className="app-shell">
      <AppHeader active="tournament" />
      <main className="site-container play-page">
        <Suspense fallback={<p role="status">Đang mở ván…</p>}>
          <MatchContent />
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}
