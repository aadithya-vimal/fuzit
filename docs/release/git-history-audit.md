# Complete Git history audit

V1-154 uses the offline `fuzit-history-audit/1` scanner across every reachable Git
commit and blob. It emits counts and truncated SHA-256 fingerprints only; matched
source, credentials, paths, and hostnames are never printed or persisted.

The audit fails closed for private-key material, GitHub tokens, and AWS access keys.
Private/internal hostname references are retained only as hashed review findings.
Blobs larger than 5 MiB are counted for manual provenance and disclosure review.

Credential-shaped content is allowlisted only when Git history attributes it to
`packages/security/test/detectors.test.ts` or `scripts/history-audit.test.mjs`;
these bounded synthetic detector fixtures contain no real credential. Identical
content in any other path remains blocking.

Manual review must classify every nonzero private-host or large-blob count as
resolved, a documented fixture/false positive, or a publication blocker. Employer,
customer, proprietary-code, and asset-rights review remains an owner/legal judgment;
automated zero findings must never be represented as legal clearance.

## V1-154 observed review

- Audited baseline: `a02b9f86c3b14d1ef30593402ee77c2757d99145`, 414 reachable commits.
- High-confidence secrets: 0 unresolved.
- Approved private-key fixtures: 2 historical patch findings, both confined to
  `packages/security/test/detectors.test.ts` and manually confirmed synthetic.
- Private-host references: 5 historical patch findings. They are confined to the
  three checkpoint schema files, `packages/core/src/environment/doctor.ts`, and
  `tests/security/network/network.test.ts`; manual review classified them as schema,
  diagnostic, and network-denial fixtures rather than private infrastructure.
- Blobs larger than 5 MiB: 0.
- Employer/customer data and proprietary third-party source: no automated finding;
  owner/legal disclosure review remains mandatory because tooling cannot prove
  contractual provenance.

Every automated finding is therefore resolved or documented as a bounded false
positive. No raw matched value is included in this record.
