# Scan

`fuzit scan` is a read-only repository inspection command.

It supports `--paths`, `--metadata`, `--items`, `--content`, `--summary`,
`--json`, `--quiet`, and `--debug`. Use `--root <path>` to select the
repository.

Path and item output is emitted in canonical repository-relative order.
Repeated scans of unchanged input therefore produce identical output.

Progress is reserved for interactive terminals. It is suppressed for JSON,
quiet, and non-interactive output so stdout remains deterministic. Permission
failures preserve already emitted records and are reported as partial results.
Cancellation exits without converting the interruption into an internal error.
