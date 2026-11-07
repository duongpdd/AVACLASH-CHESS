import { useUiCopy } from "@/i18n/use-ui-copy";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { ESCROW_ADDRESS, validateAddressConfig } from "@/config/env";

export function useContractBytecodeGuard(
  targetAddress: `0x${string}` = ESCROW_ADDRESS,
) {
  const uiText = useUiCopy();
  const publicClient = usePublicClient();
  const addressValidation = validateAddressConfig(targetAddress);

  const { data: bytecode, isLoading } = useQuery({
    queryKey: ["escrow-bytecode", targetAddress, publicClient?.chain?.id],
    queryFn: async () => {
      if (!publicClient) return null;
      try {
        const code = await publicClient.getCode({ address: targetAddress });
        return code ?? "0x";
      } catch {
        return "0x";
      }
    },
    enabled: addressValidation.valid && !!publicClient,
    staleTime: 60_000,
  });

  const isInvalidAddress = !addressValidation.valid;
  const isBytecodeEmpty =
    !isLoading && addressValidation.valid && (!bytecode || bytecode === "0x");

  const hasConfigError = isInvalidAddress || isBytecodeEmpty;

  const errorMessage = isInvalidAddress
    ? `NEXT_PUBLIC_ESCROW_ADDRESS (${targetAddress}): ${addressValidation.error}`
    : isBytecodeEmpty
      ? uiText("messageNoBytecodeFoundAtEscrowAddress", {
          p0: String(targetAddress),
        })
      : null;

  return {
    isLoading,
    hasConfigError,
    errorMessage,
    isBlocked: hasConfigError || isLoading || !publicClient,
    bytecode,
  };
}
