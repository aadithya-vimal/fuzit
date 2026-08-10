# Known limitations and release blockers

## Mandatory release blockers

These are not accepted product limitations and must pass before publication can
be authorized:

- Genuine native-Ubuntu validation is missing; WSL2/Linux evidence is not a
  substitute.
- Genuine native-macOS validation is missing.
- Unified documentation integrity is owned by V1-149.
- V1-152 dependency-license auditing passed and remains mandatory; Fuzit now uses
  MIT, but publication stays blocked pending all release gates and authorization.
- Unified platform acceptance is owned by V1-160.
- Artifact verification is owned by V1-161.
- Release dry-run is owned by V1-162.
- Publication authorization remains false until explicit owner decisions and
  every mandatory release gate pass.

## Accepted bounded V1 behavior

- Static analysis supports only the languages, frameworks, and constructs in
  the [support matrix](../reference/support-matrix.md); unsupported facts degrade
  explicitly without repository execution.
- Secret detection is defense in depth, not proof that every novel credential
  is recognized. Sensitive paths and hard exclusions remain mandatory.
- Watchers provide reconciled final-state equivalence, not real-time event
  delivery. Graphs are bounded evidence and may be partial.
- Resource bounds may truncate or partially complete analysis rather than risk
  unbounded memory, output, or process duration.
- Fuzit cannot protect repository data from a compromised local operating
  system or make user-added support attachments safe.
- V1 has no plugin marketplace, public package installation, hosted service,
  telemetry, remote AI, or automatic update mechanism.

Bounded limitations must remain diagnosed and tested. They do not authorize raw
fallbacks, unsafe overrides, wider permissions, publication, or fabricated
platform evidence.
