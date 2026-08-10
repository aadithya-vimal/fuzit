# Context Bundles

## Purpose

Defines the versioned final product delivered to a model, developer, CI job, or downstream tool.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Contain selected items, ordering, metadata, provenance, revisions, explanations, redactions, profile, policies, size estimates, warnings, failed sources, and partial indicators.
- Support embedded content and safe references.
- Be reproducible and verifiable.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Bundle has immutable ID derived from canonical manifest and content hashes.
- Manifest is mandatory.
- Selection and redaction explanations are first-class.
- References cannot escape authorized source roots.
- Bundle records Fuzit/schema/adapter versions.

## Component Interactions

- Selection creates ordered item plan.
- Budgeting finalizes inclusion mode.
- Renderer serializes.
- Manifest verifier checks hashes and schema.

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

- Referenced source removed after export.
- Partial provider data.
- Bundle copied to another machine.
- Sensitive item excluded but relationship remains.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Manifest leaking secrets.
- References resolving differently later.
- Format-specific semantic drift.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Encrypted enterprise transport in v1.
- Executing bundle contents.

## Acceptance Indicators

- Validator confirms hashes and schema.
- Cross-format semantic tests pass.
- Every included item explains origin and selection reason.

## Future Extensions

- `.fuzit` archive with content-addressed objects, graph, snapshots, policy metadata, checksums, and schema migrations.
- Signed bundles and organizational policy attestations.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
