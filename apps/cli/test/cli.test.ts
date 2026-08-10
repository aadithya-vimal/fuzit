import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CLI_USAGE_ERROR_EXIT_CODE, CLI_VERSION, runCli } from "../src/cli.js";

interface CapturedRun {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function captureRun(arguments_: readonly string[]): Promise<CapturedRun> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(arguments_, {
    writeOut: (value) => {
      stdout += value;
    },
    writeErr: (value) => {
      stderr += value;
    },
  });

  return { exitCode, stdout, stderr };
}

describe("fuzit process shell", () => {
  it("matches the help golden output", async () => {
    const goldenPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "golden",
      "help.txt",
    );
    const golden = await readFile(goldenPath, "utf8");

    expect(await captureRun(["--help"])).toEqual({
      exitCode: 0,
      stdout: golden,
      stderr: "",
    });
  });

  it("prints the package version", async () => {
    expect(await captureRun(["--version"])).toEqual({
      exitCode: 0,
      stdout: `${CLI_VERSION}\n`,
      stderr: "",
    });
  });

  it("returns a deterministic nonzero status for an unknown command", async () => {
    expect(await captureRun(["unknown"])).toEqual({
      exitCode: CLI_USAGE_ERROR_EXIT_CODE,
      stdout: "",
      stderr: "error CLI.UNKNOWN_COMMAND: unknown command 'unknown'\n",
    });
  });

  it("rejects quiet and debug together", async () => {
    const result = await captureRun(["--quiet", "--debug"]);

    expect(result.exitCode).toBe(CLI_USAGE_ERROR_EXIT_CODE);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "option '--quiet' cannot be used with option '--debug'",
    );
  });

  it("emits a stable JSON error envelope", async () => {
    expect(await captureRun(["--json", "unknown"])).toEqual({
      exitCode: CLI_USAGE_ERROR_EXIT_CODE,
      stdout: `{"schemaVersion":1,"diagnostics":[{"schemaVersion":1,"code":"CLI.UNKNOWN_COMMAND","severity":"error","source":"cli","message":"unknown command 'unknown'"}]}\n`,
      stderr: "",
    });
  });

  it("shows effective configuration and provenance as JSON", async () => {
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["config", "show", "--json"],
      {
        writeOut: (value) => {
          stdout += value;
        },
        writeErr: (value) => {
          stderr += value;
        },
      },
      {
        repositoryRoot: dirname(fileURLToPath(import.meta.url)),
        environment: {},
      },
    );

    expect({ exitCode, stdout, stderr }).toEqual({
      exitCode: 0,
      stdout:
        '{"schemaVersion":1,"values":{"outputFormat":"markdown","maxFiles":120,"diagnosticLevel":"info","include":[],"exclude":[]},"provenance":{"outputFormat":"default","maxFiles":"default","diagnosticLevel":"default","include":"default","exclude":"default"}}\n',
      stderr: "",
    });
  });
});
