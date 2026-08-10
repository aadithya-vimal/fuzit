# Security Policy

Fuzit is under private development. Do not disclose suspected vulnerabilities
in public issues, discussions, logs, or committed files. Report them privately
to the repository owner with a minimal reproduction that contains no real
credentials or private repository content.

## Private Development Rules

- Never commit credentials, tokens, private keys, environment files, local
  indexes, generated context bundles, or private runtime output.
- Use only inert synthetic values in tests and documentation.
- Keep telemetry and silent network access disabled.
- Treat repositories and configuration as untrusted input.
- Run the local secret scan before submitting changes:

  ```text
  pnpm exec secretlint '**/*' --secretlintignore .gitignore
  ```

Secret scanning reduces risk but cannot guarantee detection of every secret.
If a real credential is committed, revoke and rotate it immediately; deleting
the file or rewriting Git history is not sufficient by itself.

The V1 trust boundaries, attack surfaces, controls, executable evidence,
residual risks, and release blockers are maintained in
[`docs/security/threat-model.md`](docs/security/threat-model.md). A critical
threat without mapped test evidence blocks release.

## Supported versions

Fuzit has no public release. Only the current private `v1-completion` candidate is
eligible for coordinated security review; older commits and prerelease artifacts,
and unapproved builds are unsupported. Runtime, operating-system, issue, surface,
deprecation, and privacy boundaries are defined in the
[V1 support policy](docs/release/support-policy.md). This is a private candidate
policy and does not authorize publication or promise a public support service.

## Private reporting process

No public security address or intake URL has been approved. Obtain the private
reporting channel directly from the repository owner. If no approved private channel
is available, retain the minimum encrypted report locally and do not open an issue,
PR, discussion, or third-party ticket containing vulnerability details.

Include the affected command/package and version or commit, impact, prerequisites,
minimal synthetic reproduction, and proposed mitigation. Remove tokens, personal
data, private source, absolute user paths, hostnames, remote URLs, logs, indexes, and
context bundles. Use placeholders and hashes where identity is needed.

## Response and disclosure coordination

The prepared targets are acknowledgement within three business days and initial
triage within seven business days. These are response goals, not a bounty or legal
promise. The owner coordinates severity, remediation, regression evidence, affected
versions, advisory text, credit or anonymity, and a disclosure date with the reporter.
Do not disclose before a fix and safe upgrade path are available unless applicable
law or immediate user protection requires otherwise.

An advisory workflow remains private and inactive: reproduce safely, assign a private
tracking identifier, contain exposure, rotate any real credential, patch, add a
non-sensitive regression test, run security/privacy/release gates, prepare remediation
and attribution text, obtain owner approval, then publish only with the authorized
release. No GitHub Advisory, CVE request, or public notification is created by this
policy.
