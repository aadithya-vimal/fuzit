# Retrieval evaluation

The offline benchmark format records a repository fixture, task, graded relevant
paths, optional symbol hints, token budget, selected paths, and a measured
baseline. The runner reports precision, recall, nDCG, MRR, bundle size, latency,
and regression status without network access.

These are retrieval metrics. They do not claim or approximate downstream agent
task success.
