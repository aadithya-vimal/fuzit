# Public package identity decision record

**Status:** Canonical identities and owner control confirmed for V1 release
**Recorded:** 2026-08-09  
**Registry ownership:** npm user `aadithyavimal`; owner-controlled `@fuzit` scope;
organization 2FA enforcement enabled. Unscoped `fuzit` had no public package when checked.

## Recommendation

Use unscoped **`fuzit`** for the npm CLI and the **`@fuzit` npm scope** for the MCP
server and Plugin SDK, subject to registry checks before publication.
Keep the CLI binary as **`fuzit`** and the MCP server binary as **`fuzit-mcp`**.

The intended public identities are:

| Distribution | Package identity            | Executable  | Status                                  |
| ------------ | --------------------------- | ----------- | --------------------------------------- |
| npm          | `fuzit`                     | `fuzit`     | Approved; owner controlled              |
| npm          | `@fuzit/mcp-server`         | `fuzit-mcp` | Approved; owner controlled              |
| npm          | `@fuzit/plugin-sdk`         | None        | Approved; owner controlled              |
| VSIX         | `fuzit` / publisher `fuzit` | None        | Approved; owner controlled              |

All other `@fuzit/*` workspaces remain bundled internals or private development
packages as recorded by [`package-topology.json`](../release/package-topology.json).
The current private CLI workspace identity `@fuzit/cli` transitions to the approved
public `fuzit` identity only in the guarded V1-159 metadata application.
The private workspace identity `@fuzit/vscode-extension` remains an implementation
identifier; its approved Marketplace identity is extension `fuzit`, publisher `fuzit`.

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

Before approval, the owner must verify control of `@fuzit` through the relevant
registry account. If the scope cannot be controlled, stop release preparation and
select a new scope in a superseding decision record. Do not silently fall back to
unscoped names: `fuzit` and similar names may already be reserved, and an unscoped
fallback would change installation, provenance, and dependency identities.

## Migration implications

1. Public-candidate manifests eventually need approved versions, license metadata,
   repository metadata, publish contents, and non-private status in one bounded
   release change.
2. `workspace:*` dependencies must be rewritten only by the release packaging path
   and verified against the artifact manifest; source manifests stay deterministic.
3. Consumers must import the three approved npm package identities and invoke the two
   stable binary names. Any later rename requires deprecation and migration notes.
4. Package tarballs, VSIX metadata, SBOM, checksums, provenance, documentation, and
   clean-install tests must all agree on the approved identity.
5. No metadata change may imply that the approved license has already been applied
   or that publication authorization has been granted.

## Owner decision

**Approved 2026-08-09 for preparation.** The identities and bounded topology above
are canonical. On 2026-08-09 the owner confirmed registry and Marketplace publisher
control and explicitly set `publicationAuthorized=true`. Registry availability is
still rechecked immediately before publication; a collision must not cause a silent rename.
