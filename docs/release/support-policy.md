# V1 support policy

## Runtime and operating systems

Fuzit V1 requires Node.js `>=24.0.0 <25.0.0` and pnpm `11.9.0` for workspace
development. The packaged CLI and MCP server support Node 24 only.

Native Windows 11 24H2 x64 is the only operating system with completed native
V1 evidence. `linux-x64` and `darwin-arm64` in the release manifest are target
compatibility coordinates, not support claims. Ubuntu under WSL2 supplies
compatibility evidence but not genuine native-Ubuntu support. Native Ubuntu and
macOS remain unsupported for release claims until their independent matrices
are recorded; no container, emulation, or hosted workflow substitutes for them.

## Supported versions and security

Before public V1 publication, only the exact current private V1 candidate commit
is eligible for coordinated security review. Older commits and prerelease
artifacts, locally modified packages, and unverified builds are unsupported.
Security fixes are prepared against the current candidate and require regression,
privacy, artifact, provenance, and release-gate evidence. Reporting follows
`SECURITY.md`; vulnerabilities never belong in public issues.

## Issue boundary

Support covers reproducible defects in verified Fuzit artifacts on a supported
runtime, with a synthetic reproduction and no credentials, private source,
personal data, absolute machine paths, indexes, logs, or generated context.
Repository-specific ranking preferences, third-party editor behavior, LLM output,
unsupported platforms/runtimes, modified packages, and unapproved plugins are
outside the support boundary. This policy promises no response SLA or warranty.

## CLI, MCP, plugin, and extension surfaces

- The CLI contract covers documented commands and four render formats in a
  verified package.
- The MCP contract covers the packaged stdio server and its declared protocol;
  client-specific integrations are best-effort unless separately tested.
- Plugin support covers the published SDK contract and deny-by-default host.
  Plugin code, undeclared permissions, and third-party behavior are not supported.
- VS Code support covers the verified private VSIX on supported VS Code engines,
  Workspace Trust, and documented commands. Other editors and marketplace
  delivery are outside scope until independently authorized and verified.

## Deprecation and compatibility

An intended public contract is deprecated in documentation and diagnostics
before removal, with replacement and migration guidance. It remains available
for at least one subsequent supported release when safety and security allow.
Immediate removal is reserved for exploitable behavior, legal requirements, or
impossible-to-preserve data integrity and must be called out in release notes.
Persistent schema changes follow the migration and rebuild policy; unsupported
readers fail closed rather than silently convert data.

## Data and privacy expectations

Core repository processing is local, has zero telemetry, and applies containment,
ignore, secret-redaction, and deterministic-output controls. Local indexes and
snapshots remain user-controlled derived data. Explicit remote providers may
contact only their configured service under their documented network policy;
Fuzit does not promise third-party privacy. Users remain responsible for reviewing
output before sharing it and for deleting derived state according to local policy.
