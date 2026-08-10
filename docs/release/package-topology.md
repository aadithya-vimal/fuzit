# Intended package topology

The owner has authorized the V1 release. The npm account `aadithyavimal`
controls the `@fuzit` scope with organization 2FA enforcement, and the owner
controls VS Code Marketplace publisher `fuzit`.

The machine-readable contract is
[`package-topology.json`](./package-topology.json). It is the deterministically
ordered source used by topology consistency tests.

## Distribution boundaries

| Surface                   | Intended distribution   | Public contract                              |
| ------------------------- | ----------------------- | -------------------------------------------- |
| `fuzit`                   | npm candidate           | `fuzit` bin and `.` export                   |
| `@fuzit/mcp-server`       | npm candidate           | `fuzit-mcp` bin and `.` export               |
| `@fuzit/plugin-sdk`       | npm candidate           | `.` export; no bin is declared               |
| `fuzit` / publisher `fuzit` | VSIX candidate, not npm | VS Code extension entry point and `.` export |

Domain, renderer, provider, host, security, persistence, and watcher packages
are implementation packages bundled into the distributable surfaces. They are
not independently public. `@fuzit/benchmark` and `@fuzit/testing` are private
development-only packages and must never enter a release artifact.

## Dependency and version policy

Private internal dependencies are root-only development links. CLI, MCP, SDK,
and VSIX runtime implementations are bundled. The SDK also contains the schema
declarations required by consumers.
External dependencies retain the exact versions already present in manifests.
No package version, publication flag, registry name, or ownership decision may
change until its dedicated release task and explicit owner authorization.

Failure to resolve npm-name or publisher ownership keeps publication blocked.
Artifact verification is separately deferred to V1-161 and remains mandatory
before final release readiness or publication authorization.

## Content and metadata policy

Each candidate manifest uses an explicit allow-list containing only compiled
JavaScript, declarations, and the CLI launcher where applicable. Source maps
and declaration maps are excluded from packages even when private development
builds emit them; release artifacts must not expose source paths or embedded
source. Repository metadata identifies the private source repository and the
candidate's workspace directory. Node packages use the root-supported
`>=24.0.0 <25.0.0` engine range, while the VSIX retains its VS Code engine.

MIT is the approved and applied V1 license. Tests,
source, caches, FZ/V1 state, implementation plans, private specifications,
credentials, and local machine paths are forbidden from distributable content.

## Private CLI artifact

`pnpm artifacts:cli` performs a clean workspace build, asks pnpm to rewrite the
CLI's workspace dependency ranges for packing, then canonicalizes the package
as a sorted tar stream with fixed ownership, modes, timestamps, and gzip
metadata. It writes the ignored private output under
`artifacts/private/v1-132/`, including a SHA-256 manifest of the tarball and
every canonical entry. The command performs no registry, tag, or release action.

`pnpm package:smoke` installs only the three public npm tarballs into a new
offline temporary project outside the monorepo. It exercises help, version,
doctor, scan, pack, context, watch-once, graph statistics, snapshots, diff, and
valid and invalid plugin-manifest validation without resolving a monorepo link.
V1-134 extends the same offline clean installation with the MCP package and
proves stdio `initialize` and `tools/list` responses from packed dependencies.
V1-135 compiles a reference plugin against the packed SDK's single public export,
rejects an internal subpath import, and audits the tarball for host or test internals.
V1-136 builds a real private VSIX, audits its content and checksum, installs it
into isolated local VS Code data and extension directories, and reruns Workspace
Trust behavior tests without contacting or publishing to the marketplace.
V1-137 adds a versioned, lexically ordered SHA-256 artifact manifest linking the
source commit, lockfile, public package versions, persistent schemas, supported
Node/platform matrix, and repository-relative artifact paths. Byte changes fail closed.
V1-138 generates a deterministic CycloneDX 1.6 SBOM with package relationships,
metadata integrity hashes, licenses, and tool identity. Unknown or disallowed
dependency licenses fail closed; publication remains independently blocked.
V1-139 performs two forced local builds with remote caching and telemetry disabled,
then rejects any unexplained package or VSIX hash/content difference. The report
records permitted differences explicitly; the current normalized set permits none.
