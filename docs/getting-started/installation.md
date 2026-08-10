# Installation and first context

> Fuzit has no authorized public release. Do not install an npm package or VSIX
> that merely uses the Fuzit name. Use only a private artifact supplied by the
> repository owner or a verified private source checkout.

## Prerequisites

- Node.js 24.x, matching `.nvmrc` and the package engine range.
- pnpm 11.9.0, matching the root `packageManager` field.
- Git, with a repository you are authorized to inspect.
- A local filesystem path. Fuzit does not require a hosted service or telemetry.

Corepack may provide pnpm where the host permits it. A machine-wide `corepack
enable` is not required when the exact pnpm version is already installed.

## Supported private installation paths

### Verified private source checkout

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm package:smoke
```

`package:smoke` builds private tarballs, installs them into an isolated offline
temporary project, and exercises the same public CLI entry point. It removes its
temporary files when complete.

### Owner-supplied private artifacts

Use the artifact bundle, checksum manifest, lockfile, and install instructions as
one unit. Verify every SHA-256 entry before installation. Do not resolve missing
private dependencies from a public registry. The private VSIX may be installed
locally only after its checksum and content manifest match.

## First local workflow

Run these commands from the repository you intend to inspect:

```sh
fuzit doctor --json
fuzit scan --root . --list-roots
fuzit pack --root . --format markdown --output fuzit-context.md
fuzit context --root . --task "explain authentication" --profile bug-fix --budget-tokens 4000 --format markdown --output task-context.md
```

`doctor` may return a documented non-zero diagnostic status when prerequisites
are incomplete. Fix the reported local condition; do not bypass path, trust,
security, or configuration checks. `scan --list-roots` confirms the canonical
repository boundary before content is packed.

## Shell notes

The Fuzit commands above are identical in POSIX shells and Windows PowerShell.
Quote task text as one argument. Paths are canonicalized internally and output is
deterministically ordered; do not translate repository-relative paths by hand.

POSIX cleanup of only the two generated examples:

```sh
rm -- fuzit-context.md task-context.md
```

Windows PowerShell cleanup of only the two generated examples:

```powershell
Remove-Item -LiteralPath fuzit-context.md, task-context.md
```

Do not recursively delete repository state or caches as a generic recovery step.
Use [troubleshooting](../troubleshooting/README.md) and the relevant command's
documented cleanup behavior.
