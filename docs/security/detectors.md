# Credential detectors

Fuzit performs local deterministic matching for common API-key assignments,
credential-bearing URLs, JWT-like values, private-key blocks, and bounded
high-entropy candidates. The sanitized corpus also covers split-line
assignments, bearer tokens, certificate blocks, connection strings, and
encoded-looking values, with hashes, UUIDs, and ordinary identifiers retained
as false-positive controls. Matched values are immediately replaced and only an
irreversible fingerprint, span, kind, and confidence are retained.

These detectors reduce obvious leakage but cannot prove that content is free of
secrets. They use no network lookup and never modify source files.
Precision and recall are measured against this internal synthetic corpus; the
result does not claim complete detection of real-world credentials.
