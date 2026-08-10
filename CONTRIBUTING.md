# Contributing to Fuzit

Fuzit remains a private, unpublished V1 candidate. This workflow prepares the
owner-approved DCO contribution model; its presence does not yet invite public
submissions or authorize publication.

## Before contributing

- Use an owner-approved repository channel and disclose any employment, customer,
  or contractual restriction that could affect contribution rights.
- Never include credentials, private repository content, customer data, generated
  context bundles, private hostnames, or proprietary third-party code.
- Report vulnerabilities using [`SECURITY.md`](SECURITY.md), never an issue or PR.
- Keep changes bounded, deterministic, local-first, and network-denied by default.

## Contribution terms

Contributions to the eventual public project are accepted under MIT using Developer
Certificate of Origin (DCO) sign-off. Contributors retain copyright; no CLA or
copyright assignment is required for V1. Public issues, forks, and pull requests
remain inactive until release authorization. See the
[contribution terms decision](docs/decisions/CONTRIBUTION-TERMS.md).

## Pull-request evidence

Every proposed change must include:

1. a narrow problem and scope statement;
2. tests for success, failure, determinism, and relevant security boundaries;
3. the exact local verification commands and honest results;
4. compatibility, schema, privacy, dependency, and documentation impacts;
5. confirmation that no generated output, credential, private data, or unrelated
   change is included.

Run the applicable local gates; hosted CI is neither required nor maintained:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm audit:licenses
pnpm audit:history
pnpm audit:disclosure
git diff --check
```

## Plugin contributions

Plugin changes must use `@fuzit/plugin-sdk`, declare the minimum capabilities and
permissions, keep network/shell/persistence denied unless explicitly justified, and
include isolation, malformed-input, timeout, cancellation, redaction, and deterministic
output tests. Fuzit does not accept bundled third-party plugins or marketplace links.

## Conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Maintainers
may reject changes that lack provenance, evidence, security boundaries, or compatible
terms even when the implementation works.
