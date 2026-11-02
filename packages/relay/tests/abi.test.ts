import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CHESS_ESCROW_ABI, AVA_CLASH_META_ABI } from "@avaclash/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escrowArtifactPath = path.resolve(
  __dirname,
  "../../../contracts/out/ChessEscrow.sol/ChessEscrow.json"
);

const metaArtifactPath = path.resolve(
  __dirname,
  "../../../contracts/out/AvaClashMeta.sol/AvaClashMeta.json"
);

const hasEscrowArtifact = fs.existsSync(escrowArtifactPath);
const hasMetaArtifact = fs.existsSync(metaArtifactPath);

describe("Relay ABI sync with Foundry artifacts", () => {
  it.runIf(hasEscrowArtifact)(
    "matches contracts/out/ChessEscrow.sol/ChessEscrow.json ABI exactly",
    () => {
      const artifact = JSON.parse(fs.readFileSync(escrowArtifactPath, "utf-8"));
      expect(CHESS_ESCROW_ABI).toEqual(artifact.abi);
    }
  );

  it.runIf(hasMetaArtifact)(
    "matches contracts/out/AvaClashMeta.sol/AvaClashMeta.json ABI exactly",
    () => {
      const artifact = JSON.parse(fs.readFileSync(metaArtifactPath, "utf-8"));
      expect(AVA_CLASH_META_ABI).toEqual(artifact.abi);
    }
  );
});
