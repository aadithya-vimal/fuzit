import { describe, expect, it } from "vitest";

import {
  INCREMENTAL_INDEX_LIMITS,
  incrementalIndexRecordSchema,
  parseIncrementalIndexRecord,
  serializeIncrementalIndexRecord,
  type IncrementalIndexRecord,
} from "@fuzit/schemas";

const hash = `sha256:${"a".repeat(64)}`;
const repositoryId = `sha256:${"b".repeat(64)}`;
const timestamp = "2026-01-01T00:00:00.000Z";

const records: IncrementalIndexRecord[] = [
  {
    recordType: "repository-metadata",
    schemaVersion: 1,
    repositoryId,
    fuzitVersion: "0.0.0",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: { platform: "test" },
  },
  {
    recordType: "file",
    schemaVersion: 1,
    path: "src/index.ts",
    contentHash: hash,
    sizeBytes: 42,
    mtimeMs: 1,
    classification: "text",
    securityDecision: { outcome: "include", reason: "policy allowed" },
    completeness: "complete",
  },
  {
    recordType: "analysis",
    schemaVersion: 1,
    path: "src/index.ts",
    contentHash: hash,
    parserIdentity: "typescript@1",
    policyIdentity: "policy@1",
    symbols: [{ id: "symbol:main", kind: "function", name: "main" }],
    completeness: "complete",
    diagnostics: [],
  },
  {
    recordType: "graph",
    schemaVersion: 1,
    graphIdentity: "graph@1",
    nodes: [{ id: "file:src/index.ts", kind: "file", path: "src/index.ts" }],
    edges: [],
    completeness: "complete",
  },
  {
    recordType: "tombstone",
    schemaVersion: 1,
    tombstoneId: `sha256:${"c".repeat(64)}`,
    path: "src/old.ts",
    previousContentHash: hash,
    deletedAt: timestamp,
    reason: "deleted",
    deletionBasis: "canonical-state-diff",
    invalidationIdentity: "transaction:1",
    renamedTo: null,
    invalidatedRecordTypes: ["file", "analysis", "graph"],
  },
  {
    recordType: "transaction",
    schemaVersion: 1,
    transactionId: "transaction:1",
    repositoryId,
    state: "committed",
    startedAt: timestamp,
    completedAt: timestamp,
    changes: [{ operation: "upsert", path: "src/index.ts" }],
  },
  {
    recordType: "lock",
    schemaVersion: 1,
    repositoryId,
    ownerId: "writer:1",
    processId: 42,
    acquiredAt: timestamp,
    heartbeatAt: timestamp,
  },
  {
    recordType: "diagnostic",
    schemaVersion: 1,
    code: "INDEX_PARTIAL",
    severity: "warning",
    message: "One optional parser was unavailable.",
    path: "src/index.ts",
    recoverable: true,
  },
  {
    recordType: "verification-result",
    schemaVersion: 1,
    repositoryId,
    verifiedAt: timestamp,
    status: "valid",
    checks: [{ name: "schema", status: "pass", reason: null }],
  },
];

describe("incremental index schemas", () => {
  it.each(records.map((record) => [record.recordType, record] as const))(
    "round-trips the %s record",
    (_recordType, record) => {
      const serialized = serializeIncrementalIndexRecord(record);

      expect(parseIncrementalIndexRecord(JSON.parse(serialized))).toEqual(
        record,
      );
      expect(serializeIncrementalIndexRecord(record)).toBe(serialized);
    },
  );

  it("rejects unknown discriminators and future versions deterministically", () => {
    const unknown = incrementalIndexRecordSchema.safeParse({
      recordType: "source-content",
      schemaVersion: 1,
    });
    const future = incrementalIndexRecordSchema.safeParse({
      ...records[0],
      schemaVersion: 2,
    });

    expect(unknown.success).toBe(false);
    expect(future.success).toBe(false);
    expect(unknown.error?.issues[0]?.path).toEqual(["recordType"]);
    expect(future.error?.issues[0]?.path).toEqual(["schemaVersion"]);
  });

  it("rejects oversized or unsafe metadata", () => {
    const oversized = {
      ...records[0],
      metadata: Object.fromEntries(
        Array.from(
          { length: INCREMENTAL_INDEX_LIMITS.metadataEntries + 1 },
          (_, index) => [`key-${index}`, "safe"],
        ),
      ),
    };
    const absolutePath = { ...records[1], path: "C:\\private\\source.ts" };

    expect(incrementalIndexRecordSchema.safeParse(oversized).success).toBe(
      false,
    );
    expect(incrementalIndexRecordSchema.safeParse(absolutePath).success).toBe(
      false,
    );
  });
});
