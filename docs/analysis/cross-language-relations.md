# Cross-language analysis relations

Cross-language enrichment links tests to targets, routes to handlers,
schemas/models to usage, and configuration records to packages or entry points.
Every relation retains its detector or parser identity, evidence basis,
confidence, exact source-symbol range, and resolution state.

Endpoint and schema candidates require explicit framework evidence; filenames
or suggestive names alone are insufficient. Unknown identities are rejected.
Conflicting targets are retained as ambiguous with bounded confidence rather
than silently selecting one. Candidate ordering does not affect serialized
results.
