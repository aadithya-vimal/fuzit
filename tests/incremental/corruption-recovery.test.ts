import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createIndexIdentitySet,
  createRepositoryId,
  openLocalIndex,
  recoverCorruptIndex,
  writeLocalIndexSemanticState,
  type IndexSemanticVersions,
} from "@fuzit/index";

const TEST_CACHE_HOME = resolve("tests/incremental/tmp-cache-recovery");
const REPO_FINGERPRINT = "test-repo-fingerprint-v1-017";
const REPO_ID = createRepositoryId(REPO_FINGERPRINT);

function dummyState(): IndexSemanticVersions {
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
  };
}

describe("corruption recovery", () => {
  it("cleans abandoned staging files to restore index readiness", async () => {
    const indexPath = join(TEST_CACHE_HOME, "fuzit/indexes/v1", REPO_ID.slice(7), "staging-index");
    await rm(indexPath, { recursive: true, force: true });
    await openLocalIndex(indexPath, REPO_ID);
    await writeLocalIndexSemanticState(indexPath, dummyState());

    const txDir = join(indexPath, "transactions");
    await mkdir(txDir, { recursive: true });
    await writeFile(join(txDir, "abandoned.staged.json"), "{ truncated }");

    const result = await recoverCorruptIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.recovered).toBe(true);
    expect(result.actionTaken).toBe("cleaned-staging-files");
    await rm(indexPath, { recursive: true, force: true });
  });

  it("cleans stale lock file older than threshold", async () => {
    const indexPath = join(TEST_CACHE_HOME, "fuzit/indexes/v1", REPO_ID.slice(7), "stale-lock-index");
    await rm(indexPath, { recursive: true, force: true });
    await mkdir(indexPath, { recursive: true });
    await writeFile(join(indexPath, "index.lock"), "lock");

    const result = await recoverCorruptIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
      maxStaleLockAgeMs: -1, // treat lock as immediately stale
    });

    expect(result.recovered).toBe(true);
    expect(result.actionTaken).toBe("cleaned-stale-lock");
    await rm(indexPath, { recursive: true, force: true });
  });

  it("purges corrupt Fuzit-owned index path safely", async () => {
    const indexPath = join(TEST_CACHE_HOME, "fuzit/indexes/v1", REPO_ID.slice(7), "corrupt-index");
    await rm(indexPath, { recursive: true, force: true });
    await mkdir(indexPath, { recursive: true });
    await writeFile(join(indexPath, "index.json"), "invalid json");

    const result = await recoverCorruptIndex({
      indexPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.recovered).toBe(true);
    expect(result.actionTaken).toBe("rebuilt-index");
    await expect(readFile(join(indexPath, "index.json"))).rejects.toThrow();
  });

  it("refuses to delete outside Fuzit index structure", async () => {
    const unsafePath = join(TEST_CACHE_HOME, "unrelated-user-folder");
    await rm(unsafePath, { recursive: true, force: true });
    await mkdir(unsafePath, { recursive: true });
    await writeFile(join(unsafePath, "user-file.txt"), "important data");

    const result = await recoverCorruptIndex({
      indexPath: unsafePath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.recovered).toBe(false);
    expect(result.actionTaken).toBe("none");
    const userContent = await readFile(join(unsafePath, "user-file.txt"), "utf8");
    expect(userContent).toBe("important data");
    await rm(unsafePath, { recursive: true, force: true });
  });

  it("refuses to operate on symlinked index directory", async () => {
    const targetPath = join(TEST_CACHE_HOME, "fuzit/indexes/v1", REPO_ID.slice(7), "symlink-target");
    const linkPath = join(TEST_CACHE_HOME, "fuzit/indexes/v1", REPO_ID.slice(7), "symlink-dir");
    await rm(targetPath, { recursive: true, force: true });
    await rm(linkPath, { recursive: true, force: true });
    await mkdir(targetPath, { recursive: true });
    try {
      await symlink(targetPath, linkPath, "dir");
    } catch {
      // symlink creation on Windows without privilege may fail; skip test if symlink unsupported
      return;
    }

    const result = await recoverCorruptIndex({
      indexPath: linkPath,
      expectedRepositoryId: REPO_ID,
      currentSemanticState: dummyState(),
    });

    expect(result.recovered).toBe(false);
    expect(result.details).toContain("symlinked");
    await rm(linkPath, { force: true });
    await rm(targetPath, { recursive: true, force: true });
  });
});
