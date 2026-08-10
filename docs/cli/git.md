# Local Git commands

Fuzit provides offline, bounded Git inspection:

- `fuzit git status --json`
- `fuzit git log --limit N --json`
- `fuzit git diff [--base REV] --json`
- `fuzit git file-history PATH --limit N --json`
- `fuzit git blame PATH --lines START:END --json`

Commands use argument arrays without a shell, disable credential prompts, never
contact remotes, sanitize credential-bearing URLs, and degrade to empty or
unavailable results outside Git repositories. History is capped at 100 commits,
diffs at 100 files/1 MiB, and blame at 500 lines.
