# Local index baseline

`pnpm benchmark:index` runs deterministic cold/warm equivalence, crash
recovery, privacy-safe path, moved-repository, and index-disabled checks.
Timings are recorded as local observations only; they are not marketing
thresholds.

The compatibility gate is semantic equality: enabling the local index may skip
safe acquisition work but must not change logical scan or bundle output. The
index remains local, rebuildable, and zero-service. No daemon, watcher, server,
API, or background process is part of this baseline.
