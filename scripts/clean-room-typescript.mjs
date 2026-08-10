import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");
export const expectedTypeScriptFindings = Object.freeze([
  "scan",
  "context",
  "watch --once",
  "graph stats",
  "snapshot create",
  "diff",
  "plugin validate",
  "mcp initialize",
  "mcp tools/list",
  "plugin sdk compile",
]);

export function createTypeScriptValidationReport({ commit, packageResult }) {
  const observed = Array.isArray(packageResult?.commands)
    ? packageResult.commands
    : [];
  const missing = expectedTypeScriptFindings.filter(
    (finding) => !observed.includes(finding),
  );
  const errors = [];
  if (packageResult?.localInstall !== "ok")
    errors.push("public package install did not pass");
  if (packageResult?.packageContents !== "audited")
    errors.push("package contents were not audited");
  if (missing.length > 0)
    errors.push(`missing observed findings: ${missing.join(", ")}`);
  if (errors.length > 0)
    throw new Error(
      `TypeScript application validation failed:\n${errors.join("\n")}`,
    );
  return {
    schemaVersion: 1,
    gate: "clean-room:typescript-application",
    status: "passed",
    commit,
    fixture: "generated-sanitized-typescript-application",
    expectedFindings: [...expectedTypeScriptFindings],
    observedFindings: [...expectedTypeScriptFindings],
    publicTarballs: packageResult.tarballs,
    failures: 0,
    skips: 0,
    publicationActions: [],
  };
}

function run(command, arguments_) {
  const executable = command === "pnpm" ? process.execPath : command;
  const effectiveArguments =
    command === "pnpm" ? [process.env.npm_execpath, ...arguments_] : arguments_;
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
  if (result.status !== 0)
    throw new Error(
      `${command} ${arguments_.join(" ")} failed:\n${result.stderr}\n${result.stdout}`,
    );
  return result.stdout.trim();
}

async function main() {
  const packageOutput = run("pnpm", ["package:smoke"]);
  process.stderr.write(`${packageOutput}\n`);
  const packageResult = JSON.parse(
    packageOutput
      .split(/\r?\n/)
      .filter((line) => line.startsWith("{"))
      .at(-1),
  );
  const commit = run("git", ["rev-parse", "HEAD"]);
  process.stdout.write(
    `${JSON.stringify(createTypeScriptValidationReport({ commit, packageResult }), null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
