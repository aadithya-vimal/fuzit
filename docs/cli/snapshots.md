# Snapshots and deltas

`fuzit snapshot create --root <path>` records the available Git revision,
selection-relevant dirty state, the effective configuration hash, and sorted
repository-relative SHA-256 file fingerprints from the shared secure scanner.
Sensitive, ignored, generated-cache, and repository-metadata paths are not
fingerprinted.

Snapshot identity includes revision, relevant dirty state, configuration,
fingerprints, scanner/security/schema identity inputs, completeness, and safe
diagnostics. `createdAt` is metadata and does not affect the identity. Repeating
an unchanged snapshot therefore produces the same ID, while an included added,
modified, or deleted file changes the ID.

`fuzit diff <before> <after>` reports added, modified, deleted, renamed, and
unchanged repository-relative paths, configuration changes, and whether both
snapshots were complete. Non-Git roots use the same deterministic filesystem
identity without inventing a Git revision.
