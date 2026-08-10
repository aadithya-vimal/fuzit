# Dependency license audit

The deterministic offline audit covers every external runtime dependency reachable
from distributable workspaces. The machine-readable evidence is in
[`dependency-license-audit.json`](dependency-license-audit.json).

| Dependency       | License    | Status  | Distribution obligation                                                     |
| ---------------- | ---------- | ------- | --------------------------------------------------------------------------- |
| Commander 15.0.0 | MIT        | Allowed | Preserve copyright and license notice.                                      |
| TypeScript 6.0.3 | Apache-2.0 | Allowed | Preserve license and applicable notices; mark modifications if distributed. |
| Zod 4.4.3        | MIT        | Allowed | Preserve copyright and license notice.                                      |

Manual review found no copyleft runtime dependency and no native or WASM runtime
asset. Development-only packages are excluded from distributable dependency scope.
The product's own pending license decision remains separate: dependency compatibility
does not authorize publication. V1-159 separately applies MIT to approved Fuzit distribution surfaces.
