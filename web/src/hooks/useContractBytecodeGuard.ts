import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { ESCROW_ADDRESS, validateAddressConfig } from "@/config/env";

export function useContractBytecodeGuard(targetAddress: `0x${string}` = ESCROW_ADDRESS) {
  const publicClient = usePublicClient();
  const addressValidation = validateAddressConfig(targetAddress);

  const {
    data: bytecode,
    isLoading,
  } = useQuery({
    queryKey: ["escrow-bytecode", targetAddress, publicClient?.chain?.id],
    queryFn: async () => {
      if (!publicClient) return null;
      try {
        const code = await publicClient.getCode({ address: targetAddress });
        return code ?? "0x";
      } catch (err: any) {
        return "0x";
      }
    },
    enabled: addressValidation.valid && !!publicClient,
    staleTime: 60_000,
  });

  const isInvalidAddress = !addressValidation.valid;
  const isBytecodeEmpty = !isLoading && addressValidation.valid && (!bytecode || bytecode === "0x");

  const hasConfigError = isInvalidAddress || isBytecodeEmpty;

  const errorMessage = isInvalidAddress
    ? `NEXT_PUBLIC_ESCROW_ADDRESS (${targetAddress}): ${addressValidation.error}`
    : isBytecodeEmpty
      ? `Không tìm thấy bytecode tại địa chỉ ESCROW_ADDRESS (${targetAddress}). Hợp đồng chưa được deploy lên RPC này hoặc chưa khởi chạy. Mọi thao tác đã bị khóa để bảo vệ tài sản.`
      : null;

  return {
    isLoading,
    hasConfigError,
    errorMessage,
    isBlocked: hasConfigError,
    bytecode,
  };
}
