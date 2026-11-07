"use client";

import type { UiText } from "@/i18n/ui-copy";
import { useUiCopy } from "@/i18n/use-ui-copy";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useAccount, useReadContract } from "wagmi";
import { isAddress, isAddressEqual, parseEventLogs, type Address } from "viem";
import { TOURNAMENT_ABI } from "@avaclash/shared";
import { CHAIN_ID, TOURNAMENT_ADDRESS } from "@/config/env";
import type { TournamentTx } from "@/hooks/use-tournament-tx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardCustom } from "@/components/ui/card-custom";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FieldError } from "@/components/status/field-error";

const capacityOptions = [2, 3, 4, 5, 6, 7, 8].map((value) => ({
  value: String(value),
  label: String(value),
}));
const timeFields = [
  { name: "registrationHours", label: "messageRegistrationHours", max: 720 },
  { name: "durationDays", label: "messageCompletionDays", max: 60 },
  { name: "reviewHours", label: "messageAppealsHours", max: 168 },
] as const;
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const sameWallet = (value: string, wallet?: Address) =>
  !!wallet && isAddress(value) && isAddressEqual(value, wallet);

function tournamentSchema(
  uiText: UiText,
  organizer?: Address,
  relaySigner?: Address,
) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, uiText("messageEnterATournamentName"))
        .max(90)
        .refine(
          (value) => byteLength(value) <= 120,
          uiText("messageTheNameExceeds120Bytes"),
        ),
      reviewer: z
        .string()
        .trim()
        .refine(
          (value) => isAddress(value),
          uiText("messageEnterAValidEvmWalletAddress"),
        )
        .refine(
          (value) => !sameWallet(value, organizer),
          uiText("messageRefereeMustDifferFromOrganizer"),
        )
        .refine(
          (value) => !sameWallet(value, relaySigner),
          uiText("messageRefereeCannotBeRelay"),
        ),
      rules: z
        .string()
        .trim()
        .min(1, uiText("messageEnterTheTournamentRules"))
        .max(2000)
        .refine(
          (value) => byteLength(value) <= 3000,
          uiText("messageTheRulesExceed3000Bytes"),
        ),
      capacity: z.enum(["2", "3", "4", "5", "6", "7", "8"]),
      registrationHours: z
        .number(uiText("messageEnterTheNumberOfRegistrationHours"))
        .int()
        .min(1)
        .max(720),
      durationDays: z
        .number(uiText("messageEnterTheNumberOfDaysTo"))
        .int()
        .min(1)
        .max(60),
      reviewHours: z
        .number(uiText("messageEnterTheNumberOfHoursFor"))
        .int()
        .min(1)
        .max(168),
    })
    .refine(
      ({ durationDays, registrationHours, reviewHours }) =>
        durationDays * 24 > registrationHours + reviewHours,
      {
        path: ["durationDays"],
        message: uiText("messageCompletionTimeMustExceedRegistrationTime"),
      },
    );
}

export default function CreateTournament({
  tx,
  now,
  onCreated,
}: {
  tx: TournamentTx;
  now: bigint;
  onCreated: (id: bigint) => void;
}) {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const { data: relaySigner } = useReadContract({
    abi: TOURNAMENT_ABI,
    address: TOURNAMENT_ADDRESS,
    chainId: CHAIN_ID,
    functionName: "relaySigner",
  });
  const schema = tournamentSchema(uiText, address, relaySigner);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      capacity: "8",
      registrationHours: 24,
      durationDays: 7,
      reviewHours: 24,
    },
  });

  const create = handleSubmit(
    async ({
      title,
      rules,
      reviewer,
      registrationHours,
      durationDays,
      reviewHours,
      capacity,
    }) => {
      const receipt = await tx.send({
        functionName: "createTournament",
        args: [
          title,
          rules,
          Number(capacity),
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
    },
  );

  return (
    <CardCustom>
      <h2 className="text-description">
        {uiText("messageCreateATournamentForOrganizers")}
      </h2>
      <form
        className="mt-4 grid gap-4 md:max-w-2xl"
        noValidate
        onSubmit={create}
      >
        <label className="text-label">
          {uiText("messageTournamentName")}
          <Input
            maxLength={90}
            placeholder="AvaClash Campus Cup"
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          <FieldError message={errors.title?.message} />
        </label>
        <label className="text-label">
          {uiText("messageRefereeWallet")}
          <Input
            placeholder="0x…"
            aria-invalid={!!errors.reviewer}
            {...register("reviewer")}
          />
          <small className="text-description">
            {uiText("messageUseAWalletDistinctFromThose")}
          </small>
          <FieldError message={errors.reviewer?.message} />
        </label>
        <label className="text-label">
          {uiText("messagePublicRules")}
          <textarea
            className="form-input"
            rows={4}
            maxLength={2000}
            aria-invalid={!!errors.rules}
            placeholder={uiText("messageDisconnectionPolicyFairPlayAndA")}
            {...register("rules")}
          />
          <FieldError message={errors.rules?.message} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="text-label">
            <label htmlFor="cup-capacity">
              {uiText("messageNumberOfPlayers")}
            </label>
            <Controller
              control={control}
              name="capacity"
              render={({ field, fieldState }) => (
                <>
                  <DropdownSelect
                    id="cup-capacity"
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    options={capacityOptions}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError message={fieldState.error?.message} />
                </>
              )}
            />
          </div>
          {timeFields.map(({ name, label, max }) => (
            <label className="text-label" key={name}>
              {uiText(label)}
              <Input
                type="number"
                min={1}
                max={max}
                aria-invalid={!!errors[name]}
                {...register(name, { valueAsNumber: true })}
              />
              <FieldError message={errors[name]?.message} />
            </label>
          ))}
        </div>
        <p className="text-description">{uiText("message50ChessInARound")}</p>
        <Button
          type="submit"
          tone="primary"
          className="w-fit"
          disabled={tx.busy || isSubmitting}
        >
          {uiText("messageCreateTournament")}
        </Button>
      </form>
    </CardCustom>
  );
}
