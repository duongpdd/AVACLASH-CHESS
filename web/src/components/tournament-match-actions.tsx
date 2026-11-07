"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useId, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FieldError } from "@/components/status/field-error";
import { ValueWithStatus } from "@/components/status/value-with-status";
import { useAccount, useReadContract } from "wagmi";
import { keccak256, toHex, type Address } from "viem";
import { ZERO_ADDRESS } from "@/config/env";
import {
  tournamentContract,
  type TournamentTx,
} from "@/hooks/use-tournament-tx";

const outcomes = (
  ["messageWhiteWins", "messageBlackWins", "messageDraw2"] as const
).map((label, index) => ({
  value: String(index),
  label,
}));
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
  const uiText = useUiCopy();
  const { address } = useAccount();
  const {
    data: open,
    refetch,
    isError,
    isPending,
  } = useReadContract({
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
  async function submit(
    { note, outcome, player }: DecisionFields,
    kind: DecisionKind,
  ) {
    const evidence = keccak256(toHex(note));
    const result = Number(outcome);
    const receipt =
      kind === "appeal"
        ? await tx.send({
            functionName: "appeal",
            args: [match.roomId, evidence],
          })
        : kind === "resolve"
          ? await tx.send({
              functionName: "resolveAppeal",
              args: [match.roomId, player as Address, result, evidence],
            })
          : await tx.send({
              functionName: "review",
              args: [match.roomId, result, evidence],
            });
    if (receipt) {
      refresh();
      void refetch();
      void refreshUsed();
    }
  }
  const outcome = match.result.reported ? String(match.result.outcome) : "";
  return (
    <div className="mt-3 grid gap-3 border-t border-border pt-3 text-sm">
      <p>
        {uiText("messageOpenAppeals2")}{" "}
        <ValueWithStatus error={isError} loading={isPending} noData={!open}>
          {open?.length}
        </ValueWithStatus>
        {uiText("messageOnlyTheVerificationHashIsSubmitted")}
      </p>
      {active && reviewer && !match.result.approved && (
        <DecisionForm
          key={outcome}
          kind="review"
          outcome={outcome}
          busy={tx.busy}
          onSubmit={submit}
        >
          {!match.result.reported && (
            <p className="text-status-warning">
              {uiText("messageTheRelayHasNoResultYet")}
            </p>
          )}
        </DecisionForm>
      )}
      {active && reviewer && !!open?.length && (
        <DecisionForm
          key={`resolve:${outcome}:${open.join(",")}`}
          kind="resolve"
          outcome={outcome}
          players={open}
          busy={tx.busy}
          onSubmit={submit}
        />
      )}
      {active &&
        participant &&
        appealAllowed &&
        match.result.reported &&
        used === false && (
          <DecisionForm kind="appeal" busy={tx.busy} onSubmit={submit} />
        )}
    </div>
  );
}

type DecisionKind = "review" | "appeal" | "resolve";
type DecisionFields = { note: string; outcome: string; player: string };
const copy = {
  review: { label: "messageDecisionRecord", submit: "messageApproveMatch" },
  resolve: { label: "messageResolutionRecord", submit: "messageResolveAppeal" },
  appeal: { label: "messageEvidenceRecordId", submit: "messageSubmitAppeal" },
} as const;

function DecisionForm({
  kind,
  outcome = "",
  players,
  busy,
  onSubmit,
  children,
}: {
  kind: DecisionKind;
  outcome?: string;
  players?: readonly Address[];
  busy: boolean;
  onSubmit: (fields: DecisionFields, kind: DecisionKind) => Promise<void>;
  children?: ReactNode;
}) {
  const uiText = useUiCopy();
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DecisionFields>({
    defaultValues: { note: "", outcome, player: players?.[0] ?? "" },
  });
  return (
    <form
      className="grid gap-2 md:max-w-lg"
      noValidate
      onSubmit={handleSubmit((fields) => onSubmit(fields, kind))}
    >
      {children}
      {players && (
        <div className="text-label">
          <label htmlFor={`${id}-player`}>{uiText("messageAppealFrom")}</label>
          <Controller
            control={control}
            name="player"
            rules={{ required: uiText("messageChooseTheWalletThatFiledThe") }}
            render={({ field, fieldState }) => (
              <>
                <DropdownSelect
                  id={`${id}-player`}
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  options={players.map((address) => ({
                    value: address,
                    label: address,
                  }))}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError message={fieldState.error?.message} />
              </>
            )}
          />
        </div>
      )}
      {kind !== "appeal" && (
        <div className="text-label">
          <label htmlFor={`${id}-outcome`}>
            {uiText("messageApprovedOutcome")}
          </label>
          <Controller
            control={control}
            name="outcome"
            rules={{ required: uiText("messageChooseAnOutcome") }}
            render={({ field, fieldState }) => (
              <>
                <DropdownSelect
                  id={`${id}-outcome`}
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  options={outcomes.map(({ value, label }) => ({
                    value,
                    label: uiText(label),
                  }))}
                  placeholder={uiText("messageChooseAnOutcome2")}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError message={fieldState.error?.message} />
              </>
            )}
          />
        </div>
      )}
      <label className="text-label">
        {uiText(copy[kind].label)}
        <Input
          aria-invalid={!!errors.note}
          maxLength={500}
          {...register("note", {
            setValueAs: (value: string) => value.trim(),
            required: uiText("messageEnterTheRecordIdOrDecision"),
          })}
        />
        <FieldError message={errors.note?.message} />
      </label>
      <Button
        type="submit"
        tone={kind === "appeal" ? "ghost" : "primary"}
        className="w-fit"
        disabled={busy || isSubmitting}
      >
        {uiText(copy[kind].submit)}
      </Button>
    </form>
  );
}
