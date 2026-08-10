export {
  failureResult,
  partialResult,
  successResult,
  type FailureResult,
  type PartialResult,
  type Result,
  type SuccessResult,
} from "./result.js";
export {
  DOCTOR_REPORT_JSON_SCHEMA,
  runDoctor,
  type DoctorCheck,
  type DoctorCheckId,
  type DoctorCheckStatus,
  type DoctorDependencies,
  type DoctorReport,
} from "./environment/doctor.js";
export {
  PathNormalizationError,
  normalizeRepositoryRelativePath,
  toRepositoryRelativePath,
  type PathNormalizationErrorCode,
  type RepositoryRelativePath,
} from "./path/index.js";
export { sha256Hex } from "./hash/index.js";
export { createFileContextItem } from "./context-item/index.js";
export * from "./pipeline/index.js";
export * from "./bundle/index.js";
export * from "./application/index.js";
export * from "./resource-limits/index.js";

export interface CorePackageBoundary {
  readonly packageName: "@fuzit/core";
}
