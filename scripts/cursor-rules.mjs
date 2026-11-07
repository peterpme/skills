// Cursor keeps User Rules in its settings, not on disk (cursor.com/docs/context/rules), so the one
// global file cannot be linked there. Copy it to the clipboard and say where it goes.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../global/AGENTS.md");
const copied = spawnSync("pbcopy", { input: readFileSync(file) }).status === 0;
console.log(copied ? `Copied ${file} to the clipboard.` : `pbcopy is not available here. Copy ${file} by hand.`);
console.log(`In Cursor:
  1. Cursor Settings (Cmd+Shift+J), then Customize, then Rules.
  2. Under User Rules, click in the text box and press Cmd+A to replace the old text.
  3. Paste with Cmd+V. Cursor saves as you type.`);
