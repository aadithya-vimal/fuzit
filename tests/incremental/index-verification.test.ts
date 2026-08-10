import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createIndexIdentitySet,
  createRepositoryId,
  openLocalIndex,
  verifyLocalIndex,
  writeLocalIndexSemanticState,
  type IndexSemanticVersions,
} from "@fuzit/index";

const TEST_CACHE_HOME = resolve("tests/incremental/tmp-cache-verify");
const REPO_FINGERPRINT = "test-repo-fingerprint-v1-016";
const REPO_ID = createRepositoryId(REPO_FINGERPRINT);

function dummyState(overrides?: Partial<IndexSemanticVersions>): IndexSemanticVersions {
  return {
    contentHash: "hash1",
    configHash: "config1",
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

describe("index verification", () => {
  it("verifies ready index", async () => {
    const indexPath = join(TEST_CACHE_HOME, "ready-index");
    await rm(indexPath, { recursive: true, force: true });
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummyState());

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("ready");
    expect(result.valid).toBe(true);
    expect(result.rebuildRequired).toBe(false);
    expect(result.reasons).toEqual([]);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects absent index", async () => {
    const indexPath = join(TEST_CACHE_HOME, "absent-index");
    await rm(indexPath, { recursive: true, force: true });

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("absent");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
  });

  it("detects corrupt index metadata", async () => {
    const indexPath = join(TEST_CACHE_HOME, "corrupt-index");
    await rm(indexPath, { recursive: true, force: true });
    await mkdir(indexPath, { recursive: true });
    await writeFile(join(indexPath, "index.json"), "invalid json content");

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("corrupt");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects incomplete index missing semantic state", async () => {
    const indexPath = join(TEST_CACHE_HOME, "incomplete-index");
    await rm(indexPath, { recursive: true, force: true });
    await openLocalIndex(indexPath, REPO_ID);

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("incomplete");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects repository mismatch", async () => {
    const indexPath = join(TEST_CACHE_HOME, "repo-mismatch-index");
    await rm(indexPath, { recursive: true, force: true });
    await openLocalIndex(indexPath, "sha256:0000000000000000000000000000000000000000000000000000000000000000");

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("repository-mismatch");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects schema mismatch", async () => {
    const indexPath = join(TEST_CACHE_HOME, "schema-mismatch-index");
    await rm(indexPath, { recursive: true, force: true });
    await mkdir(indexPath, { recursive: true });
    await writeFile(
      join(indexPath, "index.json"),
      JSON.stringify({ schemaVersion: 99, repositoryId: REPO_ID, createdAt: new Date().toISOString() }),
    );

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("schema-mismatch");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects stale index when content hash changes", async () => {
    const indexPath = join(TEST_CACHE_HOME, "stale-index");
    await rm(indexPath, { recursive: true, force: true });
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummyState({ contentHash: "old-hash" }));

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState({ contentHash: "new-hash" }),
    });

    expect(result.status).toBe("stale");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects policy mismatch when security policy identity changes", async () => {
    const indexPath = join(TEST_CACHE_HOME, "policy-mismatch-index");
    await rm(indexPath, { recursive: true, force: true });
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(
      indexPath,
      dummyState({
        identities: createIndexIdentitySet({
          effectiveConfiguration: { format: "json" },
          ignorePolicy: { rules: [] },
          securityPolicy: { version: 1 },
          parser: { ts: "1" },
          analysis: { ext: "1" },
          graph: { schemaVersion: 1 },
          schema: { incrementalIndex: 1 },
        }),
      }),
    );

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState({
        identities: createIndexIdentitySet({
          effectiveConfiguration: { format: "json" },
          ignorePolicy: { rules: [] },
          securityPolicy: { version: 2 },
          parser: { ts: "1" },
          analysis: { ext: "1" },
          graph: { schemaVersion: 1 },
          schema: { incrementalIndex: 1 },
        }),
      }),
    });

    expect(result.status).toBe("policy-mismatch");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(true);
    await rm(indexPath, { recursive: true, force: true });
  });

  it("detects locked index", async () => {
    const indexPath = join(TEST_CACHE_HOME, "locked-index");
    await rm(indexPath, { recursive: true, force: true });
    await mkdir(indexPath, { recursive: true });
    await writeFile(join(indexPath, "index.lock"), "lock");

    const result = await verifyLocalIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.status).toBe("locked");
    expect(result.valid).toBe(false);
    expect(result.rebuildRequired).toBe(false);
    await rm(indexPath, { recursive: true, force: true });
  });
});
