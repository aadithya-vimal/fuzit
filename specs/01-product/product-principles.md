# Product Principles

## Purpose

Turns the product philosophy into decision rules that resolve implementation trade-offs.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Make context over volume, determinism, local-first operation, privacy, provenance, explainability, incrementality, neutrality, stable interfaces, uncertainty, graceful degradation, and cross-platform support enforceable.
- Provide review questions for each principle.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- A principle must affect tests, contracts, defaults, or release gates.
- Security and privacy override convenience.
- Stable interfaces may evolve only through versioning and migration.
- Heuristics must expose their basis.

## Component Interactions

- Architecture decision records cite relevant principles.
- Definition of done verifies principles.
- CLI diagnostics surface principle-driven behavior such as redaction and partial sources.

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

- Two principles conflict, such as deterministic output and fresh runtime evidence.
- Provider timestamps are unstable.
- A model inference is useful but unverifiable.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Principles becoming slogans with no enforcement.
- Excessive abstraction justified by hypothetical neutrality.
- Determinism claims that ignore volatile inputs.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Rigid immutability of all internal implementation.
- Prohibition of optional remote integrations.

## Acceptance Indicators

- Every principle has at least one automated or review control.
- Volatile fields are isolated in bundle schemas.
- Exceptions require an explicit unsafe or experimental marker.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
