# Default exclusions

Fuzit applies conservative, segment-exact exclusions before traversal reads
file content.

Hard safety rules cannot be bypassed by an explicit include:

- version-control internals: `.git`, `.hg`, `.svn`;
- dependency stores: `node_modules`, `.pnpm-store`, `bower_components`;
- Fuzit state: `.fuzit`, `.fuzit-index`.

Default rules exclude generated caches (`.cache`, `.turbo`), build output
(`dist`, `build`, `out`, `coverage`), and OS metadata (`.DS_Store`,
`Thumbs.db`, `Desktop.ini`). A later explicit include policy may opt into these
non-hard defaults.

Matching is by complete path segment. Names such as `node_modules_backup`,
`distribution`, and `builder` remain eligible.

Use `fuzit scan --explain-path <path> --json` to see the deciding rule. These
rules do not parse `.gitignore`, `.fuzitignore`, or file contents.
