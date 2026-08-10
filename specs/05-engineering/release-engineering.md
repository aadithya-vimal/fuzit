# Release Engineering

## Purpose

Defines versioning, Changesets, local verification gates, artifact creation, signing, provenance, dependency review, rollback, and private distribution.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Produce reproducible packages and binaries where offered.
- Keep private alpha/beta artifacts controlled.
- Prepare a clean transition to public npm and repository release.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Main branch is protected.
- Release artifacts originate from a clean, reviewed commit after `pnpm verify:release` succeeds locally.
- Packages include checksums and provenance.
- Release candidate freezes scope.
- Rollback and migration notes accompany persistent changes.

## Component Interactions

- Changesets calculate versions.
- Identical local verification commands produce the supported-platform test matrix.
- Artifact job signs and publishes to authorized channel.
- Release manifest links source commit and schemas.

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

- Partial publish.
- Signing key unavailable.
- Dependency yanked.
- Migration defect discovered after beta.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Publishing from an unverified or dirty developer workspace.
- Publishing source maps with sensitive paths.
- Public package before history audit.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Automatic breaking migration.
- Unreviewed nightly public builds.

## Acceptance Indicators

- Rebuild from tag reproduces expected hashes within documented envelope.
- Release checklist is complete.
- Private channels enforce access and retention.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
