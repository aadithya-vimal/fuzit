<div align="center">
  <img width="800" height="250" alt="fuzitcomplete" src="media/fuzitcomplete.png" />

  <h3 align="center">Local-First, Privacy-Safe AI Context-Engineering Platform for Software Development</h3>
</div>

<p align="center">
  <a href="#build-status"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build Status" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-Private--V1-blue" alt="License" /></a>
  <a href="#node-version"><img src="https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen" alt="Node Version" /></a>
  <a href="#pnpm-workspace"><img src="https://img.shields.io/badge/pnpm-workspace-orange" alt="PNPM Workspace" /></a>
  <a href="#mcp-ready"><img src="https://img.shields.io/badge/MCP-JSON--RPC-purple" alt="MCP Ready" /></a>
  <a href="#telemetry"><img src="https://img.shields.io/badge/telemetry-zero-red" alt="Zero Telemetry" /></a>
</p>

---

## 📌 Table of Contents

- [Overview](#overview)
- [Why Fuzit?](#why-fuzit)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Quick Start & Installation](#quick-start--installation)
- [CLI Reference](#cli-reference)
- [Output Formats](#output-formats)
- [Configuration Reference (`.fuzitrc.json`)](#configuration-reference-fuzitrcjson)
- [Model Context Protocol (MCP) Integration](#model-context-protocol-mcp-integration)
- [VS Code Extension](#vs-code-extension)
- [Restricted Plugin Architecture & SDK](#restricted-plugin-architecture--sdk)
- [Security & Privacy Pipeline](#security--privacy-pipeline)
- [Local Verification & Development](#local-verification--development)
- [License & Policy](#license--policy)
- [V1 Support Policy](docs/release/support-policy.md)

---

## 💡 Overview

**Fuzit** is a state-of-the-art, local-first context engineering platform engineered to bridge the gap between large codebases and LLM context windows.

Instead of dumping raw file trees or naively concatenating repository contents, Fuzit continuously models project evidence—**AST syntax trees, dependency call-graphs, Git commit metadata, symbol definitions, and structural file relationships**—to synthesize high-density, explainable context bundles optimized for LLM consumption under strict token budgets.

Fuzit operates across 5 native local surfaces:

1. **CLI (`fuzit`)** — Developer-centric command-line suite for automated workflow integration.
2. **Local Watcher & Daemon** — One-watcher-per-root live file monitor for instant index invalidation.
3. **Stdio MCP Server (`@fuzit/mcp-server`)** — Seamless integration with Claude Desktop, Cursor, and Windsurf via Model Context Protocol.
4. **VS Code Extension (`@fuzit/vscode-extension`)** — Native IDE experience with multi-root support and live context previews.
5. **Isolated Plugin Host (`@fuzit/plugin-sdk`)** — Out-of-process, deny-by-default extensibility SDK for custom collectors, rankers, and analyzers.

---

## ⚡ Why Fuzit?

| Feature                 | Naive Repository Dumpers        | Fuzit Context Platform                                                         |
| :---------------------- | :------------------------------ | :----------------------------------------------------------------------------- |
| **Context Assembly**    | Flat file concatenation         | **Knapsack token budgeting with priority decay & AST symbol ranking**          |
| **Relevance Filtering** | Static file patterns / regex    | **Task-aware semantic scoring (`feature-development`, `bug-fix`, `refactor`)** |
| **Graph Intelligence**  | None (unaware of dependencies)  | **Typed Context Graph with symbol, import, and structural neighbor expansion** |
| **Security & Privacy**  | None (exposes secrets / `.env`) | **Built-in secret detection, path traversal defense, and path redaction**      |
| **State Tracking**      | Re-reads whole disk every run   | **Incremental state snapshots, differential graph updates, and fast cache**    |
| **Telemetry**           | Frequent remote telemetry       | **100% Local-First — Zero telemetry, zero external network calls**             |
| **Protocol Support**    | Plain file / stdout             | **Multi-format (Markdown, XML, JSON, Text) & native Stdio MCP Server**         |

---

## 🚀 Key Features

### 🧠 1. Task-Aware Context Assembly & Knapsack Budgeting

- **Relevance Scoring**: Dynamically scores source files, symbols, and Git commit history against natural language tasks.
- **Knapsack Budgeting**: Enforces strict token (`--budget-tokens`) and byte constraints using multi-pass optimization (`top-k`, `priority-decay`, `file-boundary`).
- **Bounded Expansion**: Traverses context graph neighbors up to configurable depth boundaries while preserving token budgets.

### 🛡️ 2. Privacy-First Security Engine

- **Zero Telemetry**: Never transmits source code, index metrics, or usage telemetry to remote cloud servers.
- **Secret Redaction**: Built-in entropy scanner and pattern matcher automatically mask API keys, tokens, credentials, and `.env` secrets.
- **Path Containment Guard**: Prevents symlink escapes, relative path traversal (`..`), and unauthorized access outside workspace roots.
- **Workspace Trust Enforcement**: Strictly validates IDE Workspace Trust before accessing project content or running commands.

### 📊 3. Incremental Graph & Snapshot Engine

- **Typed Context Graph**: Connects files, functions, classes, import statements, and Git commit history into a querying context graph.
- **Snapshot Diffs**: Captures reproducible repository snapshots to analyze context evolution between git revisions or time windows.
- **One-Watcher-Per-Root**: Efficient in-memory caching and invalidation using non-blocking, isolated filesystem watchers.

### 🔌 4. Model Context Protocol (MCP) Integration

- Implements standard MCP JSON-RPC protocol over `stdio` to provide Cursor, Claude Desktop, and Windsurf with live context bundles, repository graph exploration, and index diagnostics.

### 🧩 5. Out-of-Process Restricted Plugin Host

- Out-of-process stdio execution for untrusted custom plugins.
- **Deny-by-default permissions**: Explicit user approval required for filesystem, network, shell execution, or environment variable access.

---

## 🏗️ Architecture Overview

Fuzit is architected as a modular, type-safe TypeScript monorepo powered by PNPM Workspaces and Turborepo.

```text
fuzit/
├── apps/
│   ├── cli/                   # Local CLI (fuzit binary & command registry)
│   └── vscode-extension/      # VS Code Extension (@fuzit/vscode-extension)
├── packages/
│   ├── core/                  # Application services & pipeline orchestrator
│   ├── config/                # Schema-validated configuration (.fuzitrc.json)
│   ├── schemas/               # Zod domain contracts & protocol schemas
│   ├── security/              # Secret scanner, path containment & redaction engine
│   ├── discovery/             # File scanner, classification, & ignore rule engine
│   ├── analysis/              # Lexical & AST symbol graph extractor
│   ├── graph/                 # Typed Context Graph builder & neighbor expansion
│   ├── selection/             # Task scoring, profile ranking & relevance algorithms
│   ├── budgeting/             # Knapsack token estimators & budget strategy solvers
│   ├── renderers/             # Multi-format bundle renderers (Markdown, XML, JSON, Text)
│   ├── snapshots/             # Incremental repository snapshot & diff engine
│   ├── git/                   # Git metadata extraction & commit history analyzer
│   ├── provider-github/       # Local read-only GitHub issue/PR context ingest
│   ├── watcher/               # Multi-root isolated filesystem watcher daemon
│   ├── mcp-server/            # Stdio Model Context Protocol (MCP) server
│   ├── plugin-sdk/            # Plugin manifest schema & SDK interfaces
│   ├── plugin-host/           # Out-of-process framed stdio plugin executor
│   ├── benchmark/             # Context retrieval quality evaluation suite
│   └── testing/               # Topology fixture generators & golden test assertion tools
```

---

## 🛠️ Quick Start & Installation

### Prerequisites

- **Node.js**: `>= 24.0.0`
- **PNPM**: `11.9.0`

### Build Workspace Locally

```bash
# Clone repository
git clone https://github.com/aadithya-vimal/fuzit.git
cd fuzit

# Install dependencies
pnpm install

# Build all monorepo packages
pnpm build
```

---

## 💻 CLI Reference

The `fuzit` package provides a comprehensive command-line tool for workspace scanning, context synthesis, graph queries, snapshot comparison, and diagnostics.

```bash
fuzit <command> [options]
```

### Core Commands

#### 1. Initialize Configuration (`fuzit init`)

Generates a default `.fuzitrc.json` configuration file in the target directory:

```bash
fuzit init
```

#### 2. Scan Workspace (`fuzit scan`)

Scans workspace files, applies ignore rules, runs secret auditing, and prints index metrics:

```bash
# Human-readable summary
fuzit scan

# Machine-readable JSON output
fuzit scan --json
```

#### 3. Generate Task Context (`fuzit context`)

Synthesizes an optimal context bundle for a given natural language task under budget:

```bash
fuzit context \
  --task "Implement OAuth2 refresh token rotation flow" \
  --profile feature-development \
  --budget-tokens 8000 \
  --format markdown \
  --output context-bundle.md
```

#### 4. Context Graph Exploration (`fuzit graph`)

Explores symbol and file dependency neighbors in the Context Graph:

```bash
# Find immediate symbol and import neighbors of a target file
fuzit graph neighbors src/auth/service.ts --depth 2 --json
```

#### 5. Snapshot Management (`fuzit snapshot`)

Capture and compare repository state snapshots:

```bash
# Create snapshot of current repository state
fuzit snapshot create --tag pre-refactor --json

# Diff two snapshot IDs to inspect structural changes
fuzit snapshot diff snap_01HGF... snap_01HGG... --json
```

#### 6. System Doctor & Diagnostics (`fuzit doctor`)

Runs path-redacted diagnostic health checks on workspace configuration, index integrity, and watcher state:

```bash
fuzit doctor
```

---

## 📄 Output Formats

Fuzit supports 4 high-density bundle output formats tailored for various AI workflows:

### 1. Markdown (`--format markdown`)

Best for direct copy-pasting into LLM chat interfaces (ChatGPT, Claude Web):

````markdown
# Fuzit Context Bundle

- Bundle: `bundle_12345`
- Root: `.`
- Files: 1
- Estimated tokens: 8000

## Manifest

```json
{
  "id": "bundle_12345",
  "source": { "kind": "repository", "root": "." }
}
```

---

## src/auth/token.ts

Provenance: local (semantic-overlap)

```typescript
export function rotateRefreshToken(oldToken: string): Promise<TokenPair> {
  // ...
}
```
````

### 2. XML (`--format xml`)

Optimized for Claude 3.5 Sonnet / Opus structured prompt parsing:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<contextBundle version="1">
  <id>bundle_12345</id>
  <source>
    <kind>repository</kind>
    <root>.</root>
  </source>
  <budget>
    <bytes>1024</bytes>
    <tokens>8000</tokens>
    <truncated>false</truncated>
  </budget>
  <items>
    <item>
      <path>src/auth/token.ts</path>
      <content>export function rotateRefreshToken(oldToken: string): Promise&lt;TokenPair&gt; { ... }</content>
    </item>
  </items>
</contextBundle>
```

### 3. JSON (`--format json`)

Structured representation for programmatic consumption and API pipelines:

```json
{
  "schemaVersion": 1,
  "id": "bundle_12345",
  "source": {
    "kind": "repository",
    "root": "."
  },
  "budget": {
    "bytes": 1024,
    "tokens": 8000,
    "truncated": false
  },
  "items": [
    {
      "path": "src/auth/token.ts",
      "content": "export function rotateRefreshToken(oldToken: string): Promise<TokenPair> { ... }",
      "contentStatus": "complete"
    }
  ]
}
```

### 4. Text (`--format text`)

Clean plain-text format with minimalist file delimiters:

```text
FUZIT CONTEXT BUNDLE
Bundle: bundle_12345
Root: .
Files: 1

==== FUZIT FILE BOUNDARY ====
Path: src/auth/token.ts
Status: complete
export function rotateRefreshToken(oldToken: string): Promise<TokenPair> { ... }
==== FUZIT FILE BOUNDARY ====
```

## ⚙️ Configuration Reference (`.fuzitrc.json`)

Fuzit can be configured using a `.fuzitrc.json` file at your repository root:

```json
{
  "$schema": "https://fuzit.dev/schema/v1/config.json",
  "version": 1,
  "budget": {
    "defaultMaxTokens": 8000,
    "trimStrategy": "priority-decay",
    "reserveRatio": 0.1
  },
  "security": {
    "redactSecrets": true,
    "redactionPattern": "[REDACTED_SECRET]",
    "excludedPatterns": ["**/.env*", "**/secrets/**", "**/*.pem"]
  },
  "profiles": {
    "feature-development": {
      "includeGitHistory": true,
      "includeSymbolGraph": true,
      "maxDepth": 3,
      "boostImportedSymbols": true
    },
    "bug-fix": {
      "includeGitHistory": true,
      "maxDepth": 2,
      "boostRecentCommits": true
    }
  },
  "ignore": ["**/node_modules/**", "**/dist/**", "**/.cache/**"]
}
```

---

## 🤖 Model Context Protocol (MCP) Integration

Fuzit features a built-in MCP server (`@fuzit/mcp-server`) enabling AI coding assistants like **Claude Desktop**, **Cursor**, and **Windsurf** to inspect workspace context programmatically.

### Claude Desktop Configuration

Add Fuzit to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fuzit": {
      "command": "node",
      "args": ["/path/to/fuzit/apps/mcp-server/dist/index.js"],
      "env": {
        "FUZIT_WORKSPACE_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

### Exposed MCP Tools & Resources

- `fuzit_get_context`: Fetch task-aware context bundle under specified token budget.
- `fuzit_explore_graph`: Query symbol and file dependency graph neighbors.
- `fuzit_scan_status`: Retrieve live index status, file counts, and secret audit diagnostic metrics.

---

## 🔌 VS Code Extension (`@fuzit/vscode-extension`)

The official VS Code extension brings Fuzit's context engineering right inside your IDE:

- **Workspace Trust Enforced**: Automatically disables engine execution in untrusted workspaces.
- **Multi-Root Disambiguation**: Seamlessly manages multi-root workspaces and folders with identical basenames.
- **Live Context Previews**: Interactive webview side-panel for reviewing context bundles before sending to AI assistants.
- **Zero Cloud Leakage**: Runs 100% locally on your machine.

---

## 📦 Restricted Plugin Architecture & SDK

Fuzit provides a type-safe, sandboxed plugin SDK (`@fuzit/plugin-sdk`) for extending context retrieval, custom AST parsing, and secret detection.

```typescript
import { parsePluginManifest, type PluginManifest } from "@fuzit/plugin-sdk";

export const manifest: PluginManifest = parsePluginManifest({
  id: "com.example.custom-parser",
  name: "Custom AST Parser Plugin",
  version: "1.0.0",
  fuzitVersion: "^1.0.0",
  entryPoint: "dist/plugin.js",
  capabilities: ["parser", "collector"],
  permissions: {
    filesystem: {
      readPaths: ["src/"],
    },
    network: {
      allowedHosts: [],
    },
    shell: false,
  },
});
```

### Plugin Safety Guarantees

- **Out-of-Process Execution**: Plugins run in isolated stdio child processes.
- **Deny-by-Default**: Zero access to network, filesystem, or shell environment unless explicitly granted in manifest.
- **Path Traversal Defense**: Strict validation blocks relative path escape (`..`) or absolute path hijacking.

---

## 🔒 Security & Privacy Pipeline

Fuzit is built from the ground up around strict privacy guarantees:

1. **Zero External Telemetry**: No tracking codes, analytics, update checks, or remote logging.
2. **Deterministic Redaction**: All secrets, private keys, and credential patterns are stripped before context rendering.
3. **Hermetic Workspace Scoping**: All operations stay within explicit workspace boundaries.

---

## 🧪 Local Verification & Development

Run local verification suites to validate code quality and contract compliance:

```bash
# Build all monorepo packages
pnpm build

# Typecheck workspace
pnpm typecheck

# Run unit tests across packages
pnpm test

# Run VS Code extension integration tests
pnpm test:vscode

# Run plugin suite tests
pnpm test:plugins

# Complete verification gate
pnpm verify
```

---

## 📄 License & Policy

Fuzit is open-source software released under the MIT License. Contributor setup,
security reporting, and release policy are documented in this repository.

<p align="center">
  <sub>Built with ❤️ by the Fuzit Core Team</sub>
</p>
