# Example Workflows

## Purpose

Provides copy-pasteable workflows for local packing, task bundles, snapshot comparison, CI, GitHub enrichment, security review, and troubleshooting.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Show minimum commands and expected artifacts.
- Demonstrate explicit network and runtime authorization.
- Include Windows PowerShell and POSIX path considerations.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- Examples use fixture names and no real credentials.
- Every workflow starts from a known repository root.
- Machine-mode examples redirect data safely.
- Examples specify maturity where commands are experimental.

## Component Interactions

- Commands exercise configuration, scanner, index, profiles, providers, and renderers.
- Validation uses `doctor` and manifest inspection.

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

- `fuzit pack --format markdown --output .fuzit/out/repository.md` creates a deterministic safe export.
- `fuzit context "fix checkout timeout" --profile bug-fix --budget 24000 --format json` prioritizes failing code, tests, changes, and diagnostics.

## Edge Cases

- No Git repository.
- Output directory already exists.
- GitHub token unavailable.
- Budget too small for required anchors.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- Examples drifting from command implementation.
- Shell syntax presented as cross-platform when it is not.
- Embedding tokens in command history.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Complete deployment tutorials.
- Provider write workflows.

## Acceptance Indicators

- Examples are executed in documentation CI.
- Secrets are represented through environment variables or credential stores.
- Expected output includes warnings and manifest location.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
