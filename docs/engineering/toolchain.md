# Supported Toolchain

Fuzit uses the Node.js 24 LTS release line and pnpm 11.9.0 through Corepack.
The root `package.json`, `.nvmrc`, and `packageManager` field are the
machine-readable authority for these versions.

## Package Management

pnpm is the only supported package manager. npm, Yarn, and direct dependency
installation outside pnpm are unsupported. Enable Corepack before invoking
pnpm:

```text
corepack enable
pnpm install
```

The repository uses pnpm workspaces. FZ-001 intentionally defines an empty
workspace because product packages have not been created.

## Cross-Platform Policy

Repository scripts must run consistently on Windows, Linux, and macOS. Scripts
must use cross-platform Node.js programs or cross-platform package binaries;
they must not depend on Bash, PowerShell, cmd.exe, or platform-specific command
syntax.

Git normalizes text files to LF. Editors use UTF-8, two-space indentation, and
final newlines. Markdown may retain trailing spaces where they represent
intentional hard line breaks.
