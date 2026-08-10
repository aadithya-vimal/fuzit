# V1 rollback plan

This plan prepares recovery but authorizes no publication, registry, marketplace,
Git, documentation, or advisory mutation. The release owner opens a private
incident, freezes the guarded workflow, identifies the exact defective manifest
and artifact hashes, and assigns the owners below before any external action.

## Decision owners

| Decision                                        | Required owner           |
| ----------------------------------------------- | ------------------------ |
| Freeze, replacement selection, and completion   | Release owner            |
| Vulnerability severity and advisory timing      | Security owner           |
| npm deprecation or replacement                  | Verified registry owner  |
| VSIX withdrawal or replacement                  | Verified publisher owner |
| Forward revert and branch custody               | Repository owner         |
| Documentation withdrawal notice                 | Docs owner               |
| Schema compatibility and derived-state recovery | Data owner               |

No person inherits another owner's authority. External mutations require the
same explicit authorization and credentials as the guarded release workflow.

## Package and extension rollback

1. Deny new use of the defective hashes in the internal release record. Retain
   the manifest, provenance, SBOM, checksums, and synthetic reproduction.
2. Select and re-verify the last compatible artifact. Never silently replace a
   file under the same version or checksum.
3. If separately authorized, the registry owner deprecates the defective npm
   version and points users to the verified replacement. Unpublishing is not the
   default because it breaks reproducibility and dependency resolution.
4. If separately authorized, the publisher owner withdraws the defective VSIX
   and restores a prior verified version. Users must be told which extension
   version and VS Code engine are compatible.

## Repository and documentation rollback

Prepare a forward revert commit from the defective source commit; do not force
push, delete tags, rewrite shared history, or change visibility. Run acceptance,
artifact, provenance, privacy, and dry-run gates on the replacement. Prepare a
documentation withdrawal banner that names affected versions, safe versions,
impact, detection, upgrade/downgrade guidance, and data-handling instructions.
Keep withdrawn documentation available for audit unless legal or security owners
explicitly require narrower access.

## Persistent state and schema recovery

Never delete or overwrite a user repository, user-authored configuration, or
unrelated cache location. First run `fuzit cache verify --root .`, then preview
`fuzit cache purge --root . --dry-run`. For an incompatible index, purge only
the exact Fuzit-owned derived directory and run `fuzit cache rebuild --root .`
with the selected compatible CLI. Older readers must not open or convert newer
snapshots, bundles, graphs, or indexes. Retain audit artifacts separately and
follow the migration policy; no downgrade conversion is promised.

## Revoked artifacts and advisory communication

A revoked artifact is denied for new installs but its identity and evidence are
retained. Local copies are treated as untrusted and must not be re-signed or
renamed. Security communication stays private until the security and release
owners approve coordinated disclosure. The notice uses synthetic evidence,
states affected and fixed versions, remediation, persistent-state impact, and
credit preference, and contains no credentials, private source, personal data,
machine paths, logs, indexes, or context bundles.

## Completion criteria

The replacement is complete only after all applicable gates pass, affected
surfaces expose the approved safe version, advisory guidance is consistent, and
the release owner records the decision. `pnpm release:rollback-plan --
<incident.json>` produces the deterministic tabletop plan and performs zero
external actions.
