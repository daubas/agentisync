# Problem Statement: Agentic Skill Management Across Multiple CLIs

## Background

The agentic coding tool ecosystem has converged on a shared skill format — the [Agent Skills open standard](https://agentskills.io) (`SKILL.md`) — but each tool still discovers skills from its own directory path. A developer running multiple agentic CLIs in the same project must either duplicate skill files across paths or manually keep them in sync.

This is a solved problem in other ecosystems (dotfiles managers, monorepo tooling, config generators) but has no dedicated solution for agentic skills.

---

## Observed Pain Points

### 1. Path fragmentation

Every agentic CLI reads skills from a different location:

| Tool | Project skill path(s) |
|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` |
| OpenCode | `.agents/skills/`, `.claude/skills/`, `.opencode/skills/` |
| Codex CLI | `.agents/skills/` (primary) |
| OpenClaw | `.agents/skills/` |
| HermesAgent | `~/.hermes/skills/` (global only, no project path) |
| Cursor | `.cursor/rules/` (different format, out of v1 scope) |

A project that wants skills available across Claude Code and Codex must maintain both `.claude/skills/` and `.agents/skills/` — identical content, two locations, inevitable drift.

### 2. No canonical source of truth

With multiple paths, there is no clear answer to "where does the skill live?" Without a canonical location, version control strategy becomes ambiguous: do you commit both paths? symlink? copy?

The current common approach is ad hoc:
- Some projects commit only `.claude/skills/` and ignore Codex
- Some commit `.agents/skills/` and ignore Claude Code
- Some duplicate manually and accept drift
- Some use symlinks, which break on Windows and in certain Git configurations

### 3. Git-unfriendly by default

Most project `.gitignore` files exclude `.claude/` entirely (it contains runtime state like `worktrees/` and `scheduled_tasks.lock`). This means skills in `.claude/skills/` are silently excluded from version control unless the developer explicitly adds exceptions.

New contributors who clone the repo may get no skills at all, or different skills depending on which tool they use.

### 4. No tooling for skill lifecycle management

There is no standard way to:
- Scaffold a new skill with correct frontmatter
- Verify that all tool paths are in sync with the canonical source
- Detect drift between copies
- Add a new tool target without manually creating directories and copying files

Existing adjacent tools solve related but different problems:
- **rulesync** — generates instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`) from a single source, but does not handle `SKILL.md` files
- **CCPM** — installs community skills from a registry, but does not manage project-local skills
- **agentskills.io SDK** — defines the SKILL.md format standard, but provides no path management or sync tooling

### 5. The activation vs. passive-context tradeoff

Skills are activated on demand — the agent decides when to load them based on context. This is efficient but introduces an "activation problem": if the agent does not recognize the need to load a skill, it proceeds without it and produces plausible but incorrect output, with no visible failure signal.

Research (Vercel, 2026) found skills fail to activate in ~56% of cases on average. However, this rate is highly uneven:
- **Reference skills** with strong lexical anchors (e.g., "remotion" appearing in the task) activate reliably (~90%+)
- **Workflow skills** with contextual but not lexical anchors activate poorly (~40–60%)

This means skill management tooling must also help developers understand *which* skills benefit from passive context pointers in `CLAUDE.md`/`AGENTS.md` versus those that can stand alone.

---

## What a Solution Looks Like

A CLI tool (`agentisync`) that:

1. Defines a **canonical skill location** within the project, by default `.agents/skills/`, that is clean to version-control
2. Reads a **config file** (`.agentisync.yaml`) declaring which tools are in use and their target paths
3. Provides a **sync command** that writes from canonical → each tool path via symlink (preferred) or copy (Windows fallback)
4. Provides a **status command** that shows which paths are in sync, which have drifted, and which tools are unconfigured
5. Provides an **add command** that scaffolds a new skill with correct frontmatter in the canonical location
6. Handles `.gitignore` automatically — ensures canonical path is tracked, runtime dirs are not
7. Is **tool-agnostic and extensible** — new tools can be added via config, no hardcoded tool list

### Non-goals

- Managing instruction files (`CLAUDE.md`, `AGENTS.md`) — that is `rulesync`'s domain
- Installing community skills from a registry — that is `CCPM`'s domain
- Authoring skill content — the tool routes skills, it does not write them
- Converting Cursor rules — that is out of v1 scope

---

## Design Constraints

- **Zero runtime dependency on any agentic CLI** — the tool must work even if Claude Code or Codex is not installed
- **Git-first** — all operations should produce clean `git status` output; the canonical path should be committable with no noise
- **Symlink-first, copy-fallback** — prefer symlinks for zero-drift guarantees; detect Windows and fall back gracefully
- **Single config file** — one `.agentisync.yaml` at project root, no per-skill config required
- **Incremental adoption** — a project with existing `.claude/skills/` can migrate in without rewriting anything; agentisync imports them as the canonical source
- **Power-user first** — the primary audience is people who actively use multiple agent CLIs in the same project and want one source of truth

---

## Open Questions

1. How should HermesAgent's global-only skill path (`~/.hermes/skills/`) be handled? It breaks the project-local model entirely. Options: (a) keep it as an optional adapter only, (b) provide a separate `agentisync install --global` command later, (c) document it as out of scope.

2. Should agentisync generate passive-context pointers in `CLAUDE.md`/`AGENTS.md`? Keeps it focused if it doesn't; adds significant value if it does. Could be opt-in.

3. What is the right level of Git integration? Options range from "none" (just manage files) to "full" (manage `.gitignore`, create commits, run as a pre-commit hook).

---

## Related Work

| Project | Relation |
|---|---|
| [agentskills.io](https://agentskills.io) | Defines the SKILL.md format this tool routes |
| [rulesync](https://github.com/dyoshikawa/rulesync) | Handles instruction files; complementary, not competing |
| [CCPM](https://ccpm.dev) | Community skill registry/installer; complementary |
| [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Community skill index |
| [GNU Stow](https://www.gnu.org/software/stow/) | Symlink manager for dotfiles; inspiration for sync model |
