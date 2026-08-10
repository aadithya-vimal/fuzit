# License strategy decision record

**Status:** MIT approved by owner; application deferred to V1-159
**Recorded:** 2026-08-09  
**Current repository license:** MIT

## Decision to make

Fuzit needs an owner-approved public licensing strategy before any publication.
This record compares two standard open-source choices with the current proprietary
alternative. It is product planning, not legal advice. Counsel should review the
selected text and the ownership of all contributions before it is applied.

## Options

| Criterion                | MIT                                                                                                                 | Apache License 2.0                                                                                                       | Proprietary, all rights reserved                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Patent terms             | No express patent grant or patent-termination clause.                                                               | Express contributor patent grant with defensive termination.                                                             | No patent permission unless an agreement expressly grants it.                                                                 |
| Commercial use           | Permitted, including modification, redistribution, and proprietary combinations, subject to notice retention.       | Permitted, including modification and redistribution, subject to license, notice, and change-marking requirements.       | Forbidden by default; available only under a separate owner agreement.                                                        |
| Contributions            | Requires a contribution policy; inbound contributions are normally accepted under the project's outbound MIT terms. | Section 5 provides a default contribution treatment unless a separate agreement says otherwise.                          | Requires an explicit contributor or assignment agreement before outside work is accepted.                                     |
| Dependency compatibility | Broadly compatible with permissive dependencies; copyleft and non-standard terms still require review.              | Broadly compatible with permissive dependencies; NOTICE handling and GPL version compatibility require review.           | Does not cure third-party obligations; every distributed dependency still needs compatible redistribution rights and notices. |
| Product strategy         | Maximizes adoption with the lowest compliance overhead, but provides no explicit patent protection.                 | Supports broad adoption while giving users and contributors a clearer patent covenant; compliance is moderately heavier. | Maximizes owner control and private commercialization, but prevents open-source adoption and community redistribution.        |

## Approved direction

Apply **MIT** for Fuzit V1. The owner intentionally selected its low-friction,
permissive terms and accepts that they allow commercial use, modification,
redistribution, forks, private modification, and proprietary downstream products.
The alternatives remain documented above as decision history, not open options.

## Conditions before applying any option

1. The owner selection is recorded as MIT; V1-159 must apply it atomically.
2. Counsel reviews the selected license, copyright ownership, and contribution path.
3. V1-152 completes the dependency-license audit and resolves every incompatible,
   unknown, or notice-requiring dependency.
4. Package metadata, distributed license/notice files, documentation, artifacts,
   checksums, and SBOM are updated together and verified before publication.
5. `publicationAuthorized` remains `false` until every release blocker is closed.

## Owner decision

**Approved 2026-08-09: MIT.** The owner selected MIT for Fuzit V1, accepting its
permissive nature and competitive risks to avoid a copyleft adoption disadvantage.
Apache-2.0, GPL-3.0, AGPL-3.0, source-available terms, and dual licensing were not
approved. This decision does not authorize publication.

V1-159 applies canonical MIT text for Aadithya Vimal (2026) and aligns the four
approved distribution surfaces, topology, tests, and audit expectations. This legal
state does not make any package publishable and `publicationAuthorized` remains false.
