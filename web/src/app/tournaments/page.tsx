"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useBalance, useBlock, useReadContract } from "wagmi";
import { formatEther, isAddress, parseEther, parseEventLogs } from "viem";
import { TOURNAMENT_ABI } from "@avaclash/shared";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import MatchActions from "@/components/TournamentMatchActions";
import {
  CHAIN_ID,
  CURRENCY_SYMBOL,
  NETWORK_NAME,
  tournamentEnabled,
  ZERO_ADDRESS,
} from "@/config/env";
import {
  tournamentContract,
  useTournamentTx,
  type TournamentTx,
} from "@/hooks/useTournamentTx";
import { parseRoomId } from "@/utils/room";

const input =
  "w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-slate-100";
const phaseNames = ["Đăng ký", "Thi đấu và duyệt", "Đã chốt thưởng", "Đã hủy"];
const outcomes = ["Trắng thắng", "Đen thắng", "Hòa"];
const amount = (value: bigint) =>
  `${formatEther(value)} ${CURRENCY_SYMBOL} test`;
const same = (a: string | undefined, b: string) =>
  a?.toLowerCase() === b.toLowerCase();
const short = (address: string) =>
  `${address.slice(0, 8)}…${address.slice(-4)}`;
const date = (seconds: bigint) =>
  new Date(Number(seconds) * 1000).toLocaleString("vi-VN");
const polling = { refetchInterval: 6000 } as const;

function CreateTournament({
  tx,
  now,
  onCreated,
}: {
  tx: TournamentTx;
  now: bigint;
  onCreated: (id: bigint) => void;
}) {
  const [error, setError] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title") ?? "").trim();
    const rules = String(fields.get("rules") ?? "").trim();
    const reviewer = String(fields.get("reviewer") ?? "").trim();
    const registrationHours = Number(fields.get("registrationHours"));
    const durationDays = Number(fields.get("durationDays"));
    const reviewHours = Number(fields.get("reviewHours"));
    const capacity = Number(fields.get("capacity"));
    if (
      !isAddress(reviewer) ||
      ![registrationHours, durationDays, reviewHours, capacity].every(
        Number.isSafeInteger,
      ) ||
      new TextEncoder().encode(title).length > 120 ||
      new TextEncoder().encode(rules).length > 3000 ||
      !title ||
      !rules ||
      durationDays * 24 <= registrationHours + reviewHours
    ) {
      setError(
        "Kiểm tra tên, điều lệ, ví trọng tài và thời hạn hoàn tất giải.",
      );
      return;
    }
    setError("");
    const receipt = await tx.send({
      functionName: "createTournament",
      args: [
        title,
        rules,
        capacity,
        reviewer,
        now + BigInt(registrationHours * 3600),
        now + BigInt(durationDays * 86400),
        BigInt(reviewHours * 3600),
      ],
    });
    const created =
      receipt &&
      parseEventLogs({
        abi: TOURNAMENT_ABI,
        eventName: "TournamentCreated",
        logs: receipt.logs,
      })[0];
    if (created) onCreated(created.args.id);
  }
  return (
    <details className="surface-card">
      <summary className="cursor-pointer font-semibold">
        Tạo giải mới · dành cho ban tổ chức
      </summary>
      <form className="mt-4 grid gap-4" onSubmit={create}>
        <label>
          Tên giải
          <input
            className={input}
            name="title"
            required
            maxLength={90}
            placeholder="AvaClash Campus Cup"
          />
        </label>
        <label>
          Ví trọng tài
          <input className={input} name="reviewer" required placeholder="0x…" />
          <small>Khác ví của BTC, relay và kỳ thủ.</small>
        </label>
        <label>
          Điều lệ công khai
          <textarea
            className={input}
            name="rules"
            required
            rows={4}
            maxLength={2000}
            placeholder="Cách xử lý mất kết nối, Fair Play và kênh gửi bằng chứng riêng cho trọng tài…"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-4">
          <label>
            Số kỳ thủ
            <select name="capacity" className={input} defaultValue={8}>
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Đăng ký (giờ)
            <input
              name="registrationHours"
              className={input}
              type="number"
              min={1}
              max={720}
              defaultValue={24}
              required
            />
          </label>
          <label>
            Hoàn tất (ngày)
            <input
              name="durationDays"
              className={input}
              type="number"
              min={1}
              max={60}
              defaultValue={7}
              required
            />
          </label>
          <label>
            Khiếu nại (giờ)
            <input
              name="reviewHours"
              className={input}
              type="number"
              min={1}
              max={168}
              defaultValue={24}
              required
            />
          </label>
        </div>
        <p className="text-sm text-slate-400">
          Cờ nhanh 5+0, vòng tròn. Thắng 1 điểm, hòa ½ điểm. Cơ cấu 60% / 30% /
          10% (giải 2 người: 70% / 30%); đồng điểm chia đều các suất liên quan.
          Nhận thưởng trong 30 ngày.
        </p>
        {error && (
          <p role="alert" className="text-rose-300">
            {error}
          </p>
        )}
        <button className="button-primary w-fit" disabled={tx.busy}>
          Tạo giải
        </button>
      </form>
    </details>
  );
}

function TournamentDetails({
  id,
  tx,
  now,
}: {
  id: bigint;
  tx: TournamentTx;
  now: bigint;
}) {
  const { address } = useAccount();
  const [selectedMatch, selectMatch] = useState<bigint>();
  const [formError, setFormError] = useState("");
  const tournament = useReadContract({
    ...tournamentContract,
    functionName: "getTournament",
    args: [id],
    query: polling,
  });
  const standing = useReadContract({
    ...tournamentContract,
    functionName: "standings",
    args: [id],
    query: polling,
  });
  const matches = useReadContract({
    ...tournamentContract,
    functionName: "getMatchViews",
    args: [id],
    query: polling,
  });
  const allocation = useReadContract({
    ...tournamentContract,
    functionName: "getAllocation",
    args: [id],
    query: { ...polling, enabled: tournament.data?.phase === 2 },
  });
  const contributions = useReadContract({
    ...tournamentContract,
    functionName: "contributions",
    args: [id, address ?? ZERO_ADDRESS],
    query: { enabled: !!address, ...polling },
  });
  const refunded = useReadContract({
    ...tournamentContract,
    functionName: "refunded",
    args: [id, address ?? ZERO_ADDRESS],
    query: { enabled: !!address, ...polling },
  });
  const relaySigner = useReadContract({
    ...tournamentContract,
    functionName: "relaySigner",
    query: { enabled: !!address, staleTime: Infinity },
  });
  const balance = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { enabled: !!address && tournament.data?.phase === 0, ...polling },
  });
  function refresh() {
    void Promise.all([
      tournament.refetch(),
      standing.refetch(),
      matches.refetch(),
      allocation.refetch(),
      contributions.refetch(),
      refunded.refetch(),
    ]);
  }
  const t = tournament.data;
  if (!t)
    return (
      <p className="surface-card" role="status">
        {tournament.isError
          ? "Không tìm thấy giải hoặc chưa kết nối được mạng."
          : "Đang tải giải…"}
      </p>
    );
  const [players, points] = standing.data ?? [[], []];
  const list = matches.data ?? [];
  const me = players.findIndex((p) => same(address, p));
  const organizer = same(address, t.organizer);
  const reviewer = same(address, t.reviewer);
  const relay = !!relaySigner.data && same(address, relaySigner.data);
  const open = t.phase === 0 && now < t.registrationEnds;
  let registrationBlock = "";
  if (!address) registrationBlock = "Kết nối ví kỳ thủ để đăng ký.";
  else if (organizer || reviewer || relay || contributions.data) {
    const role = organizer
      ? "ban tổ chức"
      : reviewer
        ? "trọng tài"
        : relay
          ? "relay"
          : "nhà tài trợ";
    registrationBlock = `Ví ${role} không thể thi đấu ở giải này. Hãy dùng ví kỳ thủ riêng.`;
  } else if (t.funded === 0n) registrationBlock = "Giải chưa có quỹ thưởng.";
  else if (players.length >= t.capacity) registrationBlock = "Giải đã đủ kỳ thủ.";
  else if (balance.data?.value === 0n)
    registrationBlock = `Ví cần ${CURRENCY_SYMBOL} thử nghiệm để trả phí mạng khi đăng ký.`;
  else if (!relaySigner.data || contributions.data === undefined || !standing.data)
    registrationBlock =
      relaySigner.isError || contributions.isError || standing.isError
        ? "Chưa kiểm tra được điều kiện đăng ký. Hãy tải lại trang."
        : "Đang kiểm tra điều kiện đăng ký…";
  const running = t.phase === 1 && now < t.completionDeadline;
  const approvedCount = list.filter((m) => m.result.approved).length;
  const ready =
    t.phase === 1 &&
    list.length > 0 &&
    approvedCount === list.length &&
    t.openAppeals === 0n &&
    t.reviewUntil > 0n &&
    now >= t.reviewUntil;
  const canRefund =
    (t.phase === 3 ||
      (t.phase === 2 && now >= t.claimUntil && t.funded > t.paid)) &&
    !!contributions.data &&
    !refunded.data;
  const prize = me < 0 ? 0n : (allocation.data?.[0][me] ?? 0n);
  const canClaim =
    t.phase === 2 &&
    now < t.claimUntil &&
    prize > 0n &&
    !allocation.data?.[1][me];
  const canExpire =
    (t.phase === 0 && !open) || (t.phase === 1 && !running && !ready);
  let settlementStatus = "Đang tải danh sách ván đấu.";
  if (ready) settlementStatus = "Đã đủ điều kiện chốt bảng thưởng.";
  else if (!running)
    settlementStatus =
      "Đã quá hạn hoàn tất. Có thể đóng giải để mở hoàn tài trợ.";
  else if (t.openAppeals > 0n)
    settlementStatus = "Cần xử lý các khiếu nại đang mở trước khi chốt thưởng.";
  else if (matches.data && approvedCount < list.length)
    settlementStatus =
      "Trọng tài cần duyệt các ván còn lại trước khi chốt thưởng.";
  else if (matches.data && t.reviewUntil > now)
    settlementStatus = `Có thể chốt thưởng sau ${date(t.reviewUntil)} nếu không phát sinh khiếu nại.`;
  const disabled = tx.busy || !address;
  async function action(
    functionName:
      | "register"
      | "start"
      | "finalize"
      | "claim"
      | "requestCancellation"
      | "approveCancellation"
      | "cancelExpired"
      | "refund",
  ) {
    if (await tx.send({ functionName, args: [id] })) refresh();
  }
  async function fund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let value: bigint;
    try {
      value = parseEther(String(new FormData(event.currentTarget).get("fund")));
      if (value <= 0n) throw Error();
    } catch {
      setFormError("Nhập số AVAX test lớn hơn 0.");
      return;
    }
    setFormError("");
    if (await tx.send({ functionName: "fund", args: [id] }, value)) refresh();
  }
  return (
    <div className="grid gap-5">
      <section className="surface-card grid gap-4">
        <div>
          <p className="eyebrow">
            GIẢI #{id.toString()} · {phaseNames[t.phase]}
          </p>
          <h2 className="section-title break-words">{t.title}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-400">Quỹ đã nạp</p>
            <strong className="text-amber-200">{amount(t.funded)}</strong>
          </div>
          <div>
            <p className="text-sm text-slate-400">Kỳ thủ</p>
            <strong>
              {players.length}/{t.capacity}
            </strong>
          </div>
          <div>
            <p className="text-sm text-slate-400">Đã trao</p>
            <strong>{amount(t.paid)}</strong>
          </div>
        </div>
        <details>
          <summary className="cursor-pointer font-semibold">
            Điều lệ và các mốc thời gian
          </summary>
          <p className="my-2 whitespace-pre-wrap break-words text-slate-200">
            {t.rules}
          </p>
          <p className="text-sm text-slate-300">
            Vòng tròn 5+0. Thắng 1 điểm, hòa ½ điểm.{" "}
            {t.capacity === 2
              ? "Giải nhất 70%, nhì 30%."
              : "Nhất 60%, nhì 30%, ba 10%."}{" "}
            Đồng điểm chia đều các suất liên quan.
          </p>
          <dl className="mt-3 grid gap-2 text-sm text-slate-400">
            <div>
              BTC: <span className="break-all">{t.organizer}</span>
            </div>
            <div>
              Trọng tài: <span className="break-all">{t.reviewer}</span>
            </div>
            <div>
              Đăng ký đến {date(t.registrationEnds)} · hoàn tất trước{" "}
              {date(t.completionDeadline)}
            </div>
            <div>
              Thời gian khiếu nại sau kết quả/quyết định mới nhất:{" "}
              {Number(t.reviewSeconds) / 3600} giờ.
            </div>
            <div>
              Mã điều lệ: <code className="break-all">{t.rulesHash}</code>
            </div>
          </dl>
        </details>
        {t.phase === 1 && (
          <div className="grid gap-2 text-sm text-slate-300">
            <p>
              Đã duyệt {approvedCount}/{list.length} ván ·{" "}
              {t.openAppeals.toString()} khiếu nại mở
            </p>
            <p>{settlementStatus}</p>
            {t.reviewUntil > now &&
              (t.openAppeals > 0n || approvedCount < list.length) && (
                <p>Nhận khiếu nại đến {date(t.reviewUntil)}.</p>
              )}
          </div>
        )}
        {t.phase === 2 && (
          <p className="text-sm text-slate-300">
            Nhận thưởng đến {date(t.claimUntil)}. Phần không nhận sẽ hoàn theo
            tỷ lệ tài trợ.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {open && me < 0 &&
            (registrationBlock ? (
              <p className="text-sm text-amber-100">{registrationBlock}</p>
            ) : (
              <button
                className="button-primary"
                disabled={disabled}
                onClick={() => void action("register")}
              >
                Đăng ký miễn phí
              </button>
            ))}
          {open && me >= 0 && (
            <span className="text-emerald-300">Bạn đã đăng ký.</span>
          )}
          {open && organizer && (
            <button
              className="button-primary"
              disabled={
                disabled || players.length !== t.capacity || t.funded === 0n
              }
              onClick={() => void action("start")}
            >
              Bắt đầu giải
            </button>
          )}
          {ready && (
            <button
              className="button-primary"
              disabled={disabled}
              onClick={() => void action("finalize")}
            >
              Chốt bảng thưởng
            </button>
          )}
          {canClaim && (
            <button
              className="button-primary"
              disabled={disabled}
              onClick={() => void action("claim")}
            >
              Nhận {amount(prize)}
            </button>
          )}
          {canRefund && (
            <button
              className="button-secondary"
              disabled={disabled}
              onClick={() => void action("refund")}
            >
              Nhận hoàn tài trợ
            </button>
          )}
          {organizer &&
            (open || (running && !t.cancellationRequested && !ready)) && (
              <button
                className="button-secondary"
                disabled={disabled}
                onClick={() => {
                  if (
                    window.confirm(
                      open
                        ? "Hủy đăng ký giải và mở hoàn tài trợ?"
                        : "Gửi yêu cầu hủy cho trọng tài?",
                    )
                  )
                    void action("requestCancellation");
                }}
              >
                {open ? "Hủy giải" : "Đề nghị hủy giải"}
              </button>
            )}
          {running && reviewer && t.cancellationRequested && !ready && (
            <button
              className="button-secondary"
              disabled={disabled}
              onClick={() => {
                if (window.confirm("Duyệt hủy giải và hoàn tiền tài trợ?"))
                  void action("approveCancellation");
              }}
            >
              Duyệt hủy giải
            </button>
          )}
          {canExpire && (
            <button
              className="button-secondary"
              disabled={disabled}
              onClick={() => void action("cancelExpired")}
            >
              Đóng giải quá hạn
            </button>
          )}
        </div>
        {open && me < 0 && !reviewer && !!relaySigner.data && !relay && (
          <form className="flex flex-wrap items-end gap-2" onSubmit={fund}>
            <label>
              Tài trợ quỹ ({CURRENCY_SYMBOL} test)
              <input
                className={input}
                name="fund"
                required
                inputMode="decimal"
                placeholder="0.02"
              />
            </label>
            <button className="button-secondary" disabled={disabled}>
              Nạp quỹ
            </button>
          </form>
        )}
        {formError && (
          <p className="text-rose-300" role="alert">
            {formError}
          </p>
        )}
      </section>
      <section className="surface-card overflow-x-auto">
        <h2 className="section-title">
          {t.phase === 2 ? "Bảng kết quả cuối" : "Bảng điểm tạm"}
        </h2>
        {!players.length ? (
          <p className="mt-3 text-slate-400">Chưa có kỳ thủ đăng ký.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Kỳ thủ</th>
                <th>Điểm</th>
                {t.phase === 2 && <th>Thưởng</th>}
              </tr>
            </thead>
            <tbody>
              {players
                .map((player, index) => ({
                  player,
                  index,
                  point: points[index] ?? 0n,
                }))
                .sort((a, b) => Number(b.point - a.point))
                .map(({ player, index, point }) => (
                  <tr className="border-t border-white/10" key={player}>
                    <td className="py-2 font-mono" title={player}>
                      {short(player)}
                      {me === index && " · Bạn"}
                    </td>
                    <td>{Number(point) / 2}</td>
                    {t.phase === 2 && (
                      <td>
                        {amount(allocation.data?.[0][index] ?? 0n)}
                        {allocation.data?.[1][index] && " · Đã nhận"}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
      {!!list.length && (
        <section className="surface-card">
          <h2 className="section-title">Lịch ván đấu</h2>
          <p className="mb-3 text-sm text-slate-400">
            Mỗi cặp chơi một ván. Hai kỳ thủ mở cùng ván theo lịch BTC.
          </p>
          <ul className="grid gap-2">
            {list.map((match) => (
              <li
                key={match.roomId.toString()}
                className="rounded-lg border border-white/10 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>#{match.roomId.toString()}</strong> · ♔{" "}
                    {short(match.white)} — ♚ {short(match.black)}
                  </span>
                  <span>
                    {match.result.reported
                      ? `${outcomes[match.result.outcome]} · ${match.result.approved ? "Đã duyệt" : "Chờ duyệt"}`
                      : "Chưa có kết quả"}
                  </span>
                  <Link
                    className="text-link"
                    href={`/tournaments/play?id=${id}&room=${match.roomId}`}
                  >
                    {match.result.reported ? "Xem ván" : "Mở ván"}
                  </Link>
                  <button
                    className="text-link"
                    aria-expanded={selectedMatch === match.roomId}
                    onClick={() =>
                      selectMatch(
                        selectedMatch === match.roomId
                          ? undefined
                          : match.roomId,
                      )
                    }
                  >
                    Hồ sơ
                  </button>
                </div>
                {selectedMatch === match.roomId && (
                  <MatchActions
                    key={match.roomId.toString()}
                    match={match}
                    reviewer={reviewer}
                    participant={me >= 0}
                    active={running}
                    appealAllowed={now < t.reviewUntil}
                    tx={tx}
                    refresh={refresh}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TournamentLobby() {
  const params = useSearchParams();
  const { address } = useAccount();
  const tx = useTournamentTx();
  const {
    data: next,
    refetch,
    isError,
  } = useReadContract({
    ...tournamentContract,
    functionName: "nextTournamentId",
    query: { enabled: tournamentEnabled, ...polling },
  });
  const { data: block, isError: blockError } = useBlock({
    chainId: CHAIN_ID,
    query: { enabled: tournamentEnabled, ...polling },
  });
  const [selection, setSelection] = useState<bigint>();
  const urlId = parseRoomId(params.get("id"));
  const id =
    selection ??
    (urlId !== undefined
      ? BigInt(urlId)
      : next && next > 0n
        ? next - 1n
        : undefined);
  if (!tournamentEnabled)
    return (
      <p className="surface-card">Chưa có giải thử nghiệm trên mạng này.</p>
    );
  if (!block || isError)
    return (
      <p className="surface-card" role="status">
        {blockError || isError
          ? "Chưa đọc được dữ liệu giải từ mạng thử nghiệm."
          : "Đang đọc dữ liệu giải…"}
      </p>
    );
  return (
    <div className="grid gap-5">
      {address ? (
        <CreateTournament
          tx={tx}
          now={block.timestamp}
          onCreated={(id) => {
            setSelection(id);
            void refetch();
          }}
        />
      ) : (
        <p className="text-slate-300">
          Kết nối ví để đăng ký hoặc quản lý giải. Bạn có thể xem giải mà không
          cần ví.
        </p>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = parseRoomId(
            String(new FormData(e.currentTarget).get("id")),
          );
          if (value !== undefined) setSelection(BigInt(value));
        }}
      >
        <label>
          Mã giải
          <input
            className={input}
            inputMode="numeric"
            pattern="[0-9]+"
            name="id"
            placeholder="0"
            required
          />
        </label>
        <button className="button-secondary">Mở giải</button>
        {!!next && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => setSelection(next - 1n)}
          >
            Giải mới nhất
          </button>
        )}
      </form>
      <div role="status" className="text-sm text-amber-100">
        {tx.message}
        {tx.hash && CHAIN_ID === 43113 && (
          <a
            className="ml-2 underline"
            href={`https://subnets.avax.network/fuji/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Xem giao dịch
          </a>
        )}
      </div>
      {id === undefined ? (
        <p className="surface-card">
          {next === 0n ? "Chưa có giải nào." : "Đang tải các giải…"}
        </p>
      ) : (
        <TournamentDetails
          key={`${id}:${address ?? "viewer"}`}
          id={id}
          tx={tx}
          now={block.timestamp}
        />
      )}
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <div className="app-shell">
      <AppHeader active="tournament" />
      <main className="site-container play-page">
        <section className="page-intro">
          <div>
            <p className="eyebrow">AVACLASH CUP · {NETWORK_NAME}</p>
            <h1>
              Chơi cờ. <span>Tranh giải.</span>
            </h1>
            <p className="intro-description">
              Tham gia miễn phí, không đặt cược. Quỹ thưởng do nhà tài trợ nạp
              trước bằng token thử nghiệm. Ví dùng để đăng ký, xác thực ván và
              nhận giải; giao dịch có phí mạng.
            </p>
          </div>
          <Link href="/hotseat" className="text-link">
            Tập cờ cùng thiết bị →
          </Link>
        </section>
        <Suspense fallback={<p role="status">Đang tải giải…</p>}>
          <TournamentLobby />
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}
