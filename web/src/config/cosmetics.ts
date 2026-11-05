import * as env from "./env";

export function isCosmeticsEnabled() {
  // The optional feature also stays off with a legacy or partial config.
  return "cosmeticsEnabled" in env && env.cosmeticsEnabled;
}
