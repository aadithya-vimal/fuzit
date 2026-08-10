# Selection scoring

Profile-owned contributions are inspectable: explicit path `+10`, relevant test
`+2`, generated `-4`, deprecated `-2`, and provenance trust `0..1`. Unknown
lifecycle is neutral. Contributions remain separate so profiles can override
weights without an opaque aggregate.

# Hybrid scoring contract

Hybrid selection evidence uses schema version 1. Each candidate retains a versioned feature vector, required-anchor status, component raw values, profile weights, weighted values, evidence basis, aggregate calculation, optional graph-expansion evidence, and deterministic path/identity tie-breakers.

Non-finite values, missing evidence basis, missing profile versions, and unsupported score versions are rejected. No aggregate score is valid without its component evidence.

Exact identifier relevance compares normalized task terms with symbol names, exports, routes, schemas, package names, aliases, and canonical path identifiers. Matching is case- and Unicode-normalized; common generic names do not create standalone relevance.

Graph-distance relevance starts from required anchors and initial high-confidence matches, traverses only resolved weighted edge types, and records the deterministic shortest graph path and edge basis. Depth, node, edge, and cancellation bounds apply; partial graph state remains explicit.

Related-test relevance prioritizes explicit test edges, parsed imports, exact naming, and same-package conventions in that order. Unit, integration, and end-to-end evidence remains distinct; lookalike and unrelated test filenames do not create broad selection.

Manifest and configuration relevance uses explicit configuration relations and nearest package containment. Package, workspace, build, language, and nested configuration metadata is included only for the selected package; unrelated monorepo manifests remain excluded.

Git relevance is optional and bounded to at most 100 commits. Recency uses commit order rather than wall-clock time; frequency, co-change, task-diff, and rename evidence remain separate normalized components. Missing or shallow history produces explicit zero-valued evidence and never prevents selection.

Lifecycle classification recognizes active, generated, deprecated, legacy, experimental, vendored, test, configuration, documentation, and unknown states only from controlled path conventions, explicit annotations, generated markers, or observed activity. Results retain their evidence and confidence; file age alone never makes an actively referenced file legacy.

Graph expansion is deterministic and limited by approved edge types, resolution and confidence, depth, traversed edges, selected items, token budget, security policy, and cancellation. Required anchors are considered before ordinary candidates and remain present even when ordinary item or token limits are exhausted. Every included expansion records its origin, graph path, edge types, reason, applied bounds, budget decision, and security decision.

Built-in profile IDs and version 1 compatibility remain stable. Each profile owns explicit weights for hybrid evidence plus approved graph edge types and depth, item, edge, and confidence bounds. Therefore the same task can rank differently under two profiles, and component evidence identifies the profile-defined reason rather than presenting an opaque score.

Selection explanations expose score components, profile weights, aggregate score, graph paths, lifecycle basis, expansion reason, budget decision, index state, security decision, and omission/truncation/redaction reasons in JSON, Markdown, text, XML, and debug modes. All modes, including failure diagnostics, pass through the same control-character, credential, and unsafe-absolute-path sanitization boundary.
