# agentisync

[![CI](https://github.com/daubas/agentisync/actions/workflows/ci.yml/badge.svg)](https://github.com/daubas/agentisync/actions/workflows/ci.yml)

`agentisync` is a local control plane for agent skills in a repository.

It helps power users who switch between multiple agent CLIs keep one canonical skill tree, inspect drift, and project skills into the paths each tool expects.

Status: v0.1.0 source release. Core v1 commands are implemented with TDD coverage.

## Project Status

- Current release: `v0.1.0`
- GitHub Release: <https://github.com/daubas/agentisync/releases/tag/v0.1.0>
- npm package: not published yet
- Local release gate: `npm run release:check`
- Clean Linux release gate: Docker command in [Release Checks](#release-checks)
- GitHub Actions: workflow is configured, but hosted Actions are currently blocked by a GitHub account billing issue

Until GitHub Actions is unblocked, use the local or Docker release checks as the source of truth for release verification.

Last verified locally on 2026-05-13:

- `npm run release:check`
- 10 test files passed
- 30 tests passed
- `npm pack --dry-run` passed

## Installation

The package is not published to npm yet.

For local development:

```bash
git clone https://github.com/daubas/agentisync.git
cd agentisync
npm install
npm run build
npm link
```

Then run:

```bash
agentisync status
```

Check CLI metadata:

```bash
agentisync --help
agentisync --version
```

## Quickstart

Inside a project that should own shared agent skills:

```bash
agentisync init
agentisync add build-docs
agentisync status
agentisync sync --dry-run
agentisync sync
agentisync status
```

This creates `.agentisync.yaml`, creates `.agents/skills`, scaffolds `.agents/skills/build-docs/SKILL.md`, reports drift, and projects canonical skills into configured targets.

## Migrating Existing Skills

For a repo that already has skills in `.claude/skills`, `.github/skills`, `.opencode/skills`, or global skill paths:

```bash
agentisync init
agentisync scan
agentisync import
agentisync status
```

`scan` is read-only. It analyzes existing skills and reports duplicates or conflicts.

`import` writes into `.agents/skills`, but stops before writing if unresolved conflicts exist.

## Why

Agent skills use a shared `SKILL.md` format, but agent CLIs still discover them from different paths.

Common examples:

- Codex and OpenClaw can read `.agents/skills`
- Claude Code reads `.claude/skills`
- OpenCode can read multiple project skill paths
- HermesAgent uses a global path such as `~/.hermes/skills`
- GitHub Copilot skills may live in `.github/skills`, `.agents/skills`, or related locations

Without a repo-level control plane, users end up copying skills manually, creating symlinks by hand, or accepting drift between tools.

## Product Contract

`agentisync` owns three jobs:

- describe the canonical skill state of the repo
- detect drift across agent CLI skill locations
- reconcile existing and projected skill trees without silent data loss

It does not publish, search, install, or host skills.

## Core User Stories

- Initialize one canonical skill tree in a repo.
- Add a new skill once under `.agents/skills`.
- Check whether repo skill state is clean before editing or syncing.
- Use JSON status output and stable exit codes in CI.
- Scan existing `.claude/skills`, `.github/skills`, `.opencode/skills`, and global paths before migration.
- Import scattered skills into canonical without silent overwrite.
- Sync canonical skills into tools that need projection.
- Keep Codex and OpenClaw as direct consumers instead of projection targets.

## Configuration

Default model:

- canonical root: `.agents/skills`
- config file: `.agentisync.yaml`
- direct readers are `consumers`
- projected destinations are `targets`
- `status` is the primary trust check
- `scan` analyzes imports without writing
- `import` writes into canonical only after scan-equivalent analysis
- `sync` projects canonical skills into configured targets

Example config:

```yaml
version: 1
canonical: .agents/skills
consumers:
  codex:
    path: .agents/skills
  openclaw:
    path: .agents/skills
targets:
  claude:
    path: .claude/skills
    mode: symlink
  opencode:
    path: .opencode/skills
    mode: symlink
  hermes:
    path: ~/.hermes/skills
    mode: copy
    optional: true
```

Config notes:

- `consumers` are tools that read `.agents/skills` directly.
- `targets` are paths that need projection.
- `mode: symlink` is preferred for zero-drift projection.
- `mode: copy` is useful for global or symlink-hostile targets.
- `optional: true` means a missing target is reported as skipped rather than treated as a hard failure.

### Project vs Global Skills

`agentisync` uses project-first precedence:

1. `.agents/skills` is the project canonical source of truth.
2. Project tool paths such as `.claude/skills` or `.opencode/skills` are migration sources or projection targets.
3. User/global paths such as `~/.agentisync/skills`, `~/.agents/skills`, `~/.claude/skills`, or `~/.hermes/skills` are personal sources or optional targets.

Global skills do not silently override project canonical skills. If the same skill name exists in project and global locations with different content, `scan` and `import` report a conflict instead of choosing one.

Different agent CLIs may apply their own runtime precedence. `agentisync` uses project-first precedence for repo state because project skills are Git-friendly and reproducible.

## Commands

Initial v1 commands:

- `agentisync init`: create `.agentisync.yaml` and `.agents/skills`
- `agentisync add <name>`: scaffold a canonical skill
- `agentisync scan`: inspect existing skill trees without writing
- `agentisync status`: report canonical, consumer, target, and drift state
- `agentisync sync`: project canonical skills into configured targets
- `agentisync import`: normalize existing scattered skills into canonical

Common options:

- `agentisync status --json`
- `agentisync scan --json`
- `agentisync sync --dry-run`
- `agentisync sync --force`
- `agentisync import --json`

### Command Examples

Create a new project-local skill:

```bash
agentisync init
agentisync add review-pr
```

Preview and apply projections:

```bash
agentisync status
agentisync sync --dry-run
agentisync sync
```

Inspect migration candidates before writing:

```bash
agentisync scan
agentisync scan --json
```

Import existing skills into canonical:

```bash
agentisync import
```

Use status in automation:

```bash
agentisync status --json
```

Important safety behavior:

- `status` is read-only
- `scan` is read-only
- `sync --dry-run` prints planned changes
- `sync --force` may replace conflicting target entries, but never modifies canonical
- `import` stops before writing when unresolved conflicts exist

## CI Usage

`status` returns stable exit codes:

- `0`: clean
- `1`: drift, missing target content, extra content, conflict, or broken symlink
- `2`: invalid config or command usage
- `3`: unsafe operation blocked
- `4`: filesystem or unexpected error

Example:

```bash
agentisync status --json
```

In CI, any non-zero exit code should usually fail the job.

## Release Checks

Run the local release check before tagging or publishing:

```bash
npm run release:check
```

This runs typecheck, tests, build, and `npm pack --dry-run`.

To verify in a clean Linux environment without depending on GitHub Actions:

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm \
  sh -lc "npm ci && npm run release:check"
```

GitHub Actions runs the same release gate on push and pull request when Actions is available for the repository.

## V1 Scope

In scope:

- `.agents/skills` canonical source
- `.agentisync.yaml` config
- consumers vs targets
- status and drift detection
- scan/import migration flow
- symlink-first, copy-fallback projection
- JSON output and stable exit codes for automation

Out of scope:

- registry hosting
- marketplace features
- package resolution
- passive-context generation
- instruction-file management
- Cursor rules conversion
- automatic commits
- dependency graphs

## Current Limitations

- npm package is not published yet.
- Windows symlink fallback behavior needs real-world validation.
- Import conflict resolution is conservative and manual.
- Status output is useful but still basic.
- GitHub Actions CI is configured for Linux, but hosted Actions are currently blocked by a GitHub account billing issue.
- macOS and Windows CI can be added after hosted Actions are available.

## Docs

- [PROBLEM.md](./PROBLEM.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PLAN.md](./PLAN.md)
- [SPEC.md](./SPEC.md)
- [IMPLEMENTATION_BRIEF.md](./IMPLEMENTATION_BRIEF.md)

---

# agentisync 繁體中文說明

[![CI](https://github.com/daubas/agentisync/actions/workflows/ci.yml/badge.svg)](https://github.com/daubas/agentisync/actions/workflows/ci.yml)

`agentisync` 是 repo 內 agent skills 的本地控制層。

它面向會在同一個專案中切換多個 agent CLI 的 power user，幫助使用者維護一份 canonical skill tree、檢查 drift，並把 skills 投影到各工具需要的路徑。

目前狀態：v0.1.0 source release。核心 v1 commands 已完成 TDD 覆蓋。

## Project Status

- 目前 release：`v0.1.0`
- GitHub Release：<https://github.com/daubas/agentisync/releases/tag/v0.1.0>
- npm package：尚未發布
- 本機 release gate：`npm run release:check`
- 乾淨 Linux release gate：見 [Release Checks](#release-checks)
- GitHub Actions：workflow 已設定，但目前 hosted Actions 因 GitHub account billing issue 被阻擋

在 GitHub Actions 恢復前，請以本機或 Docker release checks 作為 release verification 的依據。

最後一次本機驗證時間：2026-05-13

- `npm run release:check`
- 10 test files passed
- 30 tests passed
- `npm pack --dry-run` passed

## 安裝方式

目前尚未發布到 npm。

本機開發使用：

```bash
git clone https://github.com/daubas/agentisync.git
cd agentisync
npm install
npm run build
npm link
```

然後執行：

```bash
agentisync status
```

檢查 CLI metadata：

```bash
agentisync --help
agentisync --version
```

## 快速開始

在想要共用 agent skills 的專案內執行：

```bash
agentisync init
agentisync add build-docs
agentisync status
agentisync sync --dry-run
agentisync sync
agentisync status
```

這會建立 `.agentisync.yaml`、建立 `.agents/skills`、建立 `.agents/skills/build-docs/SKILL.md`、回報 drift，並將 canonical skills 投影到設定好的 targets。

## 遷移既有 Skills

如果 repo 已經有 `.claude/skills`、`.github/skills`、`.opencode/skills` 或全域 skill paths：

```bash
agentisync init
agentisync scan
agentisync import
agentisync status
```

`scan` 是唯讀，只分析既有 skills 並回報 duplicates 或 conflicts。

`import` 會寫入 `.agents/skills`，但遇到 unresolved conflicts 時會停止，不會寫入。

## 為什麼需要

Agent skills 雖然共用 `SKILL.md` 格式，但不同 agent CLI 仍然從不同路徑讀取 skills。

常見例子：

- Codex 和 OpenClaw 可以直接讀 `.agents/skills`
- Claude Code 讀 `.claude/skills`
- OpenCode 可以讀多個 project skill paths
- HermesAgent 使用 `~/.hermes/skills` 這類全域路徑
- GitHub Copilot skills 可能位於 `.github/skills`、`.agents/skills` 或相關位置

如果沒有 repo 層級的控制工具，使用者通常只能手動複製、手刻 symlink，或接受不同工具之間逐漸 drift。

## 產品契約

`agentisync` 只負責三件事：

- 描述目前 repo 的 canonical skill state
- 偵測不同 agent CLI skill 路徑之間的 drift
- 在不靜默遺失資料的前提下，收斂和投影 skill trees

它不負責發布、搜尋、安裝或託管 skills。

## 核心 User Stories

- 在 repo 內初始化一份 canonical skill tree。
- 只在 `.agents/skills` 新增一次 skill。
- 在修改或同步前檢查 repo skill state 是否乾淨。
- 在 CI 使用 JSON status output 和穩定 exit codes。
- 在 migration 前掃描 `.claude/skills`、`.github/skills`、`.opencode/skills` 和全域路徑。
- 將散落 skills 匯入 canonical，且不允許靜默覆蓋。
- 將 canonical skills 同步到需要 projection 的工具。
- 讓 Codex / OpenClaw 作為 direct consumers，而不是 projection targets。

## 設定方式

預設模型：

- canonical root：`.agents/skills`
- config file：`.agentisync.yaml`
- 直接讀 canonical 的工具是 `consumers`
- 需要同步投影的路徑是 `targets`
- `status` 是主要信任檢查
- `scan` 只分析 import，不寫入
- `import` 在完成 scan 等價分析後才寫入 canonical
- `sync` 把 canonical skills 投影到設定好的 targets

設定說明：

- `consumers` 是能直接讀 `.agents/skills` 的工具。
- `targets` 是需要 projection 的路徑。
- `mode: symlink` 適合零漂移 projection。
- `mode: copy` 適合全域路徑或不適合 symlink 的 target。
- `optional: true` 表示 target 不存在時回報 skipped，不視為硬錯誤。

### Project vs Global Skills

`agentisync` 採用 project-first precedence：

1. `.agents/skills` 是 project canonical source of truth。
2. `.claude/skills` 或 `.opencode/skills` 這類 project tool paths 是 migration sources 或 projection targets。
3. `~/.agentisync/skills`、`~/.agents/skills`、`~/.claude/skills`、`~/.hermes/skills` 這類 user/global paths 是 personal sources 或 optional targets。

Global skills 不會靜默覆蓋 project canonical skills。如果同名 skill 同時存在 project 和 global locations，且內容不同，`scan` 和 `import` 會回報 conflict，而不是自動選一個。

不同 agent CLI 可能有自己的 runtime precedence。`agentisync` 對 repo state 採 project-first precedence，因為 project skills 比較 Git-friendly，也比較可重現。

## 命令

初版 v1 命令：

- `agentisync init`：建立 `.agentisync.yaml` 和 `.agents/skills`
- `agentisync add <name>`：建立 canonical skill
- `agentisync scan`：分析既有 skill trees，不寫入
- `agentisync status`：回報 canonical、consumer、target 和 drift 狀態
- `agentisync sync`：把 canonical skills 投影到 targets
- `agentisync import`：把散落的 skills 收斂到 canonical

常用選項：

- `agentisync status --json`
- `agentisync scan --json`
- `agentisync sync --dry-run`
- `agentisync sync --force`
- `agentisync import --json`

### Command Examples

建立新的 project-local skill：

```bash
agentisync init
agentisync add review-pr
```

預覽並套用 projections：

```bash
agentisync status
agentisync sync --dry-run
agentisync sync
```

寫入前先檢查 migration candidates：

```bash
agentisync scan
agentisync scan --json
```

把既有 skills 匯入 canonical：

```bash
agentisync import
```

在 automation 中使用 status：

```bash
agentisync status --json
```

安全行為：

- `status` 不寫入
- `scan` 不寫入
- `sync --dry-run` 只顯示預計變更
- `sync --force` 可以替換 target 衝突項目，但不能修改 canonical
- `import` 遇到 unresolved conflicts 時會停止，不會寫入

## CI 使用

`status` 使用穩定 exit codes：

- `0`：clean
- `1`：drift、missing target content、extra content、conflict 或 broken symlink
- `2`：invalid config 或 command usage
- `3`：unsafe operation blocked
- `4`：filesystem 或 unexpected error

範例：

```bash
agentisync status --json
```

在 CI 中，通常任何非 0 exit code 都應該讓 job 失敗。

## Release Checks

在 tag 或 publish 前執行本機 release check：

```bash
npm run release:check
```

這會執行 typecheck、tests、build 和 `npm pack --dry-run`。

如果 GitHub Actions 暫時不能使用，可以用 Docker 在乾淨 Linux 環境驗證：

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm \
  sh -lc "npm ci && npm run release:check"
```

當 repo 可使用 GitHub Actions 時，push 和 pull request 會跑同一組 release gate。

## V1 範圍

包含：

- `.agents/skills` canonical source
- `.agentisync.yaml` 設定檔
- consumers vs targets
- status 和 drift detection
- scan/import migration flow
- symlink-first、copy-fallback projection
- JSON output 和穩定 exit codes

不包含：

- registry hosting
- marketplace features
- package resolution
- passive-context generation
- instruction-file management
- Cursor rules conversion
- automatic commits
- dependency graphs

## 目前限制

- 尚未發布 npm package。
- Windows symlink fallback 尚未經真實環境驗證。
- Import conflict resolution 目前保守且需要手動處理。
- Status output 可用但仍偏基礎。
- GitHub Actions CI 已設定 Linux，但 hosted Actions 目前因 GitHub account billing issue 被阻擋。
- macOS 和 Windows CI 可在 hosted Actions 可用後補上。
