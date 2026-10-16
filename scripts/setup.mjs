import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let current = "";
try {
  current = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], { cwd: root, encoding: "utf8" }).trim();
} catch (error) {
  if (error.status !== 1) throw error;
}
if (current && current !== ".githooks") {
  throw new Error(`Existing core.hooksPath is ${current}. Integrate the sync hook there before changing it.`);
}
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], { cwd: root });
await import("./sync-skills.mjs");
console.log("Installed hooks: git pull now syncs skills after merge or rebase.");
