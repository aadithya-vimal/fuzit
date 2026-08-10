# V1 threat model

Fuzit treats repositories, configuration, Git output, persisted indexes,
watcher events, MCP clients, editor clients, plugins, logs, archives, and
release inputs as hostile. Repository content crosses a disclosure boundary
only after canonical path checks, policy evaluation, secret filtering, and
bounded serialization. Optional adapters fail locally and never authorize a
different surface.

## Trust boundaries

1. **Host to repository:** names, links, bytes, Git metadata, configuration,
   and change events are untrusted input; repository code is never executed.
2. **Pipeline to persistence:** only versioned normalized records cross into
   indexes, caches, snapshots, graphs, or artifacts; raw ASTs and source bytes
   are not durable state.
3. **Core to disclosure adapters:** CLI, MCP, VS Code, renderers, support
   bundles, and plugins receive security-filtered data with bounded diagnostics.
4. **Host to child process:** Git and plugin workers use executable/argument
   arrays, restricted custody, timeouts, cancellation, and bounded output.
5. **Local host to network or publication:** network is denied by default;
   publication remains a separate owner-authorized action.

## Threat traceability

Every critical row names an attacker goal, its controls, executable evidence,
the owning surface, residual risk, and the condition that blocks release.

| ID    | Surface                                           | Attacker goal                                                                          | Controls                                                                                                               | Tests                                                                           | Owner evidence                   | Residual risk                                        | Release blocker                                                           |
| ----- | ------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| TM-01 | discovery and configuration                       | Escape the repository or load executable configuration                                 | canonical realpaths, root confinement, schema-only configuration, symlink and traversal rejection                      | `tests/security/malicious-repository/malicious.test.ts`; discovery/config tests | discovery and config maintainers | filesystem races after observation                   | confirmed traversal, symlink escape, or repository code execution         |
| TM-02 | scanner and security filter                       | Smuggle credentials or high-risk bytes into a bundle                                   | sensitive-path exclusions, credential detectors, redaction before disclosure, bounded reads                            | security detector/path tests; `tests/security/network/network.test.ts`          | security pipeline maintainer     | novel secret formats may evade heuristics            | confirmed real-secret disclosure or policy bypass                         |
| TM-03 | incremental index and watcher                     | Poison durable state or make incremental output differ from full analysis              | versioned normalized records, atomic replacement, invalidation identity, overflow rescan, incremental/full equivalence | index, watcher, incremental, and golden tests                                   | index and watcher maintainers    | local state theft by an already-compromised host     | schema confusion, non-atomic corruption, or equivalence failure           |
| TM-04 | analysis and graph                                | Trigger code execution, unbounded parsing, unstable IDs, or source persistence         | non-executing parsers, resource bounds, deterministic normalization, no raw AST persistence                            | analysis, graph, performance, and golden tests                                  | analysis and graph maintainers   | parser implementation defects                        | repository execution, unbounded resource use, or raw AST persistence      |
| TM-05 | CLI and renderers                                 | Inject terminal controls or disclose filtered source through diagnostics               | structured diagnostics, terminal sanitization, deterministic bounded renderers                                         | CLI integration, renderer, golden, and adversarial tests                        | CLI maintainer                   | deceptive but inert Unicode text                     | credential leak, unbounded output, or control-sequence injection          |
| TM-06 | MCP server                                        | Escape an approved workspace, cross client state, or use the network                   | explicit roots, canonical confinement, per-session state, stdio transport, deny-by-default network                     | MCP security, workspace, cancellation, and parity tests                         | MCP maintainer                   | compromised local client can request authorized data | workspace escape, cross-session disclosure, or network access             |
| TM-07 | VS Code extension                                 | Cross workspace trust or leak content through logs and webviews                        | workspace trust checks, local CLI boundary, sanitized diagnostics, no telemetry                                        | extension trust, cancellation, and integration tests                            | extension maintainer             | editor extensions share a compromised host           | untrusted-workspace execution, telemetry, or content leakage              |
| TM-08 | plugin SDK and host                               | Gain undeclared permissions, escape paths, hang, crash, or corrupt another transaction | strict manifests, compatibility checks, out-of-process framing, permission broker, size/time bounds, cancellation      | `tests/plugins/attack-isolation.test.ts`; plugin protocol and permission tests  | plugin host maintainer           | operating-system sandboxing is not claimed           | permission bypass, orphan process, secret leak, or transaction corruption |
| TM-09 | logs, crash output, support bundles, and archives | Exfiltrate source, tokens, environment values, or unsafe archive paths                 | allowlisted metadata, redaction, archive traversal rejection, inert archive handling                                   | privacy audit, package smoke, security and artifact tests                       | release and security maintainers | user-added attachments may contain sensitive data    | source/token leakage or archive traversal                                 |
| TM-10 | packaging and release                             | Substitute artifacts, publish private state, or bypass owner authorization             | clean-tree checks, deterministic packing, provenance, private visibility state, explicit publication authorization     | package smoke, release check, acceptance, checkpoint verifier                   | repository owner                 | upstream registry or account compromise              | mismatched artifact, visibility change, or unauthorized publication       |

## Mitigation rules

- Security filtering is applied before every disclosure, even when acquisition
  performed an earlier policy check.
- Diagnostics retain codes and provenance but never require raw source content.
- Cancellation and resource-limit failures are explicit partial results; they
  do not silently broaden permissions or reuse a failed transaction.
- Test fixtures contain only inert synthetic credentials and cannot contact a
  remote service by default.
- A critical row without executable test evidence is itself a release blocker.

## Residual risk and response

Fuzit cannot guarantee detection of every credential or protect data from an
already-compromised local operating system. False positives can also reduce
bundle usefulness. These risks are accepted only while controls remain
explainable and users receive explicit diagnostics. Any confirmed blocker in
the table stops release until the owning surface adds a regression test and the
control passes the complete local verification suite.
