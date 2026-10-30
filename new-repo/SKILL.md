---
name: new-repo
description: Create a new GitHub repository, or bring an existing one up to standard, with branch protection, one required CI check, cached Rust (BeautifulRust clippy lints, rustfmt, nextest, cargo-deny) or TypeScript (Vite+ with oxfmt and oxlint, tsrs type checking) CI, Dependabot, and Railway deploys gated on CI. Use when creating a repo, setting up GitHub Actions or branch rules, or adding CI to a Rust or TypeScript project.
---

# New repo

Set up a repository so agents can only land code through a pull request whose CI passed. Everything is applied by files in the repo or by `scripts/github-setup`, never by clicking through settings.

Templates live in `templates/` next to this file. Copy them, then edit names and paths; do not write CI from scratch.

## 1. Create the repository

- Ask for the name and visibility if the user did not give them. Default to private under `peterpme`.
- Scaffold the project first so the first push already contains CI:
  - Rust: `cargo init`, then copy `templates/rust/rust-toolchain.toml` and set `channel` to the current stable release (`rustup check`). Add the lints from section 2.
  - TypeScript: `vp create` (Vite+), for example `vp create vite:application --no-interactive --package-manager pnpm`. Then switch type checking to tsrs: `vp remove typescript`, `vp add -D tsrs`, add `"typecheck": "tsrs --noEmit"` to the package.json scripts, and merge `templates/ts/vite.config.ts` into the scaffolded `vite.config.ts`. Run `vp check --fix` last; a fresh scaffold does not pass its own format check.
- Copy the CI files (section 2), commit, then `gh repo create OWNER/NAME --private --source . --push`.

For an existing repository, skip creation and go to section 2.

## 2. Add CI

| Stack | Copy | To |
|---|---|---|
| Rust | `templates/rust/ci.yml` | `.github/workflows/ci.yml` |
| Rust | `templates/rust/nextest.toml` | `.config/nextest.toml` |
| Rust | `templates/rust/deny.toml` | `deny.toml` |
| Rust | `templates/rust/clippy.toml` | `clippy.toml` |
| Rust | `templates/rust/lints.toml` | the end of `Cargo.toml` (`[workspace.lints]` in a workspace root, with `[lints] workspace = true` in each member) |
| TypeScript | `templates/ts/vite.config.ts` | merged into `vite.config.ts` |
| TypeScript | `templates/ts/ci.yml` | `.github/workflows/ci.yml` |
| Both | `templates/dependabot.yml` | `.github/dependabot.yml`, keeping only the ecosystems the repo uses |

What the templates do, and the rules to keep when editing them:

- **One required check, named `ci`.** It is an aggregator job with `if: always()` that fails if any job in its `needs` failed or was cancelled. Add every blocking job to its `needs`. The ruleset only ever names `ci`, so jobs can be renamed, split or skipped without touching GitHub settings.
- **Run on `pull_request` and on `push` to `main`.** The `main` run saves the caches that PRs restore, and Railway's Wait for CI needs a push-triggered workflow.
- **No workflow-level `paths:` filter.** A required check from a workflow that never starts stays pending forever. In a repo with both stacks, put both job sets in one workflow and skip them per job with `dorny/paths-filter`; a skipped job counts as passed in `ci`.
- **Only `main` saves caches.** PRs restore them but never write, so short-lived branches don't evict main's entries from the 10 GB repository cache.
- **Read-only token.** `permissions: contents: read` at the top; grant more per job only when a job needs it.
- **Cancel superseded PR runs** through `concurrency`. Each `main` commit gets its own group, so a burst of merges still checks (and can deploy) every one.
- **Every job has `timeout-minutes`.** The default is 6 hours, which a hung build would burn from the monthly Actions minutes.
- **Tags, not SHAs.** Actions are pinned to release tags and Dependabot bumps them weekly after a 7-day cooldown. Pin to commit SHAs instead for public or high-value repos.

Rust lints come from [BeautifulRust](https://github.com/morganlinton/BeautifulRust) (`lints/`, MIT, vendored at a pinned commit; the header says where to refresh it). They turn on clippy's pedantic group plus rules such as no `unwrap()` outside tests, a reason on every `#[expect]`, a `// SAFETY:` comment on every `unsafe` block, no `bool` parameters and no lossy `as` casts. Applications delete the lines marked `[lib]`. Set `rust-version` in `Cargo.toml` to the toolchain's minor version (for example `"1.99"`); the suppression lints switch off below 1.81. Fix what they flag rather than allowing it; when a suppression is right, use `#[expect(lint, reason = "...")]`.

Rust checks: `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo nextest` plus doctests, `cargo deny` (advisories, licenses, duplicate crates, sources) and `cargo machete` (unused dependencies). `actions-rust-lang/setup-rust-toolchain` installs the version in `rust-toolchain.toml` and caches `~/.cargo` and `target/` with `Swatinem/rust-cache`, keyed per job and per `Cargo.lock`. `taiki-e/install-action` installs prebuilt tool binaries in seconds instead of compiling them. Doctests run only when a `src/lib.rs` exists, since `cargo test --doc` fails on binary-only crates. If `cargo machete` flags a crate that is only used through a macro, list it under `[package.metadata.cargo-machete] ignored`. Set `publish = false` in each crate's `Cargo.toml` unless it is published, or `cargo deny` fails on the missing license.

TypeScript checks: `vp check --deny-warnings` runs oxfmt and oxlint, `vp run typecheck` runs **tsrs**, then `vp test` and the `build` script. tsrs is Cloudflare's Rust port of the TypeScript compiler: it takes `tsc` flags and `tsconfig.json`, and exits 2 on type errors. It is pinned as a dev dependency, so Dependabot updates it and every run uses the same version. It is still experimental and has no language server, so editors keep using their bundled TypeScript. `voidzero-dev/setup-vp` installs Vite+, Node and the package manager and caches the dependency store. Pin it to an exact tag; its `@v1` tag stopped updating at v1.15.0. Don't install oxlint, oxfmt or vitest directly; Vite+ wraps them.

Keep `typeAware` and `typeCheck` off in `vite.config.ts`: both run the TypeScript 7 toolchain, and tsrs replaces them. That gives up oxlint's type-aware rules such as `no-floating-promises`. Vite+ still installs TypeScript 7 as its own dependency, but nothing in check, test or build runs it. Libraries generate `.d.ts` files with oxc (`pack.dts.generator: "oxc"`), which needs explicit return types on exported functions and fails the build with TS9007 when one is missing.

Verify locally before pushing: Rust with `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features --locked -- -D warnings && cargo nextest run && cargo deny check && cargo machete`, TypeScript with `vp check --deny-warnings && vp run typecheck && vp test && vp run build`.

## 3. Apply GitHub settings

Run from the repository root:

```bash
~/.agents/skills/new-repo/scripts/github-setup OWNER/NAME
```

It is safe to rerun and prints one line per setting. `--dry-run` prints the API calls without making them. It stops if the default branch is not `main`, since the CI templates depend on that name. It applies:

- Squash merges only, PR title and body as the commit message, auto-merge allowed, "update branch" button on, merged branches deleted.
- Workflow `GITHUB_TOKEN` read-only and unable to approve PRs.
- Dependabot alerts and security updates. Secret scanning with push protection where available: every public repo, but not private repos on a personal account, which cannot buy Secret Protection. The script reads the setting back and reports what it found.
- A branch ruleset named `default` on the default branch: no deletion or force push, linear history, changes through a PR (no approvals required, since agents and the owner share an account; review threads must be resolved), and the `ci` check passing. No bypass actors.

To change the rules for one repo, copy `templates/ruleset.json` to `.github/rulesets/default.json`, edit it and rerun; the script prefers that file. `--check NAME` replaces the required checks. GitHub has no in-repo file that it reads for these settings, so the JSON file plus this script is the source of truth.

The ruleset does not require PR branches to be up to date with `main`. With several agent PRs open, that rule would leave each one blocked after every merge until someone runs `gh pr update-branch`, and auto-merge does not do it for you. Merge queues, which solve this properly, exist only for organization repos. The trade-off is that two PRs that each pass can break `main` together; the `main` CI run catches it, and Railway's Wait for CI keeps that commit from deploying. Set `strict_required_status_checks_policy` to `true` for a repo where that risk matters more than the friction. Merge with `gh pr merge --auto --squash`.

## 4. Deploy on Railway (when the project has a service)

- Railway's Config as Code files (`railway.toml`, `railway.json`) stop working on 2026-12-01 and new services cannot use them. Use Infrastructure as Code: `railway config init` writes `.railway/railway.ts` (CLI 5.42.1 or newer), `railway config plan` previews and `railway config apply` applies. For an existing service, `railway config migrate` converts the old file. Check option names against `railway config pull` and the docs at docs.railway.com/infrastructure-as-code instead of guessing them.
- Turn on **Wait for CI** for each GitHub-sourced service so Railway deploys a `main` commit only after its workflows succeed. Railway waits on every GitHub Actions run for the commit, and a failure skips the deploy. Then run `railway config pull` and keep the setting in `.railway/railway.ts`, or a later `apply` turns it back off.
- Rust services: copy `templates/rust/Dockerfile` and `.dockerignore`, replace `APP` with the binary name, and match the image's Rust version to `rust-toolchain.toml`. cargo-chef keeps dependencies in their own cached layer. Railway rejects BuildKit cache mounts unless their `id` hardcodes the service id, so do not add `--mount=type=cache` lines. Set a healthcheck path and listen on `0.0.0.0:$PORT`.
- TypeScript services: Railpack detects the package manager and build script without a Dockerfile; set the build and start commands in `.railway/railway.ts`.
- Applying infrastructure from CI needs a Railway project token stored as the `RAILWAY_TOKEN` repository secret. Ask the user to create it; never print or commit it.

## 5. Prove it

Show the user the evidence, not a summary of steps:

1. The settings and ruleset read back from the API: `gh api repos/OWNER/NAME --jq '{allow_squash_merge,allow_merge_commit,allow_rebase_merge,delete_branch_on_merge}'` and `gh api repos/OWNER/NAME/rulesets/ID`.
2. `ci` green on the first `main` run, and `gh cache list` showing the saved caches.
3. A direct `git push origin main` rejected with `GH013: Repository rule violations`.
4. A PR containing a deliberate failure (an `unwrap()` or clippy warning, or a type error) with `ci` failing and the merge blocked. Close it and delete its branch afterwards.
5. For Railway, a deploy that waited for CI, and its healthcheck passing.
