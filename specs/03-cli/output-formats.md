# Output Formats

## Purpose

Defines deterministic Markdown, JSON, XML, plain-text, and future `.fuzit` serialization behavior.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Preserve equivalent core meaning across formats.
- Provide human readability in Markdown and strict machine schemas in JSON/XML.
- Record truncation, redaction, failures, and provenance.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Canonical item ordering is format-independent.
- JSON is the reference normalized representation.
- XML uses explicit schema/version attributes.
- Plain text is a lossy portable fallback and must say so.
- `.fuzit` is a checksummed archive, not merely renamed ZIP.

## Component Interactions

- Renderer consumes immutable bundle model.
- Token estimator may vary by target tokenizer but byte count is exact.
- Manifest hashes emitted artifacts.

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

- Invalid Unicode.
- Very long lines.
- Content contains Markdown fences or XML terminators.
- Output interrupted.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Renderer-specific selection behavior.
- Nondeterministic map ordering.
- Silent loss of metadata.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Binary media embedding in v1.
- Proprietary encrypted bundle as default.

## Acceptance Indicators

- Golden outputs are byte-stable inside the determinism envelope.
- All formats validate against schemas or parsers.
- Escaping tests cover adversarial content.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
