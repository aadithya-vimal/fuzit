export {
  LOCAL_INDEX_CONTRACT,
  createRepositoryId,
  getLocalIndexPath,
  getLocalIndexStatus,
  type LocalIndexLocationInput,
  type LocalIndexObservedState,
} from "./contract.js";
export * from "./storage/index.js";
export * from "./repositories/index.js";
export * from "./invalidation/index.js";
export * from "./verification/index.js";
export * from "./recovery/index.js";
export * from "./migrations/index.js";

export interface IndexPackageBoundary {
  readonly packageName: "@fuzit/index";
}
