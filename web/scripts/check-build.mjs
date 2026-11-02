import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cmd = process.execPath;
const args = [require.resolve("next/dist/bin/next"), "build", "--webpack"];

console.log(`[check:build] Running: ${cmd} ${args.join(" ")}`);

const child = spawn(cmd, args, {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

let output = "";

child.stdout.on("data", (data) => {
  const str = data.toString();
  process.stdout.write(str);
  output += str;
});

child.stderr.on("data", (data) => {
  const str = data.toString();
  process.stderr.write(str);
  output += str;
});

child.on("close", (code) => {
  const forbiddenPatterns = [
    "Attempted import error",
    "does not contain a default export",
    "Module not found",
  ];

  const matched = forbiddenPatterns.filter((pattern) =>
    output.includes(pattern),
  );

  if (matched.length > 0) {
    console.error(
      `\n❌ [check:build] FAIL: Build output contains forbidden warning(s): ${matched.join(", ")}`,
    );
    process.exit(1);
  }

  if (code !== 0) {
    console.error(
      `\n❌ [check:build] FAIL: Build failed with exit code ${code}`,
    );
    process.exit(code ?? 1);
  }

  console.log(
    "\n✅ [check:build] PASS: Build succeeded with 0 phaser import warnings.",
  );
  process.exit(0);
});
