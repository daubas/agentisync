# Agentisync Architecture Draft

## Goal

`agentisync` is a tool for keeping AI-agent skills consistent across multiple CLI ecosystems without depending on any one of them.

The core problem is not "how do I copy files". The problem is:

- one canonical skills source in a project
- multiple agent CLIs with different discovery paths
- drift, duplication, and migration pain

The primary user is a power user who actively switches between multiple agent CLIs in the same project.
The project should behave like a local control plane and workspace truth layer, not like a file copy utility.

## Product Thesis

The project is worth building only if it becomes the default answer to:

"I use more than one agent CLI. How do I keep skills in sync without maintaining duplicates?"

That means the tool must be:

- tool-agnostic
- Git-friendly
- migration-friendly
- explicit about state
- focused on cross-CLI skill portability rather than one ecosystem's native workflow

## Non-goals

The first version should not try to:

- author skill content
- install community skills from a registry
- manage instruction files like `CLAUDE.md` or `AGENTS.md`
- depend on any agent CLI being installed
- solve every future ecosystem integration up front

## Core Model

### Canonical source

The project owns one canonical skills directory in the repo, by default:

- `.agents/skills/`

This directory is the source of truth for all synced targets.

### Targets

A target is a path owned by a specific agent CLI, for example:

- `.claude/skills/`
- `.opencode/skills/`
- `~/.hermes/skills/`

Targets are declared in config, not hardcoded in the binary.

The canonical root itself is not a target. It is the source of truth that targets mirror from.

### Skill identity

A skill is identified by its directory name under the canonical root.

Example:

- `.agents/skills/my-skill/SKILL.md`

The sync layer should treat the directory as the unit of deployment.

## Config

Single project config file:

- `.agentisync.yaml`

Suggested responsibilities:

- set canonical root
- declare consumers that read canonical directly
- declare tool targets
- mark whether each target uses symlink or copy
- optionally declare import sources

Minimal shape:

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

### `init`

Creates the canonical directory, config file, and a sensible ignore setup.

### `add`

Scaffolds a new skill in the canonical directory.

Responsibilities:

- create skill directory
- create `SKILL.md`
- add minimal frontmatter or metadata template if needed

### `sync`

Writes canonical skills to each configured target.

Behavior:

- symlink when supported and safe
- copy when symlink is unavailable or explicitly disabled
- never require the target CLI to be installed
- block unmanaged target conflicts unless explicitly forced
- support `--dry-run` for planned changes without writes

### `scan`

Analyzes existing skill locations and reports importable skills, duplicates, and conflicts without writing files.

### `status`

Reports:

- configured targets
- configured consumers
- missing targets
- drift between canonical source and deployed copies
- broken symlinks
- unmanaged legacy skills found in old tool paths
- whether a target is symlinked, copied, unmanaged, or missing

Status should work as both an interactive trust check and an automation primitive.
It should produce stable machine-readable output in addition to the human-readable view.

Status is the primary read-only view of repo skill state. Sync should mutate state only after status can explain it.

### `import`

Writes existing skills from old skill locations into the canonical root.

This is critical for adoption because many users already have skills in:

- `.claude/skills`
- `.agents/skills`
- `.opencode/skills`

The migration path should use `scan` analysis and prefer importing existing `.claude/skills` or `.opencode/skills` content into `.agents/skills` rather than forcing a rewrite.

If multiple existing trees contain the same skill name with different content, `import` must not silently overwrite. It should require an explicit choice or dry-run confirmation.

## Adapter Layer

Each tool should be represented as a small adapter with only filesystem knowledge:

- target path
- sync mode
- optional platform constraints

The core should not know product-specific semantics beyond path layout.

This keeps the architecture extensible if new agents appear.

## Filesystem Strategy

### Symlink first

Preferred because:

- zero drift
- no duplicate content
- easy to keep consistent

### Copy fallback

Use when:

- symlinks are unavailable
- symlinks are undesirable on the platform
- a target path requires copied content

Copy mode must be detectable in `status` so the user knows drift is possible.

## Git Strategy

The repo should stay clean by default.

Requirements:

- canonical skills should be tracked in Git
- runtime state should not pollute the repo
- generated target directories should be ignored or safely managed

The tool should make it easy to commit one source of truth, not multiple mirrored copies.

`status` should be able to tell the user when the repository no longer matches the canonical state, so CI or pre-commit hooks can fail early.

### Canonical state model

The implementation should track a small, explicit state model rather than inferring everything ad hoc from paths.

Useful state fields include:

- skill identity
- source provenance
- target projections
- hash or fingerprint
- conflict state
- scope: project, personal, or imported

## Migration Flow

Likely migration path:

1. detect existing skill directories
2. choose one as the source of truth
3. move or import into canonical root
4. configure remaining targets
5. sync

This is one of the main reasons the project can be useful beyond a shell script.

If more than one existing tree is present, the tool should surface conflicts before writing anything.

## Version 1 Boundaries

The first shippable version should include:

- canonical root
- config file
- `add`
- `sync`
- `scan`
- `status`
- `import`
- at least two real targets

It should not include:

- registry hosting
- package resolution
- skill dependency graphs
- passive-context generation
- editor integration
- Cursor conversion

## Biggest Risk

The biggest risk is becoming a thin wrapper around copy/symlink logic.

If that happens, the project will feel like a convenience script, not infrastructure.

To avoid that, `status` and `import` must be first-class from day one.

## Devil's Advocate Check

### Objection 1: This is just dotfile syncing with a new label

Answer:

- only if the project stops at file copying
- the differentiator is canonical source + drift detection + migration across multiple agent ecosystems

### Objection 2: Upstream projects will solve this eventually

Answer:

- maybe partially, but each ecosystem is incentivized to optimize its own path
- cross-tool portability is usually nobody's first priority
- even if upstream improves, users still need a local migration and sync layer today

### Objection 3: The audience is too niche for a real OSS project

Answer:

- true for mass-market adoption
- not true for developer infra adoption
- the audience is small but high-friction, which is a good fit for a sharp open-source utility

### Objection 4: Global-only tools make the model messy

Answer:

- they should remain optional adapters
- the core should still be project-local and predictable
- if a tool cannot fit the model cleanly, it should not distort the architecture

### Objection 5: Why not just use `.agents/skills` directly and stop there?

Answer:

- `.agents/skills` is the best default canonical root for v1 because it matches the open standard and current tooling reality
- `agentisync` still adds value by handling migration, status, drift, and optional adapters across tools that do not naturally share one path
- the goal is not to invent a new directory for its own sake; the goal is to give users one portable source of truth with explicit sync semantics

### Objection 6: Cursor is mentioned but not supported

Answer:

- Cursor is part of the problem statement because it shows the ecosystem is fragmented
- it is not part of v1 because its format is not a skills path adapter
- keeping it out of the first release prevents scope creep

### Objection 7: Why does `status` matter if sync already exists?

Answer:

- sync changes state; status explains state
- trust comes from being able to inspect drift before mutating anything
- CI needs a read-only primitive, not another write path

### Objection 8: This is still a generic sync tool with extra labels

Answer:

- only if the state model is missing
- `agentisync` needs to own repo truth, not path movement
- if the tool cannot explain current state before changing it, it is not a control plane

## Open Questions

1. Should `status` detect unmanaged skills outside the canonical root and offer migration hints by default?
2. Should symlink fallback be per-target or per-platform?
3. Should global-only tools like Hermes stay as optional adapters only, or get a dedicated `install --global` command later?
