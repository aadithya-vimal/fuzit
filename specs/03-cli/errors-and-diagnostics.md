# Errors And Diagnostics

## Purpose

Defines structured diagnostics, human messages, exit-code philosophy, debug safety, warnings, and partial-result reporting.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Let users distinguish invalid input, policy denial, unavailable capability, source failure, partial success, internal defect, and cancellation.
- Support machine-readable diagnostics.
- Prevent debug logs from exposing secrets.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Diagnostics have stable code, severity, source, message, remediation, and optional cause chain.
- Exit codes classify outcomes rather than individual errors.
- Warnings do not disappear in quiet machine mode; they are embedded in output metadata.
- Debug mode redacts by default.

## Component Interactions

- All pipeline stages emit diagnostic records.
- CLI formats diagnostics.
- Bundle manifest includes relevant warnings and failed sources.
- `doctor` aggregates environment diagnostics.

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

- Many repeated parser errors.
- Partial provider page fetched.
- Broken pipe.
- Renderer succeeds but manifest write fails.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- One giant non-zero code.
- Printing stack traces as normal UX.
- Sensitive source excerpts in error messages.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Remote crash reporting by default.
- Localized message catalog in v1.

## Acceptance Indicators

- Failure classes are tested.
- Machine diagnostics validate against schema.
- No credential corpus value appears in logs.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
