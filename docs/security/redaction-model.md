# Redaction model

Security decisions are schema-versioned records. Findings identify a path,
bounded span, classification, confidence, and irreversible fingerprint; they
never carry the matched secret. Policy decisions select `allow`, `redact`,
`omit`, or `block`, and transformation records preserve the input/output hashes
and finding IDs.

Binary or unavailable content is omitted rather than treated as inspected.
Detection is defense in depth and does not claim complete credential coverage.
Selection, explain evidence, renderers, diagnostics, and output-file writes MUST
receive only security-filtered content and MUST NOT fall back to raw content
after a policy, detector, or read failure.
Git, parser, plugin, MCP, extension, release, doctor, CLI, and support output
share the central bounded redactor. `fuzit support --preview` produces a local,
deterministically ordered metadata-only preview: it contains no source content,
environment dump, absolute repository path, network action, or upload step.
