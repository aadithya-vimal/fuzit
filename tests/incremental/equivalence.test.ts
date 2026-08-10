import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  commitAtomicIndexTransaction,
  createIndexIdentitySet,
  createRepositoryId,
  openLocalIndex,
  readCommittedIndexState,
  writeLocalIndexSemanticState,
  type CanonicalIndexFileRecord,
  type IndexSemanticVersions,
} from "@fuzit/index";

const TEST_CACHE_HOME = resolve("tests/incremental/tmp-equivalence");
const REPO_FINGERPRINT = "test-repo-fingerprint-v1-019";
const REPO_ID = createRepositoryId(REPO_FINGERPRINT);

function dummySemanticState(
  overrides?: Partial<IndexSemanticVersions>,
): IndexSemanticVersions {
  return {
    contentHash: hash("0"),
    configHash: hash("1"),
    scannerVersion: "1",
    parserVersion: "1",
    securityPolicyVersion: "1",
    schemaVersion: 1,
    identities: createIndexIdentitySet({
      effectiveConfiguration: { format: "json" },
      ignorePolicy: { rules: [] },
      securityPolicy: { version: 1 },
      parser: { ts: "1" },
      analysis: { ext: "1" },
      graph: { schemaVersion: 1 },
      schema: { incrementalIndex: 1 },
    }),
    ...overrides,
  };
}

const hash = (char: string) =>
  `sha256:${char
    .repeat(64)
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "a")}`;

function makeFileRecord(
  path: string,
  hashChar: string,
): CanonicalIndexFileRecord {
  return {
    recordType: "file",
    schemaVersion: 1,
    path,
    contentHash: hash(hashChar),
    sizeBytes: 100,
    mtimeMs: 1000000,
    classification: "text",
    securityDecision: { outcome: "include", reason: "policy allowed" },
    completeness: "complete",
  };
}

describe("full and incremental equivalence proof", () => {
  it("proves equivalence between clean build and incremental updates (add, modify, delete, rename)", async () => {
    const cleanDir = join(TEST_CACHE_HOME, "clean-build");
    const incDir = join(TEST_CACHE_HOME, "incremental-build");
    await rm(cleanDir, { recursive: true, force: true });
    await rm(incDir, { recursive: true, force: true });

    // Step 1: Incremental sequence
    await openLocalIndex(incDir, REPO_ID);
    await writeLocalIndexSemanticState(incDir, dummySemanticState());

    // Initial state: src/a.ts, src/b.ts
    await commitAtomicIndexTransaction(incDir, {
      transactionId: "tx-1",
      repositoryId: REPO_ID,
      startedAt: "2026-07-31T00:00:00.000Z",
      completedAt: "2026-07-31T00:00:01.000Z",
      records: [
        makeFileRecord("src/a.ts", "a"),
        makeFileRecord("src/b.ts", "b"),
      ],
      semanticState: dummySemanticState(),
    });

    // Incremental update: modify src/a.ts, delete src/b.ts, add src/c.ts, rename src/d.ts
    await commitAtomicIndexTransaction(incDir, {
      transactionId: "tx-2",
      repositoryId: REPO_ID,
      startedAt: "2026-07-31T00:01:00.000Z",
      completedAt: "2026-07-31T00:01:01.000Z",
      records: [
        makeFileRecord("src/a.ts", "x"),
        makeFileRecord("src/c.ts", "c"),
        makeFileRecord("src/d-renamed.ts", "d"),
      ],
      removals: [
        {
          path: "src/b.ts",
          reason: "deleted",
          deletionBasis: "canonical-state-diff",
          invalidationIdentity: "inv-1",
        },
        {
          path: "src/d.ts",
          reason: "renamed",
          deletionBasis: "canonical-state-diff",
          invalidationIdentity: "inv-2",
          renamedTo: "src/d-renamed.ts",
        },
      ],
      semanticState: dummySemanticState({ contentHash: hash("f") }),
    });

    const incFinal = await readCommittedIndexState(incDir);

    // Step 2: Clean build directly to the final state
    await openLocalIndex(cleanDir, REPO_ID);
    await writeLocalIndexSemanticState(
      cleanDir,
      dummySemanticState({ contentHash: hash("f") }),
    );
    await commitAtomicIndexTransaction(cleanDir, {
      transactionId: "tx-clean",
      repositoryId: REPO_ID,
      startedAt: "2026-07-31T00:02:00.000Z",
      completedAt: "2026-07-31T00:02:01.000Z",
      records: [
        makeFileRecord("src/a.ts", "x"),
        makeFileRecord("src/c.ts", "c"),
        makeFileRecord("src/d-renamed.ts", "d"),
      ],
      semanticState: dummySemanticState({ contentHash: hash("f") }),
    });

    const cleanFinal = await readCommittedIndexState(cleanDir);

    // Step 3: Compare canonical file records for equivalence
    expect(incFinal?.records).toEqual(cleanFinal?.records);

    await rm(cleanDir, { recursive: true, force: true });
    await rm(incDir, { recursive: true, force: true });
  });
});
