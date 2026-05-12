# Implementation Brief for Claude CLI

This brief is the handoff document for building `agentisync`.

## Objective

Build a small but credible v1 of `agentisync` that makes one canonical skills source usable across multiple agent CLIs in the same project.

The primary user is a power user who actively switches between multiple agent CLIs and wants one source of truth for skills.

## Product Position

Do not build a generic file sync script.

Build a skills portability layer with:

- canonical source
- explicit target adapters
- migration/import
- status and drift detection
- symlink-first deployment
- machine-readable status output
- a canonical state model for skills, projections, and conflicts

## Fixed Decisions

- Canonical root: `.agents/skills/`
- Config file: `.agentisync.yaml`
- Targets must be adapter-based, not hardcoded
- Consumers are separate direct readers of canonical, not projection targets
- HermesAgent is optional and should not distort the core model
- Scope is intentionally narrow
- The canonical root is not itself a target

## v1 Must Include

1. `init`
2. `add`
3. `scan`
4. `sync`
5. `status`
6. `import`
7. target adapters for at least two real tools

## v1 Must Not Include

- registry hosting
- marketplace features
- passive-context generation
- instruction file management
- Cursor conversion
- full git automation

## Expected Behavior

### `init`

- create `.agents/skills/`
- create `.agentisync.yaml`
- ensure the canonical path is version-control friendly

### `add`

- create a new skill directory under the canonical root
- scaffold `SKILL.md`

### `sync`

- read config
- sync canonical skills to each configured target
- prefer symlinks
- fall back to copies when needed
- block unmanaged conflicts unless forced

### `scan`

- inspect known skill locations
- report importable skills, duplicates, and conflicts
- write nothing

### `status`

- show configured targets
- show configured consumers
- show missing targets
- show drift
- show whether a target is symlinked, copied, unmanaged, or missing
- support both human-readable and JSON output
- return stable exit codes for clean / drift / error states
- report the repo's canonical view before any write happens

### `import`

- detect existing skill trees
- import them into the canonical root
- prefer lossless migration
- if multiple trees disagree on the same skill name, stop for explicit user choice instead of overwriting
- never silently normalize conflicts
- write only after scan-equivalent analysis finds no unresolved conflict

## Architecture Constraints

- Core logic must be filesystem-only
- Do not depend on any target CLI being installed
- Keep target-specific logic in small adapters
- Keep data model simple
- Keep error modes explicit

## Suggested Module Boundaries

If the implementation uses a structured codebase, keep these conceptual areas separate:

- config parsing
- canonical skill discovery
- target adapter resolution
- sync engine
- status engine
- import/migration logic
- platform checks

## Acceptance Criteria

The v1 is good enough if:

- a user can define one canonical skills tree
- the same skills can appear in multiple tool paths without manual duplication
- `status` can tell the user whether the tree is clean or drifting
- `import` can move an existing project into the canonical structure
- the implementation stays small enough to understand without a framework
- CI can consume `status` output without parsing fragile prose
- status is the primary trust check before sync or edit

## Recommended Execution Order

1. define config and data model
2. implement skill discovery and fingerprinting under `.agents/skills/`
3. implement `scan`
4. implement `status`
5. implement `sync`
6. implement `import`
7. implement `add`
8. implement `init`

## Non-Goals for Claude CLI

Do not widen scope during implementation.

If you find a feature that feels useful but is outside the brief, write it down as a follow-up instead of adding it to v1.
