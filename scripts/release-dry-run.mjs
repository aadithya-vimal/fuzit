import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");

export const releaseDryRunPlan = Object.freeze([
  {
    id: "install",
    command: "pnpm",
    arguments: ["install", "--offline", "--frozen-lockfile"],
  },
  { id: "build", command: "pnpm", arguments: ["build"] },
  { id: "pack-and-verify", command: "pnpm", arguments: ["artifacts:verify"] },
  { id: "docs-build", command: "pnpm", arguments: ["docs:build"] },
  { id: "docs-check", command: "pnpm", arguments: ["docs:check"] },
  { id: "docs-tests", command: "pnpm", arguments: ["test:docs"] },
]);

export function assertSafeReleasePlan(plan) {
  const forbidden =
    /(^|:|\s)(publish|deploy|tag|push|release|login|token)(:|\s|$)/i;
  for (const step of plan) {
    const rendered = [step.command, ...step.arguments].join(" ");
    if (forbidden.test(rendered))
      throw new Error(`release dry-run forbids mutation command: ${rendered}`);
  }
  return plan;
}

export function executeReleasePlan(plan, execute) {
  assertSafeReleasePlan(plan);
  const results = [];
  for (const step of plan) {
    const outcome = execute(step);
    results.push({
      id: step.id,
      command: [step.command, ...step.arguments].join(" "),
      exitCode: outcome.status ?? 1,
      status: outcome.status === 0 ? "passed" : "failed",
    });
    if (outcome.status !== 0) break;
  }
  return {
    status:
      results.length === plan.length &&
      results.every(({ exitCode }) => exitCode === 0)
        ? "passed"
        : "failed",
    results,
  };
}

function safeEnvironment() {
  const environment = { ...process.env, NPM_CONFIG_OFFLINE: "true" };
  for (const key of Object.keys(environment)) {
    if (/(npm|node|registry).*(token|auth)|token.*(npm|registry)/i.test(key))
      delete environment[key];
  }
  return environment;
}

function run(step, cwd) {
  const executable = step.command === "pnpm" ? process.execPath : step.command;
  const arguments_ =
    step.command === "pnpm"
      ? [process.env.npm_execpath, ...step.arguments]
      : step.arguments;
  if (step.command === "pnpm" && !process.env.npm_execpath)
    return { status: 1 };
  const result = spawnSync(executable, arguments_, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    timeout: 15 * 60 * 1000,
    env: safeEnvironment(),
  });
  return { status: result.status ?? 1 };
}

async function versionCandidate(directory, version) {
  const packagePaths = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name === "package.json") packagePaths.push(path);
    }
  }
  for (const area of ["apps", "packages"]) await visit(join(directory, area));
  for (const path of packagePaths.sort()) {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    if (manifest.name?.startsWith("@fuzit/")) {
      manifest.version = version;
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }
  const changelog = await readFile(join(directory, "CHANGELOG.md"), "utf8");
  await writeFile(
    join(directory, "CHANGELOG.md"),
    changelog.replace(
      "0.0.0 — Unreleased private alpha",
      `${version} — dry-run candidate`,
    ),
  );
  return packagePaths.length;
}

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), "fuzit-release-dry-run-"));
  const archive = join(temporary, "source.tar");
  const candidate = join(temporary, "candidate");
  try {
    const archiveResult = spawnSync(
      "git",
      ["archive", "--format=tar", "-o", archive, "HEAD"],
      {
        cwd: root,
        encoding: "utf8",
        shell: false,
      },
    );
    if (archiveResult.status !== 0) throw new Error(archiveResult.stderr);
    await cp(root, candidate, {
      recursive: true,
      filter: (source) => source === root,
    });
    const extract = spawnSync("tar", ["-xf", archive, "-C", candidate], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    if (extract.status !== 0) throw new Error(extract.stderr);
    await cp(join(root, "package.json"), join(candidate, "package.json"));
    await cp(
      import.meta.filename,
      join(candidate, "scripts", "release-dry-run.mjs"),
    );
    await cp(
      join(root, "scripts", "package-smoke.mjs"),
      join(candidate, "scripts", "package-smoke.mjs"),
    );
    await mkdir(join(candidate, ".github", "workflows"), { recursive: true });

    const version = "0.0.1";
    const versionedPackages = await versionCandidate(candidate, version);
    for (const arguments_ of [
      ["init", "--quiet"],
      ["config", "user.name", "Fuzit Release Dry Run"],
      ["config", "user.email", "dry-run@fuzit.invalid"],
      ["add", "--all"],
      ["commit", "--quiet", "-m", "private release candidate"],
    ]) {
      const result = spawnSync("git", arguments_, {
        cwd: candidate,
        encoding: "utf8",
        shell: false,
      });
      if (result.status !== 0) throw new Error(result.stderr);
    }
    const execution = executeReleasePlan(releaseDryRunPlan, (step) =>
      run(step, candidate),
    );
    const report = {
      schemaVersion: 1,
      gate: "release:dry-run",
      status: execution.status,
      version,
      versionedPackages,
      isolation: "temporary-copy",
      networkPublication: "none",
      registryCredentials: "not-required",
      gitTagsCreated: 0,
      publicationActions: [],
      candidates: "private-temporary",
      results: execution.results,
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (execution.status !== "passed") process.exitCode = 1;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
