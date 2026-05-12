# agentisync

`agentisync` is a local control plane for agent skills in a repository.

It helps power users who switch between multiple agent CLIs keep one canonical skill tree, inspect drift, and project skills into the paths each tool expects.

Status: planning/specification stage. Implementation has not started yet.

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

## Default Model

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

## Commands

Planned v1 commands:

- `agentisync init`: create `.agentisync.yaml` and `.agents/skills`
- `agentisync add <name>`: scaffold a canonical skill
- `agentisync scan`: inspect existing skill trees without writing
- `agentisync status`: report canonical, consumer, target, and drift state
- `agentisync sync`: project canonical skills into configured targets
- `agentisync import`: normalize existing scattered skills into canonical

Important safety behavior:

- `status` is read-only
- `scan` is read-only
- `sync --dry-run` prints planned changes
- `sync --force` may replace conflicting target entries, but never modifies canonical
- `import` stops before writing when unresolved conflicts exist

## Core User Stories

- Initialize one canonical skill tree in a repo.
- Add a new skill once under `.agents/skills`.
- Check whether repo skill state is clean before editing or syncing.
- Use JSON status output and stable exit codes in CI.
- Scan existing `.claude/skills`, `.github/skills`, `.opencode/skills`, and global paths before migration.
- Import scattered skills into canonical without silent overwrite.
- Sync canonical skills into tools that need projection.
- Keep Codex and OpenClaw as direct consumers instead of projection targets.

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

## Docs

- [PROBLEM.md](./PROBLEM.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PLAN.md](./PLAN.md)
- [SPEC.md](./SPEC.md)
- [IMPLEMENTATION_BRIEF.md](./IMPLEMENTATION_BRIEF.md)

---

# agentisync 繁體中文說明

`agentisync` 是 repo 內 agent skills 的本地控制層。

它面向會在同一個專案中切換多個 agent CLI 的 power user，幫助使用者維護一份 canonical skill tree、檢查 drift，並把 skills 投影到各工具需要的路徑。

目前狀態：規劃與規格階段，尚未開始實作。

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

## 預設模型

- canonical root：`.agents/skills`
- config file：`.agentisync.yaml`
- 直接讀 canonical 的工具是 `consumers`
- 需要同步投影的路徑是 `targets`
- `status` 是主要信任檢查
- `scan` 只分析 import，不寫入
- `import` 在完成 scan 等價分析後才寫入 canonical
- `sync` 把 canonical skills 投影到設定好的 targets

## 預計命令

- `agentisync init`：建立 `.agentisync.yaml` 和 `.agents/skills`
- `agentisync add <name>`：建立 canonical skill
- `agentisync scan`：分析既有 skill trees，不寫入
- `agentisync status`：回報 canonical、consumer、target 和 drift 狀態
- `agentisync sync`：把 canonical skills 投影到 targets
- `agentisync import`：把散落的 skills 收斂到 canonical

安全行為：

- `status` 不寫入
- `scan` 不寫入
- `sync --dry-run` 只顯示預計變更
- `sync --force` 可以替換 target 衝突項目，但不能修改 canonical
- `import` 遇到 unresolved conflicts 時會停止，不會寫入

## 核心 User Stories

- 在 repo 內初始化一份 canonical skill tree。
- 只在 `.agents/skills` 新增一次 skill。
- 在修改或同步前檢查 repo skill state 是否乾淨。
- 在 CI 使用 JSON status output 和穩定 exit codes。
- 在 migration 前掃描 `.claude/skills`、`.github/skills`、`.opencode/skills` 和全域路徑。
- 將散落 skills 匯入 canonical，且不允許靜默覆蓋。
- 將 canonical skills 同步到需要 projection 的工具。
- 讓 Codex / OpenClaw 作為 direct consumers，而不是 projection targets。

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

