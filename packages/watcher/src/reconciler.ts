import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  commitAtomicIndexTransaction,
  readCommittedIndexState,
  type AtomicIndexTransactionInput,
  type CanonicalIndexFileRecord,
  type IndexRemoval,
  type LocalIndexSemanticState,
} from "@fuzit/index";
import type { WatcherBatch } from "@fuzit/schemas";

export interface ReconciliationOptions {
  readonly indexPath: string;
  readonly repositoryId: string;
  readonly repositoryRoot: string;
  readonly ignorePatterns?: readonly string[] | undefined;
  readonly semanticState: LocalIndexSemanticState;
  readonly signal?: AbortSignal | undefined;
}

export interface ReconciliationResult {
  readonly transactionId: string;
  readonly isOverflowReconciled: boolean;
  readonly addedCount: number;
  readonly updatedCount: number;
  readonly deletedCount: number;
}

async function scanFilesystem(
  dir: string,
  root: string,
  ignorePatterns: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, { sizeBytes: number; mtimeMs: number }>> {
  const result = new Map<string, { sizeBytes: number; mtimeMs: number }>();

  async function walk(current: string) {
    if (signal?.aborted) {
      throw new Error("Reconciliation aborted by signal");
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const relPath = relative(root, fullPath).replace(/\\/g, "/");

      let ignored = false;
      for (const pattern of ignorePatterns) {
        if (relPath.startsWith(pattern) || relPath.includes(`/${pattern}`)) {
          ignored = true;
          break;
        }
      }
      if (ignored) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const st = await stat(fullPath);
        result.set(relPath, { sizeBytes: st.size, mtimeMs: st.mtimeMs });
      }
    }
  }

  await walk(dir);
  return result;
}

export async function reconcileRepositoryState(
  batch: WatcherBatch,
  options: ReconciliationOptions,
): Promise<ReconciliationResult> {
  const {
    indexPath,
    repositoryId,
    repositoryRoot,
    ignorePatterns = [],
    semanticState,
    signal,
  } = options;

  if (signal?.aborted) {
    throw new Error("Reconciliation aborted prior to execution");
  }

  const existingState = await readCommittedIndexState(indexPath);
  const existingMap = new Map<string, CanonicalIndexFileRecord>(
    (existingState?.records ?? []).map((r: CanonicalIndexFileRecord) => [
      r.path,
      r,
    ]),
  );

  const fsMap = await scanFilesystem(
    repositoryRoot,
    repositoryRoot,
    ignorePatterns,
    signal,
  );

  let addedCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  const newRecords: CanonicalIndexFileRecord[] = [];
  const removals: IndexRemoval[] = [];

  // Check additions and updates
  for (const [relPath, fsMeta] of fsMap.entries()) {
    if (signal?.aborted) {
      throw new Error("Reconciliation aborted during record processing");
    }

    const existingRecord = existingMap.get(relPath);
    if (!existingRecord) {
      const fullPath = join(repositoryRoot, relPath);
      const buf = await readFile(fullPath);
      const contentHash = `sha256:${createHash("sha256").update(buf).digest("hex")}`;
      newRecords.push({
        recordType: "file",
        schemaVersion: 1,
        path: relPath,
        contentHash,
        sizeBytes: fsMeta.sizeBytes,
        mtimeMs: fsMeta.mtimeMs,
        classification: "text",
        securityDecision: {
          outcome: "include",
          reason: "reconciliation full scan",
        },
        completeness: "complete",
      });
      addedCount++;
    } else if (
      existingRecord.sizeBytes !== fsMeta.sizeBytes ||
      existingRecord.mtimeMs !== fsMeta.mtimeMs
    ) {
      const fullPath = join(repositoryRoot, relPath);
      const buf = await readFile(fullPath);
      const contentHash = `sha256:${createHash("sha256").update(buf).digest("hex")}`;
      newRecords.push({
        ...existingRecord,
        contentHash,
        sizeBytes: fsMeta.sizeBytes,
        mtimeMs: fsMeta.mtimeMs,
      });
      updatedCount++;
    } else {
      newRecords.push(existingRecord);
    }
  }

  // Check deletions
  for (const relPath of existingMap.keys()) {
    if (!fsMap.has(relPath)) {
      deletedCount++;
      removals.push({
        path: relPath,
        reason: "deleted",
        deletionBasis: "canonical-state-diff",
        invalidationIdentity: `reconcile:${relPath}:${Date.now()}`,
      });
    }
  }

  const transactionId = `tx-reconcile-${Date.now()}`;
  const now = new Date().toISOString();

  const transactionInput: AtomicIndexTransactionInput = {
    transactionId,
    repositoryId,
    startedAt: now,
    completedAt: now,
    records: newRecords,
    removals,
    semanticState,
  };

  await commitAtomicIndexTransaction(indexPath, transactionInput);

  return {
    transactionId,
    isOverflowReconciled: batch.overflowOccurred,
    addedCount,
    updatedCount,
    deletedCount,
  };
}
