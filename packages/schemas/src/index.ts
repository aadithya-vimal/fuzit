export {
  DIAGNOSTIC_SCHEMA_VERSION,
  diagnosticSchema,
  parseDiagnostic,
  serializeDiagnostic,
  severitySchema,
  sourceLocationSchema,
  type Diagnostic,
  type Severity,
  type SourceLocation,
} from "./diagnostic.js";
export {
  EXIT_CODES,
  exitCodeSchema,
  type ExitCode,
  type ExitCodeKind,
} from "./exit-code.js";
export { fileRecordSchema, type FileRecord } from "./file-record.js";
export {
  fileContextItemSchema,
  type FileContextItem,
} from "./context-item/index.js";
export * from "./security/index.js";
export * from "./bundle/index.js";
export * from "./budget/index.js";
export { rendererMetadataSchema, type RendererMetadata } from "./renderer.js";
export * from "./git/index.js";
export * from "./index/index.js";
export * from "./snapshot/index.js";
export * from "./repository-facts/index.js";
export * from "./selection/index.js";
export * from "./watcher/index.js";
export * from "./analysis/index.js";
export * from "./graph/index.js";
export * from "./provider/index.js";
export * from "./plugin/index.js";

export interface SchemaPackageBoundary {
  readonly packageName: "@fuzit/schemas";
}
