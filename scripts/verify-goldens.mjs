import { spawnSync } from "node:child_process";

const pnpmPath = process.env.npm_execpath;
if (!pnpmPath) throw new Error("pnpm must invoke the golden verifier");

const result = spawnSync(
  process.execPath,
  [
    pnpmPath,
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
    "tests/golden/pack",
    "tests/golden/git",
    "tests/golden/delta-bundles",
    "tests/golden/intelligence-bundles",
    "tests/performance",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
