import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const finalAuditPlan = Object.freeze([
  ["secrets", "pnpm", "audit:secrets"],
  ["adversarial", "pnpm", "test:adversarial"],
  ["network-privacy", "pnpm", "audit:privacy"],
  ["plugins", "pnpm", "test:plugins"],
  ["mcp", "pnpm", "test:mcp"],
  ["extension", "pnpm", "test:vscode"],
  ["history", "pnpm", "audit:history"],
  ["dependencies-licenses", "pnpm", "audit:licenses"],
  ["sbom", "pnpm", "sbom:generate"],
  ["artifacts", "pnpm", "artifacts:verify"],
]);

function execute([, program, script]) {
  const startedAt = performance.now();
  if (program === "pnpm" && !process.env.npm_execpath)
    return { status: 1, durationMs: 0, error: "pnpm must invoke audit:final" };
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

export function runFinalAudits({ plan = finalAuditPlan, run = execute } = {}) {
  const results = plan.map((step) => {
    const outcome = run(step);
    return {
      id: step[0],
      command: `${step[1]} ${step[2]}`,
      status: outcome.status === 0 ? "passed" : "failed",
      exitCode: outcome.status,
      durationMs: outcome.durationMs ?? 0,
      findings: outcome.findings ?? [],
      ...(outcome.error ? { error: outcome.error } : {}),
    };
  });
  return {
    schemaVersion: 1,
    gate: "audit:final",
    status: results.every(({ exitCode }) => exitCode === 0)
      ? "passed"
      : "failed",
    criticalOrHighFindings: results
      .flatMap(({ findings }) => findings)
      .filter(({ severity }) => severity === "critical" || severity === "high")
      .length,
    results,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const summary = runFinalAudits();
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (summary.status !== "passed" || summary.criticalOrHighFindings > 0)
    process.exitCode = 1;
}
