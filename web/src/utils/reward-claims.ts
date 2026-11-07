import { defaultUiText } from "@/i18n/ui-copy";
import {
  concatHex,
  encodeAbiParameters,
  isAddress,
  keccak256,
  type Hex,
} from "viem";

const hex32 = (v: unknown): v is Hex =>
  typeof v === "string" && /^0x[\da-f]{64}$/i.test(v);
const uint = (v: unknown): v is string =>
  typeof v === "string" && /^\d+$/.test(v) && BigInt(v) < 2n ** 256n;
export function parseRewardClaim(
  text: string,
  address: Hex,
  chainId: number,
  meta: Hex,
) {
  if (text.length > 1_000_000)
    throw Error(defaultUiText("messageTheRewardAllocationIsTooLarge"));
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object")
    throw Error(defaultUiText("messageInvalidRewardAllocation"));
  const file = data as Record<string, unknown>;
  if (
    file.chainId !== chainId ||
    typeof file.metaAddress !== "string" ||
    file.metaAddress.toLowerCase() !== meta.toLowerCase()
  )
    throw Error(defaultUiText("messageTheAllocationBelongsToADifferent"));
  if (
    !uint(file.seasonId) ||
    !hex32(file.merkleRoot) ||
    !hex32(file.allocationHash) ||
    !Array.isArray(file.allocations)
  )
    throw Error(defaultUiText("messageTheRewardAllocationIsIncomplete"));
  const allocation: unknown = file.allocations.find(
    (a: unknown) =>
      a &&
      typeof a === "object" &&
      "address" in a &&
      typeof a.address === "string" &&
      a.address.toLowerCase() === address.toLowerCase(),
  );
  if (!allocation || typeof allocation !== "object")
    throw Error(defaultUiText("messageTheCurrentWalletIsNotListed"));
  const item = allocation as Record<string, unknown>;
  if (
    !isAddress(address) ||
    !uint(item.amountWei) ||
    BigInt(item.amountWei) === 0n ||
    !Array.isArray(item.proof) ||
    item.proof.length > 64 ||
    !item.proof.every(hex32)
  )
    throw Error(defaultUiText("messageInvalidRewardOrProof"));
  const id = BigInt(file.seasonId),
    amount = BigInt(item.amountWei);
  let hash = keccak256(
    keccak256(
      encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "address" },
          { type: "uint256" },
          { type: "address" },
          { type: "uint256" },
        ],
        [BigInt(chainId), meta, id, address, amount],
      ),
    ),
  );
  for (const sibling of item.proof)
    hash = keccak256(
      concatHex(
        hash.toLowerCase() < sibling.toLowerCase()
          ? [hash, sibling]
          : [sibling, hash],
      ),
    );
  if (hash.toLowerCase() !== file.merkleRoot.toLowerCase())
    throw Error(defaultUiText("messageTheRewardProofDoesNotMatch"));
  return {
    id,
    amount,
    proof: item.proof,
    merkleRoot: file.merkleRoot,
    allocationHash: file.allocationHash,
  };
}
