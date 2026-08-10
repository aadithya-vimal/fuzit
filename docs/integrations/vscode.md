# VS Code Extension Integration

Fuzit provides a local, private VS Code extension (`@fuzit/vscode-extension`) for interacting with the canonical repository context engine.

## Security & Privacy Properties

- **Zero Telemetry**: No telemetry, analytics, network logging, or remote calls are made.
- **Workspace Trust**: Extension functionality respects VS Code Workspace Trust.
- **Lazy Activation**: The extension performs no automatic process spawning or repository scanning on activation alone.

## Install an authorized artifact

The extension is not published. Install only a private VSIX supplied through an
owner-approved channel after verifying its recorded SHA-256 digest:

```text
code --install-extension /absolute/path/to/fuzit.vsix
```

When a public artifact is separately authorized, the same command may install
its verified local download. Do not infer authorization from this documentation,
use a private-only URL in configuration, or install an unverified similarly
named extension. Updating uses a newly verified VSIX; uninstall through VS Code
when it is no longer required.

## Multi-Root Workspace Support

- **Explicit Root Picker**: Selects workspace root using `resolveWorkspaceRoot` and `formatWorkspaceRootPicks`. Disambiguates roots with identical folder names by displaying unique normalized path information.
- **Per-Root State Isolation**: `PerRootStateManager` enforces isolated outputs, task states, and cache buckets per root path, preventing cross-root output or cache confusion.
- **Progress & Cancellation**: `CancellableTaskRunner` manages cancellable tasks per root. Aborting a running task stops owned work cleanly without corrupting per-root state.

## Activation Events

Activation is explicitly bound to user commands:

- `onCommand:fuzit.status`
- `onCommand:fuzit.getContext`
- `onCommand:fuzit.init`
- `onCommand:fuzit.doctor`
- `onCommand:fuzit.scan`

The command palette labels are `Fuzit: Check Status`, `Fuzit: Get Task Context`,
`Fuzit: Initialize Workspace`, `Fuzit: Run Doctor`, and `Fuzit: Scan Repository`.

Activation registers local command adapters only. It does not scan, spawn a
process, contact a network service, or start a watcher. Deactivation cancels
owned tasks and disposes per-root resources; repeated deactivation is safe.

## Workspace Trust and roots

All commands refuse work in an untrusted workspace or when no root is selected.
Grant trust only after reviewing the repository. Revoking trust blocks later
commands; it never turns a prior result into authority for new work.

Multi-root workspaces use an explicit root picker. Roots with the same folder
name include normalized path detail, and output, task state, cancellation, and
cache buckets remain isolated per canonical root. Preview output replaces the
selected absolute root with `<root>` and remains subject to the shared security
filter and bounded diagnostics.

## Building

```bash
pnpm --filter @fuzit/vscode-extension build
```

Building from source is a development workflow, not publication authorization.
