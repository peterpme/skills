import { readdir, lstat, mkdir, readFile, rename, realpath, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.SKILLS_HOME || homedir();
// Folders each harness reads, from github.com/vercel-labs/skills docs/agents.md and each harness's own docs.
const destinations = [".agents/skills", ".claude/skills", ".codex/skills", ".pi/agent/skills", ".cursor/skills", ".grok/skills", ".gemini/config/skills"];
// Other harnesses the skills CLI knows: linked only when the harness's home folder already exists on this machine.
const optional = {
  ".config/opencode": ".config/opencode/skills",
  ".copilot": ".copilot/skills",
  ".factory": ".factory/skills",
  ".gemini": ".gemini/skills",
  ".codeium/windsurf": ".codeium/windsurf/skills",
};
// One instruction file for every harness; each reads only its own path, and Claude only reads CLAUDE.md.
// Cursor has no file path (its User Rules point here); Antigravity loaded none of the paths tried (see README).
const globalFiles = {
  "global/AGENTS.md": [".codex/AGENTS.md", ".pi/agent/AGENTS.md", ".grok/AGENTS.md", ".claude/CLAUDE.md", ".config/opencode/AGENTS.md"],
};
const backupRoot = join(home, ".local/state/personal-skills/backups", `${Date.now()}-${process.pid}`);
const stat = async (path) => lstat(path).catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});

async function link(source, destination, type) {
  const target = join(home, destination);
  const existing = await stat(target);
  if (existing?.isSymbolicLink() && await realpath(target).catch(() => null) === await realpath(source)) return;
  if (existing) {
    const backup = join(backupRoot, destination);
    await mkdir(dirname(backup), { recursive: true });
    await rename(target, backup);
    console.log(`Backed up ${target} to ${backup}`);
  }
  await mkdir(dirname(target), { recursive: true });
  await symlink(source, target, type);
  console.log(`Linked ${target} -> ${source}`);
}

const active = [...destinations];
for (const [agentHome, skillsDir] of Object.entries(optional)) if (await stat(join(home, agentHome))) active.push(skillsDir);

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const source = join(root, entry.name);
  if (!(await stat(join(source, "SKILL.md")))?.isFile()) continue;
  for (const destination of active) await link(source, join(destination, entry.name), "dir");
}

for (const [file, targets] of Object.entries(globalFiles)) {
  for (const destination of targets) await link(join(root, file), destination, "file");
}

// Agent helper commands: bin/<name> -> ~/.local/bin/<name> (on PATH via ~/.zprofile).
for (const entry of await readdir(join(root, "bin"), { withFileTypes: true })) {
  if ((entry.isFile() || entry.isSymbolicLink()) && !entry.name.startsWith(".")) await link(join(root, "bin", entry.name), join(".local/bin", entry.name), "file");
}

// Claude Code Stop hook: bin/turn-check sends an agent back once when it ends a turn with a
// background task still running or a promise to report later that nothing will wake it for.
// Registered once in ~/.claude/settings.json (user scope). Other keys are left as they are and
// the file is never printed: it holds tokens.
async function registerStopHook() {
  const claudeHome = join(home, ".claude");
  if (!(await stat(claudeHome))?.isDirectory()) return;
  const file = join(claudeHome, "settings.json");
  const command = join(root, "bin/turn-check");
  let settings = {};
  if (await stat(file)) {
    try {
      settings = JSON.parse(await readFile(file, "utf8"));
    } catch {
      console.log(`Skipped ${file}: not valid JSON. Add a Stop hook running ${command} by hand.`);
      return;
    }
  }
  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  if (settings.hooks.Stop.some((entry) => entry.hooks?.some((hook) => hook.command?.endsWith("/bin/turn-check")))) return;
  settings.hooks.Stop.push({ matcher: "", hooks: [{ type: "command", command, timeout: 10 }] });
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  console.log(`Registered Claude Code Stop hook ${command} in ${file}`);
}
await registerStopHook();
