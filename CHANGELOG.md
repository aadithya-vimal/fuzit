# Changelog

## 0.0.9 — 2026-08-12

### Bug Fixes
- Fixed `fuzit pack --full` detail truncation bug: resolved 64KB per-file byte cap issue by enabling unconstrained file byte limits when `--full` is specified or when custom max byte sizes are supplied.

### New Features & Enhancements
- **Enhanced PR State Packing**: `fuzit pr pack <url>` and `fuzit pack <pr-url>` now fetch full PR preamble state (Title, Body/Description, Author, Branches, Diff Summary, and Discussion Comments) with an optional `--full` mode to pack the full repository state at the PR's head revision alongside the PR preamble.
- **Unlimited & Custom File-Size Packing**: Introduced `--max-file-bytes <size>` (e.g. `500kb`, `10mb`, `unlimited`) to override per-file byte limits.
- **Smart Content Scope Selectors**: Added `--exclude-tests`, `--only-code`, and `--exclude-docs` flags to filter context bundle content scope easily.
- **Repository Token & Statistics Inspector**: Added `fuzit stats` command and `--stats` flag to `fuzit pack` for file/token distribution breakdown by language and top file sizes.
- **Interactive PR Inspection**: Added `fuzit pr view <url>` and `fuzit pr list` subcommands.

## 0.0.8 — 2026-08-11

### Bug Fixes
- Fixed `fuzit pack --remote <url>` packing local PWD instead of the remote: the
  remote source was being parsed but never used. Now correctly dispatches:
  - **PR URLs** → fetches changed file diffs from GitHub API
  - **Repo URLs** → shallow-clones via git and scans
- Fixed `fuzit <repo-url>` top-level dispatch to route to `pack --remote` instead
  of the index-based `context` command.

### New Features
- `fuzit pr pack <url>` — pack a PR's changed file diffs into a context bundle.
  Supports PR URLs, `OWNER/REPO#NUMBER` shorthands, and `--output` flag.

## 0.0.1 — 2026-08-09

- Added a local-first task-aware context command and explainable selection.
- Added offline retrieval benchmarks, resource limits, cross-platform CI, and
  clean-room private packaging.
- Schema compatibility remains at context/report version 1 and local index
  version 1.
- Added cancellation/resource limits, three-platform CI, private multi-tarball
  installation, malicious-repository tests, a no-network privacy gate, and
  private-alpha acceptance evidence.
- Native Windows is verified. Linux evidence is WSL2 only; native-host Linux
  and native macOS remain experimental and community-validation-pending.
