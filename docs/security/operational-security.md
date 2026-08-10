# Operational security, privacy, and support

Fuzit treats repository paths and bytes, Git data, configuration, indexes,
watcher events, integration clients, plugins, logs, archives, and release inputs
as hostile. Its primary disclosure boundary is the shared security pipeline:
canonical path confinement, policy evaluation, bounded acquisition, credential
detection, redaction or omission, then bounded serialization.

## Secrets and sensitive paths

High-risk paths are denied before their contents are opened. Built-in rules
cover `.env` variants, private keys, key/certificate stores, credential files,
and common cloud configuration. Hard exclusions cannot be overridden. An
additional sensitive-path rule requires both an explicit allow and unsafe
acknowledgement; never add one merely to make a scan complete.

Detectors recognize common tokens, credential-bearing URLs, JWT-like values,
and private-key blocks in otherwise allowed text. Findings store classification,
bounded location, confidence, and an irreversible fingerprint, never the matched
value. Detected material is redacted or omitted before selection, persistence,
rendering, logs, diagnostics, MCP, editor, plugin, support, or artifact output.

Detection is defense in depth and cannot guarantee finding every secret. Binary,
truncated, unreadable, or unavailable content is not claimed as inspected. If a
real credential appears anywhere, stop sharing output, revoke and rotate it,
preserve private evidence, and inspect history and artifacts. Deleting a file or
rewriting history does not revoke a credential.

## Network and telemetry defaults

Default CLI, indexing, analysis, graph, rendering, MCP stdio, VS Code, support,
and verification paths make no network requests. There is no telemetry,
analytics, update check, remote tokenizer, cloud AI, source upload, or silent
fallback. Explicit provider or future publication operations are separate
capabilities requiring their own authorization; a local command never gains
network authority because another integration has it.

## Logs, diagnostics, and support previews

Human diagnostics use stderr; machine diagnostics use structured stdout. Both
are bounded, sanitized, and centrally redacted. Debug mode may add stack context
but does not authorize raw configuration, environment, repository content, or
credentials. Review output before sharing because novel sensitive formats and
machine metadata remain residual risks.

Generate support evidence only as a local preview:

```text
fuzit support --preview
```

The preview is deterministic, metadata-only, and not written or uploaded. It
contains product version and allowlisted check status without source content,
environment dumps, absolute repository paths, Git remotes, or credentials.
There is no support-upload command. Add no manual attachment until it has been
reviewed and redacted separately.

## Unsafe overrides

Unsafe acknowledgement is narrow: it may permit an explicitly named sensitive
path after policy evaluation. It does not override repository confinement, hard
exclusions, size limits, secret redaction, renderer custody, network denial, or
no-execution rules. Prefer a synthetic reproduction over any override. Record
the exact path and reason, remove the override after use, and never commit it.

## Report a vulnerability privately

Do not disclose a suspected vulnerability in a public issue, discussion, log,
fixture, support bundle, or commit. Contact the private repository owner using
the established private channel. Include the affected version and surface, a
minimal inert reproduction, expected and observed behavior, and impact. Exclude
real credentials, repository source, absolute machine paths, and exploit data
unnecessary to reproduce the issue.

Confirmed traversal, symlink escape, repository code execution, secret leakage,
undeclared network or plugin authority, untrusted-workspace execution, artifact
substitution, or unauthorized publication blocks release. Rotate exposed
credentials before remediation and add a synthetic regression test with the fix.

## Residual limits

Fuzit cannot protect data from a compromised local operating system, guarantee
all secrets are detected, prove every heuristic graph relation, or make hostile
manual attachments safe. False positives can omit useful context. Resource
limits and cancellation can produce explicit partial results. These limits never
permit falling back to raw content or silently broadening authority.

See the full [threat model](threat-model.md), [sensitive-path rules](sensitive-paths.md),
[redaction model](redaction-model.md), and [network policy](network-policy.md).
