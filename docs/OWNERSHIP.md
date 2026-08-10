# Documentation ownership and normative custody

Public documentation explains observed V1 behavior. Normative requirements remain
under `specs/`; implementation plans and checkpoint evidence are not public-user
documentation. When prose conflicts, the linked specification owns the contract.

| Public area                | Documentation owner      | Normative specification custody              |
| -------------------------- | ------------------------ | -------------------------------------------- |
| Getting started and guides | CLI/product maintainers  | `specs/01-product`, `specs/03-cli`           |
| Reference and formats      | CLI/schema maintainers   | `specs/03-cli`, `specs/04-features`          |
| Concepts                   | Architecture maintainers | `specs/02-architecture`                      |
| Security                   | Security maintainers     | `specs/05-engineering`                       |
| Integrations               | Integration maintainers  | `specs/02-architecture`, `specs/04-features` |
| Troubleshooting            | Product maintainers      | `specs/01-product`, `specs/05-engineering`   |
| Release policies           | Release owner            | `docs/release`                               |

Every change must update the public page and its owning normative contract together
when product behavior changes. Editorial clarification alone must not restate or
silently replace a normative rule.
