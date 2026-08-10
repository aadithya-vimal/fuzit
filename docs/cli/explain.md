# Explain

`fuzit explain selection <report>` renders every recorded selection decision.
`fuzit explain path <path> <report>` focuses on one canonical path. Global
`--json` returns the same evidence as structured data.

Explanations are derived from the recorded outcome, reason, profile, score
contributions, budget removal, and tie-break fields. They are not reconstructed
as post-hoc prose.
