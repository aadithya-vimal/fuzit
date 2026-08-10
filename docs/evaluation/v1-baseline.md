# Task-aware CLI v1 baseline

The context and selection-report schemas are frozen at version 1. The offline
authentication fixture currently measures precision, recall, nDCG, and MRR at
1.0 with one selected file. Regression thresholds are 0.999, allowing only
floating-point noise rather than a material quality drop.

Ablations independently disable lexical, Git, dependency, and profile
contributions. Coverage includes small, medium, and monorepo classifications;
TypeScript, Python, and Markdown candidates; constrained token budgets; and
equivalent indexed/direct candidate inputs.

## Limitations

- The initial measured fixture set is intentionally small.
- Retrieval quality does not establish downstream agent success.
- Latency is reported but is not a deterministic regression threshold.
- Git, dependency, and profile weights need broader private-alpha calibration.
