# Example Context Bundle

This compact example illustrates the semantic shape; it is not the final schema.

```json
{
  "schemaVersion": "0.1.0",
  "bundleId": "fuzit:bundle:sha256:…",
  "createdBy": { "fuzitVersion": "0.1.0", "mode": "static" },
  "task": "Fix checkout timeout after retry refactor",
  "profile": { "id": "bug-fix", "version": "1" },
  "policy": {
    "id": "workspace-default",
    "network": "denied",
    "secretHandling": "redact"
  },
  "sources": [
    { "id": "local:repo", "revision": "git:abc123+dirty", "status": "complete" },
    { "id": "runtime:test", "observedAt": "2026-07-28T08:00:00+05:30", "status": "complete" }
  ],
  "budget": {
    "maxTokens": 24000,
    "estimatedTokens": 18320,
    "serializedBytes": 311204
  },
  "items": [
    {
      "id": "file:src/checkout/retry.ts",
      "type": "file",
      "locator": "src/checkout/retry.ts",
      "revision": "sha256:…",
      "lifecycle": { "state": "active", "basis": "parsed-and-referenced" },
      "provenance": [{ "source": "local:repo", "method": "filesystem-read" }],
      "selection": {
        "score": 0.94,
        "reasons": ["exact task symbol", "modified in recent commit", "called by failing test"]
      },
      "sensitivity": "normal",
      "contentMode": "full",
      "content": "…"
    }
  ],
  "redactions": [
    { "item": "file:.env.example", "kind": "credential-pattern", "count": 1 }
  ],
  "omissions": [
    { "item": "file:coverage/lcov.info", "reason": "generated-and-budget" }
  ],
  "diagnostics": [],
  "partial": false
}
```

## Interpretation

The bundle distinguishes static revision identity from volatile observations, records policy and profile versions, explains every selected item, and accounts for redaction and omission. A renderer may present this information differently, but it must not remove the underlying meaning. Real schemas should use canonical ordering, strict validation, content hashes, and structured confidence rather than relying on the illustrative numeric score alone.
