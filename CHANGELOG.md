# Changelog

## 0.1.0 - 2026-05-13

Initial public release of `agentisync`.

### Added

- Project-local canonical skill root at `.agents/skills`.
- `.agentisync.yaml` configuration with consumers and projection targets.
- `agentisync init` for project setup.
- `agentisync add <name>` for canonical skill scaffolding.
- `agentisync scan` for read-only migration analysis.
- `agentisync status` for drift, target, consumer, and CI checks.
- `agentisync sync`, `sync --dry-run`, and `sync --force` for projection.
- `agentisync import` for safe migration into canonical.
- Symlink and copy projection modes.
- Project-first precedence for canonical state.
- Personal/global scan sources including `~/.agentisync/skills`.
- JSON output for automation.
- Stable exit codes.
- CLI `--help` and `--version`.
- GitHub Actions CI with install, typecheck, test, build, and pack dry-run.
- Local `release:check` and Docker release-check instructions for environments where GitHub Actions is unavailable.

### Not Included

- npm package publication.
- Registry or marketplace features.
- Instruction-file management such as `AGENTS.md` or `CLAUDE.md`.
- Cursor rules conversion.
- Interactive import conflict resolution.
- macOS or Windows CI jobs.
