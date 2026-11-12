import { readdir, lstat, mkdir, readFile, rename, realpath, stat as fsStat, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.SKILLS_HOME || homedir();
// A linked git worktree holds a branch under review and is removed when that branch merges, so it
// must never become what the real home links to: every harness would read the branch's skills and
// then lose them. Linking from one is allowed only into a test home (SKILLS_HOME).
if (!process.env.SKILLS_HOME && (await lstat(join(root, ".git")).catch(() => null))?.isFile()) {
  console.log(`Skipped sync: ${root} is a linked git worktree. Run npm run sync from the main checkout.`);
  process.exit(0);
}
// A second full clone (one on a feature branch, say) would relink whatever it holds away from
// ~/skills, so the harnesses would read two checkouts at once (home#144). Only ~/skills links the real home.
const canonical = join(homedir(), "skills");
if (!process.env.SKILLS_HOME && await realpath(root) !== await realpath(canonical).catch(() => null) && await lstat(canonical).catch(() => null)) {
  console.log(`Skipped sync: ${root} is not ${canonical}. Run npm run sync there.`);
  process.exit(0);
}
// A second Claude config dir (~/.claude<n>) reads only its own skills folder, so it
// needs the links too; without them its threads saw 7 of the 27 skills (home#156).
const claudeAccounts = (await readdir(home, { withFileTypes: true }).catch(() => []))
  .filter((entry) => entry.isDirectory() && /^\.claude\d+$/.test(entry.name))
  .map((entry) => `${entry.name}/skills`);
// Folders each harness reads, from github.com/vercel-labs/skills docs/agents.md and each harness's own docs.
const destinations = [".agents/skills", ".claude/skills", ...claudeAccounts, ".codex/skills", ".pi/agent/skills", ".cursor/skills", ".grok/skills", ".gemini/config/skills"];
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

// Claude Code hooks from bin/, registered in the settings.json of every Claude Code config dir on
// the machine: ~/.claude, any ~/.claude<n> (a second config dir) and
// $CLAUDE_CONFIG_DIR. The command is the ~/.local/bin link, which survives the checkout or worktree
// that ran sync; an entry pointing elsewhere is rewritten. Other keys are left as they are, the
// write is atomic, and the file is never printed: it holds tokens.
// - Stop, bin/turn-check: sends an agent back once when it ends a turn with a background task still
//   running or a promise to report later that nothing will wake it for.
// - PermissionRequest, bin/scheduled-allow: answers allow to every permission prompt in a session
//   whose first message starts with [t3-sentinel-run], so a scheduled run never waits on Peter
//   (home #84). A PreToolUse allow does not stop the prompts bypass mode still raises.
// - SessionStart and PreToolUse, bin/start-task: opens every session with the folder's tracker, its
//   search command and the Tiers table, and denies the first file edit of a session with no ticket
//   link, once, so the ticket and tier come before any other action (home #17).
// - PreToolUse, bin/tool-guard: a permission ask on deploy commands and a warning on /tmp paths
//   (home #105).
const claudeHooks = [
  { event: "Stop", name: "turn-check" },
  { event: "PermissionRequest", name: "scheduled-allow" },
  { event: "SessionStart", name: "start-task" },
  { event: "PreToolUse", name: "start-task", matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash" },
  { event: "PreToolUse", name: "tool-guard", matcher: "Bash|Write|Edit|NotebookEdit" },
];
async function registerClaudeHooks() {
  const dirs = new Set([join(home, ".claude")]);
  for (const entry of await readdir(home, { withFileTypes: true })) {
    if (entry.isDirectory() && /^\.claude\d+$/.test(entry.name)) dirs.add(join(home, entry.name));
  }
  // A test home (SKILLS_HOME) must never touch the real config dir an agent's shell names (home#144).
  if (process.env.CLAUDE_CONFIG_DIR && !process.env.SKILLS_HOME) dirs.add(resolve(process.env.CLAUDE_CONFIG_DIR));
  for (const dir of dirs) {
    if (!(await stat(dir))?.isDirectory()) continue;
    try {
      await registerClaudeHooksIn(dir);
    } catch (error) {
      console.log(`Skipped ${join(dir, "settings.json")}: ${error.message}. Add ${claudeHooks.map(({ event, name }) => `a ${event} hook running ${join(home, ".local/bin", name)}`).join(" and ")} by hand.`);
    }
  }
}
async function registerClaudeHooksIn(dir) {
  // Follow a symlink (a dotfiles-tracked file) so the rename below replaces the target, not the link.
  const link = join(dir, "settings.json");
  const file = (await stat(link)) ? await realpath(link) : link;
  let settings = {};
  const existing = await stat(file);
  if (existing) {
    try {
      settings = JSON.parse(await readFile(file, "utf8"));
    } catch {
      throw new Error("not valid JSON");
    }
  }
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) throw new Error(`${file} is not a JSON object`);
  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) settings.hooks = {};
  const changes = [];
  for (const { event, name, matcher = "" } of claudeHooks) {
    const command = join(home, ".local/bin", name);
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
    const ours = settings.hooks[event].flatMap((entry) => (Array.isArray(entry?.hooks) ? entry.hooks : [])).filter((hook) => typeof hook?.command === "string" && hook.command.endsWith(`/bin/${name}`));
    if (ours.length && ours.every((hook) => hook.command === command)) continue;
    if (ours.length) for (const hook of ours) hook.command = command;
    else settings.hooks[event].push({ matcher, hooks: [{ type: "command", command, timeout: 10 }] });
    changes.push(`${ours.length ? "Updated" : "Registered"} Claude Code ${event} hook ${command}`);
  }
  if (!changes.length) return;
  const mode = existing ? (await fsStat(file)).mode & 0o777 : 0o600;
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, { mode });
  await rename(tmp, file);
  for (const change of changes) console.log(`${change} in ${file}`);
}
await registerClaudeHooks();
