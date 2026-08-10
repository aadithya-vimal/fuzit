# Public package dependency closure

The 24 private workspaces were classified before architecture changes. Twenty-one
runtime implementation packages are bundled into their consuming CLI, MCP, or
VSIX JavaScript. The benchmark and testing workspaces remain development-only.
The schemas workspace is bundled into the public plugin SDK, including the
declaration contracts required by TypeScript consumers.

The exact classification and resulting topology are recorded in
[dependency-closure.json](dependency-closure.json). Packed CLI and MCP manifests
have no private dependencies. The CLI depends on public Commander and TypeScript,
and the packed SDK depends only on public zod. The VSIX contains bundled implementation code and
retains only the VS Code host API as an external.

The package smoke command packs only the three public npm packages, installs their
tarballs offline in a temporary directory outside the monorepo without overrides
or workspace configuration, and runs CLI, MCP, and SDK consumer smokes.
Private workspace links exist only as development dependencies to encode clean
source-build ordering; pnpm rewrites those links in packed development metadata,
and none appears in runtime dependency fields.
