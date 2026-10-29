import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir, platform, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pulls this checkout every 30 minutes; the post-merge hook then relinks skills and instructions.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const log = join(home, ".local/state/personal-skills/pull.log");
// The hook runs node, and schedulers start with a bare PATH.
const path = [dirname(process.execPath), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
const pull = `git -C '${root}' pull --ff-only --quiet`;
await mkdir(dirname(log), { recursive: true });

if (platform() === "darwin") {
  const label = "com.peterpme.skills-pull";
  const plist = join(home, "Library/LaunchAgents", `${label}.plist`);
  await mkdir(dirname(plist), { recursive: true });
  await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string><string>${pull}</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${path}</string></dict>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict>
</plist>
`);
  const domain = `gui/${userInfo().uid}`;
  try {
    execFileSync("launchctl", ["bootout", domain, plist], { stdio: "ignore" });
  } catch {}
  execFileSync("launchctl", ["bootstrap", domain, plist]);
  console.log(`Installed ${plist}: pulls every 30 minutes, log in ${log}`);
} else if (platform() === "linux") {
  const units = join(home, ".config/systemd/user");
  await mkdir(units, { recursive: true });
  await writeFile(join(units, "skills-pull.service"), `[Unit]
Description=Pull ~/skills

[Service]
Type=oneshot
Environment=PATH=${path}
ExecStart=/bin/sh -c "${pull} >> '${log}' 2>&1"
`);
  await writeFile(join(units, "skills-pull.timer"), `[Unit]
Description=Pull ~/skills every 30 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=30min

[Install]
WantedBy=timers.target
`);
  execFileSync("systemctl", ["--user", "daemon-reload"]);
  execFileSync("systemctl", ["--user", "enable", "--now", "skills-pull.timer"]);
  console.log(`Installed skills-pull.timer: pulls every 30 minutes, log in ${log}`);
} else {
  console.log(`No automatic updates on ${platform()}; run git pull yourself.`);
}
