# Product Vision

## Purpose

Defines the enduring product thesis: software context is an engineered, versioned product rather than an undifferentiated text dump.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Align product, engineering, security, and release decisions around useful context rather than maximum volume.
- Define a credible path from a private local CLI to a provider-neutral context standard.
- Protect trust through deterministic, local-first, explainable behavior.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Optimize the minimum sufficient evidence for a task.
- Treat repository packing as the first capability, not the final identity.
- Keep cloud services optional and attributable.
- Make provenance, uncertainty, and lifecycle visible in every advanced feature.

## Component Interactions

- Product profiles express user intent to selection and budgeting.
- Core domain contracts support CLI, MCP, IDE, CI, and future hosted consumers.
- Security policy constrains every source and output.

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

- Repositories with no Git metadata.
- Polyglot monorepos with conflicting manifests.
- Air-gapped environments.
- Users who request a complete raw export despite recommended selection.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Trying to deliver graph, runtime, collaboration, and hosted services before a trusted scanner.
- Positioning so broadly that v1 cannot be evaluated.
- Confusing AI-generated summaries with source facts.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Autonomous code modification.
- IDE replacement.
- Mandatory embeddings or remote models.
- Production action execution.

## Acceptance Indicators

- A one-sentence product definition remains stable across documents.
- Every roadmap item maps to the vision without expanding v1.
- User studies confirm explainability and privacy are understood.

## Future Extensions

- Standardized `.fuzit` bundles for tool interchange.
- Cross-repository and organization policy layers.
- Self-hosted team indexes.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
