# Latest Plan

`agentisync` is moving toward a skill version-control tool for people who use multiple agent CLIs in the same project.

## Product Thesis

The project should become the local control plane for agent skills:

- one canonical project-owned source of truth
- deterministic projection into multiple agent-specific paths
- visible drift detection
- lossless import from existing layouts
- trustable status output that can be used interactively and in CI
- `status` is the primary user-facing trust check, not a side command

This is a control-plane problem, not a publishing problem.

## Why This Is Different From `gh skill`

GitHub's `gh skill` already does distribution work well:

- search
- preview
- install
- update
- publish
- provenance metadata in `SKILL.md`

That makes `gh skill` a strong supply-chain and distribution layer.

`agentisync` should not compete with that.

Instead, `agentisync` should solve the workspace problem:

- keep one repo-local canonical tree
- reconcile that tree with multiple CLI folder conventions
- detect drift before it causes confusion
- import existing scattered skills into one source of truth

## Differentiation Summary

The best differentiation is:

- `gh skill` = distribution and provenance from GitHub repos
- `agentisync` = local state management, migration, and cross-CLI reconciliation

## v1 Scope

Keep the first version narrow:

- canonical root: `.agents/skills/`
- config file: `.agentisync.yaml`
- commands: `init`, `add`, `scan`, `sync`, `status`, `import`
- target adapters for at least two CLIs
- HermesAgent as optional adapter only

## v1 Must Solve

1. A user can define one canonical tree in a repo.
2. The same skills can be projected into multiple agent paths.
3. The tool can tell the user when a tree is drifting or missing.
4. Existing scattered layouts can be imported without silent overwrite.
5. `status` must be useful before any sync happens.
6. `status` must be usable as a read-only automation primitive.
7. `scan` must explain import effects before `import` writes anything.

## What Not to Add Yet

- registry hosting
- marketplace features
- passive-context generation
- instruction-file management
- Cursor conversion
- full git automation

## Medium-Term Direction

If v1 lands well, the next step is to expand from sync into a broader skills version-control workflow:

- stronger conflict resolution
- provenance metadata for local imports
- diff and dry-run UX
- optional policy rules per target
- richer migration from legacy layouts
- JSON output and stable exit codes for automation
- explicit canonical state model for skills, provenance, and projections

## Success Criteria

The project is worth continuing if:

- power users use it across more than one CLI
- `import` becomes the easiest way to normalize a messy repo
- `status` becomes the trust layer people check before editing
- maintainers start thinking about skills as versioned project assets instead of duplicated folders
- CI can block drift before it reaches production work
- users trust the repo's skill state before they edit or sync anything
