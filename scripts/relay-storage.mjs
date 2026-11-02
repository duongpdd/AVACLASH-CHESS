#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const [, , action, sourceArg, targetArg] = process.argv;
if (!["backup", "restore"].includes(action) || !sourceArg || !targetArg)
  throw Error(
    "Usage: node scripts/relay-storage.mjs backup|restore SOURCE NEW_DESTINATION (stop relay first)",
  );
const source = fs.realpathSync(sourceArg),
  target = path.resolve(targetArg);
const relative = path.relative(source, target);
if (
  !relative ||
  (!relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative))
)
  throw Error("Destination must be outside source");
if (fs.existsSync(target))
  throw Error("Destination already exists; refuse overwrite");
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error("Symlinks are not allowed");
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".json") && entry.name !== "manifest.json") {
      const content = fs.readFileSync(full);
      JSON.parse(content.toString());
      files.push({
        path: path.relative(source, full).split(path.sep).join("/"),
        sha256: crypto.createHash("sha256").update(content).digest("hex"),
        content,
      });
    }
  }
}
walk(source);
if (action === "restore") {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source, "manifest.json"), "utf8"),
  );
  if (
    manifest.files.length !== files.length ||
    files.some(
      (f) =>
        !manifest.files.some((m) => m.path === f.path && m.sha256 === f.sha256),
    )
  )
    throw Error("Backup integrity verification failed");
}
fs.mkdirSync(target, { recursive: true });
for (const file of files) {
  const destination = path.join(target, file.path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, file.content, { flag: "wx" });
}
if (action === "backup")
  fs.writeFileSync(
    path.join(target, "manifest.json"),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        files: files.map(({ path, sha256 }) => ({ path, sha256 })),
      },
      null,
      2,
    ),
  );
console.log(
  `${action}: ${files.length} JSON files verified and copied; private keys are excluded.`,
);
