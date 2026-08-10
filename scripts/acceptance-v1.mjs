import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const acceptanceScenarios = Object.freeze([
  { id: "product-build", category: "product", command: ["pnpm", "build"] },
  {
    id: "product-typecheck",
    category: "product",
    command: ["pnpm", "typecheck"],
  },
  { id: "product-tests", category: "product", command: ["pnpm", "test"] },
  {
    id: "platform-contracts",
    category: "platform",
    command: ["pnpm", "test:cross-platform"],
  },
  {
    id: "security-tests",
    category: "security",
    command: ["pnpm", "test:security"],
  },
  {
    id: "security-adversarial",
    category: "security",
    command: ["pnpm", "test:adversarial"],
  },
  {
    id: "security-secrets",
    category: "security",
    command: ["pnpm", "audit:secrets"],
  },
  {
    id: "security-privacy",
    category: "security",
    command: ["pnpm", "audit:privacy"],
  },
  {
    id: "incremental-tests",
    category: "incremental",
    command: ["pnpm", "test:incremental"],
  },
  { id: "graph-tests", category: "graph", command: ["pnpm", "test:graph"] },
  { id: "mcp-tests", category: "mcp", command: ["pnpm", "test:mcp"] },
  { id: "plugin-tests", category: "plugin", command: ["pnpm", "test:plugins"] },
  {
    id: "extension-tests",
    category: "extension",
    command: ["pnpm", "test:vscode"],
  },
  {
    id: "packaging-smoke",
    category: "packaging",
    command: ["pnpm", "package:smoke"],
  },
  { id: "docs-build", category: "docs", command: ["pnpm", "docs:build"] },
  { id: "docs-check", category: "docs", command: ["pnpm", "docs:check"] },
  { id: "docs-tests", category: "docs", command: ["pnpm", "test:docs"] },
  {
    id: "cleanliness-diff",
    category: "cleanliness",
    command: ["git", "diff", "--check"],
  },
]);

function executeScenario(scenario) {
  const startedAt = performance.now();
  const [program, ...arguments_] = scenario.command;
  const executable = program === "pnpm" ? process.execPath : program;
  const effectiveArguments =
    program === "pnpm" ? [process.env.npm_execpath, ...arguments_] : arguments_;
  if (program === "pnpm" && !process.env.npm_execpath) {
    return {
      status: 1,
      error: "pnpm must invoke acceptance:v1",
      durationMs: 0,
    };
  }
  const result = spawnSync(executable, effectiveArguments, {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    timeout: 15 * 60 * 1000,
  });
  return {
    status: result.status ?? 1,
    durationMs: Math.round(performance.now() - startedAt),
    ...(result.error ? { error: result.error.message } : {}),
  };
}

export function selectAcceptanceScenarios(filters = []) {
  const normalized = [...new Set(filters.map((value) => value.toLowerCase()))];
  const selected =
    normalized.length === 0
      ? acceptanceScenarios
      : acceptanceScenarios.filter(
          ({ id, category }) =>
            normalized.includes(category) || normalized.includes(id),
        );
  if (selected.length === 0) {
    throw new Error(`no acceptance scenarios match: ${normalized.join(", ")}`);
  }
  return selected;
}

export function runAcceptance({
  filters = [],
  execute = executeScenario,
} = {}) {
  const scenarios = selectAcceptanceScenarios(filters);
  const results = scenarios.map((scenario) => {
    const outcome = execute(scenario);
    return {
      id: scenario.id,
      category: scenario.category,
      command: scenario.command.join(" "),
      status: outcome.status === 0 ? "passed" : "failed",
      exitCode: outcome.status,
      durationMs: outcome.durationMs ?? 0,
      warnings: outcome.warnings ?? [],
      artifacts: outcome.artifacts ?? [],
      ...(outcome.error ? { error: outcome.error } : {}),
    };
  });
  return {
    schemaVersion: 1,
    gate: "acceptance:v1",
    status: results.every(({ exitCode }) => exitCode === 0)
      ? "passed"
      : "failed",
    filters: [...filters],
    scenarioCount: results.length,
    warningCount: results.reduce(
      (count, result) => count + result.warnings.length,
      0,
    ),
    results,
  };
}

function parseArguments(arguments_) {
  const filters = [];
  let list = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--list") list = true;
    else if (argument === "--filter" && arguments_[index + 1])
      filters.push(...arguments_[++index].split(",").filter(Boolean));
    else throw new Error(`unknown or incomplete argument: ${argument}`);
  }
  return { filters, list };
}

async function main() {
  try {
    const { filters, list } = parseArguments(process.argv.slice(2));
    if (list) {
      process.stdout.write(
        `${JSON.stringify({ schemaVersion: 1, gate: "acceptance:v1", scenarios: selectAcceptanceScenarios(filters) })}\n`,
      );
      return;
    }
    const summary = runAcceptance({ filters });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    if (summary.status !== "passed") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ schemaVersion: 1, gate: "acceptance:v1", status: "failed", error: error.message })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
