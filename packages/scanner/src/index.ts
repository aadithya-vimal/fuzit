export {
  TraversalError,
  traverseDirectory,
} from "./traversal/traverse-directory.js";
export type {
  TraversalDirectoryEntry,
  TraversalEntry,
  TraversalEntryKind,
  TraversalErrorCode,
  TraversalOptions,
} from "./traversal/traverse-directory.js";
export { evaluateBuiltInExclusion } from "./exclusions/index.js";
export type {
  BuiltInExclusionRule,
  BuiltInExclusionRuleId,
  ExclusionDecision,
} from "./exclusions/index.js";
export {
  evaluateGitignore,
  loadFuzitignoreRulesForPath,
  loadGitignoreRulesForPath,
  parseGitignore,
} from "./ignore/gitignore.js";
export { evaluateIgnorePrecedence } from "./ignore/precedence.js";
export type {
  ExplicitPathRule,
  IgnoreLayer,
  IgnorePrecedenceDecision,
  IgnorePrecedenceInput,
} from "./ignore/precedence.js";
export { classifyFile } from "./classification/classify-file.js";
export type { ClassifyFileOptions } from "./classification/classify-file.js";
export { resolveSymlinkSafely } from "./symlink/symlink-safety.js";
export type {
  SymlinkResolution,
  SymlinkStatus,
} from "./symlink/symlink-safety.js";
export { readTextContent } from "./content/read-text-content.js";
export type { TextContentResult } from "./content/read-text-content.js";
export type { GitignoreDecision, GitignoreRule } from "./ignore/gitignore.js";
