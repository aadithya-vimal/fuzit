import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { runCli } from "fuzit";

describe("fuzit watch CLI command", () => {
  it("executes fuzit watch --status --json returning valid watcher status object", async () => {
    const testRepo = resolve("tests/watcher/tmp-cli-status-repo");
    await rm(testRepo, { recursive: true, force: true });
    await mkdir(join(testRepo, "src"), { recursive: true });
    await writeFile(join(testRepo, "src/index.ts"), "const a = 1;");

    let stdout = "";
    const exitCode = await runCli(
      ["watch", "--root", testRepo, "--status", "--json"],
      {
        writeOut: (data) => {
          stdout += data;
        },
        writeErr: () => {},
      },
    );

    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout);
    const parsed = envelope.data ?? envelope;
    expect(parsed.contractVersion).toBe(1);
    expect(parsed.state).toBe("stopped");

    await rm(testRepo, { recursive: true, force: true });
  });

  it("executes fuzit watch --once cleanly", async () => {
    const testRepo = resolve("tests/watcher/tmp-cli-once-repo");
    await rm(testRepo, { recursive: true, force: true });
    await mkdir(join(testRepo, "src"), { recursive: true });
    await writeFile(join(testRepo, "src/index.ts"), "const a = 1;");

    let stdout = "";
    const exitCode = await runCli(
      ["watch", "--root", testRepo, "--once", "--json"],
      {
        writeOut: (data) => {
          stdout += data;
        },
        writeErr: () => {},
      },
    );

    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout);
    const parsed = envelope.data ?? envelope;
    expect(parsed.status).toBe("complete");
    expect(parsed.mode).toBe("once");

    await rm(testRepo, { recursive: true, force: true });
  });
});
