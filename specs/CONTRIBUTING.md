# Contributing to Fuzit

Fuzit is private until the public release gate is approved. Access does not authorize disclosure, public discussion, package publication, external demos, or sharing of repository-derived artifacts.

## Contribution Rules

1. Inspect existing contracts and tests before editing.
2. Open or link an issue for non-trivial behavior changes.
3. Keep each pull request to one coherent capability or correction.
4. Preserve deterministic semantics and local-first operation.
5. Add or update tests for changed behavior, including failure paths.
6. Update affected documentation and serialized examples.
7. Do not add telemetry, network calls, shell execution, or provider access without explicit policy controls and threat review.
8. Do not log repository content, tokens, credentials, or unredacted diagnostics.
9. Use migrations or rebuild instructions for persistent schema changes.
10. Mark unstable contracts experimental and feature-flag them.

## Development Baseline

The intended baseline is Node.js LTS, TypeScript strict mode, pnpm workspaces, Turborepo, Vitest, ESLint, Prettier, Changesets, and deterministic local verification. Exact versions are pinned in the implementation repository. Prefer platform-neutral Node APIs; encapsulate shell and process differences behind tested adapters.

## Required Pull Request Evidence

- Problem and scope.
- Architectural impact.
- Security and privacy impact.
- Tests executed and their results.
- Determinism or golden-output impact.
- Cross-platform considerations.
- Documentation updated.
- Migration or rebuild instructions when applicable.

## Commit Discipline

Use focused commits that build and test independently when practical. Avoid mixed formatting, refactoring, and feature changes. Never rewrite working architecture solely to satisfy stylistic preference. Generated fixtures must identify their generator and remain reproducible.

## Review Priorities

Reviewers should check, in order: unsafe disclosure or execution, contract compatibility, correctness, deterministic behavior, partial-failure semantics, resource bounds, cross-platform behavior, test quality, and maintainability.

## Documentation

Normative terms—Context Item, Context Graph, Context Profile, Context Policy, Context Bundle, Snapshot, Delta, Provenance, Confidence, and Lifecycle—must match `GLOSSARY.md`. New concepts require a glossary entry and a traceability update.

## Private Release Hygiene

Do not place real credentials, customer data, employer information, private hostnames, internal URLs, or proprietary third-party code in commits, issues, fixtures, screenshots, or recordings. Before public release, the complete Git history and generated artifacts will be scanned and manually reviewed.
