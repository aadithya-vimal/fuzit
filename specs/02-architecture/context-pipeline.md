# Context Pipeline

## Purpose

Specifies the ordered transformation from source discovery to an explainable context bundle.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Define stage contracts and custody of provenance.
- Clarify which stages may remove, summarize, or infer content.
- Support cancellation, streaming, and partial results.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Order: source, discovery, acquisition, normalization, analysis, graph enrichment, security filtering, selection, budgeting, rendering, bundle.
- Raw acquisition cannot bypass normalization.
- Security filtering precedes remote reranking and rendering.
- Budgeting operates on scored candidates with required anchors.

## Component Interactions

- Each stage emits items, diagnostics, and metrics.
- Snapshot captures stage/version identities.
- Explainability aggregates stage decisions.

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

- A source changes during scan.
- Analysis result references deleted content.
- Security policy changes after index creation.
- Cancellation occurs during rendering.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Mutating source evidence in place.
- Losing original hash after redaction.
- Applying token budget before mandatory safety metadata.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Agent prompting.
- Code execution as analysis.

## Acceptance Indicators

- End-to-end fixture traces every output item to source.
- A failed stage marks only dependent results incomplete.
- Policy changes force safe re-evaluation.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
