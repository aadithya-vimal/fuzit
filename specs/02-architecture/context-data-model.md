# Context Data Model

## Purpose

Defines normalized entities, identifiers, provenance, confidence, lifecycle, sensitivity, transformations, and bundle schemas.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Create a versioned provider-neutral model.
- Allow file-level v1 records and later symbol/runtime records without incompatible redesign.
- Support deterministic serialization and migrations.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Stable IDs are derived from source namespace, source identity, item type, and canonical locator.
- Content and metadata hashes are separate.
- Direct, parsed, derived, heuristic, inferred, and unknown epistemic classes are explicit.
- Relationships are first-class records.

## Component Interactions

- Parsers create symbol items.
- Providers create issue/PR items.
- Graph stores typed edges.
- Bundles embed or reference selected item content.

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

- File rename changes locator but may preserve lineage.
- Case-insensitive filesystems.
- Same external issue mirrored by providers.
- Content unavailable because policy stores metadata only.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Opaque JSON blobs with no schema evolution.
- Path as globally unique identity.
- Confidence represented only as 0–1.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Database-specific physical schema.
- Universal AST schema.

## Acceptance Indicators

- JSON Schema/Zod validation exists for public records.
- Canonical serialization golden tests pass.
- Unknown fields can be handled according to version policy.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Additional Design Notes

Every Context Item should include ID, type, source, origin locator, revision/observation identity, content or content reference, lifecycle, epistemic class, confidence basis, provenance, relationships, sensitivity, transformations, and adapter/schema versions.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
