# Terminology Map

| Canonical term | Avoid using as an unqualified synonym | Reason |
| --- | --- | --- |
| Context Item | chunk, document, blob | Items may represent structured non-text evidence and have identity/provenance. |
| Context Bundle | prompt, pack, dump | A bundle is versioned, policy-filtered, budgeted, and explainable; it may serve non-prompt consumers. |
| Context Graph | knowledge graph | The graph is specifically typed software evidence and may be partial. |
| Context Profile | prompt template | Profiles control evidence priorities and budgets, not just wording. |
| Context Policy | config | Policy specifically controls security, inclusion, network, retention, and permissions; config is broader. |
| Snapshot | backup | A snapshot captures normalized identity/state and may not contain all source bytes. |
| Delta | diff | Delta includes normalized items, relationships, lifecycle, and runtime changes beyond text diff. |
| Provider | plugin | A provider is a source adapter; it may be implemented as a plugin later but the roles differ. |
| Parser | analyzer | Parser extracts syntax/structure; analysis may combine multiple parsed or derived inputs. |
| Confidence basis | confidence score | The basis explains method and evidence; a score alone is insufficient. |
| Lifecycle | status | Lifecycle uses controlled software-evolution states and provenance. |
| Partial result | success with warning | Partial result is a first-class outcome with failed-source metadata. |
| Deterministic | identical under all conditions | Determinism is bounded by the documented envelope and isolated volatile fields. |

## Naming Rules

Use “Fuzit” for the product and `fuzit` for the executable, package prefix, configuration namespace, and `.fuzit` working directory. Use “local-first,” not “offline-only.” Use “provider-neutral” and “model-neutral,” not “provider-free.” Use “explainable selection,” not “AI-picked files,” unless describing an explicitly optional model ranker.
