export {
  describePurgeScope,
  evaluateInvalidation,
  type IndexSemanticVersions,
  type InvalidationDecision,
} from "./evaluate.js";
export {
  createIndexIdentitySet,
  type IndexIdentityInput,
  type IndexIdentitySet,
} from "./identities.js";
export {
  computeDependencyInvalidation,
  type DependencyChange,
  type DependencyChangeKind,
  type DependencyInvalidationReason,
  type DependencyInvalidationResult,
  type DependencyRelation,
  type PersistedDependencyRecord,
} from "./dependencies.js";
