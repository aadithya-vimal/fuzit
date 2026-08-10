# Glossary

| Term | Definition |
| --- | --- |
| Acquisition | Reading or receiving raw evidence from a context source without yet assuming a common model. |
| Bundle manifest | Versioned machine-readable description of bundle identity, sources, revisions, policy, profile, hashes, warnings, failures, and size. |
| Collector | Adapter that obtains diagnostics or runtime evidence such as compiler output, test failures, processes, ports, containers, or logs. |
| Confidence | Explained basis for trusting an item or relationship; never an unexplained scalar alone. |
| Context Bundle | Ordered, budgeted, policy-filtered output containing selected evidence and selection explanations. |
| Context Graph | Typed graph of software entities and relationships used for retrieval, impact analysis, history, and architecture understanding. |
| Context Item | Smallest normalized evidence unit: file, symbol, commit, test, diagnostic, table, decision, process, and similar records. |
| Context Policy | Rules for inclusion, exclusion, redaction, network access, retention, plugins, providers, collectors, size, and output. |
| Context Profile | Named task strategy that changes source priorities, rank weights, graph depth, history window, runtime emphasis, layout, and budget. |
| Context Source | Filesystem, Git repository, provider, compiler, test runner, database, documentation, log, issue tracker, or plugin from which evidence originates. |
| Delta | Added, modified, deleted, renamed, or state-changed items and relationships between snapshots. |
| Determinism envelope | The explicit set of inputs that must be fixed for reproducible output: source revision, configuration, Fuzit version, parser versions, profile, policy, and task. |
| Direct fact | Evidence acquired from an authoritative source without inference, such as file bytes or a Git commit identifier. |
| Explainability trace | Structured reasons for inclusion, exclusion, graph expansion, scoring, truncation, redaction, and uncertainty. |
| Lifecycle state | Active, stable, experimental, generated, vendored, deprecated, superseded, dead, archived, or unknown status. |
| Normalization | Conversion of source-specific evidence into versioned provider-neutral context records. |
| Parser | Adapter that extracts syntax, symbols, imports, references, endpoints, schemas, or dependencies from content. |
| Profile | See Context Profile. |
| Provenance | Source, acquisition method, time, revision, adapter version, transformations, inference method, and confidence basis. |
| Provider | Integration for a repository host or external engineering system such as GitHub, GitLab, or Bitbucket. |
| Ranker | Component that assigns explainable relevance contributions to candidate items. |
| Redaction | Policy-controlled replacement or omission of sensitive content while preserving an audit record that redaction occurred. |
| Renderer | Deterministic adapter that serializes a context bundle to Markdown, JSON, XML, plain text, or `.fuzit`. |
| Snapshot | Versioned representation of context state at a point in time, including source identities, fingerprints, graph/index versions, and configuration hash. |
| Source trust | Declared authority and reliability properties of a source, separate from recency or relevance. |
| Stable identifier | Deterministically derived identifier that survives ordinary rescans and supports invalidation, relationships, and provenance. |
| Transformation history | Ordered record of parsing, normalization, filtering, summarization, truncation, and rendering operations applied to evidence. |
| Volatile field | Time, local path, runtime observation, or other field that may vary outside the deterministic static scan and must be isolated. |
