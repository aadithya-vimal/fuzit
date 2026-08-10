# Local verification

Fuzit development is verified entirely on the developer machine. Hosted CI is
not required before or after a push, and the repository contains no GitHub
Actions workflow. This policy supersedes historical CI references in completed
implementation runbooks and checkpoint evidence; those records remain
unchanged as historical evidence.

Use the narrowest deterministic gate that matches the work:

```text
pnpm verify:checkpoint
pnpm verify:phase
pnpm verify:release
pnpm verify:all
```

- `verify:checkpoint` runs build, formatting, lint, typecheck, repository tests,
  goldens, checkpoint verification, and Git whitespace verification.
- `verify:phase` adds incremental, watcher, analysis, intelligence, retrieval,
  graph, MCP, security, committed-content secret scanning, privacy, and
  package-smoke gates.
- `verify:release` adds private acceptance and release-policy checks.
- `verify:all` adds index and retrieval benchmarks to the release gate.

The commands fail fast, invoke only cross-platform Node and pnpm entry points,
and finish with `git diff --check`. They do not publish, deploy, create tags, or
change repository visibility. Cross-platform claims require the same local gate
to be executed on each supported operating system and the observed evidence to
be recorded in the applicable checkpoint or release record.

The normal workflow is: implement, verify locally, commit, then push. Pushing
does not trigger or substitute for verification.
