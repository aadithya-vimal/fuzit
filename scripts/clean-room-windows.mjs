import { spawnSync } from "node:child_process";
import { cpus, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");

export const windowsCleanRoomScenarios = Object.freeze([
  { id: "private-artifacts", command: ["pnpm", "artifacts:verify"] },
  {
    id: "packed-cli-watcher-graph-mcp-plugin-snapshot-delta",
    command: ["pnpm", "package:smoke"],
  },
  { id: "extension-package", command: ["pnpm", "test:vscode"] },
  { id: "security", command: ["pnpm", "test:security"] },
  { id: "cleanliness", command: ["git", "diff", "--check"] },
]);

function execute(scenario) {
  const [program, ...arguments_] = scenario.command;
  const executable = program === "pnpm" ? process.execPath : program;
  const effectiveArguments =
    program === "pnpm" ? [process.env.npm_execpath, ...arguments_] : arguments_;
  const result = spawnSync(executable, effectiveArguments, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    timeout: 30 * 60 * 1000,
    env: {
      ...process.env,
      NPM_TOKEN: "",
      NODE_AUTH_TOKEN: "",
      VSCE_PAT: "",
      GITHUB_TOKEN: "",
      GH_TOKEN: "",
    },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  };
}

export function createWindowsCleanRoomReport({
  platform,
  architecture,
  node,
  commit,
  scenarios,
  artifactHashes,
}) {
  if (platform !== "win32")
    throw new Error(`Windows clean-room requires win32; received ${platform}`);
  const errors = [];
  if (scenarios.length !== windowsCleanRoomScenarios.length)
    errors.push("mandatory scenario count mismatch");
  for (const expected of windowsCleanRoomScenarios) {
    const actual = scenarios.find(({ id }) => id === expected.id);
    if (!actual) errors.push(`mandatory scenario missing: ${expected.id}`);
    else if (actual.status !== "passed" || actual.exitCode !== 0)
      errors.push(`mandatory scenario failed: ${expected.id}`);
  }
  if (
    artifactHashes.length === 0 ||
    artifactHashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))
  )
    errors.push("valid artifact hashes are required");
  if (errors.length > 0)
    throw new Error(`Windows clean-room failed:\n${errors.join("\n")}`);
  return {
    schemaVersion: 1,
    gate: "clean-room:windows",
    status: "passed",
    environment: { platform, architecture, node },
    commit,
    artifactHashes: [...artifactHashes].sort(),
    mandatoryFailures: 0,
    mandatorySkips: 0,
    scenarios,
  };
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
  const scenarios = [];
  const artifactHashes = [];
  for (const scenario of windowsCleanRoomScenarios) {
    const outcome = execute(scenario);
    process.stderr.write(outcome.stdout ?? "");
    process.stderr.write(outcome.stderr ?? "");
    scenarios.push({
      id: scenario.id,
      command: scenario.command.join(" "),
      status: outcome.status === 0 ? "passed" : "failed",
      exitCode: outcome.status,
      ...(outcome.error ? { error: outcome.error } : {}),
    });
    if (scenario.id === "private-artifacts" && outcome.status === 0) {
      for (const match of (outcome.stdout ?? "").matchAll(
        /"sha256":"([a-f0-9]{64})"/g,
      ))
        artifactHashes.push(match[1]);
    }
    if (outcome.status !== 0) break;
  }
  const report = createWindowsCleanRoomReport({
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    commit: gitHead(),
    scenarios,
    artifactHashes,
  });
  report.environment = {
    ...report.environment,
    osRelease: release(),
    cpuCount: cpus().length,
    memoryBytes: totalmem(),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
