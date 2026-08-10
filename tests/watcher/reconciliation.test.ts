import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createIndexIdentitySet,
  createRepositoryId,
  openLocalIndex,
  readCommittedIndexState,
  writeLocalIndexSemanticState,
  type IndexSemanticVersions,
} from "@fuzit/index";
import { EventCoalescer, reconcileRepositoryState } from "@fuzit/watcher";
import type { WatcherBatch, WatcherEvent } from "@fuzit/schemas";

const TEST_REPO = resolve("tests/watcher/tmp-reconcile-repo");
const TEST_CACHE = resolve("tests/watcher/tmp-reconcile-cache");
const REPO_ID = createRepositoryId("reconcile-repo");

function dummySemanticState(): IndexSemanticVersions {
  const hash = (char: string) => `sha256:${char.repeat(64)}`;
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
  };
}

describe("overflow and uncertainty reconciliation", () => {
  it("reconciles full repository state on event queue overflow", async () => {
    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE, { recursive: true, force: true });
    await mkdir(join(TEST_REPO, "src"), { recursive: true });

    // Create 10 files
    for (let i = 0; i < 10; i++) {
      await writeFile(join(TEST_REPO, `src/file${i}.ts`), `content ${i}`);
    }

    const indexPath = join(TEST_CACHE, "index");
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummySemanticState());

    // Create coalescer with maxBatchSize 5 to simulate overflow
    const coalescer = new EventCoalescer({ maxBatchSize: 5 });
    const events: WatcherEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        contractVersion: 1,
        kind: "add",
        path: `src/file${i}.ts`,
        timestampMs: Date.now(),
      });
    }
    coalescer.pushAll(events);

    const batch = coalescer.flush("batch-overflow");
    expect(batch.overflowOccurred).toBe(true);

    const result = await reconcileRepositoryState(batch, {
      indexPath,
      repositoryId: REPO_ID,
      repositoryRoot: TEST_REPO,
      semanticState: dummySemanticState(),
    });

    expect(result.isOverflowReconciled).toBe(true);
    expect(result.addedCount).toBe(10);

    const state = await readCommittedIndexState(indexPath);
    expect(state?.records.length).toBe(10);

    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE, { recursive: true, force: true });
  });

  it("is idempotent when reconciling unchanged repository state", async () => {
    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE, { recursive: true, force: true });
    await mkdir(join(TEST_REPO, "src"), { recursive: true });
    await writeFile(join(TEST_REPO, "src/file1.ts"), "content 1");

    const indexPath = join(TEST_CACHE, "index");
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummySemanticState());

    const batch: WatcherBatch = {
      contractVersion: 1,
      batchId: "batch-1",
      events: [],
      overflowOccurred: false,
      reconciliationRequired: false,
    };

    const res1 = await reconcileRepositoryState(batch, {
      indexPath,
      repositoryId: REPO_ID,
      repositoryRoot: TEST_REPO,
      semanticState: dummySemanticState(),
    });
    expect(res1.addedCount).toBe(1);

    const res2 = await reconcileRepositoryState(batch, {
      indexPath,
      repositoryId: REPO_ID,
      repositoryRoot: TEST_REPO,
      semanticState: dummySemanticState(),
    });
    expect(res2.addedCount).toBe(0);
    expect(res2.updatedCount).toBe(0);
    expect(res2.deletedCount).toBe(0);

    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE, { recursive: true, force: true });
  });
});
