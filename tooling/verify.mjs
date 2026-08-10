import { spawnSync } from "node:child_process";

const pnpmPath = process.env.npm_execpath;

if (!pnpmPath) {
  throw new Error("pnpm must invoke the verify script");
}

for (const script of [
  "format:check",
  "lint",
  "typecheck",
  "test",
  "verify:goldens",
]) {
  const result = spawnSync(process.execPath, [pnpmPath, "run", script], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
