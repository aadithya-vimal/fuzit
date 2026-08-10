import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");

function runGit(arguments_, cwd = root) {
  const result = spawnSync("git", arguments_, {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || `git ${arguments_.join(" ")} failed`);
  return result.stdout.trim();
}

export function capturePublicationState(git = runGit) {
  return {
    head: git(["rev-parse", "HEAD"]),
    branch: git(["branch", "--show-current"]),
    tags: git(["tag", "--list"]),
    remotes: git(["remote", "-v"]),
    status: git(["status", "--porcelain", "--untracked-files=all"]),
  };
}

export function verifyBlockedDryRun({ before, after, exitCode, output }) {
  const errors = [];
  if (exitCode === 0) errors.push("guarded command unexpectedly succeeded");
  if (output?.gate !== "release:guarded")
    errors.push("guarded result identity missing");
  if (output?.executeRequested !== false)
    errors.push("execution was requested");
  if (
    output?.decision?.status !== "blocked" ||
    output?.decision?.publicationActionsPermitted !== false
  )
    errors.push("publication decision was not blocked");
  if (
    !Array.isArray(output?.actionsExecuted) ||
    output.actionsExecuted.length !== 0
  )
    errors.push("publication actions were executed");
  for (const field of ["head", "branch", "tags", "remotes", "status"]) {
    if (before[field] !== after[field])
      errors.push(`${field} changed during guarded dry-run`);
  }
  if (errors.length > 0)
    throw new Error(
      `Guarded workflow verification failed:\n${errors.join("\n")}`,
    );
  return {
    schemaVersion: 1,
    status: "passed",
    publicationDecision: "blocked",
    actionsExecuted: [],
    gitState: "unchanged",
    remoteState: "unchanged",
    head: before.head,
    branch: before.branch,
  };
}

export function sanitizedEnvironment(environment = process.env) {
  const result = { ...environment, FUZIT_RELEASE_AUTHORIZATION: "" };
  for (const key of [
    "NPM_TOKEN",
    "NODE_AUTH_TOKEN",
    "VSCE_PAT",
    "GITHUB_TOKEN",
    "GH_TOKEN",
  ])
    delete result[key];
  return result;
}

async function main() {
  const before = capturePublicationState();
  const result = spawnSync(process.execPath, ["scripts/guarded-release.mjs"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    env: sanitizedEnvironment(),
  });
  let output;
  try {
    output = JSON.parse(result.stdout);
  } catch {
    throw new Error("guarded command did not emit structured JSON");
  }
  const after = capturePublicationState();
  process.stdout.write(
    `${JSON.stringify(verifyBlockedDryRun({ before, after, exitCode: result.status, output }), null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
