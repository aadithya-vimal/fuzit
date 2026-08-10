# Plugin Integration & Manifest Specification

## Purpose

Defines the Plugin Manifest Schema, capability declarations, deny-by-default permission model, sandboxing boundaries, integrity metadata, and framed stdio communication protocol for Fuzit plugins.

---

## Plugin Manifest Schema

Every Fuzit plugin must provide a valid `fuzit-plugin.json` manifest at its root matching `PLUGIN_MANIFEST_SCHEMA_VERSION = 1`.

```json
{
  "schemaVersion": 1,
  "id": "com.example.custom-parser",
  "name": "Custom AST Parser",
  "version": "1.0.0",
  "protocol": "fuzit-plugin-v1",
  "fuzitVersion": "^1.0.0",
  "entryPoint": "dist/plugin.js",
  "description": "Custom AST symbol parser for experimental language support",
  "capabilities": ["parser", "collector"],
  "permissions": {
    "filesystem": {
      "readPaths": ["src/"]
    },
    "shell": false,
    "persistence": false
  },
  "integrity": {
    "checksum": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "signature": "placeholder-signature-metadata-v1",
    "algorithm": "sha256"
  }
}
```

---

## Framed Plugin Protocol (`fuzit-plugin-v1`)

The plugin protocol operates over stdio child process byte streams (`stdin` / `stdout`).

### 1. Wire Framing Format

Communication uses a length-prefixed framing binary format:

```text
┌───────────────────────────────┬──────────────────────────────────────────┐
│  4-Byte Length Header (BE)    │        JSON Payload (UTF-8)               │
│  UInt32 Big-Endian (Bytes)    │  Schema-validated PluginMessage JSON     │
└───────────────────────────────┴──────────────────────────────────────────┘
```

- **Max Frame Limit**: `MAX_PLUGIN_FRAME_BYTES = 16777216` (16 MB). Frames exceeding 16 MB fail closed immediately to prevent memory exhaust attacks.
- **Stream Decoding**: The `PluginFrameDecoder` handles chunk fragmentation across stdio `data` events and message coalescing.

### 2. Message Types

- `handshake_request` / `handshake_response`: Performed upon plugin process launch to negotiate capabilities and check version compatibility.
- `execute_request` / `execute_response`: Dispatches execution requests for declared capabilities (`parser`, `collector`, `renderer`, etc.) with optional timeouts and structured diagnostic reporting.
- `cancel_request`: Cancels an active in-flight request by `targetRequestId`.
- `diagnostic_event`: Emits asynchronous structured diagnostics during processing.
- `shutdown_request` / `shutdown_response`: Graceful termination protocol.

---

## Key Constraints & Security Rules

### 1. Plugin ID Validation

- Plugin IDs must consist of lowercase alphanumeric segments separated by dots or hyphens (e.g., `com.example.parser`).
- Path traversal sequences (`..`), leading slashes (`/`), or backslashes (`\`) are strictly forbidden and rejected at parse time.

### 2. Entry Point Containment

- `entryPoint` must be a relative path pointing inside the plugin package boundary.
- Absolute paths (`/usr/bin`, `C:\...`) and path traversal sequences (`../`) are rejected to prevent arbitrary binary execution.

### 3. Deny-by-Default Permission Model

All permissions are denied by default unless explicitly granted in `permissions`:

- `filesystem.readPaths`: Array of relative paths permitted for read operations. Path traversal (`..`) is rejected.
- `filesystem.writePaths`: Array of relative paths permitted for write operations.
- `network.allowedHosts`: Whitelist of hostnames allowed for external network connectivity.
- `shell`: Boolean flag controlling shell execution (defaults to `false`).
- `environment.allowedVars`: Whitelist of environment variables exposed to the plugin process.
- `persistence`: Controls persistent disk caching access.

### 4. Undeclared Capabilities Rejection

- Plugins must declare their capabilities in the `capabilities` array.
- Available capability tokens: `"provider"`, `"parser"`, `"collector"`, `"renderer"`, `"policy"`, `"profile"`, `"secret-detector"`, `"ranker"`, `"graph-enricher"`.

### 5. Integrity & Signed Metadata Placeholders

- `integrity` contains optional checksum and signature metadata placeholders for auditing plugin identity without claiming verified remote signature enforcement.

---

## Traceability & Compliance

- **Schema Package**: `@fuzit/schemas` (`packages/schemas/src/plugin/protocol.ts`)
- **SDK Package**: `@fuzit/plugin-sdk` (`packages/plugin-sdk`)
- **Checkpoints**: `V1-100`, `V1-101`

## Reference fixtures

`examples/plugins/reference` demonstrates a harmless deterministic renderer and
profile implemented only through `@fuzit/plugin-sdk`. Its output sorts paths and
warnings before serialization and requests no filesystem, network, shell, or
persistence access.

`examples/plugins/intentional-failure` is a sanitized isolation fixture. Its
renderer always fails with the attributable `REFERENCE_PLUGIN_FAILURE` code so
host failure behavior can be tested without secrets, external processes, or
network access.

The plugin attack suite exercises schema rejection, protocol mismatch, path
traversal, oversized frames, crashes, timeouts, and cancellation. A failed
request remains isolated from the next transaction, while filesystem, network,
and shell operations stay denied unless explicitly granted.

## SDK and capabilities

`@fuzit/plugin-sdk` is the only supported authoring boundary. A plugin uses
`parsePluginManifest` and `createPlugin`, then supplies a handler for every
declared capability. V1 capability tokens are `provider`, `parser`, `collector`,
`renderer`, `policy`, `profile`, `secret-detector`, `ranker`, and
`graph-enricher`. The host rejects an undeclared request or a manifest whose
declared capability has no handler.

The host launches the contained entry point as an argument-array Node child
process with `shell: false`. It performs a versioned handshake before execution,
then exchanges only schema-validated `fuzit-plugin-v1` frames. Cancellation,
diagnostic, and shutdown messages are part of that protocol. A request defaults
to a 10-second execution bound; framing is capped at 16 MB. Shutdown first asks
the worker to exit and then terminates owned work if it does not respond.

## Local inspection and enablement

```text
fuzit plugin list --json
fuzit plugin inspect <plugin-path-or-id>
fuzit plugin validate <manifest-path>
fuzit plugin enable <plugin-id>
fuzit plugin disable <plugin-id>
fuzit plugin doctor
```

Discovery is local and deterministic. Validate schema, protocol, host-version
compatibility, entry-point containment, and integrity metadata before reviewing
the complete permission audit from `inspect` or `enable`. Enablement does not
grant undeclared authority: missing filesystem, network, shell, environment,
credential, process, and persistence permissions remain denied. Treat shell,
write, host, environment, or persistence requests as high-risk and enable only
after reviewing the plugin source and exact scope.

Invalid manifests, incompatible protocols, missing capabilities, oversized or
malformed frames, timeouts, cancellation, and worker crashes fail closed with an
attributable bounded diagnostic. One failed request cannot authorize or corrupt
the next host transaction. Plugin diagnostics pass through the same redaction
boundary as built-in output.

## Build the reference plugin

The repository's `examples/plugins/reference` fixture compiles through the
public SDK in `pnpm test:plugins`. It requests no filesystem, network, shell, or
persistence permissions and produces byte-stable sorted output. The neighboring
intentional-failure fixture demonstrates attributable failure without secrets,
external processes, or network access.

## Distribution policy

Fuzit V1 has no plugin marketplace, registry search, remote installer, or
automatic update mechanism. Fuzit never downloads or executes a plugin by name.
Use only locally reviewed source supplied through an owner-approved channel;
validation and enablement are not endorsements and do not authorize publication.

Plugin contributions must follow [`CONTRIBUTING.md`](../../CONTRIBUTING.md), use
only the public SDK, request minimum authority, and include deterministic isolation,
failure, timeout, cancellation, and redaction evidence. No contribution mechanism
is active until the owner approves the final license and contribution terms.
