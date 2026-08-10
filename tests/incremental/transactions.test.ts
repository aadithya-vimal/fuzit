import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  commitAtomicIndexTransaction,
  readCommittedIndexState,
  type AtomicIndexTransactionInput,
  type CanonicalIndexFileRecord,
  type IndexTransactionBoundary,
} from "@fuzit/index";

const repositoryId = `sha256:${"b".repeat(64)}`;
const timestamp = "2026-01-01T00:00:00.000Z";

function record(path: string, character: string): CanonicalIndexFileRecord {
  return {
    recordType: "file",
    schemaVersion: 1,
    path,
    contentHash: `sha256:${character.repeat(64)}`,
    sizeBytes: 1,
    mtimeMs: 1,
    classification: "text",
    securityDecision: { outcome: "include", reason: "policy allowed" },
    completeness: "complete",
  };
}

function transaction(
  transactionId: string,
  records: readonly CanonicalIndexFileRecord[],
): AtomicIndexTransactionInput {
  return {
    transactionId,
    repositoryId,
    startedAt: timestamp,
    completedAt: timestamp,
    records,
    semanticState: {
      contentHash: records.map(({ contentHash }) => contentHash).join(":"),
      configHash: "config",
      scannerVersion: "1",
      parserVersion: "1",
      securityPolicyVersion: "1",
      schemaVersion: 1,
    },
  };
}

async function location(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "fuzit-transaction-")), "index");
}

describe("atomic index transactions", () => {
  for (const boundary of [
    "before-stage",
    "after-stage",
    "after-validation",
    "before-commit",
    "after-commit",
  ] as const satisfies readonly IndexTransactionBoundary[]) {
    it(`preserves a coherent state when interrupted at ${boundary}`, async () => {
      const directory = await location();
      const oldRecord = record("old.ts", "a");
      const newRecord = record("new.ts", "c");
      await commitAtomicIndexTransaction(
        directory,
        transaction("baseline", [oldRecord]),
      );

      await expect(
        commitAtomicIndexTransaction(
          directory,
          transaction(`failure-${boundary}`, [newRecord]),
          {
            onBoundary(observed) {
              if (observed === boundary)
                throw new Error(`injected ${boundary}`);
            },
          },
        ),
      ).rejects.toThrow(`injected ${boundary}`);

      expect((await readCommittedIndexState(directory))?.records).toEqual(
        boundary === "after-commit" ? [newRecord] : [oldRecord],
      );
      expect(await readdir(join(directory, "transactions"))).toEqual([]);
    });
  }

  it("allows concurrent readers to observe only the previous committed state", async () => {
    const directory = await location();
    const oldRecord = record("old.ts", "a");
    const newRecord = record("new.ts", "c");
    await commitAtomicIndexTransaction(
      directory,
      transaction("baseline", [oldRecord]),
    );

    let releaseCommit!: () => void;
    const pause = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    let staged!: () => void;
    const stagedReached = new Promise<void>((resolve) => {
      staged = resolve;
    });
    const update = commitAtomicIndexTransaction(
      directory,
      transaction("update", [newRecord]),
      {
        async onBoundary(boundary) {
          if (boundary === "before-commit") {
            staged();
            await pause;
          }
        },
      },
    );

    await stagedReached;
    expect((await readCommittedIndexState(directory))?.records).toEqual([
      oldRecord,
    ]);
    releaseCommit();
    await update;
    expect((await readCommittedIndexState(directory))?.records).toEqual([
      newRecord,
    ]);
  });

  it("rejects invalid staged records without replacing valid state", async () => {
    const directory = await location();
    const oldRecord = record("old.ts", "a");
    await commitAtomicIndexTransaction(
      directory,
      transaction("baseline", [oldRecord]),
    );

    const invalid = {
      ...record("../outside.ts", "c"),
    } as CanonicalIndexFileRecord;
    await expect(
      commitAtomicIndexTransaction(
        directory,
        transaction("invalid", [invalid]),
      ),
    ).rejects.toThrow();
    expect((await readCommittedIndexState(directory))?.records).toEqual([
      oldRecord,
    ]);
  });
});
