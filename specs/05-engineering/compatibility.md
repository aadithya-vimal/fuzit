# Compatibility

## Purpose

Defines operating system, filesystem, Node, shell, encoding, Git, schema, CLI, provider, plugin, and bundle compatibility policy.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Support Windows, Linux, and macOS core workflows.
- Document support windows and deprecation.
- Avoid path, permission, and line-ending assumptions.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Use semantic versioning for public packages after v1.
- Serialized schemas carry independent versions.
- CLI breaking changes require migration notes.
- Filesystem behavior is tested on native runners.
- Optional capabilities may have narrower documented support.

## Component Interactions

- Compatibility layer normalizes paths and process behavior.
- Identical local gates test supported Node LTS versions and operating systems.
- Bundle reader negotiates schema versions.
- Plugin host checks ranges.

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

- Case sensitivity differs.
- Executable permissions lost on Windows.
- Long paths.
- Non-UTF-8 filenames.
- Old index opened by new binary.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Claiming cross-platform from one OS.
- Silently rewriting unsupported schema.
- Using shell-specific syntax in core.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Mobile operating systems.
- Legacy Node versions.

## Acceptance Indicators

- Support matrix is published.
- Native runners pass core fixture suite.
- Incompatibility produces actionable diagnostics and no corrupting write.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
