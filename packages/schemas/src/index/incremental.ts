import { z } from "zod";

export const INCREMENTAL_INDEX_SCHEMA_VERSION = 1 as const;

export const INCREMENTAL_INDEX_LIMITS = Object.freeze({
  pathBytes: 4096,
  identityBytes: 512,
  diagnosticMessageBytes: 8192,
  metadataEntries: 128,
  symbolsPerAnalysis: 10_000,
  graphNodes: 100_000,
  graphEdges: 500_000,
  transactionChanges: 100_000,
  verificationChecks: 1_000,
});

const versionSchema = z.literal(INCREMENTAL_INDEX_SCHEMA_VERSION);
const repositoryIdSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const contentHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const timestampSchema = z.string().datetime({ offset: true });
const pathSchema = z
  .string()
  .min(1)
  .max(INCREMENTAL_INDEX_LIMITS.pathBytes)
  .refine(
    (path) =>
      path === path.normalize("NFC") &&
      !path.startsWith("/") &&
      !path.includes("\\") &&
      !path.split("/").some((segment) => segment === "." || segment === "..") &&
      !/^[A-Za-z]:/u.test(path),
    { message: "Index paths must be canonical repository-relative paths" },
  );
const identitySchema = z
  .string()
  .min(1)
  .max(INCREMENTAL_INDEX_LIMITS.identityBytes);
const safeMetadataSchema = z
  .record(
    z.string().min(1).max(128),
    z.string().max(INCREMENTAL_INDEX_LIMITS.identityBytes),
  )
  .refine(
    (metadata) =>
      Object.keys(metadata).length <= INCREMENTAL_INDEX_LIMITS.metadataEntries,
    { message: "Index metadata exceeds the bounded entry count" },
  );

export const incrementalRepositoryMetadataSchema = z.strictObject({
  recordType: z.literal("repository-metadata"),
  schemaVersion: versionSchema,
  repositoryId: repositoryIdSchema,
  fuzitVersion: identitySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  metadata: safeMetadataSchema,
});

export const canonicalIndexFileRecordSchema = z.strictObject({
  recordType: z.literal("file"),
  schemaVersion: versionSchema,
  path: pathSchema,
  contentHash: contentHashSchema,
  sizeBytes: z.number().int().nonnegative(),
  mtimeMs: z.number().finite().nonnegative().nullable(),
  classification: z.enum(["text", "binary", "symlink", "other"]),
  securityDecision: z.strictObject({
    outcome: z.enum(["include", "exclude", "redact"]),
    reason: z
      .string()
      .min(1)
      .max(INCREMENTAL_INDEX_LIMITS.diagnosticMessageBytes),
  }),
  completeness: z.enum(["complete", "partial", "unavailable"]),
});

export const incrementalAnalysisRecordSchema = z.strictObject({
  recordType: z.literal("analysis"),
  schemaVersion: versionSchema,
  path: pathSchema,
  contentHash: contentHashSchema,
  parserIdentity: identitySchema,
  policyIdentity: identitySchema,
  symbols: z
    .array(
      z.strictObject({
        id: identitySchema,
        kind: identitySchema,
        name: identitySchema,
      }),
    )
    .max(INCREMENTAL_INDEX_LIMITS.symbolsPerAnalysis),
  completeness: z.enum(["complete", "partial", "unavailable"]),
  diagnostics: z
    .array(z.string().max(INCREMENTAL_INDEX_LIMITS.diagnosticMessageBytes))
    .max(INCREMENTAL_INDEX_LIMITS.metadataEntries),
});

const graphNodeSchema = z.strictObject({
  id: identitySchema,
  kind: identitySchema,
  path: pathSchema.nullable(),
});
const graphEdgeSchema = z.strictObject({
  from: identitySchema,
  to: identitySchema,
  kind: identitySchema,
});

export const incrementalGraphRecordSchema = z.strictObject({
  recordType: z.literal("graph"),
  schemaVersion: versionSchema,
  graphIdentity: identitySchema,
  nodes: z.array(graphNodeSchema).max(INCREMENTAL_INDEX_LIMITS.graphNodes),
  edges: z.array(graphEdgeSchema).max(INCREMENTAL_INDEX_LIMITS.graphEdges),
  completeness: z.enum(["complete", "partial"]),
});

export const incrementalTombstoneSchema = z.strictObject({
  recordType: z.literal("tombstone"),
  schemaVersion: versionSchema,
  tombstoneId: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/u)
    .optional(),
  path: pathSchema,
  previousContentHash: contentHashSchema.nullable(),
  deletedAt: timestampSchema,
  reason: z.enum(["deleted", "renamed", "excluded", "unavailable"]),
  deletionBasis: z
    .enum(["canonical-state-diff", "verified-filesystem", "policy-change"])
    .optional(),
  invalidationIdentity: identitySchema.optional(),
  renamedTo: pathSchema.nullable().optional(),
  invalidatedRecordTypes: z
    .array(z.enum(["file", "analysis", "graph"]))
    .max(3)
    .optional(),
});

const transactionChangeSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("upsert"), path: pathSchema }),
  z.strictObject({ operation: z.literal("tombstone"), path: pathSchema }),
]);

export const incrementalTransactionSchema = z.strictObject({
  recordType: z.literal("transaction"),
  schemaVersion: versionSchema,
  transactionId: identitySchema,
  repositoryId: repositoryIdSchema,
  state: z.enum(["staged", "committed", "aborted"]),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  changes: z
    .array(transactionChangeSchema)
    .max(INCREMENTAL_INDEX_LIMITS.transactionChanges),
});

export const incrementalLockStateSchema = z.strictObject({
  recordType: z.literal("lock"),
  schemaVersion: versionSchema,
  repositoryId: repositoryIdSchema,
  ownerId: identitySchema,
  processId: z.number().int().positive(),
  acquiredAt: timestampSchema,
  heartbeatAt: timestampSchema,
});

export const incrementalDiagnosticRecordSchema = z.strictObject({
  recordType: z.literal("diagnostic"),
  schemaVersion: versionSchema,
  code: identitySchema,
  severity: z.enum(["info", "warning", "error"]),
  message: z
    .string()
    .min(1)
    .max(INCREMENTAL_INDEX_LIMITS.diagnosticMessageBytes),
  path: pathSchema.nullable(),
  recoverable: z.boolean(),
});

export const incrementalVerificationResultSchema = z.strictObject({
  recordType: z.literal("verification-result"),
  schemaVersion: versionSchema,
  repositoryId: repositoryIdSchema,
  verifiedAt: timestampSchema,
  status: z.enum(["valid", "invalid", "rebuild-required"]),
  checks: z
    .array(
      z.strictObject({
        name: identitySchema,
        status: z.enum(["pass", "fail", "skipped"]),
        reason: z
          .string()
          .max(INCREMENTAL_INDEX_LIMITS.diagnosticMessageBytes)
          .nullable(),
      }),
    )
    .max(INCREMENTAL_INDEX_LIMITS.verificationChecks),
});

export const incrementalIndexRecordSchema = z.discriminatedUnion("recordType", [
  incrementalRepositoryMetadataSchema,
  canonicalIndexFileRecordSchema,
  incrementalAnalysisRecordSchema,
  incrementalGraphRecordSchema,
  incrementalTombstoneSchema,
  incrementalTransactionSchema,
  incrementalLockStateSchema,
  incrementalDiagnosticRecordSchema,
  incrementalVerificationResultSchema,
]);

export type IncrementalIndexRecord = z.infer<
  typeof incrementalIndexRecordSchema
>;

export function parseIncrementalIndexRecord(
  value: unknown,
): IncrementalIndexRecord {
  return incrementalIndexRecordSchema.parse(value);
}

export function serializeIncrementalIndexRecord(
  value: IncrementalIndexRecord,
): string {
  return `${JSON.stringify(incrementalIndexRecordSchema.parse(value))}\n`;
}
