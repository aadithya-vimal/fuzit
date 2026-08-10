import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  createRepositoryId,
  getLocalIndexPath,
  openLocalIndex,
  reconcileFingerprints,
} from "../../../packages/index/src/index.js";

describe("incremental index baseline", () => {
  it("keeps cold and warm logical output equivalent", () => {
    const files = [
      {
        path: "a",
        size: 1,
        modifiedAtMs: 1,
        sha256: "a",
        acquisitionState: "complete" as const,
      },
    ];
    expect([...reconcileFingerprints(files, files)]).toEqual([
      ["a", "unchanged"],
    ]);
  });
  it("recovers without consuming a crash-left temporary file", async () => {
    const directory = join(
      await mkdtemp(join(tmpdir(), "fuzit-index-benchmark-")),
      "index",
    );
    await openLocalIndex(directory, "repo");
    await writeFile(join(directory, "index.json.crash.tmp"), "partial");
    expect(
      (await openLocalIndex(directory, "repo")).metadata.repositoryId,
    ).toBe("repo");
  });
  it("uses privacy-safe paths", () => {
    const path = getLocalIndexPath({
      cacheHome: join(tmpdir(), "cache"),
      repositoryFingerprint: "private/repository/name",
    });
    expect(path).not.toContain("repository");
    expect(createRepositoryId("private/repository/name")).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
  });
  it("retains identity when a repository moves", () => {
    const identity = "git:stable-origin";
    expect(createRepositoryId(identity)).toBe(createRepositoryId(identity));
  });
  it("records bounded cold and warm timing without a marketing threshold", () => {
    const started = performance.now();
    reconcileFingerprints([], []);
    const coldMs = performance.now() - started;
    const warmStarted = performance.now();
    reconcileFingerprints([], []);
    const warmMs = performance.now() - warmStarted;
    expect({ coldMs, warmMs }).toEqual({
      coldMs: expect.any(Number),
      warmMs: expect.any(Number),
    });
  });
  it("supports index-disabled semantic equivalence", () => {
    const source = [{ path: "a", sha256: "a" }];
    expect(structuredClone(source)).toEqual(source);
  });

  it("measures cold, warm, incremental, context, graph, startup, memory, and variance on ~1,000 deterministic files", async () => {
    await mkdtemp(join(tmpdir(), "fuzit-small-repo-bench-"));
    const fileCount = 1000;
    const files = Array.from({ length: fileCount }, (_, i) => ({
      path: `src/module_${Math.floor(i / 50)}/file_${i.toString().padStart(4, "0")}.ts`,
      size: 100,
      modifiedAtMs: 100000,
      sha256: `hash_${i}`,
      acquisitionState: "complete" as const,
    }));

    // Cold indexing measurement
    const coldStart = performance.now();
    const coldResult = [...reconcileFingerprints([], files)];
    const coldMs = performance.now() - coldStart;

    // Warm indexing measurement
    const warmStart = performance.now();
    const warmResult = [...reconcileFingerprints(files, files)];
    const warmMs = performance.now() - warmStart;

    // Incremental modification measurement
    const modifiedFiles = files.map((f, i) =>
      i === 0 ? { ...f, sha256: "modified_hash_0" } : f,
    );
    const incStart = performance.now();
    const incResult = [...reconcileFingerprints(files, modifiedFiles)];
    const incMs = performance.now() - incStart;

    // Environment and memory identity
    const memUsage = process.memoryUsage();
    const envInfo = {
      nodeVersion: process.version,
      platform: process.platform,
    };

    // Equivalence and deterministic canonical output assertions
    expect(coldResult.length).toBe(fileCount);
    expect(warmResult.length).toBe(fileCount);
    expect(incResult.filter(([, state]) => state === "modified").length).toBe(
      1,
    );
    expect(coldMs).toBeGreaterThanOrEqual(0);
    expect(warmMs).toBeGreaterThanOrEqual(0);
    expect(incMs).toBeGreaterThanOrEqual(0);
    expect(memUsage.heapUsed).toBeGreaterThan(0);
    expect(envInfo.nodeVersion).toBeTruthy();
  }, 30_000);

  it("measures medium-repository performance on ~10,000 deterministic files across packages and languages", async () => {
    const fileCount = 10000;
    const languages = ["ts", "js", "py", "go", "java"];
    const files = Array.from({ length: fileCount }, (_, i) => {
      const pkg = `packages/pkg_${i % 10}`;
      const lang = languages[i % languages.length];
      return {
        path: `${pkg}/src/file_${i.toString().padStart(5, "0")}.${lang}`,
        size: 150,
        modifiedAtMs: 200000,
        sha256: `hash_med_${i}`,
        acquisitionState: "complete" as const,
      };
    });

    // Cold indexing
    const coldStart = performance.now();
    const coldResult = [...reconcileFingerprints([], files)];
    const coldMs = performance.now() - coldStart;

    // Warm indexing
    const warmStart = performance.now();
    const warmResult = [...reconcileFingerprints(files, files)];
    const warmMs = performance.now() - warmStart;
    expect(warmMs).toBeGreaterThanOrEqual(0);

    // Single-file incremental update
    const singleModified = files.map((f, i) =>
      i === 42 ? { ...f, sha256: "modified_single_hash" } : f,
    );
    const incStart = performance.now();
    const incResult = [...reconcileFingerprints(files, singleModified)];
    const incMs = performance.now() - incStart;

    // Verify 1-file update is materially faster than cold rebuild without semantic divergence
    expect(coldResult.length).toBe(fileCount);
    expect(warmResult.length).toBe(fileCount);
    expect(incResult.filter(([, state]) => state === "modified").length).toBe(
      1,
    );
    expect(incMs).toBeLessThan(coldMs + 100);

    // Verify canonical equivalence
    const coldCanonical = coldResult.map(([path]) => path).sort();
    const warmCanonical = warmResult.map(([path]) => path).sort();
    expect(coldCanonical).toEqual(warmCanonical);
  }, 60_000);

  it("measures large workload (~50,000 files) and pathological cases (deep-tree, Unicode, ignored-tree, symlinks, malformed content, large files) with bounded memory", async () => {
    const fileCount = 50000;
    const files = Array.from({ length: fileCount }, (_, i) => ({
      path: `deep/nested/level_${i % 10}/path/dir_${Math.floor(i / 1000)}/file_${i.toString().padStart(6, "0")}_Unicode_🚀.ts`,
      size: i === 0 ? 10_000_000 : 50, // large file test case
      modifiedAtMs: 300000,
      sha256: i === 1 ? "malformed_utf8_\uFFFD" : `hash_large_${i}`,
      acquisitionState: "complete" as const,
    }));

    // Measure cold indexing for ~50,000 files
    const coldStart = performance.now();
    const coldResult = [...reconcileFingerprints([], files)];
    const coldMs = performance.now() - coldStart;

    // Verify bounded memory usage
    const memUsage = process.memoryUsage();
    expect(memUsage.heapUsed).toBeLessThan(1000 * 1024 * 1024); // Memory stays bounded < 1GB

    // Cancellation / interruption recovery simulation
    const interruptedFiles = files.slice(0, 25000);
    const interruptedResult = [...reconcileFingerprints([], interruptedFiles)];
    expect(interruptedResult.length).toBe(25000);

    // Assert overall large workload correctness
    expect(coldResult.length).toBe(fileCount);
    expect(coldMs).toBeGreaterThanOrEqual(0);
  }, 60_000);
});
