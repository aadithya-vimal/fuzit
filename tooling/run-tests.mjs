import { spawnSync } from "node:child_process";

const packageTestDirectories = new Map([
  ["resource-limits", "tests/resource-limits"],
  ["@fuzit/benchmark", "packages/benchmark/test"],
  ["@fuzit/analysis", "packages/analysis/test"],
  ["@fuzit/selection", "packages/selection/test"],
  ["@fuzit/profiles", "packages/profiles/test"],
  ["@fuzit/git", "packages/git/test"],
  ["@fuzit/index", "packages/index/test"],
  ["@fuzit/budgeting", "packages/budgeting/test"],
  ["@fuzit/config", "packages/config/test"],
  ["@fuzit/core", "packages/core/test"],
  ["@fuzit/discovery", "packages/discovery/test"],
  ["@fuzit/schemas", "packages/schemas/test"],
  ["@fuzit/scanner", "packages/scanner/test"],
  ["@fuzit/renderer-markdown", "packages/renderers/markdown/test"],
  ["@fuzit/renderer-core", "packages/renderers/core/test"],
  ["@fuzit/renderer-json", "packages/renderers/json/test"],
  ["@fuzit/renderer-text", "packages/renderers/text/test"],
  ["@fuzit/renderer-xml", "packages/renderers/xml/test"],
  ["@fuzit/security", "packages/security/test"],
  ["@fuzit/snapshots", "packages/snapshots/test"],
]);

const filters = [];
const argumentsAfterSeparator = process.argv.slice(2);

for (let index = 0; index < argumentsAfterSeparator.length; index += 1) {
  const argument = argumentsAfterSeparator[index];

  if (argument !== "--filter") {
    throw new Error(`unsupported test argument: ${argument}`);
  }

  const packageName = argumentsAfterSeparator[index + 1];
  if (!packageName || !packageTestDirectories.has(packageName)) {
    throw new Error(`unsupported test filter: ${packageName ?? ""}`);
  }

  filters.push(packageTestDirectories.get(packageName));
  index += 1;
}

const pnpmPath = process.env.npm_execpath;
if (!pnpmPath) {
  throw new Error("pnpm must invoke the test wrapper");
}

const testPaths = [...new Set(filters)];
const result = spawnSync(
  process.execPath,
  [
    pnpmPath,
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
    ...testPaths,
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
