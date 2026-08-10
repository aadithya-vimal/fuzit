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
import { applyEventsToLocalIndex } from "@fuzit/watcher";
import type { WatcherEvent } from "@fuzit/schemas";

const TEST_REPO = resolve("tests/watcher/tmp-applier-repo");
const TEST_CACHE_HOME = resolve("tests/watcher/tmp-applier-cache");
const REPO_ID = createRepositoryId("applier-repo");

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

describe("event transaction applier", () => {
  it("applies add, modify, delete, and rename events into atomic index transaction", async () => {
    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE_HOME, { recursive: true, force: true });
    await mkdir(join(TEST_REPO, "src"), { recursive: true });
    await writeFile(join(TEST_REPO, "src/a.ts"), "const a = 1;");
    await writeFile(join(TEST_REPO, "src/b-renamed.ts"), "const b = 2;");

    const indexPath = join(TEST_CACHE_HOME, "index");
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummySemanticState());

    const events: WatcherEvent[] = [
      {
        contractVersion: 1,
        kind: "add",
        path: "src/a.ts",
        timestampMs: Date.now(),
      },
      {
        contractVersion: 1,
        kind: "delete",
        path: "src/old-b.ts",
        timestampMs: Date.now(),
      },
      {
        contractVersion: 1,
        kind: "rename",
        path: "src/old-b.ts",
        renamedTo: "src/b-renamed.ts",
        timestampMs: Date.now(),
      },
    ];

    const result = await applyEventsToLocalIndex(events, {
      indexPath,
      repositoryId: REPO_ID,
      repositoryRoot: TEST_REPO,
      semanticState: dummySemanticState(),
    });

    expect(result.appliedCount).toBe(3);

    const state = await readCommittedIndexState(indexPath);
    expect(state?.records.map((r) => r.path)).toContain("src/a.ts");
    expect(state?.records.map((r) => r.path)).not.toContain("src/old-b.ts");

    await rm(TEST_REPO, { recursive: true, force: true });
    await rm(TEST_CACHE_HOME, { recursive: true, force: true });
  });
});
