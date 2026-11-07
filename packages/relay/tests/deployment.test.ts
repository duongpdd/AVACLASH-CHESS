import { expect, it } from "vitest";
import {
  assertRailwayDeployment,
  assertRenderDeployment,
} from "../src/deployment.js";

const deployment = {
  RAILWAY_ENVIRONMENT_ID: "fixture-environment",
  RAILWAY_VOLUME_MOUNT_PATH: "/data",
  CHAIN_ID: "43113",
  HOST: "0.0.0.0",
  RESULTS_DIR: "/data/results",
  ACTIVE_DIR: "/data/results/active",
  ALLOW_NO_ORIGIN: "false",
  ALLOWED_ORIGINS: "https://chess.vercel.app",
};
it("keeps local Anvil startup independent of Railway settings", () => {
  expect(() => assertRailwayDeployment({ CHAIN_ID: "31337" })).not.toThrow();
});
it("allows the mounted Railway volume and exact production origins", () => {
  expect(() => assertRailwayDeployment(deployment)).not.toThrow();
  expect(() =>
    assertRailwayDeployment({
      ...deployment,
      ALLOWED_ORIGINS: "https://chess.vercel.app,https://chess.avaclash.dev",
    }),
  ).not.toThrow();
});
it.each([
  { RAILWAY_VOLUME_MOUNT_PATH: undefined },
  { RAILWAY_VOLUME_MOUNT_PATH: "/tmp" },
  { CHAIN_ID: "31337" },
  { HOST: "127.0.0.1" },
  { RESULTS_DIR: undefined },
  { RESULTS_DIR: "/tmp/results" },
  { ACTIVE_DIR: "/data/../tmp/active" },
  { ALLOW_NO_ORIGIN: "true" },
  { ALLOWED_ORIGINS: "" },
  { ALLOWED_ORIGINS: "http://localhost:3000" },
  { ALLOWED_ORIGINS: "https://chess.vercel.app/" },
  { ALLOWED_ORIGINS: "https://*.vercel.app" },
])("refuses unsafe or ephemeral Railway setup: %j", (override) => {
  expect(() =>
    assertRailwayDeployment({ ...deployment, ...override }),
  ).toThrow();
});

const render = {
  RENDER: "true",
  CHAIN_ID: "43113",
  HOST: "0.0.0.0",
  STORAGE_DRIVER: "postgres",
  DATABASE_URL:
    "postgresql://fixture:fixture@ep-fixture-pooler.ap-southeast-1.aws.neon.tech/avaclash?sslmode=verify-full",
  ALLOW_NO_ORIGIN: "false",
  ALLOWED_ORIGINS: "https://avaclash-chess.vercel.app",
};
it("allows Render only with a real database URL and exact web origin", () => {
  expect(() => assertRenderDeployment(render)).not.toThrow();
  expect(() => assertRenderDeployment({ CHAIN_ID: "31337" })).not.toThrow();
});
it.each([
  { DATABASE_URL: undefined },
  { STORAGE_DRIVER: "file" },
  { HOST: "127.0.0.1" },
  { DATABASE_URL: "postgresql://fixture:fixture@localhost/avaclash" },
  { ALLOW_NO_ORIGIN: "true" },
  { ALLOWED_ORIGINS: "https://*.vercel.app" },
])("refuses unsafe Render setup: %j", (override) => {
  expect(() => assertRenderDeployment({ ...render, ...override })).toThrow();
});
