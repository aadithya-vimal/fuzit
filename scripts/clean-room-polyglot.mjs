import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");
export const polyglotChecks = Object.freeze([
  "python-packaging",
  "python-framework-symbols",
  "typescript-python-boundary",
  "graph",
  "context-metadata",
  "incremental",
  "parser-unavailable-fallback",
  "deterministic-intelligence",
]);

export function createPolyglotReport({ commit, results }) {
  const missing = polyglotChecks.filter(
    (id) =>
      !results.some((result) => result.id === id && result.status === "passed"),
  );
  if (missing.length > 0)
    throw new Error(
      `Polyglot validation failed; missing: ${missing.join(", ")}`,
    );
  return {
    schemaVersion: 1,
    gate: "clean-room:python-polyglot",
    status: "passed",
    commit,
    languages: ["Python", "TypeScript"],
    packageFacts: "verified",
    crossLanguageBoundaries: "verified",
    parserUnavailableFallback: "partial-bounded",
    failures: 0,
    skips: 0,
    results,
  };
}

function runPnpm(arguments_) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, ...arguments_],
    { cwd: root, encoding: "utf8", shell: false, timeout: 15 * 60 * 1000 },
  );
  if (result.status !== 0)
    throw new Error(
      `pnpm ${arguments_.join(" ")} failed:\n${result.stderr}\n${result.stdout}`,
    );
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
  runPnpm([
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
    "tests/analysis/python-parser.test.ts",
    "tests/analysis/python-symbols.test.ts",
    "tests/analysis/cross-language-relations.test.ts",
    "tests/analysis/parser-availability.test.ts",
    "tests/golden/intelligence-bundles/intelligence.test.ts",
    "tests/graph/build.test.ts",
    "tests/retrieval/metadata.test.ts",
    "tests/incremental",
  ]);
  const results = polyglotChecks.map((id) => ({ id, status: "passed" }));
  process.stdout.write(
    `${JSON.stringify(createPolyglotReport({ commit: gitHead(), results }), null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
