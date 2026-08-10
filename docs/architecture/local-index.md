# Local index contract

Fuzit's local index is a private, rebuildable acceleration structure. Source
files, Git data, and configuration remain authoritative.

## Location and identity

`fuzit cache path` reports
`<cache-home>/fuzit/indexes/v1/<repository-id>`. The repository ID is a SHA-256
digest of a stable canonical Git fingerprint, not a source path. A moved
repository therefore retains its identity, while distinct repositories have
distinct directories. For a repository without stable Git identity, the caller
may use its canonical repository-relative discovery identity as the fallback.

The cache home follows the operating system's per-user cache convention. Path
calculation is read-only: an absent or read-only cache home does not cause a
source-tree write.

## Ownership and compatibility

Each directory belongs to exactly one repository ID and schema version. Local
index schema version `1` is the only supported representation. A different
stored version is reported as `schema-mismatch`; it is never interpreted as the
current schema.

The index is disposable. Schema, scanner, parser, configuration, or security
policy incompatibility requires discarding and rebuilding it from authoritative
local inputs. Storage migrations are not implied by this contract.

## Locking and failures

Storage implementations must provide one exclusive writer and allow readers
only a coherent committed view. Lock ownership must be inspectable. A failed or
interrupted writer must not damage source files or expose a partial index.
Stale-lock recovery and atomic storage are implemented by later runbook tasks.

## Privacy

Cache paths contain only the schema version and hashed repository identity.
They do not contain repository names, source paths, credentials, file content,
or remote URLs. Persisted records must pass the same path and credential
controls as exported context. The index is local-only and creates no network
authority.

`fuzit cache status --json` is specified to return the versioned status
contract: `schemaVersion`, `repositoryId`, `path`, `state`,
`rebuildRequired`, and `lockOwner`. FZ-070 exposes the contract APIs and tests
without creating durable state; CLI wiring and storage are later tasks.
# Incremental record contracts

The local index uses incremental schema version 1 for repository metadata,
canonical file records, normalized analysis and graph records, tombstones,
transactions, writer-lock state, diagnostics, and verification results. These
strict serialized contracts live in `@fuzit/schemas`; index orchestration and
filesystem access remain in `@fuzit/index`.

Every record has a `recordType` discriminator and `schemaVersion`. Unknown
record types, future versions, absolute file paths, extra fields, and oversized
metadata are rejected. Canonical file content hashes are authoritative; size
and modification time are optional optimization hints. The schemas contain no
raw source-content field.

Canonical file records are persisted as LF-delimited schema records sorted by
UTF-8 repository-relative path. A record retains content hash, size and mtime
hints, classification, security decision, and completeness. Binary, truncated,
ignored, sensitive, and unreadable paths therefore remain explainable without
persisting source bytes. Replacement is written to a same-directory temporary
file and renamed; duplicate, unsafe, corrupt, or content-bearing records are
rejected. A fresh process can reconstruct the same canonical ordering.

At this stage, replacing the set removes absent paths. Durable deletion history
is introduced by the ordered tombstone checkpoint rather than being implied by
the file-record store.

## Semantic identities

Incremental state records separate SHA-256 identities for effective
configuration, ignore policy, security policy, parser set, analysis component,
graph schema, and incremental schema. Identity inputs are canonicalized before
hashing, so object key order cannot cause invalidation. Status output exposes
only these opaque identities.

Each mismatch has a deterministic reason and bounded dependent record classes:
parser and analysis changes invalidate analysis plus graph records; graph-only
changes invalidate graph records; configuration, ignore, security, and schema
changes invalidate file, analysis, and graph records. An older state without
the additive identity set is treated as requiring a bounded full rebuild.

## Atomic transactions

An index transaction validates its canonical records, semantic state, and
versioned transaction metadata before publishing. The complete state is staged
inside the exact index directory and one filesystem rename updates the
committed view. Readers open only `committed-state.json`; they never read
transaction staging files.

Failures before the rename preserve the previous committed state. A failure
reported after rename exposes the complete new state, never a mixture.
Transaction staging files are removed on success or rollback. The committed
envelope retains transaction identity, repository identity, timestamps, sorted
changes, canonical records, and semantic identities without source content.

## Tombstones

Verified removals publish tombstones in the same atomic envelope as the new
active record set. Each tombstone retains a stable SHA-256 identity, canonical
path, prior content hash, deletion basis, invalidation identity and time,
reason, optional rename target, and the file/analysis/graph cleanup scope.
Deleted paths disappear from active records immediately while historical
evidence remains available for deltas and invalidation.

Rename and case-only rename retain an old-path tombstone alongside the active
target. Recreating a path does not erase its prior tombstone or change that
tombstone's stable identity. Unsafe removal paths fail validation before the
atomic commit.

## Dependency invalidation

Record-level invalidation consumes persisted canonical repository-relative
relationships for imports, project configuration, tests, and graph edges.
Export, import, configuration, test-dependency, graph-edge, and parser-output
changes retain an opaque change identity and a deterministic reason for every
affected path. Traversal is cycle-safe and ordered by UTF-8 path.

Fan-out is explicitly bounded. Reaching the configured record limit produces a
partial result and requires canonical reconciliation; it never treats an
incomplete traversal as authoritative. Unrelated records are not rewritten,
and a full secure scan remains the correctness oracle.
