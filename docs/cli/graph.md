# Graph

Fuzit's local graph uses versioned, deterministic node contracts for repositories, packages, files, symbols, tests, endpoints, schemas/models, configuration, documentation, snapshots, and changes.

Node identity is scoped to one repository and derived from the canonical node kind and NFC-normalized identity input. Every node retains collector, revision, evidence basis, and optional source-location provenance. Unknown schema versions and invalid parent relationships are rejected.

Graph construction, edges, queries, and CLI commands are introduced by later checkpoints.

Edges are directional and versioned. Each edge records direct, parsed, or heuristic evidence plus revision validity. Unresolved and conflicting evidence remains explicit; unsupported node-kind directions fail validation.

The initial builder deterministically maps repository, nested package, and file containment plus manifest dependencies from normalized analysis. Conflicting package names and unresolved dependencies produce partial diagnostics rather than invented targets.

Supported symbols become file-owned graph nodes with parser identity, parser version, evidence basis, and source ranges. Overloads and duplicate names remain distinct through range-qualified identity; raw source content is never stored.

Resolved imports/exports and manifest dependencies become evidence-backed edges. Cycles remain explicit, optional dependencies retain their basis, and aliases or deleted targets remain unresolved with an actionable reason.

Tests, endpoints, schemas/models, and configuration create typed relations only from normalized parser or configuration evidence. Lookalike filenames do not create framework relations.

Git change nodes can provide `modifies`, `introduced-by`, and `changed-with` evidence, including rename provenance. Missing or shallow history is reported as partial and never converted into unsupported lifecycle certainty.

Incremental graph changes are immutable transactions. Replacements and deletions tombstone invalidated identities and incident edges; interruption before commit preserves the previous snapshot.

Graph stats, neighbors, impact, and filtered queries are deterministic and policy-filtered. Depth is capped at 10 and results at 1,000 items; cross-repository, unbounded, and cancelled queries fail explicitly.

## CLI

`fuzit graph stats`, `neighbors`, `impact`, and `query` read a repository-confined graph snapshot through `--input <path>`. Global `--json` emits machine-readable results; human output is stable text. `--depth` and `--limit` remain subject to the hard service caps. Partial snapshots return usable data with bounded diagnostics, while invalid paths, schemas, or bounds use the CLI validation exit code.
