import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalIndexFileRecordSchema,
  incrementalTombstoneSchema,
  incrementalTransactionSchema,
} from "@fuzit/schemas";

import type { CanonicalIndexFileRecord } from "./file-record-store.js";
import type { LocalIndexSemanticState } from "./store.js";

const COMMITTED_STATE_FILE = "committed-state.json";
const STAGING_DIRECTORY = "transactions";

export type IndexTransactionBoundary =
  | "before-stage"
  | "after-stage"
  | "after-validation"
  | "before-commit"
  | "after-commit";

export interface AtomicIndexTransactionInput {
  readonly transactionId: string;
  readonly repositoryId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly records: readonly CanonicalIndexFileRecord[];
  readonly semanticState: LocalIndexSemanticState;
  readonly removals?: readonly IndexRemoval[];
}

export interface IndexRemoval {
  readonly path: string;
  readonly reason: "deleted" | "renamed" | "excluded" | "unavailable";
  readonly deletionBasis:
    "canonical-state-diff" | "verified-filesystem" | "policy-change";
  readonly invalidationIdentity: string;
  readonly renamedTo?: string;
}

export type DurableIndexTombstone = ReturnType<typeof createTombstone>;

export interface CommittedIndexState {
  readonly transaction: {
    readonly recordType: "transaction";
    readonly schemaVersion: 1;
    readonly transactionId: string;
    readonly repositoryId: string;
    readonly state: "committed";
    readonly startedAt: string;
    readonly completedAt: string;
    readonly changes: readonly {
      readonly operation: "upsert";
      readonly path: string;
    }[];
  };
  readonly records: readonly CanonicalIndexFileRecord[];
  readonly tombstones: readonly DurableIndexTombstone[];
  readonly semanticState: LocalIndexSemanticState;
}

export interface AtomicIndexTransactionOptions {
  readonly onBoundary?: (
    boundary: IndexTransactionBoundary,
  ) => void | Promise<void>;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function createTombstone(
  removal: IndexRemoval,
  previousContentHash: string | null,
  deletedAt: string,
) {
  const stableIdentity = JSON.stringify({
    path: removal.path,
    previousContentHash,
    reason: removal.reason,
    deletionBasis: removal.deletionBasis,
    invalidationIdentity: removal.invalidationIdentity,
    renamedTo: removal.renamedTo ?? null,
  });
  return incrementalTombstoneSchema.parse({
    recordType: "tombstone",
    schemaVersion: 1,
    tombstoneId: `sha256:${createHash("sha256")
      .update(stableIdentity, "utf8")
      .digest("hex")}`,
    path: removal.path,
    previousContentHash,
    deletedAt,
    reason: removal.reason,
    deletionBasis: removal.deletionBasis,
    invalidationIdentity: removal.invalidationIdentity,
    renamedTo: removal.renamedTo ?? null,
    invalidatedRecordTypes: ["file", "analysis", "graph"],
  });
}

function validateSemanticState(
  value: LocalIndexSemanticState,
): LocalIndexSemanticState {
  for (const key of [
    "contentHash",
    "configHash",
    "scannerVersion",
    "parserVersion",
    "securityPolicyVersion",
  ] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new Error(`Invalid semantic state field: ${key}`);
    }
  }
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    throw new Error("Invalid semantic state field: schemaVersion");
  }
  return value;
}

function validateCommittedState(value: unknown): CommittedIndexState {
  if (value === null || typeof value !== "object") {
    throw new Error("Invalid committed index state.");
  }
  const candidate = value as Partial<CommittedIndexState>;
  const transaction = incrementalTransactionSchema.parse(candidate.transaction);
  if (transaction.state !== "committed") {
    throw new Error(
      "Committed index state must contain a committed transaction.",
    );
  }
  if (!Array.isArray(candidate.records)) {
    throw new Error("Committed index state records must be an array.");
  }
  const records = candidate.records
    .map((record) => canonicalIndexFileRecordSchema.parse(record))
    .sort((left, right) => compareUtf8(left.path, right.path));
  if (new Set(records.map(({ path }) => path)).size !== records.length) {
    throw new Error("Committed index state contains duplicate paths.");
  }
  const tombstones = (candidate.tombstones ?? [])
    .map((tombstone) => incrementalTombstoneSchema.parse(tombstone))
    .sort((left, right) => compareUtf8(left.path, right.path));
  return {
    transaction: transaction as CommittedIndexState["transaction"],
    records,
    tombstones: tombstones as DurableIndexTombstone[],
    semanticState: validateSemanticState(
      candidate.semanticState as LocalIndexSemanticState,
    ),
  };
}

export async function commitAtomicIndexTransaction(
  directory: string,
  input: AtomicIndexTransactionInput,
  options: AtomicIndexTransactionOptions = {},
): Promise<CommittedIndexState> {
  const notify = async (boundary: IndexTransactionBoundary) =>
    options.onBoundary?.(boundary);
  await notify("before-stage");
  await mkdir(join(directory, STAGING_DIRECTORY), {
    recursive: true,
    mode: 0o700,
  });

  const records = [...input.records].sort((left, right) =>
    compareUtf8(left.path, right.path),
  );
  const previous = await readCommittedIndexState(directory);
  const previousRecords = new Map(
    previous?.records.map((record) => [record.path, record]) ?? [],
  );
  const newTombstones = (input.removals ?? []).map((removal) =>
    createTombstone(
      removal,
      previousRecords.get(removal.path)?.contentHash ?? null,
      input.completedAt,
    ),
  );
  const tombstones = [...(previous?.tombstones ?? []), ...newTombstones].sort(
    (left, right) => compareUtf8(left.path, right.path),
  );
  const stagedState = validateCommittedState({
    transaction: {
      recordType: "transaction",
      schemaVersion: 1,
      transactionId: input.transactionId,
      repositoryId: input.repositoryId,
      state: "committed",
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      changes: [
        ...records.map(({ path }) => ({ operation: "upsert" as const, path })),
        ...newTombstones.map(({ path }) => ({
          operation: "tombstone" as const,
          path,
        })),
      ],
    },
    records,
    tombstones,
    semanticState: input.semanticState,
  });
  const stagedPath = join(
    directory,
    STAGING_DIRECTORY,
    `${input.transactionId}.staged.json`,
  );
  const targetPath = join(directory, COMMITTED_STATE_FILE);

  try {
    await writeFile(stagedPath, `${JSON.stringify(stagedState)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await notify("after-stage");
    validateCommittedState(JSON.parse(await readFile(stagedPath, "utf8")));
    await notify("after-validation");
    await notify("before-commit");
    await rename(stagedPath, targetPath);
    await notify("after-commit");
    return stagedState;
  } finally {
    await rm(stagedPath, { force: true });
  }
}

export async function readCommittedIndexState(
  directory: string,
): Promise<CommittedIndexState | undefined> {
  try {
    return validateCommittedState(
      JSON.parse(await readFile(join(directory, COMMITTED_STATE_FILE), "utf8")),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
