import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(".");
const temporary = await mkdtemp(join(tmpdir(), "fuzit-privacy-"));
const protectedValue = ["PRIVATE", "FIXTURE", "VALUE", "123456789"].join("_");
function run(command, arguments_, options = {}) {
  const executable =
    command === "pnpm" || command === "node" ? process.execPath : command;
  const safeArguments =
    command === "pnpm" ? [process.env.npm_execpath, ...arguments_] : arguments_;
  const result = spawnSync(executable, safeArguments, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: false,
  });
  if (!(options.acceptedStatuses ?? [0]).includes(result.status))
    throw new Error(`${command} failed: ${result.stderr}`);
  const output = `${result.stdout}${result.stderr}`;
  if (output.includes(protectedValue) || output.includes(temporary))
    throw new Error(
      "Privacy audit found a protected value or private absolute path.",
    );
  return output;
}
try {
  await writeFile(join(temporary, "secret.txt"), `token=${protectedValue}\n`);
  run("pnpm", [
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
    "tests/security/network",
  ]);
  run("node", [join(root, "apps/cli/dist/bin.js"), "--help"], {
    cwd: temporary,
  });
  run(
    "node",
    [join(root, "apps/cli/dist/bin.js"), "--json", "profile", "list"],
    { cwd: temporary },
  );
  run("node", [join(root, "apps/cli/dist/bin.js"), "unknown"], {
    cwd: temporary,
    acceptedStatuses: [2],
  });
  const remote = run("git", ["config", "--get", "remote.origin.url"], {
    cwd: root,
    acceptedStatuses: [0, 1],
  });
  if (/https?:\/\/[^/\s:@]+:[^/\s@]+@/u.test(remote))
    throw new Error("Credential-bearing Git remote URL detected.");
  process.stdout.write(
    `${JSON.stringify({ network: "denied", debugJsonCrashOutputs: "clean", gitRemoteCredentials: "absent" })}\n`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
