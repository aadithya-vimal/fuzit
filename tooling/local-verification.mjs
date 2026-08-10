import { spawnSync } from "node:child_process";

const pnpmPath = process.env.npm_execpath;
if (!pnpmPath) throw new Error("pnpm must invoke local verification");

const suites = {
  checkpoint: [
    "build",
    "format:check",
    "lint",
    "typecheck",
    "test",
    "verify:goldens",
  ],
  phase: [
    "build",
    "format:check",
    "lint",
    "typecheck",
    "test",
    "verify:goldens",
    "test:incremental",
    "test:watcher",
    "test:analysis",
    "test:intelligence",
    "test:retrieval",
    "test:graph",
    "test:mcp",
    "test:security",
    "audit:secrets",
    "audit:privacy",
    "package:smoke",
  ],
  release: ["verify:phase", "acceptance:v1", "release:check"],
  all: ["verify:release", "benchmark:index", "benchmark:v1"],
};

const suite = process.argv[2];
if (!(suite in suites)) throw new Error(`unknown verification suite: ${suite}`);

for (const script of suites[suite]) {
  const result = spawnSync(process.execPath, [pnpmPath, "run", script], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const diff = spawnSync("git", ["diff", "--check"], { stdio: "inherit" });
if (diff.status !== 0) process.exit(diff.status ?? 1);
