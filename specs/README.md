# Fuzit Complete Project Blueprint

Fuzit is a local-first context engineering platform for software projects. It discovers, normalizes, relates, ranks, secures, budgets, and exports the minimum highest-value evidence needed by an AI coding agent, developer, reviewer, CI workflow, or engineering tool.

> Git standardized version control. Docker standardized containers. Fuzit aims to standardize software context for AI systems.

## What This Package Is

This directory contains the public product and engineering contracts for Fuzit.
Internal roadmaps, sprint guidance, decision ledgers, and traceability records are
not part of the public source boundary.

## Product Thesis

Current repository packers optimize transportation: they flatten files into a large prompt. Fuzit optimizes reasoning. A context bundle should combine relevant code with relationships, recent changes, tests, runtime evidence, architecture, developer intent, lifecycle status, provenance, confidence, redaction decisions, and a clear explanation of what was omitted.

The canonical pipeline is:

```text
Task or question
→ Discover sources
→ Acquire and normalize evidence
→ Analyze structure and relationships
→ Apply security policy
→ Select task-relevant context
→ Enforce token or byte budget
→ Render an explainable versioned bundle
```

## Non-Negotiable Invariants

- Core repository scanning and deterministic rendering work without a cloud account.
- No source code, logs, environment information, or runtime state is uploaded silently.
- The same revision, configuration, Fuzit version, and explicit inputs yield the same meaningful static output.
- Every selected item carries provenance; inferred items carry an explained confidence basis.
- Security filtering occurs before external transmission and before final rendering.
- Optional source failure produces an explicit partial result, not fabricated completeness.
- Persistent schemas, CLI behavior, provider records, plugin contracts, and bundle formats are versioned.
- Windows, Linux, and macOS behavior is designed and tested from the beginning.

## Documentation Map

| Area | Purpose |
| --- | --- |
| `01-product/` | Vision, positioning, users, workflows, metrics, and market differentiation |
| `02-architecture/` | Components, domain model, graph, storage, providers, plugins, and MCP |
| `03-cli/` | Command surface, configuration, profiles, output contracts, and workflows |
| `04-features/` | Detailed behavior of discovery, analysis, selection, runtime, and bundles |
| `05-engineering/` | Technology, repository conventions, testing, performance, security, and releases |
| `diagrams/` | Mermaid source diagrams for architecture, pipeline, graph, plugins, updates, and releases |
| `appendices/` | Public risks, terminology, and examples |

Start with [Executive Summary](EXECUTIVE-SUMMARY.md) and
[Architecture Overview](02-architecture/architecture-overview.md).

## v1 Boundary

Public v1.0 is “Trustworthy Repository Context”: local scanning, ignore rules, deterministic packaging, redaction, budgets, Markdown/JSON/XML/text renderers, essential Git metadata, file-level snapshots and deltas, read-only GitHub integration, configuration, and diagnostics. Runtime collection, a rich typed graph, MCP, advanced plugins, hosted collaboration, and cross-repository intelligence are later milestones unless a narrowly scoped experimental interface is required to preserve forward compatibility.

## Repository Status

The development repository remains private. Any future public repository must
start from the owner-approved sanitized source-tree boundary.

## Authority and Change Control

Where documents disagree, use this precedence:

1. Security and privacy invariants.
2. Versioned public contracts and serialized schemas.
3. Explicit v1 scope and acceptance gates.
4. Architecture and feature requirements.
5. Recommendations and exploratory research.

Contract contradictions must be resolved through normal public design review;
contributors must not silently invent behavior.
