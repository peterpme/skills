#!/usr/bin/env python3
"""Link this repository's root-level skills into the agent skill folders."""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Check links without changing them"
    )
    parser.add_argument(
        "--home", type=Path, default=Path.home(), help="Home directory to install into"
    )
    args = parser.parse_args()

    repo = Path(__file__).resolve().parent
    skills = [p.parent for p in sorted(repo.glob("*/SKILL.md"))]
    folders = [
        args.home.expanduser().resolve() / p
        for p in (
            ".agents/skills",
            ".claude/skills",
            ".cursor/skills",
            ".pi/agent/skills",
        )
    ]
    expected = {folder / skill.name: skill for folder in folders for skill in skills}
    conflicts, pending, retired = [], [], []

    for folder in folders:
        if folder.is_symlink() or (folder.exists() and not folder.is_dir()):
            conflicts.append(f"Skill folder must be a real directory: {folder}")
            continue
        if folder.exists():
            retired.extend(
                p
                for p in folder.iterdir()
                if p.is_symlink()
                and p.resolve().is_relative_to(repo)
                and p not in expected
            )

    for target, source in expected.items():
        if target.is_symlink() and target.resolve() == source:
            continue
        if target.is_symlink():
            if not target.resolve().is_relative_to(repo):
                conflicts.append(f"Another install owns {target}; leaving it unchanged")
                continue
        elif target.exists():
            conflicts.append(
                f"Existing file or directory at {target}; leaving it unchanged"
            )
            continue
        pending.append((target, source))

    if conflicts:
        parser.exit(1, "\n".join(conflicts) + "\n")

    if args.check:
        problems = [f"Missing or outdated: {p}" for p, _ in pending]
        problems.extend(f"Retired skill still linked: {p}" for p in retired)
        if problems:
            parser.exit(1, "\n".join(problems) + "\n")
        print(f"OK: {len(skills)} skills, {len(expected)} links")
        return

    for target in retired:
        target.unlink()
    for target, source in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_symlink():
            target.unlink()
        target.symlink_to(source, target_is_directory=True)

    print(
        f"Installed {len(skills)} skills: {len(pending)} links changed, {len(retired)} retired"
    )


if __name__ == "__main__":
    main()
