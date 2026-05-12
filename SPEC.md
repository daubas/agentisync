# Agentisync V1 Specification

This document defines the first implementable version of `agentisync`.

## Product Contract

`agentisync` is the local control plane for agent skills in a repository.

It owns three jobs:

- describe the canonical skill state of the repo
- detect drift across agent CLI skill locations
- reconcile existing and projected skill trees without silent data loss

It does not publish, search, install, or host skills.

## Defaults

- config file: `.agentisync.yaml`
- canonical root: `.agents/skills`
- canonical root is not a sync target
- skill unit: one directory containing `SKILL.md`
- default deployment mode: `symlink`
- copy mode is allowed per target

## Config Schema

Minimal v1 config:

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

### Fields

- `version`: config version, initially `1`
- `canonical`: repo-relative canonical skill root
- `consumers`: map of tools that read the canonical root directly
- `targets`: map of target adapter names to target config
- `consumers.<name>.path`: path the consumer reads, usually the canonical root
- `targets.<name>.path`: repo-relative or home-relative target path
- `targets.<name>.mode`: `symlink` or `copy`
- `targets.<name>.optional`: if true, absence is reported as skipped rather than error

### Rules

- `canonical` must not also appear as a target path.
- direct readers of the canonical root belong in `consumers`, not `targets`.
- target names are adapter identifiers, not product dependencies.
- no command may require the target agent CLI to be installed.
- paths beginning with `~/` resolve against the user's home directory.

### Scope Mapping

- repo-relative paths are `project`
- home-relative paths beginning with `~/` are `personal`
- skills written into canonical by `import` are `imported`

## State Model

V1 state is computed from the filesystem and config. A persisted state file is not required.

Each skill has:

- `name`: directory name under canonical root
- `canonicalPath`: path to the canonical skill directory
- `fingerprint`: deterministic hash of files in the skill directory
- `sources`: where this skill was discovered during import or status scan
- `projections`: expected target locations
- `conflicts`: detected name or content conflicts
- `scope`: `project`, `personal`, or `imported`

The fingerprint must ignore filesystem metadata and depend only on file paths and contents.

## Commands

### `agentisync init`

Creates a minimal project config and canonical root.

Behavior:

- create `.agentisync.yaml` if missing
- create `.agents/skills` if missing
- do not overwrite existing config without an explicit force flag
- do not create target directories unless requested later by `sync`

### `agentisync add <name>`

Scaffolds a new canonical skill.

Behavior:

- create `.agents/skills/<name>/SKILL.md`
- fail if the skill already exists
- create minimal valid skill content
- do not sync automatically

Minimal scaffold:

```markdown
---
name: <name>
description: Describe when this skill should be used.
---

# <name>

Describe the workflow, references, or instructions for this skill.
```

### `agentisync scan`

Analyzes existing skill trees without writing anything.

Behavior:

- scan known source locations
- detect duplicate names
- compare content fingerprints
- classify existing sources as canonical, importable, duplicate, or conflicting
- print a human-readable plan
- support JSON output
- return stable exit codes defined below

### `agentisync status`

Primary trust check. Read-only.

Behavior:

- load config
- discover canonical skills
- inspect configured targets
- inspect configured consumers
- compute fingerprints
- report missing, extra, drifted, broken, skipped, and clean states
- return stable exit codes
- support human-readable and JSON output

Status must not mutate files.

### `agentisync sync`

Projects canonical skills into configured targets.

Behavior:

- read canonical skills
- create target directories as needed
- symlink or copy each canonical skill into each target
- never sync canonical root to itself
- refuse to overwrite unmanaged conflicting target content unless explicitly forced
- after sync, target status should become clean or explain why it cannot

`sync --dry-run` must print the planned changes without writing files.
`sync --force` may replace conflicting target entries according to the sync overwrite rules.

### `agentisync import`

Normalizes existing scattered skills into canonical root.

Behavior:

- use the same analysis model as `scan`
- detect duplicate names
- compare content fingerprints
- import one copy when canonical is missing and duplicate fingerprints match
- require explicit resolution for conflicting duplicates
- never silently overwrite canonical content
- write changes to the canonical root
- stop before writing if unresolved conflicts exist

Known v1 scan locations:

- `.github/skills`
- `.claude/skills`
- `.agents/skills`
- `.opencode/skills`
- `~/.agents/skills`
- `~/.claude/skills`
- `~/.copilot/skills`
- `~/.hermes/skills`

If `.agentisync.yaml` exists, the configured canonical path is treated as canonical state, not as an import source.
If config is missing, an existing `.agents/skills` directory may be treated as a bootstrap canonical candidate.

## Status Semantics

### Skill States

- `clean`: target matches canonical fingerprint
- `missing`: canonical skill is absent from target
- `drifted`: target skill exists but fingerprint differs
- `extra`: target contains a skill not found in canonical
- `broken`: target symlink is broken
- `skipped`: optional target is absent or unavailable
- `conflict`: multiple sources have the same skill name with different fingerprints

### Consumer States

- `ready`: configured consumer path matches the canonical root
- `missing`: configured consumer path does not exist
- `mismatch`: configured consumer path does not match the canonical root

### Target States

- `symlinked`: target entries are symlinks to canonical skills
- `copied`: target entries are copied from canonical skills
- `unmanaged`: target path contains content not created or recognized by `agentisync`
- `missing`: target path does not exist

Consumers are descriptive only. They must not cause canonical root to be treated as a target.

### Managed Recognition

V1 does not require a persisted state file, so ownership is inferred conservatively:

- symlink pointing to the canonical skill: managed
- copied directory with matching fingerprint: managed-like
- same skill name with different fingerprint: drifted or unmanaged
- target-only skill absent from canonical: extra
- broken symlink: broken

## Human Output

Default output should be compact and actionable:

```text
agentisync status

canonical  .agents/skills  3 skills

target     path              mode      state
claude     .claude/skills    symlink   drifted
opencode   .opencode/skills  symlink   missing
hermes     ~/.hermes/skills  copy      skipped

consumer   path              state
codex      .agents/skills    ready

drift
  claude/build-docs  content differs
  claude/release     missing

run: agentisync sync --dry-run
```

## JSON Output

`agentisync status --json` must return stable machine-readable output.

Shape:

```json
{
  "version": 1,
  "canonical": {
    "path": ".agents/skills",
    "skillCount": 3
  },
  "consumers": [
    {
      "name": "codex",
      "path": ".agents/skills",
      "state": "ready"
    }
  ],
  "summary": {
    "state": "drifted",
    "clean": 1,
    "missing": 1,
    "drifted": 1,
    "extra": 0,
    "broken": 0,
    "conflict": 0,
    "skipped": 1
  },
  "targets": [
    {
      "name": "claude",
      "path": ".claude/skills",
      "mode": "symlink",
      "state": "drifted",
      "skills": [
        {
          "name": "build-docs",
          "state": "drifted",
          "canonicalFingerprint": "sha256:...",
          "targetFingerprint": "sha256:..."
        }
      ]
    }
  ]
}
```

Unknown fields may be added later. Existing fields should remain stable within v1.

## Exit Codes

- `0`: clean, no drift or conflict
- `1`: non-clean analysis result, including drift, conflict, missing target content, extra content, or broken symlink
- `2`: invalid config or command usage
- `3`: unsafe operation blocked
- `4`: filesystem or permission error

CI should treat any non-zero code as failure unless explicitly configured otherwise.
Skipped optional targets do not make `status` fail by themselves.
`scan` and `status` share these exit code meanings.

## Import Conflict Rules

When two sources contain the same skill name:

- if fingerprints match, import once and record all sources
- if fingerprints differ, mark conflict and stop before writing
- if canonical already exists with matching content, leave it unchanged and report the additional source
- if canonical already exists with different content, stop before writing
- if target content exists and is unmanaged, require explicit force or resolution

V1 may implement conflict resolution as manual instructions. It does not need a full interactive merge UI.

## Sync Overwrite Rules

For each canonical skill and target:

- missing target skill: create symlink or copy
- symlink to the same canonical skill: leave unchanged
- symlink to a different location: block unless forced
- copied directory with matching fingerprint: leave unchanged
- copied directory with different fingerprint: block unless forced
- regular file where a directory is expected: block
- target-only skill absent from canonical: report as extra; do not delete by default

`sync --force` may replace conflicting target entries, but must never modify the canonical root.

## Adapter Defaults

Initial built-in adapters:

- `claude`: `.claude/skills`, default mode `symlink`
- `opencode`: `.opencode/skills`, default mode `symlink`
- `github`: `.github/skills`, default mode `symlink`
- `hermes`: `~/.hermes/skills`, default mode `copy`, optional

Codex and OpenClaw can read `.agents/skills` directly, so they do not need projection targets by default.

## Out of Scope for V1

- registry hosting
- marketplace features
- package resolution
- passive-context generation
- instruction-file management
- Cursor rules conversion
- automatic commits
- dependency graphs
