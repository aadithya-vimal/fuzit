# Incremental index, watcher, and graph

Fuzit's incremental pipeline is an optimization around one correctness oracle:
a complete, security-filtered scan of canonical repository state. Incremental
updates must produce the same active file, normalized analysis, and graph state
as that full calculation for the same inputs and semantic identities.

## Canonical/full equivalence

A canonical calculation normalizes repository-relative paths, applies current
configuration and security policy, fingerprints content, and orders records by
UTF-8 path. An incremental transaction may reuse unchanged records, but its
committed result must equal a clean calculation. File timestamps and watcher
event order are hints, never identity.

The index persists safe facts, opaque hashes, normalized analysis, graph
records, and tombstones. It does not persist raw source or ASTs. One atomic
rename publishes a complete transaction, so readers see either the previous or
the next committed state and never a mixture.

## Cache states and rebuilds

Use these read-only checks before changing cache state:

```text
fuzit --json cache status --root <path>
fuzit --json cache verify --root <path>
fuzit --json cache rebuild --root <path> --dry-run
```

An absent index is normal. `ready` means its repository, schema, configuration,
ignore, security, parser, analysis, and graph identities are compatible.
`locked`, `corrupt`, `repository-mismatch`, and `schema-mismatch` are explicit
states. Verification failures set `rebuildRequired`; they never silently accept
or migrate incompatible records.

Schema version 1 has no automatic storage migration. Rebuild from authoritative
local inputs after a schema mismatch, obsolete representation, corruption, or
semantic identity change. Preview with `--dry-run`; purge only the exact
Fuzit-owned index after verifying the reported repository identity.

```json
{"schemaVersion":1,"state":"schema-mismatch","rebuildRequired":true,"reason":"stored schema is not supported"}
```

The diagnostic reason is bounded and contains no repository content or path.

## Watch semantics

`fuzit watch` coalesces filesystem notifications into bounded update batches.
Creates, modifications, removals, and renames update one atomic index
transaction. `--debounce-ms` controls batching; `--once` processes one batch;
`--status` reports state; `--reconcile` explicitly requests a canonical scan.

Watch notifications are advisory. Queue overflow, missing rename pairs,
uncertain metadata, bounded dependency fan-out, startup races, or platform
differences set `reconciliationRequired`. Reconciliation compares the current
secure scan with committed fingerprints, publishes the deterministic delta,
and is idempotent when nothing changed.

Fuzit does **not** promise real-time delivery, zero-latency indexing, or that
every intermediate filesystem state is observable. A completed reconciliation
does promise canonical/full equivalence for the observed repository state.

## Graph evidence and bounds

Graph nodes and edges retain repository identity, schema version, collector,
revision validity, and an evidence basis (`direct`, `parsed`, or `heuristic`).
Missing or conflicting evidence produces a partial result and diagnostic; it
does not create an unsupported relationship. Graph completeness is therefore
never presented as perfect knowledge of a repository.

Queries are repository-confined, deterministic, and security-filtered. Depth
is capped at 10 and results at 1,000 items. Incremental graph transactions
tombstone invalidated nodes and incident edges, and cancellation cannot publish
a partially updated graph.

## Troubleshooting

1. Run `fuzit --json cache status --root <path>` and retain the state and opaque
   identities, not source content.
2. Run `fuzit --json cache verify --root <path>`.
3. If uncertainty is reported, run `fuzit watch --root <path> --reconcile --once
   --json` or stop the watcher and preview `cache rebuild --dry-run`.
4. Rebuild only when verification says it is required. Purge only after checking
   the exact Fuzit-owned cache path.
5. Treat `partial` graph or invalidation output as usable bounded evidence with
   explicit gaps; use a full reconciliation before relying on completeness.

Never edit index files, remove a broad cache parent, disable hard exclusions,
or execute repository code to repair analysis. If a clean rebuild is not
equivalent, preserve the diagnostics and report a defect.

See [cache commands](../cli/cache.md), [graph queries](../cli/graph.md), and
[snapshot deltas](../cli/snapshots.md) for command-level details.
