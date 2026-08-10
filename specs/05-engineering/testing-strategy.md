# Testing Strategy

## Purpose

Defines unit, integration, CLI, fixture, golden, deterministic, cross-platform, large-repository, property, security, contract, migration, and performance testing.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Build confidence in safe deterministic output.
- Create reusable contract suites for providers, parsers, collectors, renderers, and plugins.
- Test malicious repositories as first-class inputs.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Golden tests normalize only explicitly volatile fields.
- Incremental results are compared with clean rescans.
- Security corpus includes realistic synthetic secret patterns.
- Cross-platform evidence comes from identical local gates on Windows, Linux, and macOS.
- Performance tests assert bounds, not fragile exact timings.

## Component Interactions

- Fixture repositories exercise pipeline.
- Contract tests run against every adapter.
- CLI tests verify stdout/stderr/exit codes.
- Migration tests open old indexes.

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

- Filesystem timestamp resolution differs.
- Git version changes output.
- Flaky provider sandbox.
- Huge synthetic repositories strain developer machines, so performance gates remain explicit.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Snapshot tests approving wrong behavior blindly.
- Real credentials in fixtures.
- Coverage percentage replacing risk-based testing.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Formal verification.
- Live production provider write tests.

## Acceptance Indicators

- Release gate matrix passes.
- Every public schema has round-trip tests.
- Malicious path and redaction suites have no known critical failure.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Additional Design Notes

Reference fixtures: small TypeScript app, Python project, Java project, monorepo, microservices, generated files, synthetic secrets, malformed files, symlinks, unusual encodings, and large synthetic repository.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
