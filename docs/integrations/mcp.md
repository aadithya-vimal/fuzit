# MCP Integration

Fuzit provides a local, read-only Model Context Protocol (MCP) server for integrating with AI-assisted development tools.

## Overview

The Fuzit MCP server (`@fuzit/mcp-server`) exposes repository intelligence through a versioned, bounded, security-filtered set of tools using stdio transport only. No network listener is opened.

## Requirements

- Node.js >=24.0.0
- Fuzit workspace initialized (`fuzit init`)
- Explicit allowed workspace roots passed at startup

## Local stdio setup

```bash
node node_modules/@fuzit/mcp-server/dist/index.js /path/to/workspace
```

Or from a pre-built binary:

```bash
fuzit-mcp /path/to/workspace
```

An MCP client configuration for one verified private installation can use:

```json
{"command":"fuzit-mcp","args":["/absolute/path/to/workspace"],"transport":"stdio"}
```

The command must resolve to the locally installed, integrity-checked artifact.
Each argument is an independently allowed workspace root; use canonical absolute
paths and no shell wrapper. At least one and at most eight roots are required.
Duplicate roots are collapsed and canonical roots are sorted, so equivalent
configurations have deterministic identity. Restart the client after changing
the allow-list; a running server does not gain authority over new roots.

## Available Tools

| Tool                      | Description                              |
| ------------------------- | ---------------------------------------- |
| `fuzit_status`            | Run doctor checks for the workspace root |
| `fuzit_profiles`          | List available context profiles          |
| `fuzit_search`            | Search files by task relevance           |
| `fuzit_get_context`       | Get full context bundle for a task       |
| `fuzit_explain_selection` | Explain file selection decisions         |
| `fuzit_graph_neighbors`   | Get graph neighborhood of a file         |
| `fuzit_graph_impact`      | Get impact set for a changed file        |
| `fuzit_recent_changes`    | Get recent Git commits                   |
| `fuzit_create_bundle`     | Create a context bundle file             |

All tools share canonical workspace confinement, security-filtered content,
redacted audit errors, bounded request and response sizes, and cancellation.
Task strings are treated as hostile input and cannot provide raw access to
redacted content. The stdio server performs no default network operation.

## Security Properties

- **Local stdio only**: No network port is opened
- **Workspace isolation**: All paths are validated against explicit allowed roots
- **Canonical identity**: Roots resolve through the filesystem at startup and on
  every request, so traversal, unknown nested roots, and swapped symlinks are
  rejected
- **Multi-root sessions**: Duplicate roots are collapsed and canonical roots are
  ordered deterministically
- **Read-only tools**: No write operations except `fuzit_create_bundle` which writes only within the workspace root under `.fuzit-bundles/`
- **Bounded output**: All responses are limited to 2 MB
- **Secret redaction**: Security-filtered items have content omitted
- **No telemetry**: No outbound network calls

Every request must name one of the exact canonical roots supplied at startup.
Children are not independently selectable roots. Traversal, an unknown root,
or a root whose symlink identity changed fails before tool work begins.

## Configuration

All tools require a `root` parameter (absolute path within an allowed workspace root).

### fuzit_status

```json
{
  "root": "/path/to/workspace"
}
```

### fuzit_search

```json
{
  "root": "/path/to/workspace",
  "task": "fix authentication bug",
  "profile": "bug-fix",
  "budgetTokens": 8000
}
```

### fuzit_get_context

```json
{
  "root": "/path/to/workspace",
  "task": "implement new feature",
  "profile": "feature-development",
  "budgetTokens": 8000,
  "explain": false
}
```

### fuzit_explain_selection

```json
{
  "root": "/path/to/workspace",
  "task": "review security code",
  "profile": "security-audit"
}
```

### fuzit_graph_neighbors

```json
{
  "root": "/path/to/workspace",
  "path": "src/auth/index.ts",
  "depth": 2
}
```

### fuzit_graph_impact

```json
{
  "root": "/path/to/workspace",
  "path": "src/core/utils.ts",
  "depth": 2
}
```

### fuzit_recent_changes

```json
{
  "root": "/path/to/workspace",
  "limit": 20
}
```

### fuzit_create_bundle

```json
{
  "root": "/path/to/workspace",
  "task": "review PR",
  "profile": "code-review",
  "budgetTokens": 8000,
  "format": "markdown"
}
```

## Limits

| Limit                    | Value      |
| ------------------------ | ---------- |
| Maximum allowed roots    | 8          |
| Maximum output payload   | 2 MB       |
| Maximum tool duration    | 30 seconds |
| Maximum search results   | 200        |
| Maximum graph depth      | 4          |
| Maximum graph nodes      | 300        |
| Maximum commits returned | 50         |

## Restrictions

The following are explicitly forbidden in the v1 MCP server:

- Remote multi-tenant MCP
- Agent write tools
- Shell execution tools
- Arbitrary filesystem tools
- Network listeners
- Workspace escape
- Raw redacted content retrieval

## Lifecycle and failure handling

The client owns the child process. Startup validates roots before serving tool
requests. Closing stdin or cancelling the client ends owned work; tool calls are
also capped at 30 seconds and 2 MB. A timeout, cancellation, oversized request,
workspace mismatch, or partial repository result returns a bounded structured
diagnostic rather than unfiltered content. Restart after changing installation,
configuration, or allowed roots.
