import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  commitAtomicIndexTransaction,
  readCommittedIndexState,
  type AtomicIndexTransactionInput,
  type CanonicalIndexFileRecord,
  type IndexRemoval,
} from "@fuzit/index";

const repositoryId = `sha256:${"b".repeat(64)}`;
const timestamp = "2026-01-01T00:00:00.000Z";

function record(path: string): CanonicalIndexFileRecord {
  return {
    recordType: "file",
    schemaVersion: 1,
    path,
    contentHash: `sha256:${"a".repeat(64)}`,
    sizeBytes: 1,
    mtimeMs: 1,
    classification: "text",
    securityDecision: { outcome: "include", reason: "policy allowed" },
    completeness: "complete",
  };
}

function transaction(
  id: string,
  records: readonly CanonicalIndexFileRecord[],
  removals: readonly IndexRemoval[] = [],
): AtomicIndexTransactionInput {
  return {
    transactionId: id,
    repositoryId,
    startedAt: timestamp,
    completedAt: timestamp,
    records,
    removals,
    semanticState: {
      contentHash: id,
      configHash: "config",
      scannerVersion: "1",
      parserVersion: "1",
      securityPolicyVersion: "1",
      schemaVersion: 1,
    },
  };
}

const removal = (
  path: string,
  reason: IndexRemoval["reason"] = "deleted",
  renamedTo?: string,
): IndexRemoval => ({
  path,
  reason,
  deletionBasis: "verified-filesystem",
  invalidationIdentity: "scan:2",
  ...(renamedTo === undefined ? {} : { renamedTo }),
});

async function location(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "fuzit-tombstone-")), "index");
}

describe("index tombstones", () => {
  it("removes deleted files from active records and retains attributable evidence", async () => {
    const directory = await location();
    await commitAtomicIndexTransaction(
      directory,
      transaction("initial", [record("old.ts")]),
    );
    await commitAtomicIndexTransaction(
      directory,
      transaction("delete", [], [removal("old.ts")]),
    );

    const state = await readCommittedIndexState(directory);
    expect(state?.records).toEqual([]);
    expect(state?.tombstones[0]).toMatchObject({
      path: "old.ts",
      previousContentHash: `sha256:${"a".repeat(64)}`,
      deletionBasis: "verified-filesystem",
      invalidationIdentity: "scan:2",
      invalidatedRecordTypes: ["file", "analysis", "graph"],
    });
  });

  it.each([
    ["rename", "old.ts", "new.ts"],
    ["case-only rename", "name.ts", "Name.ts"],
  ])("records %s without hiding the active target", async (_name, from, to) => {
    const directory = await location();
    await commitAtomicIndexTransaction(
      directory,
      transaction("initial", [record(from)]),
    );
    await commitAtomicIndexTransaction(
      directory,
      transaction("rename", [record(to)], [removal(from, "renamed", to)]),
    );

    const state = await readCommittedIndexState(directory);
    expect(state?.records.map(({ path }) => path)).toEqual([to]);
    expect(state?.tombstones[0]).toMatchObject({
      path: from,
      reason: "renamed",
      renamedTo: to,
    });
  });

  it("keeps stable tombstone identity when a path is recreated", async () => {
    const directory = await location();
    await commitAtomicIndexTransaction(
      directory,
      transaction("initial", [record("file.ts")]),
    );
    await commitAtomicIndexTransaction(
      directory,
      transaction("delete", [], [removal("file.ts")]),
    );
    const deleted = await readCommittedIndexState(directory);
    await commitAtomicIndexTransaction(
      directory,
      transaction("recreate", [record("file.ts")]),
    );
    const recreated = await readCommittedIndexState(directory);

    expect(recreated?.records.map(({ path }) => path)).toEqual(["file.ts"]);
    expect(recreated?.tombstones[0]?.tombstoneId).toBe(
      deleted?.tombstones[0]?.tombstoneId,
    );
  });

  it("rejects unsafe removal paths without replacing committed state", async () => {
    const directory = await location();
    await commitAtomicIndexTransaction(
      directory,
      transaction("initial", [record("safe.ts")]),
    );
    await expect(
      commitAtomicIndexTransaction(
        directory,
        transaction("unsafe", [], [removal("../outside.ts")]),
      ),
    ).rejects.toThrow();
    expect(
      (await readCommittedIndexState(directory))?.records.map(
        ({ path }) => path,
      ),
    ).toEqual(["safe.ts"]);
  });
});
