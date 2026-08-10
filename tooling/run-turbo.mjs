import { spawnSync } from "node:child_process";

const pnpmPath = process.env.npm_execpath;

if (!pnpmPath) {
  throw new Error("pnpm must invoke the Turborepo wrapper");
}

const result = spawnSync(
  process.execPath,
  [pnpmPath, "exec", "turbo", ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      TURBO_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
