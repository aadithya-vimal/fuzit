# Platform compatibility

The supported V1 validation baselines are Windows 11 24H2, Ubuntu 24.04 LTS,
and macOS 14 Sonoma. Each platform runs the same deterministic local commands;
hosted CI is not a prerequisite or source of truth. Node 24.x LTS and pnpm
11.9.0 are required. Git 2.40 or newer is assumed, with long-path support
enabled when a Windows repository needs it.

Paths are canonicalized to repository-relative forward-slash form. Arguments are
passed without shell reconstruction, repository text uses LF, and symlink tests
recognize that Windows creation may require developer-mode privileges. The
current index package has no native SQLite dependency; local verification
audits this packaging fact so a future native dependency cannot be introduced
without explicit cross-platform evidence.

Canonicalization removes redundant separators and dot segments while preserving
the original segment case. Case-only collisions and renames therefore remain
distinct inputs for policy and diagnostics even on a case-insensitive host.
Absolute paths, repository escapes, and Windows drive/root mismatches fail with
structured path errors rather than being coerced into repository identities.
Long paths, spaces, non-ASCII names, and emoji are preserved without display or
argument truncation. Windows installations may still require long-path support
for host filesystem operations. macOS filesystems may expose canonically
equivalent Unicode names in different normalization forms; Fuzit preserves the
observed spelling and does not silently merge distinct directory entries.

Unsupported edge cases include filesystems that cannot provide stable Unicode
names, platforms outside Node's supported set, and repositories requiring
privileged symlink traversal.

Permission failures retain their host error codes (`EACCES`, `EPERM`, or
`EROFS`) for actionable diagnostics. Active writer locks are never replaced;
stale locks are replaced narrowly, and cleanup removes only Fuzit-owned lock or
temporary paths. Windows read-only attributes and POSIX write bits are distinct
host capabilities and are tested according to their native semantics.

Native watcher backends may emit different intermediate event shapes for a
rename or editor atomic save. Fuzit normalizes those events and treats overflow
as uncertainty requiring a clean reconciliation scan. The supported semantic
contract is the deterministic final canonical state, not host-specific event
counts or ordering.

Cancellation uses `AbortSignal` at application boundaries and direct child
process termination without shell mediation. Windows and POSIX may report
different native termination signals or exit codes; Fuzit preserves the common
semantic outcome (`cancelled`, CLI exit 130), releases owned locks, stops
extension watchers, and leaves no Fuzit-owned child running.

The CLI, MCP stdio server, graph, context engine, watcher, and plugin host are
supported on all three baselines. The VS Code extension additionally requires
VS Code 1.90 or newer. Symlink creation is optional on Windows when Developer
Mode or equivalent privilege is unavailable; detection must degrade safely.

Support for a Node major is removed only in a documented major release after
at least one release-cycle notice. An operating-system baseline may move after
its vendor support window ends, with the new baseline recorded and locally
verified before the compatibility claim changes.

On a native Windows host, `pnpm verify:windows-native` runs the complete Windows
gate locally. It refuses non-Windows hosts and does not use GitHub Actions. Its
temporary package artifacts remain under `.cache/windows-native` and are
removed after the gate completes. Test and acceptance fixtures continue to use
the operating-system temp directory so they cannot inherit the repository's
Git identity.

Ubuntu 26.04 LTS under WSL2, using a repository clone on the Linux filesystem,
has passed the Linux compatibility matrix with Linux-native Node and pnpm.
This evidence demonstrates WSL2/Linux compatibility only. It is not bare-metal
or otherwise genuine native-Ubuntu release evidence, which remains mandatory
before publication can be authorized.
