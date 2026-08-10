export {
  LOCAL_INDEX_SCHEMA_VERSION,
  localIndexRepositoryIdSchema,
  localIndexStatusSchema,
  type LocalIndexStatus,
} from "./contracts.js";
export {
  INCREMENTAL_INDEX_LIMITS,
  INCREMENTAL_INDEX_SCHEMA_VERSION,
  canonicalIndexFileRecordSchema,
  incrementalAnalysisRecordSchema,
  incrementalDiagnosticRecordSchema,
  incrementalGraphRecordSchema,
  incrementalIndexRecordSchema,
  incrementalLockStateSchema,
  incrementalRepositoryMetadataSchema,
  incrementalTombstoneSchema,
  incrementalTransactionSchema,
  incrementalVerificationResultSchema,
  parseIncrementalIndexRecord,
  serializeIncrementalIndexRecord,
  type IncrementalIndexRecord,
} from "./incremental.js";
