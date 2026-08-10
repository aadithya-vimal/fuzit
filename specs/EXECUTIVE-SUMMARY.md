# Executive Summary

## Opportunity

AI coding systems are increasingly capable, but their effectiveness is constrained by context quality. Most repository-to-prompt tools produce static, flat, oversized snapshots. They lose dependency structure, temporal state, runtime failures, developer intent, lifecycle status, and privacy controls. They also become stale as soon as the repository changes.

Fuzit addresses this as a context engineering platform rather than a repository packer. It continuously models available project evidence and assembles a task-specific, explainable bundle under a defined budget and policy.

## Product Definition

Fuzit is a local-first, provider-neutral platform that discovers and normalizes source code, repository structure, Git history, documentation, diagnostics, runtime evidence, provider records, and inferred relationships. It then applies policy, profile-specific ranking, graph expansion, redundancy control, and token or byte budgeting before rendering a versioned context bundle.

The smallest meaningful unit is a **Context Item**. Items are related in a typed **Context Graph**, selected using a named **Context Profile**, constrained by **Context Policy**, and exported in a **Context Bundle**. **Snapshots** establish reproducible state; **Deltas** describe change. **Provenance**, **confidence**, **lifecycle**, and **sensitivity** are first-class metadata rather than annotations added later.

## Strategic Differentiation

Fuzit’s defensible value is not a single packing command. It is the combination of:

- deterministic local acquisition and rendering;
- incremental indexes that do not restart from zero;
- task-aware selection driven by lexical, symbol, Git, graph, and runtime evidence;
- provenance and selection explanations;
- privacy-safe defaults and explicit network use;
- stable provider, parser, renderer, plugin, SDK, CLI, and bundle contracts;
- a path from a trustworthy local CLI to MCP, IDE, CI, and team integrations.

## Initial Product

v1.0 should establish trust before sophistication. The initial product includes repository discovery, classification, ignore handling, binary and size controls, streaming reads, content hashing, deterministic ordering, secret detection and redaction, Markdown/JSON/XML/plain-text output, budgets, Git metadata, snapshots, file-level deltas, read-only GitHub records, configuration, diagnostics, and cross-platform fixture coverage.

Advanced runtime collection, symbol-rich graph persistence, embeddings, remote reranking, plugin marketplaces, team collaboration, and hosted indexes are intentionally deferred.

## Architecture

The recommended implementation is a modular TypeScript monorepo using Node.js LTS, pnpm workspaces, Turborepo, Zod, Vitest, Tree-sitter where useful, and an embedded SQLite index with WAL and schema migrations. CLI, MCP server, and daemon are application shells over the same core engine. Domain contracts remain independent of provider and UI implementations.

A typical request passes through source discovery, acquisition, normalization, analysis, graph enrichment, security filtering, task selection, budgeting, and rendering. Each stage emits structured diagnostics and preserves provenance. The index is rebuildable from authoritative sources; exported bundles are immutable and self-describing.

## Security Posture

Fuzit treats repositories and plugins as untrusted input. It does not execute repository code during ordinary scanning, follow escaping symlinks, expand unsafe archives, print credentials in debug logs, or transmit source without an attributable explicit action. Likely credentials and high-risk files are excluded or redacted by default. Plugin access is capability- and permission-based, with process isolation as the minimum viable boundary for untrusted extensions.

## Release Approach

Development remains in a private GitHub repository. Alpha proves deterministic safe packing. Beta adds repository intelligence, profiles, snapshots, provider data, and diagnostics. The release candidate freezes scope and performs security, dependency, licensing, documentation, history, and artifact audits. Public v1.0 opens the repository and publishes signed packages only after all launch gates pass.

## Definition of Success

Fuzit succeeds when a developer can point it at a real repository and obtain a smaller, safer, more relevant, reproducible, and explainable context bundle than a complete dump—without sending private code to a third party and without requiring a hosted service. Engineering success is measured through deterministic golden tests, redaction effectiveness, cross-platform parity, incremental update efficiency, bounded memory use, source-to-bundle traceability, and task retrieval quality on curated benchmark fixtures.
