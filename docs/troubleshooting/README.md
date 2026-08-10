# Troubleshooting

Start with read-only, privacy-safe evidence:

```text
fuzit --json doctor
fuzit --json config show
fuzit scan --root . --list-roots
fuzit support --preview
```

Do not paste source, credentials, environment dumps, Git remotes, private URLs,
or unredacted absolute paths into a report. The support preview is local,
metadata-only, deterministic, and never uploaded.

## Installation and startup failures

- Confirm Node matches `>=24.0.0 <25.0.0`, `.nvmrc` is `24`, and pnpm is exactly
  `11.9.0`. Reinstall from the verified private artifact or checkout if package
  contents or checksums differ.
- Run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm package:smoke`
  only in a trusted private source checkout. Never substitute a similarly named
  public package or fetch missing private workspace packages from a registry.
- Permission, long-path, symlink, and read-only errors retain host diagnostics.
  Fix the specific host capability; do not run Fuzit as an elevated user merely
  to bypass confinement or permission checks.

## Cache corruption or incompatibility

```text
fuzit --json cache status --root .
fuzit --json cache verify --root .
fuzit --json cache rebuild --root . --dry-run
```

`corrupt`, `schema-mismatch`, and `repository-mismatch` require rebuilding from
authoritative local inputs. A `locked` index may have an active writer; do not
remove its lock. Preview first, then run `fuzit cache rebuild --root .` only when
verification requires it. Use `cache purge --dry-run` before any purge and never
delete a broad cache parent or repository source as recovery.

## Watcher uncertainty

Native watchers may coalesce events or lose details during overflow. Inspect
`fuzit watch --root . --status --json`, then request one canonical reconciliation
with `fuzit watch --root . --reconcile --once --json`. Fuzit guarantees the
reconciled final state, not real-time delivery or host event ordering. If
reconciliation fails, stop the watcher and use the cache verification flow.

## Missing, failed, or partial parsing

Missing optional parsers, malformed syntax, oversized files, timeouts, and
unsupported constructs retain independent discovery and manifest facts while
returning bounded `partial` or `unsupported` diagnostics. Do not install or
execute a repository toolchain to make analysis succeed. Check the
[support matrix](../reference/support-matrix.md); reduce the explicit input or
use the secure file-level context when semantic extraction is unavailable.

## Partial graph results

Graph relations are evidence-backed and bounded, not perfect repository
knowledge. Missing parents, conflicting evidence, shallow history, cancellation,
depth over 10, or results over 1,000 produce a validation error or explicit
partial state. Reconcile the index and rerun within bounds; never infer absent
edges or disable the security filter. See the [incremental guide](../concepts/incremental-operation.md).

## Performance and resource limits

Large or highly connected repositories can reach file, byte, token, parser,
dependency-fan-out, graph, MCP, or process-time limits. The result remains
deterministic and reports truncation or partial completeness. Narrow the root,
task, profile, budget, graph depth, or result limit. Do not raise limits until
memory, cancellation, redaction, and output bounds have separate test evidence.

## MCP errors

- Startup requires one to eight existing canonical absolute allowed roots.
- An unknown root, traversal, swapped symlink, request over the size limit, or
  call over 30 seconds fails before disclosure.
- Stop the owning client, correct its local stdio command and argument-array
  allow-list, then restart it. Do not add a shell wrapper or network listener.

## VS Code errors

Commands require Workspace Trust and an explicitly selected root. Grant trust
only after reviewing the repository. For stale state, cancel the owned task,
reload the extension host, and select the root again. Reinstall only a verified
owner-supplied VSIX. Activation alone must not scan, spawn, watch, or use the
network.

## Plugin errors

Run `fuzit plugin validate <manifest-path>`, `fuzit plugin inspect
<plugin-path-or-id>`, and `fuzit plugin doctor`. Protocol/version mismatch,
undeclared capabilities, permissions, malformed frames, timeout, cancellation,
or crashes fail closed. Disable the local plugin and reproduce with the
reference fixture; do not broaden filesystem, network, shell, environment, or
persistence permissions to hide an error.

## Uninstall and local cleanup

- Stop MCP clients, watchers, editor tasks, and plugin workers they own.
- Disable local plugins and remove their client configuration manually.
- Uninstall the VSIX through the VS Code Extensions view.
- Preview `fuzit cache purge --root . --dry-run`, then purge only the reported
  Fuzit-owned index when desired.
- Remove a private CLI installation using the same local package mechanism that
  installed it. Removing a source checkout is an owner filesystem action, not a
  Fuzit command.

Uninstall never requires deleting repository source, configuration owned by
another tool, Git metadata, broad cache directories, or user documents.

## Privacy-safe issue and vulnerability reporting

Use the owner's established private channel. Include version, operating system,
architecture, command name, diagnostic code, expected behavior, and a minimal
inert reproduction. Replace the repository root with `<root>` and review every
attachment. For a suspected vulnerability, follow the
[private security process](../security/operational-security.md#report-a-vulnerability-privately)
and rotate any exposed credential before debugging.

See [known limitations](known-limitations.md) for bounded product constraints
and release-blocking evidence that must not be confused.
