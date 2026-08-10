# Storage And Indexing

## Purpose

Defines local persistence, cache ownership, schema migration, atomicity, locking, recovery, retention, and rebuild behavior.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Provide fast recurring scans without making the index authoritative.
- Support crash-safe atomic updates.
- Protect local sensitive metadata.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Use embedded SQLite with WAL as the initial index unless implementation evidence disproves it.
- Store content by hash or reference; avoid unnecessary duplication.
- Schema version and Fuzit version are recorded.
- The user can inspect, clear, relocate, or rebuild the index.

## Component Interactions

- Scanner writes staged records.
- Graph and analysis cache depend on content/config/parser hashes.
- Snapshots reference immutable fingerprints.
- Doctor validates schema and permissions.

Every interaction must carry enough identity to support invalidation and explanation: source, revision or observation time, collector/parser version, transformation history, confidence basis, and sensitivity classification where applicable.

## Recommended Implementation Shape

1. Represent the capability through a small domain contract in `packages/core` or `packages/schemas`.
2. Keep acquisition and platform-specific behavior in adapters such as providers, parsers, collectors, or renderers.
3. Normalize records before ranking, graph enrichment, budgeting, or persistence.
4. Make ordering deterministic by using stable identifiers and explicit secondary sort keys.
5. Emit diagnostics as structured records as well as human-readable CLI messages.
6. Preserve a machine-readable explanation of inclusion, exclusion, truncation, and redaction.
7. Version persistent representations and provide a migration or rebuild path.

## Examples

- A user invokes the relevant Fuzit workflow and receives an explainable result governed by policy rather than hidden defaults.
- A partial source failure is reported in the bundle manifest without discarding unrelated usable context.

## Edge Cases

- Network filesystem lacks reliable locking.
- Disk fills during transaction.
- Index is copied across operating systems.
- Concurrent processes request write access.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Storing unredacted secrets indefinitely.
- Silent destructive migration.
- Cache correctness depending only on mtime.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Hosted distributed database.
- Index as source control.

## Acceptance Indicators

- Interrupted writes recover to last committed state.
- Migration and rebuild paths are tested.
- Cache invalidation responds to parser/config changes.
- Sensitive local files use restrictive permissions where supported.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
