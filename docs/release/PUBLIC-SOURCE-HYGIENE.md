# Public-source hygiene audit

Status: owner-approved public-source boundary applied. Publication remains paused
pending dependency-closure and final sanitized-tree verification. GitHub Actions
remain forbidden.

## PUBLIC

- Production and package source: `apps/`, `packages/`.
- Contributor tests and fixtures: `tests/`, `fixtures/`, package tests.
- Examples and public assets: `examples/`, `media/`.
- Public product, architecture, CLI, integration, security, privacy, reference,
  troubleshooting, engineering, evaluation, and release documentation under `docs/`.
- Reproducible benchmark inputs and checked baselines under `benchmarks/`.
- Contributor build, audit, packaging, documentation, and local release tooling
  under `scripts/` and `tooling/`.
- Manifests, lockfiles, schemas, configuration, governance, license, security,
  contribution, DCO-related, and legitimate release metadata.

## REMOVE

- `.fuzit-development/`, `.gh-development/`, `.v1-development/`: private
  checkpoint/state ledgers.
- `implementation-plan/`: private implementation and sprint runbooks.
- `docs/v1/`, `docs/implementation/checkpoint-protocol.md`, and
  `docs/engineering/private-development.md`: private sprint/process material.
- Private-alpha, feature-freeze, source-disclosure-review, guarded-workflow,
  and provider-completion records that existed only to manage the private sprint.
- Checkpoint/traceability/private-candidate scripts, tests, and verification
  wiring that depended on the removed ledgers.

## Owner-approved review disposition

Roadmap and agent-guidance specifications, planning and traceability appendices,
internal release evidence and readiness reports, internal backlog and launch
checklists, and legally sensitive logo/name-review materials were removed.
Tracked benchmark result JSON remains because regression tests require it;
generated changes must still be restored after benchmark runs.

## History

The removed paths remain in existing Git history. Observed path-touch counts:

- `.fuzit-development/`: 80 commits, first `9b0e6153ab7256527d61db1aa61ac28243d61146`, last `9a382b4a6456e9f7a85f4089153d3a1109ca3711`.
- `.v1-development/`: 265 commits, first `641ecf8d0309975b16e20b034ac37beb5fa1e867`, last `938452394ab42911f2500b582608a8efcbc351a4`.
- `.gh-development/`: 32 commits, first `18ca85882549befa119f1d60e9c773b0f976faa7`, last `fd39df203a1b3ba100c4f876464d45235c1f509a`.
- `implementation-plan/`: 11 commits, first `9b0e6153ab7256527d61db1aa61ac28243d61146`, last `bb5f93f6a499a2215da62256b27f5b3731565c3c`.

The repository history audit inspected 489 commits and found zero
high-confidence secrets and zero large blobs. Four secret-like findings were
approved security fixtures; nine private-host references were reviewed in
schemas, security tests, and local provenance identifiers. Current-tree
Secretlint also passed. No credential, token, secret, or genuinely confidential
personal-data finding currently makes history sanitization mandatory.

The owner selected a clean public-history strategy because hundreds of commits
retain private sprint ledgers and runbooks. The existing development repository
and its 489-commit history remain private and unchanged. A future public
repository must begin from the approved sanitized tree boundary; this task does
not create that repository.
