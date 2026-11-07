// Cursor keeps User Rules in its settings, not on disk (cursor.com/docs/context/rules), so the one
// global file cannot be linked there. Its User Rules hold one pointer line instead of a copy, so the
// text never goes stale. Copy the line to the clipboard and say where it goes.
import { spawnSync } from "node:child_process";

const line = "Before any task, read ~/skills/global/AGENTS.md and follow it. It is the source of truth.";
const copied = spawnSync("pbcopy", { input: line }).status === 0;
console.log(copied ? "Copied the pointer line to the clipboard." : `pbcopy is not available here. Copy this by hand:\n${line}`);
console.log(`In Cursor:
  1. Cursor Settings (Cmd+Shift+J), then Customize, then Rules.
  2. Under User Rules, click in the text box and press Cmd+A to replace the old text.
  3. Paste with Cmd+V. Cursor saves as you type. Do this once; later edits to the file need no paste.`);
