import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".");

export const guardedReleasePlan = Object.freeze([
  {
    phase: "gate",
    id: "acceptance",
    command: "pnpm",
    arguments: ["acceptance:v1"],
  },
  {
    phase: "gate",
    id: "artifacts",
    command: "pnpm",
    arguments: ["artifacts:verify"],
  },
  {
    phase: "gate",
    id: "simulation",
    command: "pnpm",
    arguments: ["release:dry-run"],
  },
  {
    phase: "publish",
    id: "cli",
    command: "pnpm",
    arguments: ["--dir", "apps/cli", "publish", "--access", "public"],
  },
  {
    phase: "publish",
    id: "mcp",
    command: "pnpm",
    arguments: ["--dir", "apps/mcp-server", "publish", "--access", "public"],
  },
  {
    phase: "publish",
    id: "plugin-sdk",
    command: "pnpm",
    arguments: [
      "--dir",
      "packages/plugin-sdk",
      "publish",
      "--access",
      "public",
    ],
  },
  {
    phase: "publish",
    id: "vscode",
    command: "pnpm",
    arguments: ["--dir", "apps/vscode-extension", "exec", "vsce", "publish"],
  },
  {
    phase: "tag",
    id: "git-tag",
    command: "git",
    arguments: [
      "tag",
      "--annotate",
      "v{version}",
      "--message",
      "Fuzit v{version}",
      "{commit}",
    ],
  },
  {
    phase: "release",
    id: "github-release",
    command: "gh",
    arguments: [
      "release",
      "create",
      "v{version}",
      "--verify-tag",
      "--title",
      "Fuzit v{version}",
    ],
  },
]);

const requiredCredentials = Object.freeze([
  "NPM_TOKEN",
  "VSCE_PAT",
  "GITHUB_TOKEN",
]);

export function evaluateReleaseAuthorization({
  state,
  environment,
  head,
  version,
  branch,
  dirtyPaths = [],
}) {
  const reasons = [];
  const authorization = state.releaseAuthorization;
  if (state.publicationAuthorized !== true)
    reasons.push("publicationAuthorized is not true");
  if (state.publicationPaused === true) reasons.push("publication is paused");
  for (const blocker of state.releaseBlockers ?? []) {
    if (blocker.status === "open")
      reasons.push(`open release blocker: ${blocker.id}`);
  }
  if (!authorization?.approvedSourceCommit)
    reasons.push("owner-approved source commit is absent");
  if (!authorization || authorization.approvedVersion !== version)
    reasons.push("owner-approved version does not match candidate");
  if (authorization?.approvedBranch !== branch)
    reasons.push("owner-approved branch does not match current branch");
  const expectedPhrase = `publish:${version}:${head}`;
  if (environment.FUZIT_RELEASE_AUTHORIZATION !== expectedPhrase)
    reasons.push("explicit release authorization phrase is absent or invalid");
  for (const credential of requiredCredentials) {
    if (!environment[credential])
      reasons.push(`missing credential: ${credential}`);
  }
  if (dirtyPaths.length > 0) reasons.push("working tree is not clean");
  return {
    schemaVersion: 1,
    status: reasons.length === 0 ? "authorized" : "blocked",
    head,
    version,
    branch,
    requiredCredentials: [...requiredCredentials],
    reasons,
    publicationActionsPermitted: reasons.length === 0,
  };
}

export function materializeReleasePlan({ version, commit }) {
  return guardedReleasePlan.map((step) => ({
    ...step,
    arguments: step.arguments.map((value) =>
      value.replaceAll("{version}", version).replaceAll("{commit}", commit),
    ),
  }));
}

export function executeGuardedPlan({ decision, plan, execute }) {
  if (decision.status !== "authorized" || !decision.publicationActionsPermitted)
    throw new Error("guarded release is not authorized");
  const results = [];
  for (const step of plan) {
    const outcome = execute(step);
    results.push({
      id: step.id,
      phase: step.phase,
      exitCode: outcome.status ?? 1,
    });
    if (outcome.status !== 0) break;
  }
  return {
    status:
      results.length === plan.length &&
      results.every(({ exitCode }) => exitCode === 0)
        ? "complete"
        : "failed",
    results,
  };
}

function git(...arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function execute(step) {
  const executable = step.command === "pnpm" ? process.execPath : step.command;
  const arguments_ =
    step.command === "pnpm"
      ? [process.env.npm_execpath, ...step.arguments]
      : step.arguments;
  const result = spawnSync(executable, arguments_, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    timeout: 30 * 60 * 1000,
  });
  return { status: result.status ?? 1 };
}

async function main() {
  const executeRequested = process.argv.includes("--execute");
  const state = JSON.parse(
    await readFile(resolve(root, "docs/release/release-state.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const head = git("rev-parse", "HEAD");
  const version = manifest.version;
  const decision = evaluateReleaseAuthorization({
    state,
    environment: process.env,
    head,
    version,
    branch: git("branch", "--show-current"),
    dirtyPaths: git("status", "--porcelain", "--untracked-files=all")
      .split(/\r?\n/)
      .filter(Boolean),
  });
  if (!executeRequested || decision.status !== "authorized") {
    process.stdout.write(
      `${JSON.stringify({ gate: "release:guarded", executeRequested, decision, actionsExecuted: [] })}\n`,
    );
    process.exitCode = 1;
    return;
  }
  const result = executeGuardedPlan({
    decision,
    plan: materializeReleasePlan({ version, commit: head }),
    execute,
  });
  process.stdout.write(
    `${JSON.stringify({ gate: "release:guarded", decision, result })}\n`,
  );
  if (result.status !== "complete") process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
