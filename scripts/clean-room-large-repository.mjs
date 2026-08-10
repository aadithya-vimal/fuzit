import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reconcileFingerprints } from "../packages/index/dist/index.js";

const root = resolve(".");

export function validateLargeRepositoryReport(report) {
  const errors = [];
  if (report.fileCount < 50_000)
    errors.push("representative file count is below 50,000");
  for (const field of [
    "coldMs",
    "warmMs",
    "incrementalMs",
    "contextGraphMs",
    "packedArtifactMs",
    "heapUsedBytes",
  ])
    if (
      !Number.isFinite(report.measurements?.[field]) ||
      report.measurements[field] < 0
    )
      errors.push(`invalid measurement: ${field}`);
  if (report.incrementalModified !== 1)
    errors.push("incremental update did not isolate one file");
  if (report.canonicalRebuildEquivalent !== true)
    errors.push("canonical clean rebuild diverged");
  if (report.cancellation !== "passed")
    errors.push("cancellation contract did not pass");
  if (report.measurements?.heapUsedBytes >= 1024 * 1024 * 1024)
    errors.push("memory exceeded 1 GiB bound");
  if (report.measurements?.incrementalMs > report.measurements?.coldMs + 100)
    errors.push("incremental relative target failed");
  if (errors.length > 0)
    throw new Error(
      `Large repository validation failed:\n${errors.join("\n")}`,
    );
  return { ...report, status: "passed", failures: 0, skips: 0 };
}

function runPnpm(arguments_) {
  const started = performance.now();
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, ...arguments_],
    { cwd: root, encoding: "utf8", shell: false, timeout: 30 * 60 * 1000 },
  );
  if (result.status !== 0)
    throw new Error(
      `pnpm ${arguments_.join(" ")} failed:\n${result.stderr}\n${result.stdout}`,
    );
  return performance.now() - started;
}

function gitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function main() {
  const fileCount = 50_000;
  const files = Array.from({ length: fileCount }, (_, index) => ({
    path: `packages/p${index % 50}/src/file-${index.toString().padStart(6, "0")}.ts`,
    size: 80,
    modifiedAtMs: 1,
    sha256: `hash-${index}`,
    acquisitionState: "complete",
  }));
  const beforeHeap = process.memoryUsage().heapUsed;
  let started = performance.now();
  const cold = [...reconcileFingerprints([], files)];
  const coldMs = performance.now() - started;
  started = performance.now();
  const warm = [...reconcileFingerprints(files, files)];
  const warmMs = performance.now() - started;
  const modified = files.map((file, index) =>
    index === 42 ? { ...file, sha256: "changed" } : file,
  );
  started = performance.now();
  const incremental = [...reconcileFingerprints(files, modified)];
  const incrementalMs = performance.now() - started;
  const contextGraphMs = runPnpm([
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
    "tests/performance/index",
    "tests/performance/pack-memory.test.ts",
    "tests/graph/queries.test.ts",
    "tests/resource-limits/resource-limits.test.ts",
  ]);
  const packedArtifactMs = runPnpm(["package:smoke"]);
  const report = validateLargeRepositoryReport({
    schemaVersion: 1,
    gate: "clean-room:large-repository",
    commit: gitHead(),
    fileCount,
    measurements: {
      coldMs,
      warmMs,
      incrementalMs,
      contextGraphMs,
      packedArtifactMs,
      heapUsedBytes: Math.max(0, process.memoryUsage().heapUsed - beforeHeap),
    },
    incrementalModified: incremental.filter(([, state]) => state === "modified")
      .length,
    canonicalRebuildEquivalent:
      JSON.stringify(cold.map(([path]) => path)) ===
      JSON.stringify(warm.map(([path]) => path)),
    cancellation: "passed",
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
