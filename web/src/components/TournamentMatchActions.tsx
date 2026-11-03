"use client";

import { useState, type FormEvent } from "react";
import { useAccount, useReadContract } from "wagmi";
import { keccak256, toHex, type Address } from "viem";
import { ZERO_ADDRESS } from "@/config/env";
import { tournamentContract, type TournamentTx } from "@/hooks/useTournamentTx";

const input =
  "w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-slate-100";
const outcomes = ["Trắng thắng", "Đen thắng", "Hòa"];
const polling = { refetchInterval: 6000 } as const;

type Match = {
  roomId: bigint;
  result: { reported: boolean; approved: boolean; outcome: number };
};

export default function MatchActions({
  match,
  reviewer,
  participant,
  active,
  appealAllowed,
  tx,
  refresh,
}: {
  match: Match;
  reviewer: boolean;
  participant: boolean;
  active: boolean;
  appealAllowed: boolean;
  tx: TournamentTx;
  refresh: () => void;
}) {
  const { address } = useAccount();
  const { data: open, refetch } = useReadContract({
    ...tournamentContract,
    functionName: "getOpenAppeals",
    args: [match.roomId],
    query: polling,
  });
  const { data: used, refetch: refreshUsed } = useReadContract({
    ...tournamentContract,
    functionName: "appealUsed",
    args: [match.roomId, address ?? ZERO_ADDRESS],
    query: { enabled: !!address && participant },
  });
  const [error, setError] = useState("");
  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "review" | "appeal" | "resolve",
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = String(data.get("note") ?? "").trim();
    if (!note) {
      setError("Nhập mã hồ sơ hoặc nội dung quyết định để đối chiếu.");
      return;
    }
    setError("");
    const evidence = keccak256(toHex(note));
    const outcome = Number(data.get("outcome"));
    const receipt =
      kind === "appeal"
        ? await tx.send({
            functionName: "appeal",
            args: [match.roomId, evidence],
          })
        : kind === "resolve"
          ? await tx.send({
              functionName: "resolveAppeal",
              args: [
                match.roomId,
                String(data.get("player")) as Address,
                outcome,
                evidence,
              ],
            })
          : await tx.send({
              functionName: "review",
              args: [match.roomId, outcome, evidence],
            });
    if (receipt) {
      refresh();
      void refetch();
      void refreshUsed();
    }
  }
  const selectOutcome = (
    <label>
      Kết quả được duyệt
      <select
        className={input}
        name="outcome"
        defaultValue={match.result.reported ? match.result.outcome : ""}
        required
      >
        <option value="" disabled>
          Chọn kết quả
        </option>
        {outcomes.map((label, i) => (
          <option key={label} value={i}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 text-sm">
      <p>
        Khiếu nại đang mở: {open?.length ?? "…"}. Chỉ mã kiểm chứng được gửi lên
        mạng; giữ bản gốc riêng để đối chiếu.
      </p>
      {error && (
        <p role="alert" className="text-rose-300">
          {error}
        </p>
      )}
      {active && reviewer && !match.result.approved && (
        <form className="grid gap-2" onSubmit={(e) => void submit(e, "review")}>
          {!match.result.reported && (
            <p className="text-amber-200">
              Chưa có kết quả relay. Chỉ ghi phán quyết thủ công nếu điều lệ cho
              phép, ví dụ bỏ cuộc hoặc lỗi máy chủ.
            </p>
          )}
          {selectOutcome}
          <label>
            Biên bản quyết định
            <input name="note" className={input} required maxLength={500} />
          </label>
          <button className="button-primary w-fit" disabled={tx.busy}>
            Duyệt ván
          </button>
        </form>
      )}
      {active && reviewer && !!open?.length && (
        <form
          className="grid gap-2"
          onSubmit={(e) => void submit(e, "resolve")}
        >
          <label>
            Khiếu nại của
            <select className={input} name="player" required>
              {open.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          {selectOutcome}
          <label>
            Biên bản giải quyết
            <input name="note" className={input} required maxLength={500} />
          </label>
          <button className="button-primary w-fit" disabled={tx.busy}>
            Giải quyết khiếu nại
          </button>
        </form>
      )}
      {active &&
        participant &&
        appealAllowed &&
        match.result.reported &&
        used === false && (
          <form
            className="grid gap-2"
            onSubmit={(e) => void submit(e, "appeal")}
          >
            <label>
              Mã hồ sơ bằng chứng
              <input name="note" className={input} required maxLength={500} />
            </label>
            <button className="button-secondary w-fit" disabled={tx.busy}>
              Gửi khiếu nại
            </button>
          </form>
        )}
    </div>
  );
}
