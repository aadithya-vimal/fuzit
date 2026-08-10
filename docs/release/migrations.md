# V1 migration and rebuild policy

## Private baseline to V1

Install the approved V1 CLI artifact over the private baseline only after
verifying its release manifest. Command names remain compatible; use
`fuzit --version` and `fuzit doctor --json` before processing a repository.
Configuration stays in declarative `fuzit.config.json`; JavaScript configuration
is never executed. `fuzit init` preserves a compatible file, reports a conflict
for incompatible content, and replaces it only when the user explicitly passes
`--force`.

## Reader compatibility

V1 context bundles, selection reports, snapshots, graph records, configuration,
and the local incremental index use schema version 1. Readers accept version 1
and reject unsupported future major versions rather than guessing or rewriting
them. Graph files are inputs to `fuzit graph stats --input <file>` and remain
read-only. A config or scanner identity change invalidates derived index state;
it does not modify repository source files.

## Inspect and rebuild local state

Run these commands from the repository that owns the local state:

```text
fuzit cache status --root . --json
fuzit cache verify --root .
fuzit cache rebuild --root . --dry-run
fuzit cache rebuild --root .
```

The dry-run reports the exact invalidation decision and affected record types.
The final command recreates only the Fuzit-owned derived index from authoritative
local repository content and effective configuration. When the index cannot be
trusted, `fuzit context --root . --task "..." --no-index` bypasses it. To remove
derived state instead, preview `fuzit cache purge --root . --dry-run` before
running the same command without `--dry-run`.

## No silent migration

Persistent source-of-truth data is never silently migrated. Missing, malformed,
obsolete, or identity-mismatched index metadata produces `rebuild-required`;
newer schema versions produce `unsupported-future-version` and refuse writes or
conversion. Compatible version-1 readers leave stored data unchanged. Any
future automatic migration must be explicitly named, tested, and recorded in a
release manifest; otherwise rebuilding is mandatory.

## Rollback limits

Rollback restores the previous CLI binary but cannot make an older reader
understand artifacts written with a newer schema. Keep source repositories and
user-authored configuration as the rollback authority; never copy a newer index
over an older installation. After rollback, purge/rebuild derived local state
with the older CLI. Snapshots, context bundles, reports, or graph exports needed
for audit should be retained separately and opened only by a compatible reader.
No release procedure promises downgrade conversion or restoration of discarded
derived cache data.
