# V1 known limitations and residual risks

The machine-readable risk register is `residual-risks.json`. Every
warning, partial result, performance caveat, accepted limitation, and platform
difference has severity, mitigation, owner, evidence, and release-blocking
classification. `pnpm risks:check` rejects missing fields, blank evidence, and
any reviewed-ready status while a release-blocking risk remains open.

Java and Go support is bounded static analysis; dynamic/generated behavior and
toolchain execution are not claimed. Performance timings are host-specific and
only resource bounds, canonical equivalence, and relative incremental behavior
are gates. Windows clean-room success does not substitute for native Linux or
macOS evidence. The owner accepted that residual risk for V1: Linux evidence
remains explicitly WSL2-only, while native-host Linux and native macOS are
experimental and community-validation-pending.

Every register entry records severity, user impact, mitigation, support boundary,
and release-blocking status. Internal future-work planning is intentionally not
part of the public source tree.
