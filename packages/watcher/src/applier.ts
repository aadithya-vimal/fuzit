import { randomUUID } from "node:crypto";
import {
  commitAtomicIndexTransaction,
  readCommittedIndexState,
  type AtomicIndexTransactionInput,
  type CanonicalIndexFileRecord,
  type IndexRemoval,
  type LocalIndexSemanticState,
} from "@fuzit/index";
import {
  verifyEventAgainstFilesystem,
  type VerifiedEventOutcome,
} from "./verifier.js";
import type { WatcherEvent } from "@fuzit/schemas";

export interface EventTransactionApplierOptions {
  readonly indexPath: string;
  readonly repositoryId: string;
  readonly repositoryRoot: string;
  readonly ignorePatterns?: readonly string[] | undefined;
  readonly semanticState: LocalIndexSemanticState;
}

export async function applyEventsToLocalIndex(
  events: readonly WatcherEvent[],
  options: EventTransactionApplierOptions,
): Promise<{ readonly transactionId: string; readonly appliedCount: number }> {
  const {
    indexPath,
    repositoryId,
    repositoryRoot,
    ignorePatterns = [],
    semanticState,
  } = options;

  const verifiedOutcomes: VerifiedEventOutcome[] = [];
  for (const event of events) {
    const outcome = await verifyEventAgainstFilesystem(event, {
      repositoryRoot,
      ignorePatterns,
    });
    verifiedOutcomes.push(outcome);
  }

  const existingState = await readCommittedIndexState(indexPath);
  const recordMap = new Map<string, CanonicalIndexFileRecord>(
    (existingState?.records ?? []).map((r: CanonicalIndexFileRecord) => [
      r.path,
      r,
    ]),
  );

  const removals: IndexRemoval[] = [];

  for (const outcome of verifiedOutcomes) {
    if (outcome.action === "upsert") {
      recordMap.set(outcome.path, {
        recordType: "file",
        schemaVersion: 1,
        path: outcome.path,
        contentHash: outcome.contentHash,
        sizeBytes: outcome.sizeBytes,
        mtimeMs: outcome.mtimeMs,
        classification: "text",
        securityDecision: {
          outcome: "include",
          reason: "watcher event verified",
        },
        completeness: "complete",
      });
    } else if (outcome.action === "delete") {
      if (recordMap.has(outcome.path)) {
        recordMap.delete(outcome.path);
        removals.push({
          path: outcome.path,
          reason: "deleted",
          deletionBasis: "verified-filesystem",
          invalidationIdentity: `watcher:${outcome.path}:${Date.now()}`,
        });
      }
    }
  }

  const transactionId = `tx-watcher-${randomUUID()}`;
  const now = new Date().toISOString();

  const transactionInput: AtomicIndexTransactionInput = {
    transactionId,
    repositoryId,
    startedAt: now,
    completedAt: now,
    records: Array.from(recordMap.values()),
    removals,
    semanticState,
  };

  await commitAtomicIndexTransaction(indexPath, transactionInput);

  return {
    transactionId,
    appliedCount: verifiedOutcomes.filter((o) => o.action !== "ignore").length,
  };
}
