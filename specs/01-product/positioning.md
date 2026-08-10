# Positioning

## Purpose

Defines Fuzit’s category, differentiation, vocabulary, and boundaries relative to repository packers, code search, RAG systems, IDE assistants, and observability tools.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Enable consistent public messaging without overstating current capability.
- Clarify why Fuzit is useful even when a model supports a large context window.
- Identify integration partners rather than framing every adjacent tool as a competitor.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Primary category: AI Context Engineering Platform for Software Projects.
- Core promise: smaller, safer, more relevant, reproducible, explainable context.
- Local-first trust is a product feature, not only a deployment choice.

## Component Interactions

- Repository packers may be import/export peers.
- Code hosts and issue trackers are providers.
- AI agents, IDEs, and CI are consumers.
- Observability systems are optional context sources.

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

- A competitor adds semantic search but no runtime evidence.
- An IDE offers proprietary context inaccessible to other tools.
- A hosted service claims local mode but uploads telemetry.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Feature-comparison checklists that obscure architectural differentiation.
- Claims of universal understanding before benchmark evidence.
- Lock-in to a single model ecosystem.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- General-purpose vector database.
- Prompt marketplace.
- Standalone chatbot.

## Acceptance Indicators

- Website, README, CLI help, and release notes use consistent category language.
- Competitive claims are evidence-backed and date-stamped.
- Non-goals are visible in onboarding.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
