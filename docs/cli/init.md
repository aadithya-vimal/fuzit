# Init

`fuzit init --dry-run` previews every approved repository-local change without
writing files. Review this output before running `fuzit init`.

Initialization may:

- create `fuzit.config.json` with the documented built-in defaults; and
- create or append `.gitignore` entries for `.fuzit/`, `.fuzit-index/`, and
  `.fuzit/local/`.

Existing compatible configuration is preserved. An incompatible
`fuzit.config.json` stops initialization before any write; use `--force` only
when replacing it is intentional. Existing `.gitignore` content is preserved,
and missing approved entries are appended once.

Initialization is idempotent. A second run reports `No changes.` It does not
install packages, commit changes, access the network, or create an index.
