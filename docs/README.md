# Fuzit documentation

This is the public documentation entry point for Fuzit's private V1 candidate.
Normative product and engineering requirements remain in [`specs/`](../specs/README.md);
these pages explain how to use the implemented product without duplicating those contracts.

| Area             | Start here                                   | Purpose                                 |
| ---------------- | -------------------------------------------- | --------------------------------------- |
| Getting started  | [Getting started](getting-started/README.md) | Installation and first local workflow   |
| Guides           | [Guides](guides/README.md)                   | Task-oriented workflows                 |
| Reference        | [Reference](reference/README.md)             | Commands, formats, and configuration    |
| Concepts         | [Concepts](concepts/README.md)               | Architecture and deterministic behavior |
| Security         | [Security](security/README.md)               | Privacy, trust, and threat boundaries   |
| Integrations     | [Integrations](integrations/README.md)       | MCP, VS Code, and plugins               |
| Troubleshooting  | [Troubleshooting](troubleshooting/README.md) | Diagnosis and recovery                  |
| Release policies | [Release policies](release/README.md)        | Private artifact and publication gates  |

Navigation order is machine-validated from [`navigation.json`](navigation.json),
and documentation/specification custody is recorded in [`OWNERSHIP.md`](OWNERSHIP.md).

The production documentation site is built and checked entirely locally:

```bash
pnpm docs:build
pnpm docs:check
pnpm test:docs
```

The build uses only repository-local assets, performs no deployment, and includes
no analytics or tracking scripts.
