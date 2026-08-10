# Risks and Mitigations

## Risk Register

| ID | Risk | Likelihood | Impact | Primary mitigation | Release trigger |
| --- | --- | --- | --- | --- | --- |
| R-01 | Secret or credential appears in an exported bundle | Medium | Critical | Sensitive-path denylist, layered detectors, redaction, adversarial corpus, sharing warning | Any confirmed unredacted real secret blocks release |
| R-02 | Incremental index diverges from a clean scan | Medium | High | Canonical full-scan oracle, dependency invalidation, schema/version cache keys, crash injection tests | Any unexplained canonical mismatch blocks incremental release |
| R-03 | Plugin or provider exfiltrates private code | Medium | Critical | Deny-by-default permissions, explicit network policy, process isolation, attributable audit events | Any bypass of permission broker blocks plugin/provider release |
| R-04 | Cross-platform path behavior changes bundle identity | Medium | High | Canonical repository-relative paths, identical native local gates, case-collision fixtures | Golden mismatch on supported platform blocks release |
| R-05 | Selection omits task-critical code | Medium | High | Required anchors, hybrid retrieval, graph expansion, benchmark fixtures, explanation review | Retrieval regression above accepted threshold blocks profile release |
| R-06 | Large monorepo exhausts memory | Medium | High | Streaming, bounded queues, file limits, metadata-only records, large synthetic benchmarks | Peak memory exceeds published bound |
| R-07 | Provider API changes break normalization | High | Medium | Capability discovery, contract tests, versioned adapter, graceful partial source | Local workflows must remain operational |
| R-08 | False confidence misleads users | Medium | High | Epistemic class and confidence basis, contradiction reporting, no bare scores | Inferred claim without basis is a correctness defect |
| R-09 | Private development history contains confidential data | Medium | Critical | Pre-commit controls, periodic scans, final full-history audit and manual review | Unresolved confidential history blocks public release |
| R-10 | Architecture over-expands before v1 | High | High | Goals/non-goals, staged roadmap, agent rules, milestone exit criteria | PR without current milestone justification is rejected |
| R-11 | Native parser dependencies reduce install reliability | Medium | Medium | Basic packaging independent of parser, optional packages, clear doctor diagnostics | Core scan must work without parser |
| R-12 | Debug/support artifacts leak content | Medium | High | Structured redacted logs, previewable local support bundle, no default crash upload | Secret-corpus log failure blocks release |
| R-13 | `.fuzit` format becomes proprietary lock-in | Low | High | Public schemas, documented archive layout, independent validators/readers | Format cannot require hosted Fuzit service |
| R-14 | Budget estimates differ from target tokenizer | High | Medium | Exact byte limits, selectable tokenizer adapters, disclose estimator/version | Never claim exact token count without tokenizer identity |

## Risk Governance

Each risk has an owner in the implementation repository, evidence links, current status, and next review date. Security/privacy risks are reviewed at every private release gate. Product and architecture risks are reviewed at phase boundaries. A mitigation is not complete because code exists; it requires a test, operational control, or documented user-facing behavior.

## Residual Risk Principles

Fuzit cannot guarantee detection of every secret, perfect semantic retrieval, complete static call graphs, or freshness of every external source. Residual risk must be disclosed in bundle warnings and release documentation. Unsafe overrides are allowed only when explicit, scoped, attributable, and recorded in the output manifest.
