/**
 * GitHub provider acceptance test runner.
 *
 * Exercises the complete GitHub provider workflow with sanitized fixtures.
 * Grows as GH checkpoints are completed.
 */

import { execFileSync } from "node:child_process";

try {
  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.workspace.ts",
      "tests/acceptance/github",
    ],
    { stdio: "inherit" },
  );
  process.stdout.write("acceptance:github: all scenarios passed\n");
} catch (error) {
  process.stderr.write(`acceptance:github failed: ${error.message}\n`);
  process.exit(1);
}
