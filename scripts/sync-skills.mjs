import { readdir, lstat, mkdir, rename, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.SKILLS_HOME || homedir();
const destinations = [".agents/skills", ".claude/skills", ".codex/skills", ".pi/agent/skills", ".cursor/skills"];
const backupRoot = join(home, ".local/state/personal-skills/backups", `${Date.now()}-${process.pid}`);
const stat = async (path) => lstat(path).catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const source = join(root, entry.name);
  if (!(await stat(join(source, "SKILL.md")))?.isFile()) continue;
  for (const destination of destinations) {
    const target = join(home, destination, entry.name);
    const existing = await stat(target);
    if (existing?.isSymbolicLink() && await realpath(target).catch(() => null) === await realpath(source)) continue;
    if (existing) {
      const backup = join(backupRoot, destination, entry.name);
      await mkdir(dirname(backup), { recursive: true });
      await rename(target, backup);
      console.log(`Backed up ${target} to ${backup}`);
    }
    await mkdir(dirname(target), { recursive: true });
    await symlink(source, target, "dir");
    console.log(`Linked ${target} -> ${source}`);
  }
}
