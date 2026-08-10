# Normalized analysis contracts

Fuzit represents static-analysis output with schema version `1`. Records cover
canonical repository-relative files, modules and packages, symbols, and typed
relationships for imports, exports, references, calls, inheritance, tests,
endpoints, schemas, and configuration links.

Every record is scoped to one repository identity. Relationships retain their
source file and optional source symbol, source range, evidence basis, parser and
analysis identities, confidence, and resolution state. Supported evidence bases
are `observed`, `parsed`, `inferred`, and `configured`; unsupported labels and
cross-repository records are rejected.

Completeness is explicit: `complete`, `partial`, `unsupported`, `failed`,
`stale`, or `verified`. Partial records carry bounded diagnostics and never
claim missing relationships as resolved. Paths must be normalized,
repository-relative, and traversal-free.

The canonical serializer sorts every identity-bearing collection by stable ID.
The strict schema rejects unknown fields, including raw parser ASTs, so persisted
or transported records remain bounded and parser-independent.
