# Release policies

Fuzit V1 uses the MIT License. Publication authorization and the current pause
are recorded in [release-state.json](release-state.json).

The proposed package names, binaries, topology, and still-pending scope ownership
are recorded in the [package identity decision](../decisions/PACKAGE-IDENTITY.md).

The reviewed external runtime dependency licenses and obligations are recorded in
the [dependency license audit](dependency-license-audit.md).

The privacy-preserving full repository history review is described in the
[Git history audit](git-history-audit.md).

The public tree classification and history findings are recorded in the
[public-source hygiene audit](PUBLIC-SOURCE-HYGIENE.md).

Private vulnerability intake, response, coordinated disclosure, and advisory
readiness are aligned in the [security reporting release policy](security-reporting.md).

CLI, schema, index, graph, configuration, rebuild, and rollback behavior is
documented in the [V1 migration and rebuild policy](migrations.md).

Tested operating systems, Node, security coverage, issue boundaries, supported
surfaces, deprecation, and privacy expectations are defined in the
[V1 support policy](support-policy.md).

Package, repository, docs, extension, persistent-state, revoked-artifact,
advisory, and decision-owner recovery is defined in the
[V1 rollback plan](rollback-plan.md).

- [Package topology](package-topology.md)
- [Dependency closure](dependency-closure.md)
- [Release state](release-state.json)

Publication remains forbidden until every release blocker is resolved and the owner
explicitly authorizes the exact action. Release requirements remain normative in
the [specification index](../../specs/README.md).

## Unified V1 acceptance

`pnpm acceptance:v1` runs the mandatory product, integration, platform,
security, incremental, graph, MCP, plugin, extension, packaging, documentation,
and cleanliness scenarios in a stable order. It emits a JSON summary after all
selected scenarios finish and exits nonzero if any scenario fails. A category or
scenario can be selected with `--filter`, for example
`pnpm acceptance:v1 --filter platform`; `--list` prints the selected plan without
running it. Filtering is diagnostic and does not replace the unfiltered release
gate.

`pnpm artifacts:verify` builds a canonical CLI tarball in an isolated
temporary directory, verifies its SHA-256 manifest, source commit, package and
persistent-schema identities, CycloneDX SBOM, archive custody rules, and then
runs the offline clean-install smoke suite. Missing or modified artifacts and
forbidden entries such as source maps fail the command. Temporary verification
artifacts are removed whether verification passes or fails.

`pnpm release:dry-run` creates a temporary isolated candidate, simulates the
next private version, installs only from the offline package store, builds,
packs and verifies artifacts, and builds, checks, and tests the documentation.
Its allow-listed plan rejects publish, deploy, tag, push, login, token, or
release commands; registry credentials are removed from the child environment.
The candidate and its local Git repository are deleted after the structured
report is emitted. `pnpm test:release` covers the release contracts without
performing a simulation.

`pnpm release:guarded` is the local-only publication workflow. Normal invocation
and the current release state emit a structured blocked decision and
execute zero actions. Execution additionally requires `--execute`, an explicit
owner authorization record matching the exact commit, version, and branch, a
matching one-time authorization phrase, a clean tree, and separate npm, VS Code
Marketplace, and GitHub credentials. The deterministic plan reruns acceptance,
artifact verification, and the dry-run before any publish, tag, or release
phase. No hosted workflow is created or required.

`pnpm release:guarded-dry-run` independently invokes that workflow without an
execute flag or publication credentials and audits HEAD, branch, tags, remotes,
and every working-tree path before and after. See the
[public release state](release-state.json).

Artifact verification generates and verifies a canonical release
manifest with in-toto/SLSA-compatible provenance. The manifest binds the source
commit, lockfile, local guarded workflow, package versions, dependency SBOM,
persistent schemas, artifact SHA-256 subjects, test gates, and support matrix.
`pnpm release:manifest -- <artifact-manifest> <sbom> <output>` exposes the same
deterministic generator for an existing private artifact set; missing or
mismatched provenance fails verification.
