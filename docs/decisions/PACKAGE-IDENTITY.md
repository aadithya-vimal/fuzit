# Public package identity decision record

**Status:** Canonical identities and owner control confirmed for V1 release
**Recorded:** 2026-08-09  
**Registry ownership:** npm user `aadithyavimal`; owner-controlled `@fuzit` scope;
organization 2FA enforcement enabled. Unscoped `fuzit` had no public package when checked.

## Recommendation

Use **`@fuzit/cli`** for the npm CLI and the **`@fuzit` npm scope** for the MCP
server and Plugin SDK. Keep the CLI binary as **`fuzit`** and the MCP server binary
as **`fuzit-mcp`**.

The published public identities are:

| Distribution | Package identity            | Executable  | Status                      |
| ------------ | --------------------------- | ----------- | --------------------------- |
| npm          | `@fuzit/cli`                | `fuzit`, `repomix` | Published; owner controlled |
| npm          | `@fuzit/mcp-server`         | `fuzit-mcp` | Published; owner controlled |
| npm          | `@fuzit/plugin-sdk`         | None        | Published; owner controlled |
| VSIX         | `fuzit` / publisher `fuzit` | None        | Published; owner controlled |

All other `@fuzit/*` workspaces remain bundled internals or private development
packages as recorded by [`package-topology.json`](../release/package-topology.json).
The npm CLI is published as `@fuzit/cli` while retaining the executable name `fuzit`.
The VS Code extension is published under Marketplace identity `fuzit.fuzit`
(extension `fuzit`, publisher `fuzit`).

## Audit findings

- Workspace package names are unique; no internal package-name or executable-name
  collision exists.
- Only approved public-candidate manifests are publishable. The root remains
  private, so accidental monorepo publication remains blocked.
- The CLI and MCP binaries have distinct names and retain their existing commands;
  adopting the recommendation requires no user-facing command rename.
- Registry ownership and Marketplace publisher control were confirmed by the owner.
- The current topology has four public candidates, bundled internal packages, and
  two private development-only packages. Publishing internal workspaces separately
  is not part of this recommendation.

## Collision and fallback policy

Registry and Marketplace ownership were verified before publication. Future package
identity changes must not silently fall back to unscoped or alternate names, because
that would change installation, provenance, and dependency identities.

## Published identity implications

1. The published npm identities are `@fuzit/cli`, `@fuzit/mcp-server`, and
   `@fuzit/plugin-sdk`.
2. The CLI executable remains `fuzit`; the MCP server executable remains `fuzit-mcp`.
3. The VS Code Marketplace identity is `fuzit.fuzit`.
4. Package tarballs, VSIX metadata, SBOMs, checksums, documentation, and clean-install
   validation must continue to agree with these identities.
5. Any future package rename requires an explicit migration and deprecation plan.

## Owner decision

**Approved 2026-08-09 for preparation.** The identities and bounded topology above
are canonical. On 2026-08-09 the owner confirmed registry and Marketplace publisher
control and explicitly set `publicationAuthorized=true`. Registry availability is
still rechecked immediately before publication; a collision must not cause a silent rename.

The originally planned unscoped npm identity `fuzit` could not be published because
npm rejected the name as too similar to existing packages. The owner therefore
published the CLI as `@fuzit/cli`; the executable remains `fuzit`.
