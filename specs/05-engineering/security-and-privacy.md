# Security And Privacy

## Purpose

Defines the threat model and controls for secret scanning, redaction, sensitive files, path and archive traversal, command execution, tokens, plugins, logs, indexes, network, telemetry, crash reports, malicious repositories, and untrusted configuration.

This document is normative for product behavior and architectural boundaries unless it explicitly labels an item as exploratory. It should be read with the [architecture overview](../02-architecture/architecture-overview.md), [security and privacy model](../05-engineering/security-and-privacy.md), and [implementation phases](../06-roadmap/implementation-phases.md).

## Scope and Intended Outcomes

- Make privacy-safe local operation the default.
- Treat source repositories and extensions as hostile input.
- Provide explicit unsafe overrides with auditability.

## Required Behavior

Fuzit must implement this capability as part of a traceable context pipeline. Inputs must be normalized, policy must be evaluated before unsafe disclosure, and outputs must retain provenance. A failure in an optional adapter must degrade locally: it may reduce confidence or completeness, but it must not silently fabricate data or invalidate independent sources.

The implementation should preserve the following outcomes:

- No telemetry, source upload, external AI, or arbitrary command execution by default.
- Likely credentials and high-risk files are excluded or redacted.
- Network use is attributable to provider/plugin/user action.
- Debug logs never print credentials.
- Policy is evaluated before acquisition where possible and before disclosure always.

## Component Interactions

- Discovery blocks traversal.
- Security classifier labels items.
- Redactor transforms safe copies while retaining hashes/provenance.
- Permission broker controls providers/plugins/collectors.
- Bundle warns before sharing.

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

- Symlink target changes.
- Secret split across lines.
- Binary contains certificate.
- Git remote contains token.
- Malicious config imports code.
- Plugin exfiltration attempt.

Edge cases should produce explicit diagnostics. They must never be resolved by silently broadening permissions, bypassing ignore rules, or transmitting private content.

## Risks and Trade-offs

- False-negative secret detection.
- Over-redaction breaking code usefulness.
- Local index theft.
- Supply-chain compromise.

The preferred trade-off is correctness, privacy, and explainability over maximal recall or superficial speed. Optimization is acceptable only when it preserves output semantics and can be tested with golden fixtures.

## Out of Scope

- Guaranteeing detection of all secrets.
- Executing arbitrary security scanners automatically.
- Cloud DLP dependency.

## Acceptance Indicators

- Threat model reviewed before alpha and release candidate.
- Synthetic secret corpus passes.
- Network-off integration test observes zero calls.
- Unsafe override is explicit in manifest and diagnostics.

## V1 Threat-Model Traceability

The maintained threat model must cover discovery and configuration, scanning
and filtering, incremental state and watchers, analysis and graphs, CLI and
renderers, MCP, VS Code, plugins, diagnostic artifacts, packaging, and release.
Each critical threat records its attacker goal, trust boundary, controls,
executable tests, owning surface, residual risk, and release-blocking condition.
Missing test evidence, repository escape or execution, permission bypass,
secret disclosure, cross-session disclosure, corrupted durable state, and
unauthorized publication are release blockers.

## Future Extensions

- Extend the capability behind stable contracts after the local deterministic implementation is proven.

## Related Documents

- [Product principles](../01-product/product-principles.md)
- [Context data model](../02-architecture/context-data-model.md)
- [Context bundles](../04-features/context-bundles.md)
- [Testing strategy](../05-engineering/testing-strategy.md)
- [Definition of done](../07-agent-guidance/definition-of-done.md)
