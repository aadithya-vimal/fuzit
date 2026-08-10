# Technology Direction

## Purpose

Recommends an initial technology stack and records why each choice is provisional behind stable contracts.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Use TypeScript, Node.js LTS, pnpm workspaces, Turborepo, Zod, Vitest, ESLint, Prettier, tsup or equivalent, Changesets, deterministic local verification, Tree-sitter where useful, and SQLite for local indexing.
- Keep native and remote dependencies optional.
- Define criteria for revisiting choices.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Strict TypeScript protects public schemas and adapters.
- Node provides cross-platform filesystem/process support and ecosystem reach.
- SQLite offers transactional embedded persistence.
- Tree-sitter is one parser option, not the domain model.
- Technology changes require compatibility impact analysis.

## Component Interactions

- Package boundaries encapsulate tools.
- Build graph uses workspace dependencies.
- Identical local gates validate the supported Node/platform matrix.
- Changesets manage public package versions.

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

- Native module unavailable for target architecture.
- Node LTS changes.
- Turborepo cache includes sensitive outputs.
- ESM/CJS ecosystem mismatch.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Stack fashion driving architecture.
- Native parser blocking basic packaging.
- Build cache uploading private artifacts.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Permanent commitment to one bundler.
- Browser implementation in v1.

## Acceptance Indicators

- Bootstrap builds from clean checkout.
- Core pack flow works without optional native parser.
- Dependency review documents licenses and network behavior.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
