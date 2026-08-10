# Command Reference

## Purpose

Defines the purpose and essential options of the command set without prematurely specifying every flag.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Cover `init`, `scan`, `pack`, `analyze`, `graph`, `context`, `snapshot`, `diff`, `profile`, `provider`, `plugin`, `config`, `doctor`, `cache`, and `serve`.
- Label commands by release maturity.
- Provide safe defaults and examples.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- `scan` discovers and indexes; `pack` performs deterministic repository export; `context` builds task-specific bundles.
- `analyze` enriches known items; `graph` inspects relationships.
- `serve` is experimental until MCP/daemon maturity.
- Commands support `--json`, `--quiet`, `--debug`, and `--dry-run` where meaningful.

## Component Interactions

- Command handlers share global configuration and diagnostics.
- Profile and policy resolution precede source access.
- Provider/plugin subcommands use capability discovery.

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

- Command unavailable in current build.
- Required native parser missing.
- Destination exists.
- Unsupported output format requested.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Creating placeholder commands that imply support.
- Command-specific config precedence.
- Dry-run that still writes or accesses network.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Exact long-term flag inventory.
- Backward compatibility before first public contract.

## Acceptance Indicators

- Every documented command either works or is explicitly marked experimental/unavailable.
- Examples pass smoke tests.
- Dry-run has no persistent or network side effects.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Additional Design Notes

Recommended command meanings: `init` creates config; `scan` inventories/indexes; `pack` exports deterministic repository content; `analyze` adds structure; `context` performs task selection; `snapshot` records state; `diff` compares states; `doctor` verifies environment and index; `cache` inspects/clears local state.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
