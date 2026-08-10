# Architecture Overview

## Purpose

Defines the modular monorepo, dependency direction, pipeline stages, deployment shapes, and architectural invariants.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Provide a shared system map for implementation.
- Keep CLI, MCP, and daemon as thin application shells over one engine.
- Separate domain contracts from adapters and persistence.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- TypeScript monorepo with `apps/` and bounded `packages/`.
- Core packages never depend on CLI or provider-specific packages.
- Security filtering is a pipeline gate, not a renderer option.
- The index is rebuildable; bundles are immutable.

## Component Interactions

- CLI/MCP call application services.
- Discovery, analysis, providers, and runtime adapters emit normalized records.
- Graph/index support selection.
- Budgeting and renderers produce bundles.

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

- `fuzit context --profile bug-fix` and an MCP `build_context_bundle` tool invoke the same application service.
- A GitHub outage removes provider items but local repository evidence still renders with a partial-source warning.

## Edge Cases

- Only a subset of packages is installed.
- Native parser unavailable.
- Index schema is newer than binary.
- Concurrent scan and context request.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Shared package becoming a dependency cycle.
- Pipeline stages leaking provider-specific types.
- Daemon becoming a separate implementation.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Microservice decomposition.
- Mandatory hosted control plane.

## Acceptance Indicators

- Dependency graph has no forbidden cycles.
- All entry points pass the same contract tests.
- Partial adapter failure is isolated and visible.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Additional Design Notes

Recommended top-level structure: `apps/cli`, `apps/mcp-server`, `apps/daemon`; packages for core, config, discovery, scanner, analysis, parsers, graph, index, selection, profiles, budgeting, runtime, providers, renderers, security, plugin SDK, schemas, shared utilities, and testing.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
