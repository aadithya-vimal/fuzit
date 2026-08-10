# Cache commands

`fuzit cache status --root <path>` reports the version, hashed repository
identity, local path, and current state. `rebuild --dry-run` explains which
semantic version or input requires rebuilding. `purge --dry-run` reports the
exact Fuzit-owned directory and never deletes it.

`init` persists repository ownership plus semantic content/configuration state,
so `status` in a later process reports `ready`. Status distinguishes absent,
ready, locked, schema mismatch, repository mismatch, and corrupt state.
`rebuild --dry-run` compares persisted values with a fresh secure scan and makes
no mutation. A real rebuild refreshes those values; a real purge removes only
the exact repository-owned index.

Incompatible content, configuration, scanner/parser, security-policy, or schema
versions require a rebuild. Corruption also requires rebuilding. Fuzit never
automatically purges state and never deletes outside the exact owned index
directory.
# Schema validation

Fuzit validates local incremental index records against versioned strict
schemas before use. Invalid, corrupt, unknown, or future-version data is never
accepted as a current index. Later index tasks provide explicit verification,
recovery, migration, and rebuild behavior; defining a schema does not silently
rewrite stored data.

The index file-record view contains normalized paths and safe facts only. It
does not contain raw text or binary content. Ignored, sensitive, oversized, and
read-failure outcomes retain bounded reasons and completeness so cache
inspection can explain why no content was acquired.

`cache status` also reports the persisted semantic identity set, or `null` when
the index has none. The values are domain-separated hashes: they reveal no
configuration values, ignore patterns, repository paths, or source content.
`cache rebuild --dry-run` names the changed identity and reports the dependent
file, analysis, or graph record classes that require refresh.

Index updates use a validated staged transaction and a single atomic commit.
Concurrent cache readers continue to see the previous complete state until the
commit point. Interrupted staging is rolled back; an interruption after commit
leaves the complete new state available and no transaction lock or staging
file behind.

Cache state distinguishes active records from tombstone evidence. A deletion
or rename is therefore absent from active queries but remains attributable by
prior hash, verified basis, invalidation identity, and dependent cleanup scope.
No deleted source content is retained.

Dependency invalidation is path-specific and explainable. Changes to exports,
imports, project configuration, test relationships, graph edges, or parser
output select only the changed path and persisted dependents. A bounded
fan-out reports partial uncertainty and requires canonical reconciliation
instead of silently accepting an incomplete incremental result.
