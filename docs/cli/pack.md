# Pack

`fuzit pack --format markdown --output <path>` creates a local,
security-filtered Markdown context bundle. Use `--output -` for stdout and
`--dry-run` to inspect selected paths, redaction counts, and failed sources
without writing output.

Existing output files are never overwritten. Scanning, detection, budgeting,
and rendering are local and require no network access.

Repository intelligence is derived from security-filtered files and includes
detected languages, packages/workspaces, frameworks, tests, entry points, and
dependencies. A parser failure preserves successful facts and marks analysis
partial.

`--since <snapshot-id>` selects added, modified, and renamed files from the
actual snapshot delta. Unchanged unrelated files are omitted, while deleted
paths are represented as safe bundle warnings rather than content reads.
