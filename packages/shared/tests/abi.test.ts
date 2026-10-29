import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CHESS_ESCROW_ABI, AVA_CLASH_META_ABI } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("@avaclash/shared ABI sync with Foundry artifacts", () => {
  it("matches contracts/out/ChessEscrow.sol/ChessEscrow.json ABI exactly", () => {
    const artifactPath = path.resolve(
      __dirname,
      "../../../contracts/out/ChessEscrow.sol/ChessEscrow.json"
    );
    expect(fs.existsSync(artifactPath)).toBe(true);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    expect(CHESS_ESCROW_ABI).toEqual(artifact.abi);
  });

  it("matches contracts/out/AvaClashMeta.sol/AvaClashMeta.json ABI exactly", () => {
    const artifactPath = path.resolve(
      __dirname,
      "../../../contracts/out/AvaClashMeta.sol/AvaClashMeta.json"
    );
    expect(fs.existsSync(artifactPath)).toBe(true);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    expect(AVA_CLASH_META_ABI).toEqual(artifact.abi);
  });
});
