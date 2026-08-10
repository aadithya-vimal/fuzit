import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const documentationAccuracyPlan = Object.freeze([
  ["local-build", "docs:build"],
  ["links-json-public-boundary", "docs:check"],
  ["public-contracts", "test:docs"],
  ["packed-commands", "package:smoke"],
  ["limitations-risk-register", "risks:check"],
  ["license-claims", "audit:licenses"],
  ["public-source-boundary", "audit:disclosure"],
]);

function execute([, script]) {
  const startedAt = performance.now();
  if (!process.env.npm_execpath)
    return {
      status: 1,
      durationMs: 0,
      error: "pnpm must invoke docs:accuracy",
    };
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, script],
    {
      encoding: "utf8",
      stdio: "inherit",
      shell: false,
      timeout: 15 * 60 * 1000,
      env: { ...process.env, NPM_CONFIG_OFFLINE: "true" },
    },
  );
  return {
    status: result.status ?? 1,
    durationMs: Math.round(performance.now() - startedAt),
    ...(result.error ? { error: result.error.message } : {}),
  };
}

export function runDocumentationAccuracy({
  plan = documentationAccuracyPlan,
  run = execute,
} = {}) {
  const results = plan.map((step) => {
    const outcome = run(step);
    return {
      id: step[0],
      command: `pnpm ${step[1]}`,
      status: outcome.status === 0 ? "passed" : "failed",
      exitCode: outcome.status,
      durationMs: outcome.durationMs ?? 0,
      ...(outcome.error ? { error: outcome.error } : {}),
    };
  });
  return {
    schemaVersion: 1,
    gate: "docs:accuracy",
    status: results.every(({ exitCode }) => exitCode === 0)
      ? "passed"
      : "failed",
    results,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const summary = runDocumentationAccuracy();
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.status !== "passed") process.exitCode = 1;
}
