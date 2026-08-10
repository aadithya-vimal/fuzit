import { performance } from "node:perf_hooks";
import {
  mkdir,
  readFile,
  readdir,
  writeFile as writeFsFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import {
  compareBaseline,
  measureRetrieval,
} from "../packages/benchmark/dist/index.js";

const directory = resolve("benchmarks/retrieval");
const baseline = JSON.parse(
  await readFile(resolve(directory, "baseline.json"), "utf8"),
);
const cases = (await readdir(directory))
  .filter((path) => path !== "baseline.json" && path.endsWith(".json"))
  .sort();
const results = [];
for (const path of cases) {
  const input = JSON.parse(await readFile(resolve(directory, path), "utf8"));
  const start = performance.now();
  const metrics = measureRetrieval(input);
  const latencyMs = performance.now() - start;
  const comparison = compareBaseline(metrics, baseline[input.id] ?? metrics);
  results.push({
    id: input.id,
    ...metrics,
    latencyMs,
    regression: comparison.regressed,
  });
}
const outputPayload = {
  schemaVersion: 1,
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  results,
};
const resultsDir = resolve("benchmarks/results");
await mkdir(resultsDir, { recursive: true });
await writeFsFile(
  resolve(resultsDir, "v1-release-baseline.json"),
  `${JSON.stringify(outputPayload, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(outputPayload, null, 2)}\n`);
if (results.some(({ regression }) => regression)) process.exitCode = 1;
