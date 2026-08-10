# CLI reference

Fuzit is a private, local-first context-engineering CLI. Run `fuzit --help` or
`fuzit <command> --help` for the installed version's authoritative command
surface. This page describes the core repository workflow.

## Global options

Global options must appear before the command.

| Option | Purpose |
| --- | --- |
| `-V`, `--version` | Print the installed CLI version. |
| `--json` | Emit deterministic machine-readable output. |
| `--quiet` | Suppress nonessential human output. |
| `--debug` | Include debug diagnostics; incompatible with `--quiet`. |
| `-h`, `--help` | Display help. |

Machine-readable output is newline-terminated JSON on stdout. Diagnostics use
stable codes and do not include source content or secrets. Human diagnostics
use stderr. Non-TTY output never relies on color.

## Initialize and diagnose

```text
fuzit init [--dry-run] [--force]
fuzit doctor
fuzit config show [--json]
```

`init` creates only approved local configuration. Use `--dry-run` before
writing; `--force` replaces an incompatible configuration. `doctor` reports
local readiness without changing the repository. `config show` resolves the
effective configuration together with provenance.

## Discover and package repository context

```text
fuzit scan [--root <path>] [--list-roots]
           [--paths | --metadata | --items | --content | --summary]
           [--include <pattern>] [--exclude <pattern>]
           [--explain-path <path>]
fuzit pack [--root <path>] [--format <format>] [--output <path>]
           [--dry-run] [--git <mode>] [--since <snapshot>]
```

`scan` applies canonical repository-root confinement, hard exclusions, and the
documented include/exclude precedence. Repeated `--include` and `--exclude`
options are accepted. Content is emitted only when `--content` is explicit.

`pack` creates a security-filtered bundle. Supported formats are `markdown`,
`json`, `xml`, `text`, and `auto`. Use `--output -` for stdout, `--dry-run` to
inspect selection without writing, `--git current|history|diff` for bounded Git
context, and `--since` for an immutable snapshot baseline.

## Build task-aware context

```text
fuzit profile list [--json]
fuzit context --task <task> [--profile <profile>]
              [--budget-tokens <tokens>] [--format <format>]
              [--output <path>] [--root <path>] [--no-index] [--explain]
fuzit explain selection <report>
fuzit explain path <path> <report>
```

Profiles supply deterministic scoring and budget defaults. `context` selects a
bounded set for the requested task; `--no-index` performs a full calculation
without using the local index. `--explain` emits selection evidence aligned
with the result. The `explain` command reads a saved report and never executes
repository code.

## Git context

```text
fuzit git status
fuzit git log [options]
fuzit git diff [options]
fuzit git file-history [options] <path>
fuzit git blame [options] <path>
```

Git commands read only local repository metadata. History, diffs, and blame are
bounded and redacted before rendering. See the command's `--help` output for
the bounds supported by the installed version.

## Cache, snapshots, and comparison

```text
fuzit cache init [options]
fuzit cache status [options]
fuzit cache rebuild [options]
fuzit cache verify [options]
fuzit cache purge [options]
fuzit snapshot create [options]
fuzit snapshot list
fuzit snapshot show <id>
fuzit diff [--json] <snapshot-a> <snapshot-b>
```

The cache is repository-local and reproducible from source files. Snapshots are
immutable manifests; `diff` compares two snapshot identities in deterministic
path order. Purging a cache does not delete repository source.

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Success. |
| `2` | Invalid arguments, input, or configuration. |
| `3` | Required local capability unavailable. |
| `4` | Partial result with explicit diagnostics. |
| `70` | Unexpected internal defect. |
| `130` | Cancelled. |

Unknown commands exit with code `2`. Scripts should use exit status and JSON
diagnostic codes instead of matching human prose.

## Security and related references

- [Configuration](../cli/configuration.md)
- [Ignore precedence and hard exclusions](../cli/ignore-precedence.md)
- [Profiles](../cli/profiles.md)
- [Git context](../cli/git-context.md)
- [Exit codes and output channels](../cli/errors.md)
- [Graph commands](../cli/graph.md)
- [Snapshot lifecycle](../cli/snapshots.md)

Fuzit does not execute repository code, enable telemetry, or contact remote AI
services. Network-backed commands are explicit integrations and are not part of
the default local workflow.
